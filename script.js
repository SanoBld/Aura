/* AURA — script.js v6
   ─────────────────────────────────────────────────────────────────────────────
   CHANGES vs v5:
   · [data-lyrics-font] buttons wired (was broken — used select ref that doesn't exist)
   · Marquee speed: dir=rtl removed; CSS var maps high=fast via (70-value)s
   · Fluid gradient: always shows with fallback palette when no art is loaded
   · Album ctx-menu: Last.fm + Share only (no like/copy). Wired from HTML directly.
   · injectAlbumHoverMenu() removed (was duplicating HTML ctx-menu)
   · checkTitleOverflow(): auto-scrolling marquee when title overflows container
   · S.albumAnim + body.album-anim for artwork float animation toggle
   · New bg animation modes: legere / energique / flottante (body class switching)
   · [data-fps] buttons wired
   · All sliders update their sp-slider-val % displays
   · generateShareImage() kept; openLastFmPage() added for ctx-btn-lastfm
   ─────────────────────────────────────────────────────────────────────────────
*/

/* ---- STATE ---- */
let apiKey = '', username = '', originalUser = '', currentTrack = null, artSlot = 'a', bgSlot = 'a';
let lyricsOpen = false, histOpen = false, settingsOpen = false;
let pollTimer = null, idleTimer = null, bgTimeout = null;
let trackStartTime = 0, trackDuration = 0, trackPausedAt = 0, progressRAF = null;
let currentTrackId = '';
let isPaused = false;
let zenMode = false;
let vizLastFrame = 0;

const S = {
  blur: 70, brightness: 55, saturate: 14,
  bgMode: 'album', showArt: true, showBg: true, showAvatar: true,
  showMarquee: true, defaultPanel: 'lyrics', accentColor: '#e0245e',
  artShape: '22px', marqueeSpeed: 32, showGlow: true, showGrain: false,
  autoScroll: true, appleMode: false, showProgress: true,
  bgAnimation: 'none', fontChoice: 'default',
  vinylMode: false, colorThief: false, fluidGradient: false,
  eqViz: false, canvasViz: false,
  heroScale: 100, heroLayout: 'standard', heroAlign: 'center',
  lanyardId: '', sourcePriority: 'lanyard', vizFPS: 60,
  lyricsSize: 100, lyricsFontChoice: 'serif', lyricsAnim: true,
  albumAnim: true,
};

/* ---- DOM REFS ---- */
const $ = {
  login:           document.getElementById('s-login'),
  player:          document.getElementById('s-player'),
  loading:         document.getElementById('loading'),
  globalNoise:     document.getElementById('global-noise'),
  orbBg:           document.getElementById('orb-bg'),
  inUser:          document.getElementById('in-user'),
  inKey:           document.getElementById('in-key'),
  btnConnect:      document.getElementById('btn-connect'),
  cachedEntry:     document.getElementById('cached-entry'),
  cachedName:      document.getElementById('cached-name'),
  lError:          document.getElementById('l-error'),
  bgA:             document.getElementById('bg-a'),
  bgB:             document.getElementById('bg-b'),
  bgFilter:        document.getElementById('bg-filter'),
  artWrap:         document.getElementById('art-wrap'),
  artGlow:         document.getElementById('art-glow'),
  artA:            document.getElementById('art-a'),
  artB:            document.getElementById('art-b'),
  fbA:             document.getElementById('fallback-a'),
  fbB:             document.getElementById('fallback-b'),
  mq:              document.getElementById('mq'),
  mqWrap:          document.getElementById('mq-wrap'),
  title:           document.getElementById('track-title'),
  artist:          document.getElementById('track-artist'),
  artistRow:       document.getElementById('artist-row'),
  artistAvatar:    document.getElementById('artist-avatar'),
  avatarCircle:    document.getElementById('avatar-circle'),
  avatarFallback:  document.getElementById('avatar-fallback'),
  content:         document.getElementById('track-content'),
  progressBar:     document.getElementById('progress-bar'),
  noTrack:         document.getElementById('no-track'),
  hero:            document.getElementById('hero'),
  lyricsPanel:     document.getElementById('lyrics-panel'),
  lpBody:          document.getElementById('lp-body'),
  lpBadge:         document.getElementById('lp-badge'),
  lrcContainer:    document.getElementById('lrc-container'),
  histPanel:       document.getElementById('hist-panel'),
  hpList:          document.getElementById('hp-list'),
  settingsPanel:   document.getElementById('settings-panel'),
  ui:              document.getElementById('ui'),
  btnLyrics:       document.getElementById('btn-lyrics'),
  btnHist:         document.getElementById('btn-hist'),
  btnSettings:     document.getElementById('btn-settings'),
  btnFs:           document.getElementById('btn-fs'),
  btnLogout:       document.getElementById('btn-logout'),
  stDot:           document.getElementById('st-dot'),
  stText:          document.getElementById('st-text'),
  displayUsername: document.getElementById('display-username'),
  fluidGradientBg: document.getElementById('fluid-gradient-bg'),
  // Settings controls
  setBlur:         document.getElementById('set-blur'),
  setBrightness:   document.getElementById('set-brightness'),
  setSaturate:     document.getElementById('set-saturate'),
  setBg:           document.getElementById('set-bg'),
  setArt:          document.getElementById('set-art'),
  setGlow:         document.getElementById('set-glow'),
  setAvatar:       document.getElementById('set-avatar'),
  setMarquee:      document.getElementById('set-marquee'),
  setGrain:        document.getElementById('set-grain'),
  setAutoscroll:   document.getElementById('set-autoscroll'),
  setMqSpeed:      document.getElementById('set-mq-speed'),
  userSearch:      document.getElementById('user-search'),
  setAppleMode:    document.getElementById('set-apple-mode'),
  setShowProgress: document.getElementById('set-show-progress'),
  setVinylMode:    document.getElementById('set-vinyl-mode'),
  setColorThief:   document.getElementById('set-color-thief'),
  setFluidGradient:document.getElementById('set-fluid-gradient'),
  setEqViz:        document.getElementById('set-eq-viz'),
  setCanvasViz:    document.getElementById('set-canvas-viz'),
  setHeroScale:    document.getElementById('set-hero-scale'),
  layoutDesc:      document.getElementById('layout-desc'),
  priorityDesc:    document.getElementById('priority-desc'),
  setLanyardId:    document.getElementById('set-lanyard-id'),
  btnLanyardConnect: document.getElementById('btn-lanyard-connect'),
  lanyardDot:      document.getElementById('lanyard-dot'),
  lanyardStatusText: document.getElementById('lanyard-status-text'),
  lanyardWsBadge:  document.getElementById('lanyard-ws-badge'),
  btnLanyardStatus:document.getElementById('btn-lanyard-status'),
  lanyardBadge:    document.getElementById('lanyard-badge'),
  setLyricsSize:   document.getElementById('set-lyrics-size'),
  setLyricsSizeVal:document.getElementById('set-lyrics-size-val'),
  setLyricsAnim:   document.getElementById('set-lyrics-anim'),
  setAlbumAnim:    document.getElementById('set-album-anim'),
  vizCanvas:       document.getElementById('viz-canvas'),
  // Slider value displays
  valBlur:         document.getElementById('val-blur'),
  valBrightness:   document.getElementById('val-brightness'),
  valSaturate:     document.getElementById('val-saturate'),
  valMqSpeed:      document.getElementById('val-mq-speed'),
  valHeroScale:    document.getElementById('val-hero-scale'),
  // Album ctx buttons (from HTML)
  ctxBtnLastfm:    document.getElementById('ctx-btn-lastfm'),
  ctxBtnShare:     document.getElementById('ctx-btn-share'),
};

/* ---- CACHE / PERSISTENCE ---- */
function saveCache() {
  try { localStorage.setItem('aura_user', originalUser); localStorage.setItem('aura_key', apiKey); } catch(e) {}
}
function loadCache() {
  try { return { u: localStorage.getItem('aura_user') || '', k: localStorage.getItem('aura_key') || '' }; }
  catch(e) { return { u: '', k: '' }; }
}
function clearCache() {
  try { localStorage.removeItem('aura_user'); localStorage.removeItem('aura_key'); } catch(e) {}
}
function saveSettings() {
  try { localStorage.setItem('aura_settings', JSON.stringify(S)); } catch(e) {}
}
function loadSettings() {
  try {
    const raw = localStorage.getItem('aura_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      for (const key in parsed) {
        if (Object.prototype.hasOwnProperty.call(S, key) && typeof parsed[key] === typeof S[key]) S[key] = parsed[key];
      }
    }
  } catch(e) {}
}

/* ---- LRC CACHE — TTL 7 days, max 50 entries ---- */
function lrcCacheKey(artist, title) {
  try { return 'aura_lrc_' + btoa(unescape(encodeURIComponent((artist + '|' + title).toLowerCase()))); }
  catch { return 'aura_lrc_' + (artist + title).replace(/\W/g, '').slice(0, 60); }
}
function getLRCCache(artist, title) {
  try {
    const data = JSON.parse(localStorage.getItem(lrcCacheKey(artist, title)) || 'null');
    if (data && (Date.now() - data.cachedAt) < 7 * 24 * 3600 * 1000) return data;
    return null;
  } catch { return null; }
}
function setLRCCache(artist, title, data) {
  try { gcLRCCache(); localStorage.setItem(lrcCacheKey(artist, title), JSON.stringify({ ...data, cachedAt: Date.now() })); } catch {}
}
function gcLRCCache() {
  try {
    const prefix = 'aura_lrc_', TTL = 7 * 24 * 3600 * 1000, keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
    const entries = [];
    for (const k of keys) {
      try {
        const d = JSON.parse(localStorage.getItem(k));
        if (!d || (Date.now() - d.cachedAt) > TTL) localStorage.removeItem(k);
        else entries.push({ k, t: d.cachedAt });
      } catch { localStorage.removeItem(k); }
    }
    if (entries.length > 50) {
      entries.sort((a, b) => a.t - b.t);
      entries.slice(0, entries.length - 50).forEach(e => localStorage.removeItem(e.k));
    }
  } catch {}
}

/* ---- SETTINGS TABS ---- */
document.querySelectorAll('.sp-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.sp-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.sp-tab-pane').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const target = document.getElementById('tab-' + tab.dataset.tab);
    if (target) target.classList.add('active');
  });
});

/* ============================================================
   SLIDER HELPERS
   ============================================================ */
function updateSliderFill(el) {
  if (!el) return;
  el.style.setProperty('--pct', ((el.value - el.min) / (el.max - el.min) * 100) + '%');
}
function pctLabel(value, min, max) {
  return Math.round(((value - min) / (max - min)) * 100) + '%';
}

/* ---- APPLY SETTINGS ---- */
function applySettings() {
  document.documentElement.style.setProperty('--accent', S.accentColor);
  document.querySelectorAll('[data-color]').forEach(b => b.classList.toggle('active', b.dataset.color === S.accentColor));

  document.documentElement.style.setProperty('--blur-amount', S.blur + 'px');
  document.documentElement.style.setProperty('--bg-brightness', (S.brightness / 100).toFixed(2));
  document.documentElement.style.setProperty('--bg-saturate', (S.saturate / 10).toFixed(2));

  if ($.setBlur)       { $.setBlur.value       = S.blur;          updateSliderFill($.setBlur); }
  if ($.setBrightness) { $.setBrightness.value  = S.brightness;   updateSliderFill($.setBrightness); }
  if ($.setSaturate)   { $.setSaturate.value    = S.saturate;     updateSliderFill($.setSaturate); }
  if ($.setMqSpeed)    { $.setMqSpeed.value     = S.marqueeSpeed; updateSliderFill($.setMqSpeed); }

  /* Marquee speed: high slider value = fast = short duration.
     Formula: (70 − value)s → at max 60 → 10s (fast), at min 10 → 60s (slow). */
  document.documentElement.style.setProperty('--mq-speed', (70 - S.marqueeSpeed) + 's');

  /* % value labels */
  if ($.valBlur)       $.valBlur.textContent       = pctLabel(S.blur,          0,  120);
  if ($.valBrightness) $.valBrightness.textContent = pctLabel(S.brightness,   10,   90);
  if ($.valSaturate)   $.valSaturate.textContent   = pctLabel(S.saturate,      0,   30);
  if ($.valMqSpeed)    $.valMqSpeed.textContent    = pctLabel(S.marqueeSpeed, 10,   60);
  if ($.valHeroScale)  $.valHeroScale.textContent  = S.heroScale + '%';

  /* Toggles */
  const t = (ref, val) => { if (ref) ref.checked = val; };
  t($.setBg,           S.showBg);
  t($.setArt,          S.showArt);
  t($.setGlow,         S.showGlow);
  t($.setAvatar,       S.showAvatar);
  t($.setMarquee,      S.showMarquee);
  t($.setGrain,        S.showGrain);
  t($.setAutoscroll,   S.autoScroll);
  t($.setAppleMode,    S.appleMode);
  t($.setShowProgress, S.showProgress);
  t($.setVinylMode,    S.vinylMode);
  t($.setColorThief,   S.colorThief);
  t($.setFluidGradient,S.fluidGradient);
  t($.setEqViz,        S.eqViz);
  t($.setCanvasViz,    S.canvasViz);
  t($.setAlbumAnim,    S.albumAnim);

  /* Art / avatar visibility */
  $.artWrap.style.opacity        = S.showArt   ? '1' : '0';
  $.artGlow.style.display        = S.showGlow  ? 'block' : 'none';
  $.avatarCircle.style.display   = S.showAvatar ? '' : 'none';
  $.mqWrap.classList.toggle('hidden-mq', !S.showMarquee);
  $.globalNoise.classList.toggle('on', S.showGrain);

  const showBgImg = S.showBg && S.bgMode === 'album';
  $.bgA.style.display = showBgImg ? '' : 'none';
  $.bgB.style.display = showBgImg ? '' : 'none';

  if      (S.bgMode === 'dark')  $.bgFilter.style.background = 'rgba(0,0,0,.88)';
  else if (S.bgMode === 'color') $.bgFilter.style.background = 'rgba(10,5,20,.7)';
  else                            $.bgFilter.style.background = 'rgba(0,0,0,.35)';

  /* Art radius & button groups */
  document.documentElement.style.setProperty('--art-radius', S.artShape);
  document.querySelectorAll('[data-art-shape]').forEach(b => b.classList.toggle('active', b.dataset.artShape === S.artShape));
  document.querySelectorAll('[data-bg]').forEach(b        => b.classList.toggle('active', b.dataset.bg       === S.bgMode));
  document.querySelectorAll('[data-panel]').forEach(b     => b.classList.toggle('active', b.dataset.panel    === S.defaultPanel));
  document.querySelectorAll('[data-anim]').forEach(b      => b.classList.toggle('active', b.dataset.anim     === S.bgAnimation));
  document.querySelectorAll('[data-f]').forEach(b         => b.classList.toggle('active', b.dataset.f        === S.fontChoice));
  document.querySelectorAll('[data-fps]').forEach(b       => b.classList.toggle('active', parseInt(b.dataset.fps) === S.vizFPS));

  /* Body classes */
  document.body.classList.toggle('mode-apple',       S.appleMode);
  document.body.classList.toggle('show-progress',    S.showProgress);
  document.body.classList.toggle('album-anim',       S.albumAnim);
  document.body.classList.remove('f-inter', 'f-modern', 'f-serif', 'f-mono', 'f-default');
  document.body.classList.add('f-' + S.fontChoice);

  /* Orbs / bg animation */
  $.orbBg.style.opacity = (S.bgAnimation === 'blobs') ? '1' : '0';
  document.body.classList.remove('bg-legere', 'bg-energique', 'bg-flottante');
  if (S.bgAnimation === 'legere')    document.body.classList.add('bg-legere');
  if (S.bgAnimation === 'energique') document.body.classList.add('bg-energique');
  if (S.bgAnimation === 'flottante') document.body.classList.add('bg-flottante');

  /* Vinyl */
  $.artWrap.classList.toggle('vinyl', S.vinylMode);

  /* EQ / Canvas viz */
  document.body.classList.toggle('show-eq',          S.eqViz);
  document.body.classList.toggle('show-canvas-viz',  S.canvasViz);
  if (!S.fluidGradient && $.fluidGradientBg) $.fluidGradientBg.classList.remove('on');

  /* FPS row */
  const fpsRow = document.getElementById('sp-fps-row');
  if (fpsRow) fpsRow.classList.toggle('fps-visible', S.canvasViz);

  /* Lanyard */
  if ($.setLanyardId) $.setLanyardId.value = S.lanyardId || '';

  /* Hero scale */
  const scale = (S.heroScale || 100) / 100;
  document.documentElement.style.setProperty('--hero-scale', scale);
  if ($.setHeroScale) { $.setHeroScale.value = S.heroScale; updateSliderFill($.setHeroScale); }

  /* Hero layout */
  document.body.classList.remove('hero-minimal');
  if (S.heroLayout === 'minimal') document.body.classList.add('hero-minimal');
  document.querySelectorAll('[data-layout]').forEach(b => b.classList.toggle('active', b.dataset.layout === S.heroLayout));
  updateLayoutDesc();

  /* Hero align */
  document.body.classList.remove('hero-left', 'hero-right');
  if (S.heroAlign === 'left')  document.body.classList.add('hero-left');
  if (S.heroAlign === 'right') document.body.classList.add('hero-right');
  document.querySelectorAll('[data-align]').forEach(b => b.classList.toggle('active', b.dataset.align === S.heroAlign));

  applyLyricsSettings();
}

/* ---- LYRICS SETTINGS ---- */
function applyLyricsSettings() {
  const size = S.lyricsSize || 100;
  /* --lyrics-size is a float multiplier: 100 → 1.0, 150 → 1.5 */
  document.documentElement.style.setProperty('--lyrics-size', (size / 100).toFixed(2));

  if ($.setLyricsSize) { $.setLyricsSize.value = size; updateSliderFill($.setLyricsSize); }
  if ($.setLyricsSizeVal) $.setLyricsSizeVal.textContent = size + '%';

  /* Font — button group */
  const fc = S.lyricsFontChoice || 'serif';
  document.body.classList.remove('lf-default', 'lf-serif', 'lf-sans', 'lf-mono', 'lf-display');
  document.body.classList.add('lf-' + fc);
  document.querySelectorAll('[data-lyrics-font]').forEach(b =>
    b.classList.toggle('active', b.dataset.lyricsFont === fc)
  );

  /* Animation */
  document.body.classList.toggle('lyrics-anim-off', !S.lyricsAnim);
  if ($.setLyricsAnim) $.setLyricsAnim.checked = S.lyricsAnim;
}

function updateLayoutDesc() {
  if (!$.layoutDesc) return;
  $.layoutDesc.textContent = S.heroLayout === 'minimal'
    ? 'Juste une barre de progression et le nom du titre.'
    : 'Affichage complet avec pochette et infos de la piste.';
}

/* ---- SETTINGS EVENT LISTENERS ---- */
if ($.setBlur)       $.setBlur.addEventListener('input',       () => { S.blur         = parseInt($.setBlur.value);        applySettings(); saveSettings(); });
if ($.setBrightness) $.setBrightness.addEventListener('input', () => { S.brightness   = parseInt($.setBrightness.value);  applySettings(); saveSettings(); });
if ($.setSaturate)   $.setSaturate.addEventListener('input',   () => { S.saturate     = parseInt($.setSaturate.value);    applySettings(); saveSettings(); });
if ($.setMqSpeed)    $.setMqSpeed.addEventListener('input',    () => { S.marqueeSpeed = parseInt($.setMqSpeed.value);     applySettings(); saveSettings(); });
if ($.setHeroScale)  $.setHeroScale.addEventListener('input',  () => { S.heroScale    = parseInt($.setHeroScale.value);   applySettings(); saveSettings(); });

const boolToggle = (ref, key) => { if (ref) ref.addEventListener('change', () => { S[key] = ref.checked; applySettings(); saveSettings(); }); };
boolToggle($.setBg,           'showBg');
boolToggle($.setArt,          'showArt');
boolToggle($.setGlow,         'showGlow');
boolToggle($.setAvatar,       'showAvatar');
boolToggle($.setMarquee,      'showMarquee');
boolToggle($.setGrain,        'showGrain');
boolToggle($.setAutoscroll,   'autoScroll');
boolToggle($.setAppleMode,    'appleMode');
boolToggle($.setShowProgress, 'showProgress');
boolToggle($.setVinylMode,    'vinylMode');
boolToggle($.setAlbumAnim,    'albumAnim');

if ($.setColorThief) $.setColorThief.addEventListener('change', () => {
  S.colorThief = $.setColorThief.checked;
  if (!S.colorThief) document.documentElement.style.setProperty('--accent', S.accentColor);
  else if (currentTrack) triggerColorThief();
  saveSettings();
});
if ($.setFluidGradient) $.setFluidGradient.addEventListener('change', () => {
  S.fluidGradient = $.setFluidGradient.checked;
  if (!S.fluidGradient && $.fluidGradientBg) $.fluidGradientBg.classList.remove('on');
  else triggerColorThief();
  saveSettings();
});
if ($.setEqViz) $.setEqViz.addEventListener('change', () => { S.eqViz = $.setEqViz.checked; applySettings(); saveSettings(); });
if ($.setCanvasViz) $.setCanvasViz.addEventListener('change', () => {
  S.canvasViz = $.setCanvasViz.checked;
  applySettings();
  if (S.canvasViz) startCanvasViz(); else stopCanvasViz();
  saveSettings();
});

/* Lyrics font buttons */
document.querySelectorAll('[data-lyrics-font]').forEach(b => b.addEventListener('click', () => {
  S.lyricsFontChoice = b.dataset.lyricsFont;
  applyLyricsSettings(); saveSettings();
}));
/* Lyrics size */
if ($.setLyricsSize) $.setLyricsSize.addEventListener('input', () => {
  S.lyricsSize = parseInt($.setLyricsSize.value);
  applyLyricsSettings(); saveSettings();
});
/* Lyrics animation */
if ($.setLyricsAnim) $.setLyricsAnim.addEventListener('change', () => {
  S.lyricsAnim = $.setLyricsAnim.checked;
  applyLyricsSettings(); saveSettings();
});

/* Button groups */
document.querySelectorAll('[data-bg]').forEach(b        => b.addEventListener('click', () => { S.bgMode         = b.dataset.bg;        applySettings(); saveSettings(); }));
document.querySelectorAll('[data-panel]').forEach(b     => b.addEventListener('click', () => { S.defaultPanel   = b.dataset.panel;     applySettings(); saveSettings(); }));
document.querySelectorAll('[data-art-shape]').forEach(b => b.addEventListener('click', () => { S.artShape       = b.dataset.artShape;  applySettings(); saveSettings(); }));
document.querySelectorAll('[data-color]').forEach(b     => b.addEventListener('click', () => { S.accentColor    = b.dataset.color;     applySettings(); saveSettings(); }));
document.querySelectorAll('[data-anim]').forEach(b      => b.addEventListener('click', () => { S.bgAnimation    = b.dataset.anim;      applySettings(); saveSettings(); }));
document.querySelectorAll('[data-f]').forEach(b         => b.addEventListener('click', () => { S.fontChoice     = b.dataset.f;         applySettings(); saveSettings(); }));
document.querySelectorAll('[data-priority]').forEach(b  => b.addEventListener('click', () => { S.sourcePriority = b.dataset.priority;  applySettings(); saveSettings(); }));
document.querySelectorAll('[data-layout]').forEach(b    => b.addEventListener('click', () => { S.heroLayout     = b.dataset.layout;    applySettings(); saveSettings(); }));
document.querySelectorAll('[data-align]').forEach(b     => b.addEventListener('click', () => { S.heroAlign      = b.dataset.align;     applySettings(); saveSettings(); }));

/* FPS buttons */
document.querySelectorAll('[data-fps]').forEach(b => b.addEventListener('click', () => {
  S.vizFPS = parseInt(b.dataset.fps);
  document.querySelectorAll('[data-fps]').forEach(x => {
    x.classList.toggle('active', parseInt(x.dataset.fps) === S.vizFPS);
    x.setAttribute('aria-pressed', parseInt(x.dataset.fps) === S.vizFPS ? 'true' : 'false');
  });
  saveSettings();
}));

/* User search */
if ($.userSearch) {
  $.userSearch.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const target = $.userSearch.value.trim();
    username = target !== '' ? target : originalUser;
    setStatus('loading', target !== '' ? 'Viewing: ' + target : 'Back to you…');
    clearInterval(pollTimer);
    poll();
    pollTimer = setInterval(poll, 1000);
  });
}

/* Lanyard */
if ($.setLanyardId) {
  $.setLanyardId.addEventListener('input', () => { S.lanyardId = $.setLanyardId.value.trim(); saveSettings(); });
  $.setLanyardId.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    S.lanyardId = $.setLanyardId.value.trim(); saveSettings();
    if (S.lanyardId) lanyardConnect(S.lanyardId); else lanyardDisconnect();
  });
}
if ($.btnLanyardConnect) {
  $.btnLanyardConnect.addEventListener('click', () => {
    S.lanyardId = $.setLanyardId ? $.setLanyardId.value.trim() : ''; saveSettings();
    if ($.btnLanyardConnect.classList.contains('connected')) {
      lanyardDisconnect();
      $.btnLanyardConnect.textContent = 'Connecter';
      $.btnLanyardConnect.classList.remove('connected');
    } else if (S.lanyardId) {
      lanyardConnect(S.lanyardId);
      $.btnLanyardConnect.textContent = 'Déconnecter';
      $.btnLanyardConnect.classList.add('connected');
    }
  });
}

/* Album context menu */
if ($.ctxBtnLastfm) $.ctxBtnLastfm.addEventListener('click', (e) => { e.stopPropagation(); openLastFmPage(); });
if ($.ctxBtnShare)  $.ctxBtnShare.addEventListener('click',  (e) => { e.stopPropagation(); generateShareImage(); });

function openLastFmPage() {
  if (!currentTrack) return;
  const artist = currentTrack.artist?.name || currentTrack.artist?.['#text'] || '';
  const title  = currentTrack.name || '';
  window.open(`https://www.last.fm/music/${encodeURIComponent(artist)}/_/${encodeURIComponent(title)}`, '_blank', 'noopener');
}

/* ---- ERROR DISPLAY ---- */
function showError(msg) { $.lError.textContent = msg; $.lError.classList.add('on'); }
function clearError()   { $.lError.classList.remove('on'); }
$.inUser.addEventListener('input',   clearError);
$.inKey.addEventListener('input',    clearError);
$.inUser.addEventListener('keydown', e => { if (e.key === 'Enter') $.inKey.focus(); });
$.inKey.addEventListener('keydown',  e => { if (e.key === 'Enter') attemptConnect(); });

/* ---- INIT ---- */
(function init() {
  loadSettings();
  gcLRCCache();
  injectAriaLabels();
  const { u, k } = loadCache();
  if (u && k) {
    $.cachedName.textContent = u;
    $.cachedEntry.style.display = 'flex';
    $.cachedEntry.addEventListener('click', () => connectWith(u, k));
  }
})();

/* ---- LOGIN ---- */
$.btnConnect.addEventListener('click', attemptConnect);

async function attemptConnect() {
  const u = $.inUser.value.trim();
  const k = $.inKey.value.trim();
  if (!u) { showError('Entrez votre pseudo Last.fm.'); return; }
  if (!k || k.length < 20) { showError('Clé API invalide (32 caractères hex).'); return; }
  connectWith(u, k);
}

async function connectWith(u, k) {
  showLoading(true);
  try {
    await fetchUserInfo(u, k);
    apiKey = k; username = u; originalUser = u;
    saveCache(); hideLogin(); showLoading(false);
    $.player.classList.add('on');
    applySettings();
    if ($.displayUsername) $.displayUsername.textContent = u;
    if (S.defaultPanel === 'lyrics')  $.btnLyrics.click();
    if (S.defaultPanel === 'history') $.btnHist.click();
    if (S.lanyardId) lanyardConnect(S.lanyardId);
    startPolling();
    if (S.canvasViz) startCanvasViz();
    resetIdle();
  } catch(err) {
    showLoading(false);
    showError(err.message || 'Connexion impossible.');
  }
}

function hideLogin() {
  $.login.classList.add('out');
  setTimeout(() => { $.login.style.display = 'none'; }, 1400);
}
function showLoading(on) {
  $.loading.style.opacity = on ? '1' : '0';
  $.loading.style.pointerEvents = on ? 'all' : 'none';
}

$.btnLogout.addEventListener('click', () => {
  lanyardDisconnect();
  clearCache(); clearInterval(pollTimer); location.reload();
});

/* ============================================================
   IDLE / UI FADE
   ============================================================ */
function resetIdle() {
  document.body.classList.remove('is-idle');
  document.body.style.cursor = 'default';
  clearTimeout(idleTimer);
  if (settingsOpen || histOpen) return;
  if (zenMode) {
    document.body.classList.add('is-idle');
    document.body.style.cursor = 'none';
    return;
  }
  idleTimer = setTimeout(() => {
    document.body.classList.add('is-idle');
    document.body.style.cursor = 'none';
  }, 5000);
}
document.addEventListener('mousemove', resetIdle);
document.addEventListener('click',     resetIdle);
document.addEventListener('keydown',   resetIdle);

/* ============================================================
   ZEN MODE
   ============================================================ */
function toggleZenMode() {
  zenMode = !zenMode;
  document.body.classList.toggle('zen-mode', zenMode);
  const btn = document.getElementById('btn-zen');
  if (btn) {
    btn.classList.toggle('active', zenMode);
    btn.setAttribute('aria-pressed', zenMode ? 'true' : 'false');
    btn.setAttribute('aria-label', zenMode ? 'Désactiver le mode Zen' : 'Activer le mode Zen');
  }
  if (zenMode) {
    if (histOpen || settingsOpen) closeAllPanels();
    document.body.classList.add('is-idle'); document.body.style.cursor = 'none';
    clearTimeout(idleTimer);
  } else {
    document.body.classList.remove('is-idle'); document.body.style.cursor = 'default';
    resetIdle();
  }
}
const btnZen = document.getElementById('btn-zen');
if (btnZen) btnZen.addEventListener('click', () => { toggleZenMode(); resetIdle(); });

/* ============================================================
   ARIA LABELS
   ============================================================ */
function injectAriaLabels() {
  const labels = {
    'btn-lyrics': 'Ouvrir les paroles', 'btn-hist': "Ouvrir l'historique",
    'btn-settings': 'Ouvrir les paramètres', 'btn-fs': 'Plein écran',
    'btn-logout': 'Se déconnecter', 'btn-lanyard-status': 'Statut Lanyard',
    'ctx-btn-lastfm': 'Ouvrir sur Last.fm', 'ctx-btn-share': 'Partager (Story 9:16)',
  };
  for (const [id, label] of Object.entries(labels)) {
    const el = document.getElementById(id);
    if (el && !el.getAttribute('aria-label')) el.setAttribute('aria-label', label);
  }
}

/* ============================================================
   AVATAR — SWR cache
   ============================================================ */
const avatarSWRCache = {};
function avatarCacheKey(a) { return 'aura_avatar_' + encodeURIComponent(a.toLowerCase()).slice(0, 80); }
function getAvatarFromStorage(a) {
  try { const { url, ts } = JSON.parse(localStorage.getItem(avatarCacheKey(a)) || 'null'); return (Date.now() - ts < 86400000) ? url : null; } catch { return null; }
}
function setAvatarInStorage(a, url) {
  try { localStorage.setItem(avatarCacheKey(a), JSON.stringify({ url, ts: Date.now() })); } catch {}
}
async function fetchArtistAvatarHD(artist) {
  try {
    const r = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(artist)}&limit=1`);
    if (r.ok) { const d = await r.json(); const img = d.data?.[0]?.picture_xl || d.data?.[0]?.picture_big; if (img) return img; }
  } catch {}
  try {
    const mbR = await fetch(`https://musicbrainz.org/ws/2/artist/?query=artist:${encodeURIComponent(artist)}&fmt=json&limit=1`, { headers: { 'User-Agent': 'AURA/6.0' } });
    if (mbR.ok) {
      const mbid = (await mbR.json()).artists?.[0]?.id;
      if (mbid) {
        const taR = await fetch(`https://www.theaudiodb.com/api/v1/json/2/artist-mb.php?i=${mbid}`);
        if (taR.ok) { const img = (await taR.json()).artists?.[0]?.strArtistThumb; if (img) return img; }
      }
    }
  } catch {}
  try {
    const r = await fetch(`https://www.theaudiodb.com/api/v1/json/2/search.php?s=${encodeURIComponent(artist)}`);
    if (r.ok) { const img = (await r.json()).artists?.[0]?.strArtistThumb; if (img) return img; }
  } catch {}
  try {
    const r = await fetch(`https://ws.audioscrobbler.com/2.0/?method=artist.getInfo&artist=${encodeURIComponent(artist)}&api_key=${apiKey}&format=json`);
    if (r.ok) {
      const imgs = (await r.json()).artist?.image || [];
      for (let i = imgs.length - 1; i >= 0; i--) { const u = imgs[i]['#text']; if (u && u.length > 10 && !u.includes('2a96cbd8b46e442fc41c2b86b821562f')) return u; }
    }
  } catch {}
  return null;
}
function applyAvatarUrl(url) {
  if (!url) return;
  const img = new Image(); img.crossOrigin = 'anonymous';
  img.onload = () => { $.artistAvatar.src = url; $.artistAvatar.classList.add('loaded'); if ($.avatarFallback) $.avatarFallback.style.opacity = '0'; };
  img.src = url;
}
async function updateArtistAvatar(artist) {
  if (!S.showAvatar) return;
  $.avatarCircle.classList.remove('on'); $.artistAvatar.classList.remove('loaded'); $.artistAvatar.src = '';
  if ($.avatarFallback) { $.avatarFallback.style.background = fallbackGradient(artist); $.avatarFallback.textContent = fallbackLetter(artist); $.avatarFallback.style.opacity = '1'; }
  $.avatarCircle.classList.add('on');
  const stale = avatarSWRCache[artist] || getAvatarFromStorage(artist);
  if (stale) applyAvatarUrl(stale);
  try {
    const fresh = await fetchArtistAvatarHD(artist);
    if (fresh) {
      avatarSWRCache[artist] = fresh; setAvatarInStorage(artist, fresh);
      if ((currentTrack?.artist?.name || currentTrack?.artist?.['#text'] || '') === artist) applyAvatarUrl(fresh);
    }
  } catch {}
}

/* ============================================================
   POLLING — Lanyard always priority
   ============================================================ */
function startPolling() { poll(); pollTimer = setInterval(poll, 1000); }

async function poll() {
  if (lanyardActive && lanyardSpotifyData) {
    setStatus('ok', '⚡ AURA Sync · ' + (lanyardSpotifyData.song || ''));
    try { const { history } = await fetchRecentTracks(10); renderHistory(history); } catch {}
    return;
  }
  if (S.sourcePriority === 'lastfm' || !lanyardActive) {
    try {
      const { current, history } = await fetchRecentTracks(10);
      handleTrack(current);
      renderHistory(history);
      setStatus('ok', username !== originalUser ? 'Viewing: ' + username : 'Live');
    } catch { setStatus('error', 'Network error'); }
  }
}
function setStatus(state, text) {
  $.stDot.className = state === 'loading' ? 'loading' : state === 'error' ? 'error' : '';
  $.stText.textContent = text;
}

/* ============================================================
   LANYARD — WebSocket
   ============================================================ */
let lanyardWs = null, lanyardHbInterval = null, lanyardReconnectTimer = null;
let lanyardActive = false, lanyardSpotifyData = null;
let lanyardTimestampStart = 0, lanyardTimestampEnd = 0, lanyardCurrentDiscordId = '';

function lanyardConnect(discordId) {
  if (!discordId) return;
  lanyardCurrentDiscordId = discordId;
  lanyardDisconnect();
  setLanyardStatus('connecting', 'Connexion…');
  if ($.btnLanyardStatus) $.btnLanyardStatus.style.display = 'flex';
  try { lanyardWs = new WebSocket('wss://api.lanyard.rest/socket'); }
  catch { setLanyardStatus('error', 'WebSocket non supporté'); return; }

  lanyardWs.onopen = () => {};
  lanyardWs.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.op === 1) {
        lanyardHbInterval = setInterval(() => {
          if (lanyardWs?.readyState === WebSocket.OPEN) lanyardWs.send(JSON.stringify({ op: 3 }));
        }, msg.d.heartbeat_interval);
        lanyardWs.send(JSON.stringify({ op: 2, d: { subscribe_to_id: discordId } }));
        if ($.lanyardWsBadge) $.lanyardWsBadge.style.display = 'inline-block';
      } else if (msg.op === 0 && (msg.t === 'INIT_STATE' || msg.t === 'PRESENCE_UPDATE')) {
        lanyardHandlePresence(msg.d);
      }
    } catch {}
  };
  lanyardWs.onerror  = () => { setLanyardStatus('error', 'Erreur'); if ($.lanyardWsBadge) $.lanyardWsBadge.style.display = 'none'; };
  lanyardWs.onclose  = () => {
    lanyardActive = false; lanyardSpotifyData = null;
    if ($.lanyardWsBadge) $.lanyardWsBadge.style.display = 'none';
    if (lanyardHbInterval) { clearInterval(lanyardHbInterval); lanyardHbInterval = null; }
    if (lanyardCurrentDiscordId) {
      setLanyardStatus('connecting', 'Reconnexion…');
      lanyardReconnectTimer = setTimeout(() => lanyardConnect(lanyardCurrentDiscordId), 5000);
    }
  };
}
function lanyardDisconnect() {
  lanyardCurrentDiscordId = ''; lanyardActive = false; lanyardSpotifyData = null;
  clearTimeout(lanyardReconnectTimer);
  if (lanyardHbInterval) { clearInterval(lanyardHbInterval); lanyardHbInterval = null; }
  if (lanyardWs) { try { lanyardWs.close(); } catch {} lanyardWs = null; }
  if ($.lanyardWsBadge) $.lanyardWsBadge.style.display = 'none';
  setLanyardStatus('off', 'Désactivé — entrez un ID pour activer');
  if ($.btnLanyardStatus) $.btnLanyardStatus.style.display = 'none';
}
function lanyardHandlePresence(data) {
  let spotifyData = null, trackPaused = false;
  if (data.spotify?.song) {
    spotifyData = data.spotify;
    if (!data.spotify.timestamps?.start) trackPaused = true;
  } else {
    const musicActivity = (data.activities || []).find(a => a.type === 2);
    if (musicActivity) {
      spotifyData = {
        song: musicActivity.details || musicActivity.name || '',
        artist: musicActivity.state || '',
        album: musicActivity.assets?.large_text || '',
        album_art_url: musicActivity.assets?.large_image
          ? (musicActivity.assets.large_image.startsWith('spotify:')
              ? `https://i.scdn.co/image/${musicActivity.assets.large_image.replace('spotify:', '')}`
              : `https://media.discordapp.net/assets/${musicActivity.application_id}/${musicActivity.assets.large_image}`)
          : null,
        timestamps: musicActivity.timestamps || null,
      };
      trackPaused = !musicActivity.timestamps?.start;
    }
  }
  if (spotifyData) {
    lanyardActive = true; lanyardSpotifyData = spotifyData;
    lanyardTimestampStart = spotifyData.timestamps?.start || 0;
    lanyardTimestampEnd   = spotifyData.timestamps?.end   || 0;
    const durationMs = (lanyardTimestampEnd && lanyardTimestampStart) ? lanyardTimestampEnd - lanyardTimestampStart : 0;
    setLanyardStatus('connected', `${trackPaused ? '⏸' : '🎵'} ${spotifyData.song}`);
    const syntheticTrack = {
      name: spotifyData.song,
      artist: { name: spotifyData.artist, '#text': spotifyData.artist },
      album: { '#text': spotifyData.album || '' },
      albumArtUrl: spotifyData.album_art_url || '',
      image: spotifyData.album_art_url ? [{ '#text': spotifyData.album_art_url, size: 'extralarge' }] : [],
      duration: durationMs > 0 ? Math.floor(durationMs / 1000) * 1000 : 0,
      _fromLanyard: true, _timestampStart: lanyardTimestampStart, _isPaused: trackPaused,
    };
    if (S.sourcePriority !== 'lastfm') { handleTrack(syntheticTrack, true); setPausedState(trackPaused); }
  } else {
    lanyardActive = false; lanyardSpotifyData = null;
    setLanyardStatus('no-music', 'Aucune musique détectée');
    if (S.sourcePriority !== 'lastfm') handleTrack(null);
  }
}
function setLanyardStatus(state, text) {
  const dot = $.lanyardDot, txtEl = $.lanyardStatusText, badge = $.lanyardBadge;
  if (!dot || !badge) return;
  dot.className = 'lanyard-dot'; badge.className = 'lanyard-badge';
  if      (state === 'connecting') { dot.classList.add('connecting'); badge.classList.add('inactive'); }
  else if (state === 'connected')  { dot.classList.add('connected');  badge.classList.add('active'); }
  else if (state === 'no-music')   { dot.classList.add('no-music');   badge.classList.add('inactive'); }
  else if (state === 'error')      { dot.classList.add('error');      badge.classList.add('inactive'); }
  else                             { badge.classList.add('inactive'); }
  if (txtEl) txtEl.textContent = text;
}

/* ---- PAUSE STATE ---- */
function setPausedState(paused) {
  if (isPaused === paused) return;
  isPaused = paused;
  if (paused) {
    trackPausedAt = Date.now(); cancelAnimationFrame(progressRAF);
    if (lrcSynced) { cancelAnimationFrame(lrcRAF); lrcRAF = null; }
    if (!S.canvasViz) stopCanvasViz();
  } else {
    if (trackPausedAt > 0) { trackStartTime += Date.now() - trackPausedAt; trackPausedAt = 0; }
    progressRAF = requestAnimationFrame(updateTrackProgress);
    if (lrcSynced && lyricsOpen) { cancelAnimationFrame(lrcRAF); tickLRC(); }
    if (S.canvasViz) startCanvasViz();
  }
  document.body.classList.toggle('is-paused',  paused);
  document.body.classList.toggle('is-playing', !paused && currentTrack !== null);
}

/* ---- PROGRESS ---- */
function getElapsedMs() {
  if (isPaused) return trackPausedAt > 0 ? trackPausedAt - trackStartTime : 0;
  if (currentTrack?._fromLanyard && currentTrack._timestampStart > 0) return Date.now() - currentTrack._timestampStart;
  return Date.now() - trackStartTime;
}
function updateTrackProgress() {
  if (!trackDuration || !trackStartTime || isPaused) return;
  const pct = Math.min((getElapsedMs() / 1000 / trackDuration) * 100, 100);
  $.progressBar.style.width = pct + '%';
  if (pct < 100) progressRAF = requestAnimationFrame(updateTrackProgress);
}
function trackId(t) { return t ? (t.artist?.name || t.artist?.['#text'] || '') + '|||' + (t.name || '') : ''; }

/* ============================================================
   TITLE OVERFLOW → auto-marquee
   ============================================================ */
function checkTitleOverflow() {
  const wrap = document.querySelector('.track-title-wrap');
  const titleEl = $.title;
  if (!wrap || !titleEl) return;
  titleEl.classList.remove('scrolling');
  titleEl.style.removeProperty('--title-overflow');
  requestAnimationFrame(() => {
    const overflow = titleEl.scrollWidth - wrap.clientWidth;
    if (overflow > 10) {
      titleEl.style.setProperty('--title-overflow', `-${((overflow / titleEl.scrollWidth) * 100).toFixed(1)}%`);
      titleEl.classList.add('scrolling');
    }
  });
}
window.addEventListener('resize', () => { if (currentTrack) checkTitleOverflow(); });

/* ---- HANDLE TRACK ---- */
function handleTrack(track, fromLanyard = false) {
  if (!track) {
    $.noTrack.classList.add('on');
    $.content.style.opacity = '0';
    $.mq.textContent = ('· · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · ').repeat(3);
    cancelAnimationFrame(progressRAF);
    $.artWrap.classList.remove('playing');
    document.body.classList.remove('is-playing', 'is-paused', 'source-lanyard');
    if (S.colorThief) document.documentElement.style.setProperty('--accent', S.accentColor);
    if (S.fluidGradient && $.fluidGradientBg) $.fluidGradientBg.classList.remove('on');
    stopLRC();
    isPaused = false; trackStartTime = 0; trackPausedAt = 0;
    currentTrack = null; currentTrackId = '';
    if (!S.canvasViz) stopCanvasViz();
    return;
  }

  $.noTrack.classList.remove('on');
  $.content.style.opacity = '1';
  const id = trackId(track), isSame = (id === currentTrackId);

  if (isSame && fromLanyard) { const np = track._isPaused || false; if (np !== isPaused) setPausedState(np); return; }
  if (isSame && !fromLanyard) return;

  currentTrackId = id; currentTrack = track;
  isPaused = track._isPaused || false; trackPausedAt = 0;
  $.artWrap.classList.add('playing');
  document.body.classList.add('is-playing');
  document.body.classList.remove('is-paused');
  document.body.classList.toggle('source-lanyard', !!track._fromLanyard);

  if (track._fromLanyard && track._timestampStart > 0) {
    trackStartTime = track._timestampStart;
    trackDuration  = track.duration > 0 ? track.duration / 1000 : 180;
  } else {
    trackStartTime = Date.now();
    trackDuration  = track.duration && parseInt(track.duration) > 0 ? parseInt(track.duration) / 1000 : 180;
  }
  cancelAnimationFrame(progressRAF);
  if (!isPaused) progressRAF = requestAnimationFrame(updateTrackProgress);

  const artist = track.artist?.name || track.artist?.['#text'] || 'Unknown artist';
  const title  = track.name || 'Unknown title';
  $.mq.textContent = (title + '   ·   ' + artist + '   ·   ').repeat(10);

  $.title.classList.remove('show', 'scrolling');
  $.artistRow.classList.remove('show');
  setTimeout(() => {
    $.title.textContent = title; $.artist.textContent = artist;
    void $.title.offsetWidth;
    $.title.classList.add('show'); $.artistRow.classList.add('show');
    setTimeout(checkTitleOverflow, 200);
  }, 400);

  let imgUrl = track.albumArtUrl || '';
  if (!imgUrl) {
    const imgs = track.image || [];
    for (let i = imgs.length - 1; i >= 0; i--) {
      if (imgs[i]['#text']?.length > 10) { imgUrl = imgs[i]['#text']; break; }
    }
    if (imgUrl) imgUrl = imgUrl.replace('/300x300/', '/600x600/').replace('34s', '600x600');
  }
  swapArt(imgUrl, artist, title);
  updateArtistAvatar(artist);
  if (lyricsOpen) loadLyrics(artist, title);
}

/* ---- COLOR THIEF ---- */
function extractDominantColors(imgEl, count = 4) {
  try {
    const cv = document.createElement('canvas'); cv.width = cv.height = 50;
    const ctx = cv.getContext('2d'); ctx.drawImage(imgEl, 0, 0, 50, 50);
    const data = ctx.getImageData(0, 0, 50, 50).data, buckets = {};
    for (let i = 0; i < data.length; i += 4) {
      const r = Math.round(data[i]/28)*28, g = Math.round(data[i+1]/28)*28, b = Math.round(data[i+2]/28)*28;
      buckets[`${r},${g},${b}`] = (buckets[`${r},${g},${b}`] || 0) + 1;
    }
    const sorted = Object.entries(buckets).sort((a,b)=>b[1]-a[1]).map(([k])=>{const[r,g,b]=k.split(',').map(Number);return{r,g,b};});
    const filtered = sorted.filter(c => { const l=(c.r*299+c.g*587+c.b*114)/1000; return l>20&&l<230; });
    return (filtered.length >= 2 ? filtered : sorted).slice(0, count);
  } catch { return null; }
}

const FLUID_FALLBACK = [
  { r:120, g:40,  b:180 },
  { r:30,  g:80,  b:200 },
  { r:200, g:50,  b:100 },
  { r:40,  g:160, b:140 },
];

function triggerColorThief() {
  const activeImg = artSlot === 'a' ? $.artA : $.artB;
  let colors = null;
  if (activeImg && activeImg.naturalWidth) colors = extractDominantColors(activeImg, 4);
  if (!colors || colors.length < 2) colors = FLUID_FALLBACK;

  if (S.colorThief && colors) {
    const vivid = colors.find(c => { const l=(c.r*299+c.g*587+c.b*114)/1000; return l>40&&l<200; }) || colors[0];
    document.documentElement.style.setProperty('--accent', `#${vivid.r.toString(16).padStart(2,'0')}${vivid.g.toString(16).padStart(2,'0')}${vivid.b.toString(16).padStart(2,'0')}`);
  }

  if (S.fluidGradient && $.fluidGradientBg) {
    const [c0,c1,c2,c3] = [colors[0], colors[1], colors[2]||colors[0], colors[3]||colors[1]];
    const [r0,r1,r2,r3] = [c0,c1,c2,c3].map(c=>`rgb(${c.r},${c.g},${c.b})`);
    $.fluidGradientBg.style.backgroundImage = [
      `radial-gradient(ellipse at 15% 25%, ${r0}cc 0%, transparent 55%)`,
      `radial-gradient(ellipse at 85% 75%, ${r1}bb 0%, transparent 55%)`,
      `radial-gradient(ellipse at 80% 20%, ${r2}99 0%, transparent 50%)`,
      `radial-gradient(ellipse at 20% 80%, ${r3}88 0%, transparent 50%)`,
    ].join(', ');
    $.fluidGradientBg.classList.add('on');
  }
}

/* ---- ART SWAP ---- */
function fallbackGradient(str) {
  const hue = [...(str||'A')].reduce((a,c)=>a+c.charCodeAt(0),0) % 360;
  return `linear-gradient(135deg, hsl(${hue},60%,25%), hsl(${(hue+40)%360},70%,18%))`;
}
function fallbackLetter(str) { return (str||'?')[0].toUpperCase(); }

function swapArt(url, artist, title) {
  const front   = artSlot==='a' ? $.artA : $.artB;
  const back    = artSlot==='a' ? $.artB : $.artA;
  const fbFront = artSlot==='a' ? $.fbA  : $.fbB;
  const fbBack  = artSlot==='a' ? $.fbB  : $.fbA;
  const grad = fallbackGradient(artist), letter = fallbackLetter(title);

  if (!url) {
    fbBack.style.background = grad; fbBack.textContent = letter; fbBack.style.opacity = '1';
    fbFront.style.opacity = '0'; back.style.opacity = '0'; front.style.opacity = '0';
    artSlot = artSlot==='a' ? 'b' : 'a';
    updateBg(null, grad); $.artGlow.style.background = grad; $.artGlow.style.backgroundImage = 'none';
    if (S.fluidGradient) triggerColorThief();
    return;
  }
  back.crossOrigin = 'anonymous';
  back.onerror = () => {
    fbBack.style.background = grad; fbBack.textContent = letter; fbBack.style.opacity = '1';
    fbFront.style.opacity = '0'; back.style.opacity = '0'; front.style.opacity = '0';
    artSlot = artSlot==='a' ? 'b' : 'a';
    updateBg(null, grad); $.artGlow.style.background = grad; $.artGlow.style.backgroundImage = 'none';
    if (S.fluidGradient) triggerColorThief();
  };
  back.onload = () => {
    fbBack.style.opacity = '0'; back.style.opacity = '1';
    front.style.opacity = '0'; fbFront.style.opacity = '0';
    artSlot = artSlot==='a' ? 'b' : 'a';
    updateBg(url, null);
    $.artGlow.style.backgroundImage = `url('${url}')`;
    $.artGlow.style.background = 'transparent';
    setTimeout(() => triggerColorThief(), 200);
  };
  back.src = url;
  if (back.complete && back.naturalWidth) back.onload();
}

function updateBg(url, grad) {
  if (!S.showBg || S.bgMode !== 'album') return;
  const front = bgSlot==='a' ? $.bgA : $.bgB;
  const back  = bgSlot==='a' ? $.bgB : $.bgA;
  clearTimeout(bgTimeout);
  back.style.transition = 'none'; back.style.opacity = '0';
  void back.offsetWidth;
  back.style.transition = 'opacity 2s var(--ease)';
  if (url)       back.style.backgroundImage = `url('${url}')`;
  else if (grad) back.style.backgroundImage = grad;
  back.style.opacity = '1'; front.style.opacity = '0';
  bgSlot = bgSlot==='a' ? 'b' : 'a';
  bgTimeout = setTimeout(() => { front.style.backgroundImage = ''; }, 2200);
}

/* ---- HISTORY ---- */
function renderHistory(tracks) {
  const frag = document.createDocumentFragment();
  tracks.forEach(t => {
    const isPlaying = t['@attr']?.nowplaying === 'true';
    const artist = t.artist?.name || t.artist?.['#text'] || '';
    const title  = t.name || '';
    const imgs   = t.image || [];
    let imgUrl = '';
    for (let i = imgs.length-1; i >= 0; i--) { if (imgs[i]['#text']?.length > 10) { imgUrl = imgs[i]['#text']; break; } }
    let timeStr = '';
    if (!isPlaying && t.date?.uts) timeStr = new Date(t.date.uts*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});

    const item = document.createElement('div'); item.className = 'hp-item';
    if (imgUrl) {
      const img = document.createElement('img'); img.className = 'hp-thumb'; img.src = imgUrl; img.alt = '';
      img.onerror = () => img.style.display = 'none'; item.appendChild(img);
    } else {
      const div = document.createElement('div'); div.className = 'hp-thumb';
      Object.assign(div.style, { background: fallbackGradient(artist), display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Bebas Neue',sans-serif", fontSize:'18px', color:'rgba(255,255,255,.6)' });
      div.textContent = fallbackLetter(title); item.appendChild(div);
    }
    const info = document.createElement('div'); info.className = 'hp-info';
    const te = document.createElement('div'); te.className = 'hp-track'; te.textContent = title; info.appendChild(te);
    const ae = document.createElement('div'); ae.className = 'hp-artist'; ae.textContent = artist; info.appendChild(ae);
    if (timeStr) { const tme = document.createElement('div'); tme.className = 'hp-time'; tme.textContent = timeStr; info.appendChild(tme); }
    item.appendChild(info);
    if (isPlaying) { const dot = document.createElement('div'); dot.className = 'hp-playing'; item.appendChild(dot); }
    frag.appendChild(item);
  });
  $.hpList.innerHTML = ''; $.hpList.appendChild(frag);
}

/* ---- LAST.FM API ---- */
async function fetchUserInfo(u, k) {
  const r = await fetch(`https://ws.audioscrobbler.com/2.0/?method=user.getInfo&user=${encodeURIComponent(u)}&api_key=${k}&format=json`);
  if (!r.ok) throw new Error('Network error.');
  const d = await r.json();
  if (d.error) throw new Error(d.message || 'Last.fm error ' + d.error);
  return d.user;
}
async function fetchRecentTracks(limit = 10) {
  const r = await fetch(`https://ws.audioscrobbler.com/2.0/?method=user.getRecentTracks&user=${encodeURIComponent(username)}&api_key=${apiKey}&format=json&limit=${limit}&extended=1`);
  if (!r.ok) throw new Error('Network error');
  const d = await r.json();
  if (d.error) throw new Error(d.message);
  const tracks = d.recenttracks?.track;
  if (!tracks) return { current: null, history: [] };
  const arr = Array.isArray(tracks) ? tracks : [tracks];
  return { current: arr[0]?.['@attr']?.nowplaying === 'true' ? arr[0] : null, history: arr };
}

/* ---- LRC ENGINE ---- */
let lrcLines = [], lrcSynced = false, lrcActiveIndex = -1, lrcRAF = null;
const LRC_META = /^\[(ar|ti|al|au|by|offset|re|ve|length):/i;

function parseLRC(lrcText) {
  const result = [], timeRe = /\[(\d{1,2}):(\d{2})[.:](\d{2,3})\]/g;
  for (const line of lrcText.split('\n')) {
    if (LRC_META.test(line.trim())) continue;
    const matches = [...line.matchAll(timeRe)];
    const text = line.replace(/\[\d{1,2}:\d{2}[.:]\d{2,3}\]/g, '').trim();
    if (matches.length > 0) {
      for (const m of matches) {
        const ms = (parseInt(m[1])*60 + parseInt(m[2]))*1000 + parseInt(m[3].padEnd(3,'0').slice(0,3));
        result.push({ timeMs: ms, text: text || '♪' });
      }
    }
  }
  return result.sort((a,b) => a.timeMs - b.timeMs);
}

function renderLRCLines(lines) {
  $.lrcContainer.innerHTML = '';
  lines.forEach((line, i) => {
    const div = document.createElement('div');
    div.className = 'lrc-line'; div.textContent = line.text; div.dataset.index = i;
    div.addEventListener('click', () => { lrcActiveIndex = i; updateLRCDisplay(); });
    $.lrcContainer.appendChild(div);
  });
}

function tickLRC() {
  if (!lyricsOpen || !lrcSynced || !lrcLines.length) { lrcRAF = null; return; }
  if (isPaused) { lrcRAF = requestAnimationFrame(tickLRC); return; }
  const ms = getElapsedMs();
  let ni = -1;
  for (let i = lrcLines.length-1; i >= 0; i--) { if (ms >= lrcLines[i].timeMs) { ni = i; break; } }
  if (ni !== lrcActiveIndex) { lrcActiveIndex = ni; updateLRCDisplay(); }
  lrcRAF = requestAnimationFrame(tickLRC);
}

function updateLRCDisplay() {
  if (!$.lrcContainer) return;
  const all = $.lrcContainer.querySelectorAll('.lrc-line');
  if (!all.length) return;
  all.forEach((line, i) => {
    line.classList.remove('active', 'near');
    if (i === lrcActiveIndex) line.classList.add('active');
    else if (Math.abs(i - lrcActiveIndex) <= 2) line.classList.add('near');
  });
  if (lrcActiveIndex >= 0 && S.autoScroll) {
    const activeLine = all[lrcActiveIndex];
    if (activeLine && $.lpBody) {
      const targetY = -(activeLine.offsetTop - $.lpBody.clientHeight/2 + activeLine.offsetHeight/2);
      $.lrcContainer.style.transform = `translateY(${targetY}px)`;
    }
  }
}

function stopLRC() {
  cancelAnimationFrame(lrcRAF); lrcRAF = null;
  lrcLines = []; lrcSynced = false; lrcActiveIndex = -1;
  if ($.lrcContainer) $.lrcContainer.style.transform = '';
  $.lpBody.classList.remove('lrc-mode');
}

/* ---- LYRICS LOADING ---- */
async function fetchLyricsFromLRCLIB(artist, title) {
  try {
    const r = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`);
    if (r.ok) { const d = await r.json(); if (d.syncedLyrics || d.plainLyrics) return { syncedLyrics: d.syncedLyrics||null, plainLyrics: d.plainLyrics||null, duration: d.duration, source:'lrclib' }; }
  } catch {}
  try {
    const r = await fetch(`https://lrclib.net/api/search?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`);
    if (r.ok) {
      const results = await r.json();
      if (Array.isArray(results)) {
        const match = results.find(x=>x.syncedLyrics) || results.find(x=>x.plainLyrics);
        if (match) return { syncedLyrics: match.syncedLyrics||null, plainLyrics: match.plainLyrics||null, duration: match.duration, source:'lrclib-search' };
      }
    }
  } catch {}
  try {
    const r = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
    if (r.ok) { const d = await r.json(); if (d.lyrics?.trim().length > 10) return { syncedLyrics: null, plainLyrics: d.lyrics, duration: 0, source:'lyrics.ovh' }; }
  } catch {}
  return null;
}

async function loadLyrics(artist, title) {
  stopLRC();
  $.lrcContainer.innerHTML = '<span class="lp-empty">Chargement des paroles…</span>';
  $.lpBody.classList.remove('lrc-mode');
  setLPBadge('');
  let lyrData = getLRCCache(artist, title);
  if (!lyrData) { lyrData = await fetchLyricsFromLRCLIB(artist, title); if (lyrData) setLRCCache(artist, title, lyrData); }
  if (!lyrData) {
    $.lrcContainer.innerHTML = `<span class="lp-empty">Aucune parole trouvée.<br/>Essayer sur <a href="https://genius.com/search?q=${encodeURIComponent(artist+' '+title)}" target="_blank" style="color:rgba(255,255,255,.4);text-decoration:none">Genius →</a></span>`;
    setLPBadge('plain'); return;
  }
  if (lyrData.duration > 0) trackDuration = lyrData.duration;
  if (lyrData.syncedLyrics) {
    lrcLines = parseLRC(lyrData.syncedLyrics);
    if (lrcLines.length > 0) {
      lrcSynced = true; $.lrcContainer.innerHTML = '';
      $.lpBody.classList.add('lrc-mode');
      renderLRCLines(lrcLines); setLPBadge('synced');
      cancelAnimationFrame(lrcRAF); tickLRC(); return;
    }
  }
  lrcSynced = false; $.lpBody.classList.remove('lrc-mode');
  const plain = lyrData.plainLyrics ? lyrData.plainLyrics.trim().replace(/</g,'&lt;').replace(/\n/g,'<br>') : '';
  $.lrcContainer.innerHTML = plain ? `<div class="plain-lyrics">${plain}</div>` : '<span class="lp-empty">Aucune parole trouvée.</span>';
  setLPBadge('plain');
}

function setLPBadge(type) {
  if (!$.lpBadge) return;
  $.lpBadge.className = 'lp-badge';
  if (type === 'synced') { $.lpBadge.classList.add('synced'); $.lpBadge.textContent = '⚡ Synced'; }
  else if (type === 'plain') { $.lpBadge.classList.add('plain'); $.lpBadge.textContent = 'Text'; }
  else $.lpBadge.textContent = '';
}

/* ============================================================
   SHARE IMAGE — Canvas 9:16
   ============================================================ */
async function generateShareImage() {
  if (!currentTrack) return;
  const artist = currentTrack.artist?.name || currentTrack.artist?.['#text'] || 'Unknown Artist';
  const title  = currentTrack.name || 'Unknown Title';
  const album  = currentTrack.album?.['#text'] || '';
  const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1920;
  const ctx = canvas.getContext('2d');
  const activeImg = artSlot==='a' ? $.artA : $.artB;
  let colors = null;
  if (activeImg?.naturalWidth) colors = extractDominantColors(activeImg, 3);
  const c1 = colors?.[0] ? `rgb(${colors[0].r},${colors[0].g},${colors[0].b})` : '#1a0030';
  const c2 = colors?.[1] ? `rgb(${colors[1].r},${colors[1].g},${colors[1].b})` : '#0a001a';
  const c3 = colors?.[2] ? `rgb(${colors[2].r},${colors[2].g},${colors[2].b})` : '#000010';
  const bgGrad = ctx.createLinearGradient(0,0,1080,1920);
  bgGrad.addColorStop(0,c1); bgGrad.addColorStop(0.5,c2); bgGrad.addColorStop(1,c3);
  ctx.fillStyle = bgGrad; ctx.fillRect(0,0,1080,1920);
  const ov = ctx.createLinearGradient(0,0,0,1920);
  ov.addColorStop(0,'rgba(0,0,0,0.25)'); ov.addColorStop(0.6,'rgba(0,0,0,0.1)'); ov.addColorStop(1,'rgba(0,0,0,0.7)');
  ctx.fillStyle = ov; ctx.fillRect(0,0,1080,1920);
  const artSize=780, artX=(1080-artSize)/2, artY=280, radius=36;
  ctx.save(); ctx.shadowColor='rgba(0,0,0,0.6)'; ctx.shadowBlur=80; ctx.shadowOffsetY=30;
  ctx.beginPath(); ctx.roundRect(artX,artY,artSize,artSize,radius); ctx.clip();
  let artDrawn=false;
  if (activeImg?.naturalWidth) { try { ctx.drawImage(activeImg,artX,artY,artSize,artSize); artDrawn=true; } catch {} }
  if (!artDrawn) { const fb=ctx.createLinearGradient(artX,artY,artX+artSize,artY+artSize); fb.addColorStop(0,c1); fb.addColorStop(1,c2); ctx.fillStyle=fb; ctx.fillRect(artX,artY,artSize,artSize); }
  ctx.restore();
  ctx.font='bold 52px "Bebas Neue",sans-serif'; ctx.letterSpacing='8px'; ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.textAlign='center';
  ctx.fillText('AURA',540,120);
  ctx.font='28px "Bebas Neue",sans-serif'; ctx.fillStyle='rgba(255,255,255,0.4)';
  ctx.fillText('NOW PLAYING',540,165);
  const textY=artY+artSize+90;
  ctx.font='bold 72px "Bebas Neue",sans-serif'; ctx.fillStyle='rgba(255,255,255,0.97)'; ctx.letterSpacing='2px';
  wrapCanvasText(ctx,title.toUpperCase(),540,textY,900,80);
  ctx.font='44px "Bebas Neue",sans-serif'; ctx.fillStyle='rgba(255,255,255,0.6)'; ctx.letterSpacing='3px';
  const tl=measureWrappedLines(ctx,title.toUpperCase(),900,'bold 72px "Bebas Neue",sans-serif');
  ctx.fillText(artist,540,textY+tl*80+20);
  if (album) { ctx.font='32px "Bebas Neue",sans-serif'; ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.fillText(album,540,textY+tl*80+80); }
  ctx.font='26px monospace'; ctx.fillStyle='rgba(255,255,255,0.25)'; ctx.letterSpacing='0px';
  ctx.fillText(location.hostname||'aura.music',540,1860);
  const link=document.createElement('a');
  link.download=`AURA_${(title+'_'+artist).replace(/[^a-zA-Z0-9]/g,'_').slice(0,40)}.png`;
  link.href=canvas.toDataURL('image/png'); link.click();
}

function wrapCanvasText(ctx,text,x,y,maxW,lh) {
  const words=text.split(' '); let line='',cy=y;
  for (const w of words) { const t=line+w+' '; if (ctx.measureText(t).width>maxW&&line!=='') { ctx.fillText(line.trim(),x,cy); line=w+' '; cy+=lh; } else line=t; }
  if (line.trim()) ctx.fillText(line.trim(),x,cy);
}
function measureWrappedLines(ctx,text,maxW,font) {
  const sf=ctx.font; ctx.font=font; const words=text.split(' '); let line='',lines=1;
  for (const w of words) { const t=line+w+' '; if (ctx.measureText(t).width>maxW&&line!=='') { lines++; line=w+' '; } else line=t; }
  ctx.font=sf; return lines;
}

/* ============================================================
   CANVAS VISUALIZER
   ============================================================ */
let vizRAF = null, vizPhase = 0;
function startCanvasViz() { if (vizRAF) cancelAnimationFrame(vizRAF); vizLastFrame=0; vizLoop(0); }
function stopCanvasViz()  { cancelAnimationFrame(vizRAF); vizRAF=null; if ($.vizCanvas) $.vizCanvas.getContext('2d').clearRect(0,0,$.vizCanvas.width,$.vizCanvas.height); }

function vizLoop(ts) {
  const interval = 1000/(S.vizFPS===30?30:60);
  if (ts - vizLastFrame < interval - 1) { if (S.canvasViz) vizRAF=requestAnimationFrame(vizLoop); return; }
  vizLastFrame = ts;
  const cv=$.vizCanvas; if (!cv) return;
  const ctx=cv.getContext('2d'), W=cv.width, H=cv.height;
  ctx.clearRect(0,0,W,H);
  const barCount=48, barW=W/barCount-1.5, gap=W/barCount;
  const playing=!isPaused&&document.body.classList.contains('is-playing');
  const accent=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#e0245e';
  vizPhase += isPaused ? 0.003 : 0.035;
  for (let i=0; i<barCount; i++) {
    const t=i/barCount;
    const wave1=Math.sin(t*Math.PI*2.2+vizPhase)*0.38, wave2=Math.sin(t*Math.PI*5.7+vizPhase*1.7)*0.22;
    const wave3=Math.sin(t*Math.PI*11+vizPhase*0.9)*0.12, wave4=Math.sin(t*Math.PI*0.8-vizPhase*0.5)*0.15;
    const shape=Math.exp(-Math.pow((t-0.35)*2.5,2))*0.6+Math.exp(-Math.pow((t-0.65)*3,2))*0.35+0.08;
    const rawH=(wave1+wave2+wave3+wave4+shape+0.5)*0.5;
    const barH=Math.max(2,rawH*H*(playing?1:0.12));
    const x=i*gap, y=H-barH;
    const grad=ctx.createLinearGradient(0,y,0,H);
    grad.addColorStop(0,accent+'cc'); grad.addColorStop(0.5,accent+'88'); grad.addColorStop(1,accent+'22');
    ctx.fillStyle=grad; ctx.beginPath(); ctx.roundRect(x,y,barW,barH,[2,2,0,0]); ctx.fill();
  }
  if (S.canvasViz) vizRAF=requestAnimationFrame(vizLoop); else vizRAF=null;
}

/* ---- PANEL MANAGEMENT ---- */
function closeAllPanels() {
  if (lyricsOpen)   { lyricsOpen=false;   $.lyricsPanel.classList.remove('on'); $.btnLyrics.classList.remove('active');   stopLRC(); }
  if (histOpen)     { histOpen=false;     $.histPanel.classList.remove('on');   $.btnHist.classList.remove('active'); }
  if (settingsOpen) { settingsOpen=false; $.settingsPanel.classList.remove('on'); $.btnSettings.classList.remove('active'); }
  $.hero.classList.remove('shifted');
}

$.btnLyrics.addEventListener('click', () => {
  const opening = !lyricsOpen;
  closeAllPanels();
  if (opening) {
    lyricsOpen=true; $.lyricsPanel.classList.add('on'); $.btnLyrics.classList.add('active'); $.hero.classList.add('shifted');
    if (currentTrack) loadLyrics(currentTrack.artist?.name||currentTrack.artist?.['#text']||'', currentTrack.name||'');
    else { $.lrcContainer.innerHTML = "<span class='lp-empty'>En attente d'un titre…</span>"; setLPBadge(''); }
  }
  resetIdle();
});

$.btnHist.addEventListener('click', () => {
  const opening = !histOpen;
  closeAllPanels();
  if (opening) { histOpen=true; $.histPanel.classList.add('on'); $.btnHist.classList.add('active'); $.hero.classList.add('shifted'); }
  resetIdle();
});

$.btnSettings.addEventListener('click', (e) => {
  e.stopPropagation();
  const opening = !settingsOpen;
  closeAllPanels();
  if (opening) { settingsOpen=true; $.settingsPanel.classList.add('on'); $.btnSettings.classList.add('active'); }
  resetIdle();
});

document.addEventListener('click', e => {
  if (settingsOpen && !$.settingsPanel.contains(e.target) && e.target !== $.btnSettings && !$.btnSettings.contains(e.target)) {
    settingsOpen=false; $.settingsPanel.classList.remove('on'); $.btnSettings.classList.remove('active'); resetIdle();
  }
});

$.lpBody.addEventListener('wheel', () => {});
$.lpBody.addEventListener('touchstart', () => {});

/* ---- FULLSCREEN ---- */
$.btnFs.addEventListener('click', () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{});
  else document.exitFullscreen().catch(()=>{});
});
document.addEventListener('fullscreenchange', () => {
  const ico = $.btnFs.querySelector('svg'); if (!ico) return;
  ico.innerHTML = document.fullscreenElement
    ? '<path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>'
    : '<path d="M3 3h6v2H5v4H3V3zm12 0h6v6h-2V5h-4V3zM3 15h2v4h4v2H3v-6zm16 4h-4v2h6v-6h-2v4z"/>';
});

/* ---- KEYBOARD SHORTCUTS ---- */
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (!$.player.classList.contains('on')) return;
  switch (e.key.toUpperCase()) {
    case 'L': e.preventDefault(); $.btnLyrics.click();   break;
    case 'H': e.preventDefault(); $.btnHist.click();     break;
    case 'S': e.preventDefault(); $.btnSettings.click(); break;
    case 'F': e.preventDefault(); $.btnFs.click();       break;
    case 'Z': e.preventDefault(); toggleZenMode();       break;
    case 'M':
      e.preventDefault();
      if (document.body.classList.contains('is-idle')) { document.body.classList.remove('is-idle'); document.body.style.cursor='default'; resetIdle(); }
      else { clearTimeout(idleTimer); document.body.classList.add('is-idle'); document.body.style.cursor='none'; }
      break;
    case 'ESCAPE': e.preventDefault(); closeAllPanels(); if (zenMode) toggleZenMode(); resetIdle(); break;
  }
});
