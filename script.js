/* AURA — script.js v9
   ─────────────────────────────────────────────────────────────────────────────
   CHANGES vs v8:
   · [NEW] Progress bar : calcul direct depuis timestamps.start/end Discord
     quand disponibles — exact au ms, indépendant du timer local.
   · [NEW] Gestion pause multi-plateforme : détection robuste via timestamps.end
     pour Spotify natif + toute app Discord type 2 (Apple Music, Deezer, Tidal…).
   · [NEW] Overlay pause : icône ⏸ + assombrissement pochette via #pause-overlay.
   · [NEW] Reset instantané de la barre sans clignoter au changement de morceau.
   · [NEW] Stats personnelles : option "Mes stats" (userplaycount artiste + titre)
     via Last.fm avec username — injectée dynamiquement dans les settings.
   · [FIX] lanyardHandlePresence : _timestampEnd propagé jusqu'à updateTrackProgress.
   · [FIX] Description Lanyard précise "toute plateforme musicale" (pas juste Spotify).
   ─────────────────────────────────────────────────────────────────────────────
*/

/* ---- LYRICS TIMING OFFSET ---- */
const LYRICS_ADVANCE_MS = 500; // Show lyrics 500ms earlier to compensate delay

/* ---- PERF HELPERS ---- */
function debounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
function throttle(fn, ms) {
  let last = 0; return (...args) => { const now = Date.now(); if (now - last >= ms) { last = now; fn(...args); } };
}

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
  lanyardId: '', sourcePriority: 'lanyard', vizFPS: 60, showExtendedStats: false, showOwnStats: false,
  statsType: 'artist', // 'artist' | 'album'
  lyricsSize: 100, lyricsFontChoice: 'serif', lyricsAnim: true,
  albumAnim: true,
  // NEW v7
  lyricsBackdropBlur: 40,   // 0-100 → maps to 0-60px blur
  lyricsShadowOpacity: 55,  // 0-100 → text shadow opacity %
  lyricsAutoColor: false,   // auto detect text color from album art
  lyricsBlurMode: 'standard', // 'standard' | 'apple'
  lyricsPosition: 'right',    // 'right' | 'center' | 'bottom'
  animatedGlow: false,      // pulsed glow on album art
  lyricsOffset: 0,          // user-adjustable LRC sync offset in ms (-2000 to +2000)
  titleColorBg: false,      // animated dominant-color orbs from album art
  lyricsShadowDy: 1,        // shadow Y offset in px
  lyricsShadowBlur: 3,      // shadow blur in px
  // v8 NEW
  lyricsActiveColor: '#e0245e',   // active lyric line color
  lyricsInactiveColor: '#ffffff', // inactive lyric line color
  lyricsColorAuto: false,         // derive active color from album art accent
  lyricsBg: 'none',               // 'none' | 'dark' | 'custom' | 'auto'
  lyricsBgColor: '#0a0a0f',       // custom bg color for lyrics panel
  lyricsBgOpacity: 40,            // 0-100 bg opacity
  lyricsAnimStyle: 'fade',        // 'fade'|'slide'|'scale'|'blur'|'bounce'|'none'
  titleAnimStyle: 'fade-up',      // 'fade-up'|'slide-left'|'scale-in'|'blur-in'|'split'|'none'
  titleDots: true,                // decorative dots in titlecolor mode
  dotsColor: '#e0245e',
  dotsBrightness: 70,
  dotsSize: 50,
  dotsSpeed: 50,
  dotsAnimStyle: 'orbit',         // 'orbit'|'pulse'|'wave'|'sparkle'
  // v10 NEW
  lyricsRenderMode: 'phrase',     // 'basic' | 'scroll' | 'phrase' | 'karaoke'
  karaokeProgressiveFill: true,   // progressive word fill in karaoke mode
  titleColorBrightness: 100,      // 10-200 — titlecolor bg brightness
  titleColorContrast: 100,        // 50-150 — titlecolor bg contrast
  // v10b typography
  lyricsWeight: 400,              // 100-900 font weight
  lyricsLetterSpacing: 0,         // -2 to 8 (units of 0.01em)
  lyricsLineHeight: 180,          // 120-260 (%)
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
  lyricsAmBg:      document.getElementById('lyrics-am-bg'),
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
  extendedStats:   document.getElementById('extended-stats'),
  subStats:        document.getElementById('sub-stats'),
  setExtendedStats:document.getElementById('set-extended-stats'),
  setOwnStats:     document.getElementById('set-own-stats'),
  lanyardWsBadge:  document.getElementById('lanyard-ws-badge'),
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
  // NEW v7 — Lyrics legibility controls
  setLyricsBlur:      document.getElementById('set-lyrics-blur'),
  setLyricsShadow:    document.getElementById('set-lyrics-shadow'),
  setLyricsAutoColor: document.getElementById('set-lyrics-auto-color'),
  setAnimatedGlow:    document.getElementById('set-art-glow-pulse'),
  valLyricsBlur:      document.getElementById('val-lyrics-blur'),
  valLyricsShadow:    document.getElementById('val-lyrics-shadow'),
  lyricsModeDesc:     document.getElementById('lyrics-mode-desc'),
  // Lyrics offset
  setLyricsOffset:    document.getElementById('set-lyrics-offset'),
  valLyricsOffset:    document.getElementById('val-lyrics-offset'),
  // Shadow controls
  setShadowOffset:    document.getElementById('set-shadow-offset'),
  setShadowBlur:      document.getElementById('set-shadow-blur'),
  valShadowOffset:    document.getElementById('val-shadow-offset'),
  valShadowBlur:      document.getElementById('val-shadow-blur'),
  // Title color bg
  titleColorBg:       document.getElementById('title-color-bg'),
  // Glow pulse row
  glowPulseRow:       document.getElementById('sp-glow-pulse-row'),
  // v8 NEW — lyrics color + bg + anim controls
  setLyricsColorAuto:     document.getElementById('set-lyrics-color-auto'),
  setLyricsActiveColor:   document.getElementById('set-lyrics-active-color'),
  setLyricsInactiveColor: document.getElementById('set-lyrics-inactive-color'),
  spLyricsColorRow:       document.getElementById('sp-lyrics-color-row'),
  setLyricsBgOpacity:     document.getElementById('set-lyrics-bg-opacity'),
  valLyricsBgOpacity:     document.getElementById('val-lyrics-bg-opacity'),
  setLyricsBgColor:       document.getElementById('set-lyrics-bg-color'),
  spLyricsBgColorRow:     document.getElementById('sp-lyrics-bg-color-row'),
  setTitleDots:           document.getElementById('set-title-dots'),
  setDotsColor:           document.getElementById('set-dots-color'),
  setDotsBrightness:      document.getElementById('set-dots-brightness'),
  valDotsBrightness:      document.getElementById('val-dots-brightness'),
  setDotsSize:            document.getElementById('set-dots-size'),
  valDotsSize:            document.getElementById('val-dots-size'),
  setDotsSpeed:           document.getElementById('set-dots-speed'),
  valDotsSpeed:           document.getElementById('val-dots-speed'),
  // v10
  setKaraokeProgressiveFill: document.getElementById('set-karaoke-fill'),
  setTitleColorBrightness:   document.getElementById('set-title-color-brightness'),
  setTitleColorContrast:     document.getElementById('set-title-color-contrast'),
  valTitleColorBrightness:   document.getElementById('val-title-color-brightness'),
  valTitleColorContrast:     document.getElementById('val-title-color-contrast'),
  // v10b typography
  setLyricsWeight:       document.getElementById('set-lyrics-weight'),
  valLyricsWeight:       document.getElementById('val-lyrics-weight'),
  setLyricsLetterSpacing:document.getElementById('set-lyrics-letter-spacing'),
  valLyricsLetterSpacing:document.getElementById('val-lyrics-letter-spacing'),
  setLyricsLineHeight:   document.getElementById('set-lyrics-line-height'),
  valLyricsLineHeight:   document.getElementById('val-lyrics-line-height'),
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
function saveSettings(noRc) {
  try { localStorage.setItem('aura_settings', JSON.stringify(S)); } catch(e) {}
  if (!noRc && window.rcSchedulePush) window.rcSchedulePush();
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

/* ============================================================
   IMAGE LUMINANCE — for auto text color
   ============================================================ */
function getImageLuminance(imgEl) {
  try {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 24;
    const ctx = cv.getContext('2d');
    ctx.drawImage(imgEl, 0, 0, 24, 24);
    const data = ctx.getImageData(0, 0, 24, 24).data;
    let total = 0, count = 0;
    for (let i = 0; i < data.length; i += 4) {
      total += (data[i] * 299 + data[i+1] * 587 + data[i+2] * 114) / 1000;
      count++;
    }
    return count > 0 ? total / count : 128;
  } catch { return 128; }
}

/* ============================================================
   LYRICS AUTO COLOR — adapt text color to album brightness
   ============================================================ */
function applyLyricsColors() {
  if (!S.lyricsAutoColor) {
    document.body.classList.remove('lyrics-on-light');
    return;
  }
  const img = artSlot === 'a' ? $.artA : $.artB;
  if (!img || !img.naturalWidth) {
    document.body.classList.remove('lyrics-on-light');
    return;
  }
  const lum = getImageLuminance(img);
  // If album is light (> 155), use dark text; otherwise use white text
  document.body.classList.toggle('lyrics-on-light', lum > 155);
}

/* ============================================================
   HELPER — hex to rgba
   ============================================================ */
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ============================================================
   LYRICS BACKGROUND — custom/auto/dark
   ============================================================ */
function applyLyricsBg() {
  const lp = $.lyricsPanel;
  if (!lp) return;
  const mode = S.lyricsBg || 'none';
  const opacity = (S.lyricsBgOpacity != null ? S.lyricsBgOpacity : 40) / 100;
  lp.style.removeProperty('--lyrics-custom-bg');
  lp.classList.remove('lbg-none','lbg-dark','lbg-custom','lbg-auto');
  lp.classList.add('lbg-' + mode);
  if (mode === 'custom') {
    const hex = S.lyricsBgColor || '#0a0a0f';
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    lp.style.setProperty('--lyrics-custom-bg', `rgba(${r},${g},${b},${opacity.toFixed(2)})`);
  } else if (mode === 'dark') {
    lp.style.setProperty('--lyrics-custom-bg', `rgba(0,0,0,${opacity.toFixed(2)})`);
  } else if (mode === 'auto') {
    // derive from album art dominant color
    const img = artSlot === 'a' ? $.artA : $.artB;
    let colors = null;
    if (img && img.naturalWidth) colors = extractDominantColors(img, 1);
    if (colors && colors[0]) {
      const { r, g, b } = colors[0];
      lp.style.setProperty('--lyrics-custom-bg', `rgba(${r},${g},${b},${opacity.toFixed(2)})`);
    } else {
      lp.style.setProperty('--lyrics-custom-bg', `rgba(0,0,0,${opacity.toFixed(2)})`);
    }
  }
}

/* ============================================================
   APPLE MUSIC LYRICS BACKGROUND — vibrant animated gradients
   ============================================================ */
function applyLyricsAmBg() {
  if (!$.lyricsAmBg) return;
  if (S.lyricsBlurMode !== 'apple') {
    document.body.classList.remove('lyrics-apple-mode');
    return;
  }
  document.body.classList.add('lyrics-apple-mode');

  const img = artSlot === 'a' ? $.artA : $.artB;
  let colors = null;
  if (img && img.naturalWidth) colors = extractDominantColors(img, 4);
  if (!colors || colors.length < 2) colors = FLUID_FALLBACK;

  const [c0, c1, c2, c3] = [colors[0], colors[1], colors[2] || colors[0], colors[3] || colors[1]];
  const [r0, r1, r2, r3] = [c0, c1, c2, c3].map(c => `rgb(${c.r},${c.g},${c.b})`);

  $.lyricsAmBg.style.backgroundImage = [
    `radial-gradient(ellipse at 15% 25%, ${r0}ee 0%, transparent 60%)`,
    `radial-gradient(ellipse at 85% 75%, ${r1}cc 0%, transparent 60%)`,
    `radial-gradient(ellipse at 78% 18%, ${r2}aa 0%, transparent 55%)`,
    `radial-gradient(ellipse at 22% 82%, ${r3}99 0%, transparent 55%)`,
  ].join(', ');
}

/* ============================================================
   ANIMATED GLOW (pulsed)
   ============================================================ */
function applyAnimatedGlow() {
  if (!$.artGlow) return;
  $.artGlow.classList.toggle('pulsed', S.animatedGlow);
}

/* ---- APPLY SETTINGS ---- */
function applySettings() {
  document.documentElement.style.setProperty('--accent', S.accentColor);
  /* Derive --accent-rgb for rgba() usage in CSS */
  const _hex = S.accentColor.replace('#','');
  const _r = parseInt(_hex.slice(0,2),16), _g = parseInt(_hex.slice(2,4),16), _b = parseInt(_hex.slice(4,6),16);
  if (!isNaN(_r)) document.documentElement.style.setProperty('--accent-rgb', `${_r},${_g},${_b}`);
  document.querySelectorAll('[data-color]').forEach(b => b.classList.toggle('active', b.dataset.color === S.accentColor));

  document.documentElement.style.setProperty('--blur-amount', S.blur + 'px');
  document.documentElement.style.setProperty('--bg-brightness', (S.brightness / 100).toFixed(2));
  document.documentElement.style.setProperty('--bg-saturate', (S.saturate / 10).toFixed(2));

  if ($.setBlur)       { $.setBlur.value       = S.blur;          updateSliderFill($.setBlur); }
  if ($.setBrightness) { $.setBrightness.value  = S.brightness;   updateSliderFill($.setBrightness); }
  if ($.setSaturate)   { $.setSaturate.value    = S.saturate;     updateSliderFill($.setSaturate); }
  if ($.setMqSpeed)    { $.setMqSpeed.value     = S.marqueeSpeed; updateSliderFill($.setMqSpeed); }

  /* Marquee speed */
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
  t($.setAnimatedGlow, S.animatedGlow);

  /* Art / avatar visibility */
  $.artWrap.style.opacity        = S.showArt   ? '1' : '0';
  $.artGlow.style.display        = S.showGlow  ? 'block' : 'none';
  $.avatarCircle.style.display   = S.showAvatar ? '' : 'none';
  $.mqWrap.classList.toggle('hidden-mq', !S.showMarquee);
  $.globalNoise.classList.toggle('on', S.showGrain);

  const showBgImg = S.showBg && S.bgMode === 'album';
  $.bgA.style.display = showBgImg ? '' : 'none';
  $.bgB.style.display = showBgImg ? '' : 'none';

  if      (S.bgMode === 'dark')       $.bgFilter.style.background = 'rgba(0,0,0,.88)';
  else if (S.bgMode === 'color')      $.bgFilter.style.background = 'rgba(10,5,20,.7)';
  else if (S.bgMode === 'titlecolor') $.bgFilter.style.background = 'rgba(0,0,0,.18)';
  else                                 $.bgFilter.style.background = 'rgba(0,0,0,.35)';

  /* Title-color animated bg */
  const showTitleColorBg = S.bgMode === 'titlecolor';
  if ($.titleColorBg) $.titleColorBg.classList.toggle('on', showTitleColorBg);
  if (!showTitleColorBg && $.titleColorBg) $.titleColorBg.classList.remove('on');
  if (showTitleColorBg && currentTrack) triggerColorThief();
  else if (!showTitleColorBg) stopTitleColorBg();
  updateDots();

  /* Title-color ambiance sliders */
  const tcBr = S.titleColorBrightness != null ? S.titleColorBrightness : 100;
  const tcCo = S.titleColorContrast   != null ? S.titleColorContrast   : 100;
  document.documentElement.style.setProperty('--tcbg-brightness', (tcBr / 100).toFixed(2));
  document.documentElement.style.setProperty('--tcbg-contrast',   (tcCo / 100).toFixed(2));
  const tcbgSection = document.getElementById('sp-titlecolor-ambiance');
  if (tcbgSection) tcbgSection.style.display = showTitleColorBg ? 'block' : 'none';
  if ($.setTitleColorBrightness) { $.setTitleColorBrightness.value = tcBr; updateSliderFill($.setTitleColorBrightness); }
  if ($.setTitleColorContrast)   { $.setTitleColorContrast.value   = tcCo; updateSliderFill($.setTitleColorContrast);   }
  if ($.valTitleColorBrightness) $.valTitleColorBrightness.textContent = tcBr + '%';
  if ($.valTitleColorContrast)   $.valTitleColorContrast.textContent   = tcCo + '%';

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

  /* Priority buttons + extended stats */
  syncPriorityButtons();
  syncStatsTypeButtons();
  if ($.setExtendedStats) $.setExtendedStats.checked = !!S.showExtendedStats;
  if ($.setOwnStats)      $.setOwnStats.checked      = !!S.showOwnStats;

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

  /* Animated glow */
  applyAnimatedGlow();
  /* Glow-pulse row: disable/grey when main glow is off */
  if ($.glowPulseRow) {
    const glowOff = !S.showGlow;
    $.glowPulseRow.style.opacity = glowOff ? '0.35' : '1';
    $.glowPulseRow.style.pointerEvents = glowOff ? 'none' : '';
    const glowPulseInput = document.getElementById('set-art-glow-pulse');
    if (glowPulseInput) glowPulseInput.disabled = glowOff;
  }

  applyLyricsSettings();
}

function applyLyricsSettings() {
  const size = S.lyricsSize || 100;
  document.documentElement.style.setProperty('--lyrics-size', (size / 100).toFixed(2));
  if ($.setLyricsSize) { $.setLyricsSize.value = size; updateSliderFill($.setLyricsSize); }
  if ($.setLyricsSizeVal) $.setLyricsSizeVal.textContent = size + '%';

  /* v10b typography */
  const lw  = S.lyricsWeight       ?? 400;
  const lls = S.lyricsLetterSpacing ?? 0;
  const llh = S.lyricsLineHeight    ?? 180;
  document.documentElement.style.setProperty('--lyrics-weight',         lw);
  document.documentElement.style.setProperty('--lyrics-letter-spacing', (lls * 0.01) + 'em');
  document.documentElement.style.setProperty('--lyrics-line-height',    (llh / 100).toFixed(2));
  if ($.setLyricsWeight)        { $.setLyricsWeight.value        = lw;  updateSliderFill($.setLyricsWeight); }
  if ($.valLyricsWeight)        $.valLyricsWeight.textContent    = lw;
  if ($.setLyricsLetterSpacing) { $.setLyricsLetterSpacing.value = lls; updateSliderFill($.setLyricsLetterSpacing); }
  if ($.valLyricsLetterSpacing) $.valLyricsLetterSpacing.textContent = lls > 0 ? '+' + lls : lls;
  if ($.setLyricsLineHeight)    { $.setLyricsLineHeight.value    = llh; updateSliderFill($.setLyricsLineHeight); }
  if ($.valLyricsLineHeight)    $.valLyricsLineHeight.textContent = llh + '%';

  /* Font — button group */
  const fc = S.lyricsFontChoice || 'serif';
  document.body.classList.remove('lf-default', 'lf-serif', 'lf-sans', 'lf-mono', 'lf-display');
  document.body.classList.add('lf-' + fc);
  document.querySelectorAll('[data-lyrics-font]').forEach(b =>
    b.classList.toggle('active', b.dataset.lyricsFont === fc)
  );

  /* Lyrics anim style */
  const la = S.lyricsAnimStyle || 'fade';
  document.body.classList.remove('lrc-anim-fade','lrc-anim-slide','lrc-anim-scale','lrc-anim-blur','lrc-anim-bounce','lrc-anim-none');
  document.body.classList.add('lrc-anim-' + la);
  document.querySelectorAll('[data-lyrics-anim]').forEach(b => b.classList.toggle('active', b.dataset.lyricsAnim === la));

  /* Title anim style */
  const ta = S.titleAnimStyle || 'fade-up';
  document.body.classList.remove(
    'title-anim-fade-up','title-anim-fade-down','title-anim-slide-left','title-anim-slide-right',
    'title-anim-scale-in','title-anim-scale-down','title-anim-blur-in',
    'title-anim-flip-x','title-anim-swing','title-anim-split','title-anim-glitch','title-anim-none'
  );
  document.body.classList.add('title-anim-' + ta);
  document.querySelectorAll('[data-title-anim]').forEach(b => b.classList.toggle('active', b.dataset.titleAnim === ta));

  /* Lyrics active/inactive colors */
  const autoC = !!S.lyricsColorAuto;
  if ($.setLyricsColorAuto) $.setLyricsColorAuto.checked = autoC;
  if ($.spLyricsColorRow) $.spLyricsColorRow.style.opacity = autoC ? '0.35' : '1';
  if (!autoC) {
    document.documentElement.style.setProperty('--lyrics-active-color', S.lyricsActiveColor || '#e0245e');
    document.documentElement.style.setProperty('--lyrics-inactive-color', hexToRgba(S.lyricsInactiveColor || '#ffffff', 0.28));
    document.documentElement.style.setProperty('--lyrics-near-color', hexToRgba(S.lyricsInactiveColor || '#ffffff', 0.55));
  }
  if ($.setLyricsActiveColor) $.setLyricsActiveColor.value = S.lyricsActiveColor || '#e0245e';
  if ($.setLyricsInactiveColor) $.setLyricsInactiveColor.value = S.lyricsInactiveColor || '#ffffff';

  /* Lyrics background */
  const lbg = S.lyricsBg || 'none';
  document.querySelectorAll('[data-lyrics-bg]').forEach(b => b.classList.toggle('active', b.dataset.lyricsBg === lbg));
  if ($.spLyricsBgColorRow) $.spLyricsBgColorRow.style.display = (lbg === 'custom') ? 'flex' : 'none';
  if ($.setLyricsBgColor) $.setLyricsBgColor.value = S.lyricsBgColor || '#0a0a0f';
  applyLyricsBg();

  /* Lyrics bg opacity */
  const bgo = S.lyricsBgOpacity != null ? S.lyricsBgOpacity : 40;
  if ($.setLyricsBgOpacity) { $.setLyricsBgOpacity.value = bgo; updateSliderFill($.setLyricsBgOpacity); }
  if ($.valLyricsBgOpacity) $.valLyricsBgOpacity.textContent = bgo + '%';

  /* Title dots */
  const dotsEnabled = S.titleDots !== false;
  if ($.setTitleDots) $.setTitleDots.checked = dotsEnabled;
  document.body.classList.toggle('title-dots-on', dotsEnabled);
  const dc = S.dotsColor || '#e0245e';
  const db = S.dotsBrightness != null ? S.dotsBrightness : 70;
  const ds = S.dotsSize != null ? S.dotsSize : 50;
  const dsp = S.dotsSpeed != null ? S.dotsSpeed : 50;
  const da = S.dotsAnimStyle || 'orbit';
  document.documentElement.style.setProperty('--dots-color', dc);
  document.documentElement.style.setProperty('--dots-brightness', (db / 100).toFixed(2));
  document.documentElement.style.setProperty('--dots-size', Math.round(4 + ds * 0.12) + 'px');
  document.documentElement.style.setProperty('--dots-duration', (2.2 - dsp / 100 * 1.8).toFixed(2) + 's');
  if ($.setDotsColor) $.setDotsColor.value = dc;
  if ($.setDotsBrightness) { $.setDotsBrightness.value = db; updateSliderFill($.setDotsBrightness); }
  if ($.valDotsBrightness) $.valDotsBrightness.textContent = db + '%';
  if ($.setDotsSize) { $.setDotsSize.value = ds; updateSliderFill($.setDotsSize); }
  if ($.valDotsSize) $.valDotsSize.textContent = ds + '%';
  if ($.setDotsSpeed) { $.setDotsSpeed.value = dsp; updateSliderFill($.setDotsSpeed); }
  if ($.valDotsSpeed) $.valDotsSpeed.textContent = dsp + '%';
  document.body.classList.remove('dots-orbit','dots-pulse','dots-wave','dots-sparkle');
  document.body.classList.add('dots-' + da);
  document.querySelectorAll('[data-dots-anim]').forEach(b => b.classList.toggle('active', b.dataset.dotsAnim === da));
  updateDots();

  /* Animation legacy compat */
  document.body.classList.toggle('lyrics-anim-off', la === 'none');

  /* v10: Lyrics render mode */
  const rm = S.lyricsRenderMode || 'phrase';
  document.body.classList.remove('lrc-render-basic','lrc-render-scroll','lrc-render-phrase','lrc-render-karaoke');
  document.body.classList.add('lrc-render-' + rm);
  document.querySelectorAll('[data-lrc-render]').forEach(b => b.classList.toggle('active', b.dataset.lrcRender === rm));
  /* karaoke fill toggle */
  const kf = S.karaokeProgressiveFill !== false;
  if ($.setKaraokeProgressiveFill) $.setKaraokeProgressiveFill.checked = kf;
  document.body.classList.toggle('karaoke-fill', kf);
  const karaokeSection = document.getElementById('sp-karaoke-opts');
  if (karaokeSection) karaokeSection.style.display = rm === 'karaoke' ? 'block' : 'none';
  /* Re-render if already loaded */
  if (lrcLines.length > 0) {
    if (rm === 'karaoke') renderLRCLinesKaraoke(lrcLines);
    else { renderLRCLines(lrcLines); updateLRCDisplay(); }
  }

  /* Backdrop blur — applied inline on the element so blur:0 is truly invisible */
  const blurPx = Math.round((S.lyricsBackdropBlur / 100) * 60);
  document.documentElement.style.setProperty('--lyrics-backdrop-blur', blurPx + 'px');
  const bgOpacity = S.lyricsBackdropBlur > 5 ? (0.05 + (S.lyricsBackdropBlur / 100) * 0.35).toFixed(2) : '0';
  document.documentElement.style.setProperty('--lyrics-bg-opacity', bgOpacity);

  /* KEY FIX: backdrop-filter with saturate() creates a visible box even at 0px blur.
     Override inline: none at 0%, proper value when > 0. Position modes (center/bottom)
     manage their own backdrop-filter via CSS, so only override for right mode. */
  const lp = $.lyricsPanel;
  if (lp && (S.lyricsPosition || 'right') === 'right') {
    const bm = S.lyricsBlurMode || 'standard';
    if (blurPx === 0) {
      lp.style.backdropFilter = 'none';
      lp.style.webkitBackdropFilter = 'none';
    } else {
      const sat = bm === 'apple' ? 2 : 1.6;
      const actualBlur = bm === 'apple' ? Math.round(blurPx * 1.4) : blurPx;
      lp.style.backdropFilter = `blur(${actualBlur}px) saturate(${sat})`;
      lp.style.webkitBackdropFilter = `blur(${actualBlur}px) saturate(${sat})`;
    }
  } else if (lp && (S.lyricsPosition || 'right') !== 'right') {
    /* center/bottom: CSS handles their own backdrop-filter, clear inline override */
    lp.style.backdropFilter = '';
    lp.style.webkitBackdropFilter = '';
  }

  if ($.setLyricsBlur) { $.setLyricsBlur.value = S.lyricsBackdropBlur; updateSliderFill($.setLyricsBlur); }
  if ($.valLyricsBlur) $.valLyricsBlur.textContent = pctLabel(S.lyricsBackdropBlur, 0, 100);

  /* Text shadow opacity */
  const shadowAlpha = ((S.lyricsShadowOpacity || 55) / 100).toFixed(2);
  document.documentElement.style.setProperty('--shadow-opacity', shadowAlpha);

  if ($.setLyricsShadow) { $.setLyricsShadow.value = S.lyricsShadowOpacity || 55; updateSliderFill($.setLyricsShadow); }
  if ($.valLyricsShadow) $.valLyricsShadow.textContent = pctLabel(S.lyricsShadowOpacity || 55, 0, 100);

  /* Shadow offset slider */
  const shadowDy = S.lyricsShadowDy != null ? S.lyricsShadowDy : 1;
  document.documentElement.style.setProperty('--shadow-dy', shadowDy + 'px');
  if ($.setShadowOffset) { $.setShadowOffset.value = shadowDy; updateSliderFill($.setShadowOffset); }
  if ($.valShadowOffset) $.valShadowOffset.textContent = shadowDy + 'px';

  /* Shadow blur slider */
  const shadowBlurVal = S.lyricsShadowBlur != null ? S.lyricsShadowBlur : 3;
  document.documentElement.style.setProperty('--shadow-blur', shadowBlurVal + 'px');
  if ($.setShadowBlur) { $.setShadowBlur.value = shadowBlurVal; updateSliderFill($.setShadowBlur); }
  if ($.valShadowBlur) $.valShadowBlur.textContent = shadowBlurVal + 'px';

  /* Lyrics offset */
  const off = S.lyricsOffset || 0;
  if ($.setLyricsOffset) { $.setLyricsOffset.value = off; updateSliderFill($.setLyricsOffset); }
  if ($.valLyricsOffset) $.valLyricsOffset.textContent = (off >= 0 ? '+' : '') + off + 'ms';

  /* Auto color toggle */
  if ($.setLyricsAutoColor) $.setLyricsAutoColor.checked = !!S.lyricsAutoColor;
  applyLyricsColors();

  /* Blur mode buttons — data-lyrics-blur-mode */
  const bm = S.lyricsBlurMode || 'standard';
  document.querySelectorAll('[data-lyrics-blur-mode]').forEach(b =>
    b.classList.toggle('active', b.dataset.lyricsBlurMode === bm)
  );
  /* Apply blur mode class to lyrics panel */
  const lp2 = $.lyricsPanel;
  if (lp2) {
    lp2.classList.remove('lyrics-blur-standard', 'lyrics-blur-apple');
    lp2.classList.add('lyrics-blur-' + bm);
  }

  /* Position mode — apply body class + sync buttons */
  const pos = S.lyricsPosition || 'right';
  document.body.classList.remove('lyrics-pos-right', 'lyrics-pos-center', 'lyrics-pos-bottom');
  if (pos !== 'right') document.body.classList.add('lyrics-pos-' + pos);
  document.querySelectorAll('[data-lyrics-pos]').forEach(b =>
    b.classList.toggle('active', b.dataset.lyricsPos === pos)
  );
  const posDesc = document.getElementById('lyrics-pos-desc');
  if (posDesc) {
    if (window.t) {
      const map = { right: 'lyr_pos_side_desc', center: 'lyr_pos_center_desc', bottom: 'lyr_pos_bottom_desc' };
      posDesc.textContent = window.t(map[pos] || map.right);
    } else {
      const descs = {
        right:  'Lyrics on the right side of the screen.',
        center: 'Lyrics centered on screen, over the background.',
        bottom: 'Lyrics at the bottom, full width.',
      };
      posDesc.textContent = descs[pos] || descs.right;
    }
  }

  applyLyricsAmBg();
  applyLyricsBg();

  if ($.lyricsModeDesc) {
    $.lyricsModeDesc.textContent = bm === 'apple'
      ? (window.t ? window.t('lyr_panel_color_desc') : 'Animated color gradient from artwork.')
      : (window.t ? window.t('lyr_panel_subtle_desc') : 'Simple transparent panel.');
  }
}

function updateLayoutDesc() {
  if (!$.layoutDesc) return;
  $.layoutDesc.textContent = S.heroLayout === 'minimal'
    ? (window.t ? window.t('disp_view_minimal_desc') : 'Just a progress bar and the track title.')
    : (window.t ? window.t('disp_view_full_desc') : 'Full display with artwork and track information.');
}

/* ---- SETTINGS EVENT LISTENERS ---- */
const _applyDebounced = debounce(() => { applySettings(); saveSettings(); }, 40);
if ($.setBlur)       $.setBlur.addEventListener('input',       () => { S.blur         = parseInt($.setBlur.value);        updateSliderFill($.setBlur);       _applyDebounced(); }, { passive: true });
if ($.setBrightness) $.setBrightness.addEventListener('input', () => { S.brightness   = parseInt($.setBrightness.value);  updateSliderFill($.setBrightness); _applyDebounced(); }, { passive: true });
if ($.setSaturate)   $.setSaturate.addEventListener('input',   () => { S.saturate     = parseInt($.setSaturate.value);    updateSliderFill($.setSaturate);   _applyDebounced(); }, { passive: true });
if ($.setMqSpeed)    $.setMqSpeed.addEventListener('input',    () => { S.marqueeSpeed = parseInt($.setMqSpeed.value);     updateSliderFill($.setMqSpeed);    _applyDebounced(); }, { passive: true });
if ($.setHeroScale)  $.setHeroScale.addEventListener('input',  () => { S.heroScale    = parseInt($.setHeroScale.value);   updateSliderFill($.setHeroScale);  _applyDebounced(); }, { passive: true });

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
boolToggle($.setAnimatedGlow, 'animatedGlow');
// Note: lyricsAnim toggle removed — replaced by data-lyrics-anim button group

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
const _lyricsSliderApply = debounce(() => { applyLyricsSettings(); saveSettings(); }, 40);
if ($.setLyricsSize) $.setLyricsSize.addEventListener('input', () => {
  S.lyricsSize = parseInt($.setLyricsSize.value);
  _lyricsSliderApply();
}, { passive: true });
/* NEW: Lyrics backdrop blur */
if ($.setLyricsBlur) $.setLyricsBlur.addEventListener('input', () => {
  S.lyricsBackdropBlur = parseInt($.setLyricsBlur.value);
  _lyricsSliderApply();
}, { passive: true });
/* NEW: Lyrics shadow opacity */
if ($.setLyricsShadow) $.setLyricsShadow.addEventListener('input', () => {
  S.lyricsShadowOpacity = parseInt($.setLyricsShadow.value);
  _lyricsSliderApply();
}, { passive: true });
/* NEW: Shadow offset */
if ($.setShadowOffset) $.setShadowOffset.addEventListener('input', () => {
  S.lyricsShadowDy = parseInt($.setShadowOffset.value);
  _lyricsSliderApply();
}, { passive: true });
/* NEW: Shadow blur */
if ($.setShadowBlur) $.setShadowBlur.addEventListener('input', () => {
  S.lyricsShadowBlur = parseInt($.setShadowBlur.value);
  _lyricsSliderApply();
}, { passive: true });
/* NEW: Lyrics auto color */
if ($.setLyricsAutoColor) $.setLyricsAutoColor.addEventListener('change', () => {
  S.lyricsAutoColor = $.setLyricsAutoColor.checked;
  applyLyricsSettings(); saveSettings();
});
/* NEW: Lyrics offset slider */
if ($.setLyricsOffset) $.setLyricsOffset.addEventListener('input', () => {
  S.lyricsOffset = parseInt($.setLyricsOffset.value);
  _lyricsSliderApply();
}, { passive: true });
/* NEW: Lyrics blur mode buttons — data-lyrics-blur-mode */
document.querySelectorAll('[data-lyrics-blur-mode]').forEach(b => b.addEventListener('click', () => {
  S.lyricsBlurMode = b.dataset.lyricsBlurMode;
  applyLyricsSettings(); saveSettings();
}));
/* NEW: Lyrics position buttons — data-lyrics-pos */
document.querySelectorAll('[data-lyrics-pos]').forEach(b => b.addEventListener('click', () => {
  S.lyricsPosition = b.dataset.lyricsPos;
  /* Re-evaluate hero shift if lyrics panel is currently open */
  if (lyricsOpen) {
    if (S.lyricsPosition === 'right') $.hero.classList.add('shifted');
    else $.hero.classList.remove('shifted');
  }
  applyLyricsSettings(); saveSettings();
}));

/* v8: Lyrics anim style */
document.querySelectorAll('[data-lyrics-anim]').forEach(b => b.addEventListener('click', () => {
  S.lyricsAnimStyle = b.dataset.lyricsAnim;
  applyLyricsSettings(); saveSettings();
}));
/* v8: Title anim style */
document.querySelectorAll('[data-title-anim]').forEach(b => b.addEventListener('click', () => {
  S.titleAnimStyle = b.dataset.titleAnim;
  applyLyricsSettings(); saveSettings();
}));
/* v8: Dots anim style */
document.querySelectorAll('[data-dots-anim]').forEach(b => b.addEventListener('click', () => {
  S.dotsAnimStyle = b.dataset.dotsAnim;
  applyLyricsSettings(); saveSettings();
}));
/* v8: Lyrics bg mode */
document.querySelectorAll('[data-lyrics-bg]').forEach(b => b.addEventListener('click', () => {
  S.lyricsBg = b.dataset.lyricsBg;
  applyLyricsSettings(); saveSettings();
}));
/* v8: Lyrics bg opacity */
if (document.getElementById('set-lyrics-bg-opacity')) {
  document.getElementById('set-lyrics-bg-opacity').addEventListener('input', function() {
    S.lyricsBgOpacity = parseInt(this.value);
    applyLyricsSettings(); saveSettings();
  });
}
/* v8: Lyrics bg custom color */
if (document.getElementById('set-lyrics-bg-color')) {
  document.getElementById('set-lyrics-bg-color').addEventListener('input', function() {
    S.lyricsBgColor = this.value;
    applyLyricsSettings(); saveSettings();
  });
}
/* v8: Lyrics active color */
if (document.getElementById('set-lyrics-active-color')) {
  document.getElementById('set-lyrics-active-color').addEventListener('input', function() {
    S.lyricsActiveColor = this.value;
    S.lyricsColorAuto = false;
    applyLyricsSettings(); saveSettings();
  });
}
/* v8: Lyrics inactive color */
if (document.getElementById('set-lyrics-inactive-color')) {
  document.getElementById('set-lyrics-inactive-color').addEventListener('input', function() {
    S.lyricsInactiveColor = this.value;
    S.lyricsColorAuto = false;
    applyLyricsSettings(); saveSettings();
  });
}
/* v8: Lyrics color auto */
if (document.getElementById('set-lyrics-color-auto')) {
  document.getElementById('set-lyrics-color-auto').addEventListener('change', function() {
    S.lyricsColorAuto = this.checked;
    applyLyricsSettings(); saveSettings();
  });
}
/* v8: Title dots toggle */
if (document.getElementById('set-title-dots')) {
  document.getElementById('set-title-dots').addEventListener('change', function() {
    S.titleDots = this.checked;
    applyLyricsSettings(); saveSettings();
  });
}
/* v8: Dots color */
if (document.getElementById('set-dots-color')) {
  document.getElementById('set-dots-color').addEventListener('input', function() {
    S.dotsColor = this.value;
    applyLyricsSettings(); saveSettings();
  });
}
/* v8: Dots brightness */
if (document.getElementById('set-dots-brightness')) {
  document.getElementById('set-dots-brightness').addEventListener('input', function() {
    S.dotsBrightness = parseInt(this.value); _lyricsSliderApply();
  }, { passive: true });
}
/* v8: Dots size */
if (document.getElementById('set-dots-size')) {
  document.getElementById('set-dots-size').addEventListener('input', function() {
    S.dotsSize = parseInt(this.value); _lyricsSliderApply();
  }, { passive: true });
}
/* v8: Dots speed */
if (document.getElementById('set-dots-speed')) {
  document.getElementById('set-dots-speed').addEventListener('input', function() {
    S.dotsSpeed = parseInt(this.value); _lyricsSliderApply();
  }, { passive: true });
}

/* Button groups */
document.querySelectorAll('[data-bg]').forEach(b        => b.addEventListener('click', () => { S.bgMode         = b.dataset.bg;        applySettings(); saveSettings(); }));
document.querySelectorAll('[data-panel]').forEach(b     => b.addEventListener('click', () => { S.defaultPanel   = b.dataset.panel;     applySettings(); saveSettings(); }));
document.querySelectorAll('[data-art-shape]').forEach(b => b.addEventListener('click', () => { S.artShape       = b.dataset.artShape;  applySettings(); saveSettings(); }));
document.querySelectorAll('[data-color]').forEach(b     => b.addEventListener('click', () => { S.accentColor    = b.dataset.color;     applySettings(); saveSettings(); }));
/* Stats type buttons (artiste / album) */
document.querySelectorAll('[data-stats-type]').forEach(b => b.addEventListener('click', () => {
  S.statsType = b.dataset.statsType; saveSettings(); syncStatsTypeButtons();
  if (S.showExtendedStats && currentTrack) {
    const a  = currentTrack.artist?.name || currentTrack.artist?.['#text'] || '';
    const al = currentTrack.album?.['#text'] || '';
    const t  = currentTrack.name || '';
    animateSubStats(() => fetchExtendedStats(a, al, t));
  }
}));

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
    setStatus('loading', target !== '' ? (window.t ? window.t('status_viewing') : 'Viewing: ') + target : (window.t ? window.t('status_loading') : 'Loading…'));
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
      $.btnLanyardConnect.textContent = window.t ? window.t('sync_discord_btn_connect') : 'Connect';
      $.btnLanyardConnect.classList.remove('connected');
    } else if (S.lanyardId) {
      lanyardConnect(S.lanyardId);
      $.btnLanyardConnect.textContent = window.t ? window.t('sync_discord_btn_disconnect') : 'Disconnect';
      $.btnLanyardConnect.classList.add('connected');
    }
  });
}

/* Extended stats toggle */
if ($.setExtendedStats) {
  $.setExtendedStats.addEventListener('change', () => {
    S.showExtendedStats = $.setExtendedStats.checked;
    applyExtendedStats();
    saveSettings();
  });
}

/* Own stats toggle */
if ($.setOwnStats) {
  $.setOwnStats.addEventListener('change', () => {
    S.showOwnStats = $.setOwnStats.checked;
    applyExtendedStats();
    saveSettings();
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

/* ============================================================
   STATUS BAR — bottom-left dot + text
   States: 'loading' | 'ok' | 'error'
   ============================================================ */
function setStatus(state, text) {
  const dot   = $.stDot;
  const txtEl = $.stText;
  if (!dot) return;
  dot.className = '';
  if      (state === 'loading') dot.classList.add('loading');
  else if (state === 'ok')      dot.classList.add('ok');
  else if (state === 'error')   dot.classList.add('error');
  if (txtEl && text !== undefined) txtEl.textContent = text;
}

/* ============================================================
   LANGUAGE TOGGLE — wired after i18n.js is loaded
   Works for both login card button AND settings panel selector
   ============================================================ */
function syncLangButtons(lang) {
  /* Login card mini-toggle */
  const btn = document.getElementById('lang-toggle');
  if (btn) btn.textContent = lang === 'fr' ? 'EN' : 'FR';
  /* Settings panel pill selector */
  document.querySelectorAll('[data-lang]').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === lang);
  });
}

function initLangToggle() {
  const currentLang = window.getLang ? window.getLang() : 'en';
  syncLangButtons(currentLang);

  /* Login card button */
  const btn = document.getElementById('lang-toggle');
  if (btn) {
    btn.addEventListener('click', () => {
      const next = (window.getLang && window.getLang() === 'fr') ? 'en' : 'fr';
      if (window.setLang) window.setLang(next);
      syncLangButtons(next);
      applyDynamicI18n();
    });
  }

  /* Settings panel language buttons */
  document.querySelectorAll('[data-lang]').forEach(b => {
    b.addEventListener('click', () => {
      const lang = b.dataset.lang;
      if (!lang) return;
      if (window.setLang) window.setLang(lang);
      syncLangButtons(lang);
      applyDynamicI18n();
    });
  });
}

/* Re-apply script-generated strings when language changes */
function applyDynamicI18n() {
  /* Status bar */
  if ($.stText) {
    const current = $.stText.textContent;
    /* Only replace known static strings */
    if (current === 'Connexion…' || current === 'Connecting…')
      $.stText.textContent = window.t ? window.t('status_connecting') : current;
  }
  /* Lanyard status if currently "off" */
  const lanyardTxt = $.lanyardStatusText;
  if (lanyardTxt) {
    const cur = lanyardTxt.textContent;
    if (cur.includes('Désactivé') || cur.includes('Disabled'))
      lanyardTxt.textContent = window.t ? window.t('sync_discord_off') : cur;
  }
  /* Lanyard connect button label */
  if ($.btnLanyardConnect) {
    const isConnected = $.btnLanyardConnect.classList.contains('connected');
    $.btnLanyardConnect.textContent = window.t
      ? window.t(isConnected ? 'sync_discord_btn_disconnect' : 'sync_discord_btn_connect')
      : (isConnected ? 'Disconnect' : 'Connect');
  }
  /* Test mode button */
  const testBtn = document.getElementById('btn-test-mode');
  if (testBtn) {
    testBtn.textContent = window.t
      ? window.t(testModeActive ? 'sync_test_mode_off' : 'sync_test_mode_btn')
      : testBtn.textContent;
  }
  /* Lyrics position desc */
  if (document.getElementById('lyrics-pos-desc')) updateLyricsPositionDesc();
  /* Layout desc */
  if ($.layoutDesc) updateLayoutDesc();
  /* Priority desc */
  syncPriorityButtons();
}

/* Expose for lanyard disconnect helper */
function updateLyricsPositionDesc() {
  const posDesc = document.getElementById('lyrics-pos-desc');
  if (!posDesc || !window.t) return;
  const pos = S.lyricsPosition || 'right';
  const map = { right: 'lyr_pos_side_desc', center: 'lyr_pos_center_desc', bottom: 'lyr_pos_bottom_desc' };
  posDesc.textContent = window.t(map[pos] || map.right);
}

/* Listen for language change events from i18n.js */
document.addEventListener('aura:langchange', () => applyDynamicI18n());

/* ---- INIT ---- */
(function init() {
  loadSettings();
  gcLRCCache();
  injectAriaLabels();
  injectPauseOverlay();
  injectOwnStatsToggle();
  initLangToggle();
  /* Initial status text from i18n */
  if ($.stText && window.t) $.stText.textContent = window.t('status_connecting');
  const { u, k } = loadCache();
  if (u && k) {
    $.cachedName.textContent = u;
    $.cachedEntry.style.display = 'flex';
    $.cachedEntry.addEventListener('click', () => connectWith(u, k));
  }
  /* Restore Lanyard connect button state */
  if (S.lanyardId && $.btnLanyardConnect) {
    $.btnLanyardConnect.textContent = window.t ? window.t('sync_discord_btn_disconnect') : 'Disconnect';
    $.btnLanyardConnect.classList.add('connected');
  }
  /* Restore Lanyard ID input */
  if ($.setLanyardId && S.lanyardId) $.setLanyardId.value = S.lanyardId;
})();

/* ---- LOGIN ---- */
$.btnConnect.addEventListener('click', attemptConnect);

async function attemptConnect() {
  const u = $.inUser.value.trim();
  const k = $.inKey.value.trim();
  if (!u) { showError(window.t ? window.t('login_err_user') : 'Enter your Last.fm username.'); return; }
  if (!k || k.length < 20) { showError(window.t ? window.t('login_err_key') : 'Invalid API key (32 hex characters).'); return; }
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
    /* Init télécommande (display mode) */
    if (window.rcInitDisplay) window.rcInitDisplay();
  } catch(err) {
    showLoading(false);
    showError(err.message || (window.t ? window.t('status_network_err') : 'Connection failed.'));
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

/* Mode Test */
const btnTestMode = document.getElementById('btn-test-mode');
if (btnTestMode) btnTestMode.addEventListener('click', toggleTestMode);

/* ============================================================
   IDLE / UI FADE
   ============================================================ */
function resetIdle() {
  document.body.classList.remove('is-idle');
  document.body.style.cursor = 'default';
  clearTimeout(idleTimer);
  if (settingsOpen || histOpen) return;
  // Zen/focus mode: shorter 2s delay before hiding UI
  const delay = zenMode ? 2000 : 5000;
  idleTimer = setTimeout(() => {
    document.body.classList.add('is-idle');
    document.body.style.cursor = 'none';
  }, delay);
}
const _resetIdleThrottled = throttle(resetIdle, 200);
document.addEventListener('mousemove', _resetIdleThrottled, { passive: true });
document.addEventListener('click',     resetIdle);
document.addEventListener('keydown',   resetIdle);

/* ============================================================
   ZEN / FOCUS ALBUM MODE
   ============================================================ */
function toggleZenMode() {
  zenMode = !zenMode;
  document.body.classList.toggle('zen-mode', zenMode);
  const btn = document.getElementById('btn-zen');
  if (btn) {
    btn.classList.toggle('active', zenMode);
    btn.setAttribute('aria-pressed', zenMode ? 'true' : 'false');
    btn.setAttribute('aria-label', zenMode ? 'Disable Focus Album mode' : 'Enable Focus Album mode');
  }
  if (zenMode) {
    // Close all panels (including lyrics) when entering focus mode
    if (lyricsOpen || histOpen || settingsOpen) closeAllPanels();
    // Let resetIdle handle the 2s delay (instead of immediately hiding)
    resetIdle();
  } else {
    document.body.classList.remove('is-idle');
    document.body.style.cursor = 'default';
    resetIdle();
  }
}
const btnZen = document.getElementById('btn-zen');
if (btnZen) btnZen.addEventListener('click', () => { toggleZenMode(); resetIdle(); });

/* ============================================================
   PAUSE OVERLAY — icône pause + assombrissement de la pochette
   Injecté dynamiquement dans #art-wrap au démarrage.
   Contrôlé par .art-paused sur #art-wrap et #pause-overlay.visible
   ============================================================ */
function injectPauseOverlay() {
  if (document.getElementById('pause-overlay')) return;

  /* ── Overlay DOM ── */
  const overlay = document.createElement('div');
  overlay.id = 'pause-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <svg viewBox="0 0 24 24" fill="currentColor" width="36" height="36" aria-hidden="true">
      <rect x="5"  y="3" width="4" height="18" rx="1.5"/>
      <rect x="15" y="3" width="4" height="18" rx="1.5"/>
    </svg>
  `;

  /* ── Styles injectés — pas besoin de modifier style.css ── */
  const style = document.createElement('style');
  style.id = 'aura-pause-overlay-style';
  style.textContent = `
    /* Pause overlay sur la pochette */
    #art-wrap {
      position: relative;
    }
    #pause-overlay {
      position:        absolute;
      inset:           0;
      z-index:         8;
      display:         flex;
      align-items:     center;
      justify-content: center;
      border-radius:   inherit;
      background:      rgba(0, 0, 0, 0);
      color:           rgba(255, 255, 255, 0);
      opacity:         0;
      pointer-events:  none;
      transition:      opacity 0.35s ease, background 0.35s ease, color 0.35s ease;
    }
    #pause-overlay.visible {
      opacity:    1;
      background: rgba(0, 0, 0, 0.38);
      color:      rgba(255, 255, 255, 0.92);
    }
    #pause-overlay svg {
      filter: drop-shadow(0 2px 8px rgba(0,0,0,0.4));
    }

    /* Assombrissement de la pochette en pause */
    #art-wrap.art-paused #art-a,
    #art-wrap.art-paused #art-b {
      filter:     brightness(0.72) saturate(0.8);
      transition: filter 0.35s ease;
    }
    #art-wrap:not(.art-paused) #art-a,
    #art-wrap:not(.art-paused) #art-b {
      filter:     brightness(1) saturate(1);
      transition: filter 0.35s ease;
    }
  `;

  document.head.appendChild(style);
  if ($.artWrap) $.artWrap.appendChild(overlay);
}

/* ============================================================
   OWN STATS TOGGLE — injecte le contrôle dans les settings
   si l'élément n'existe pas encore dans le HTML.
   ============================================================ */
function injectOwnStatsToggle() {
  /* Le toggle "Mes stats" est désormais directement dans le HTML — rien à injecter.
     On se contente de câbler l'événement si l'élément n'est pas encore wiré. */
  const el = document.getElementById('set-own-stats');
  if (!el) return;
  $.setOwnStats = el;
  if (el._wired) return;
  el._wired = true;
  el.checked = !!S.showOwnStats;
  el.addEventListener('change', () => {
    S.showOwnStats = el.checked;
    applyExtendedStats();
    saveSettings();
  });
}

/* ============================================================
   ARIA LABELS
   ============================================================ */
function injectAriaLabels() {
  const labels = {
    'btn-lyrics':   window.t ? window.t('btn_lyrics') : 'Lyrics',
    'btn-hist': window.t ? window.t('btn_history') : 'History',
    'btn-settings': window.t ? window.t('btn_settings') : 'Settings',
    'btn-fs':       'Plein écran',
    'btn-logout':   window.t ? window.t('sync_logout') : 'Log out',
    'ctx-btn-lastfm': 'Ouvrir sur Last.fm',
    'ctx-btn-share':  'Partager (Story 9:16)',
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
  /* 1. Wikipedia EN — source la plus fiable pour les photos d'artistes */
  try {
    const r = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(artist)}&prop=pageimages&format=json&pithumbsize=600&origin=*`
    );
    if (r.ok) {
      const d = await r.json();
      const pages = d.query?.pages || {};
      for (const page of Object.values(pages)) {
        if (page.thumbnail?.source) return page.thumbnail.source;
      }
    }
  } catch {}

  /* 2. Wikipedia FR — fallback si l'artiste est francophone */
  try {
    const r = await fetch(
      `https://fr.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(artist)}&prop=pageimages&format=json&pithumbsize=600&origin=*`
    );
    if (r.ok) {
      const d = await r.json();
      const pages = d.query?.pages || {};
      for (const page of Object.values(pages)) {
        if (page.thumbnail?.source) return page.thumbnail.source;
      }
    }
  } catch {}

  /* 3. iTunes Search — artwork artiste 600×600 */
  try {
    const r = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(artist)}&entity=musicArtist&limit=5&country=fr`);
    if (r.ok) {
      const d = await r.json();
      const exact = d.results?.find(a => a.artistName?.toLowerCase() === artist.toLowerCase());
      const hit   = exact || d.results?.[0];
      if (hit?.artworkUrl100) return hit.artworkUrl100.replace('100x100bb', '600x600bb').replace('/100x100/', '/600x600/');
    }
  } catch {}

  /* 4. Deezer — photo artiste */
  try {
    const r = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(artist)}&limit=1`);
    if (r.ok) { const d = await r.json(); const img = d.data?.[0]?.picture_xl || d.data?.[0]?.picture_big; if (img) return img; }
  } catch {}

  /* 5. TheAudioDB direct */
  try {
    const r = await fetch(`https://www.theaudiodb.com/api/v1/json/2/search.php?s=${encodeURIComponent(artist)}`);
    if (r.ok) { const img = (await r.json()).artists?.[0]?.strArtistThumb; if (img) return img; }
  } catch {}

  /* 6. Last.fm fallback */
  try {
    const r = await fetch(`https://ws.audioscrobbler.com/2.0/?method=artist.getInfo&artist=${encodeURIComponent(artist)}&api_key=${apiKey}&format=json`);
    if (r.ok) {
      const imgs = (await r.json()).artist?.image || [];
      for (let i = imgs.length - 1; i >= 0; i--) {
        const u = imgs[i]['#text'];
        if (u && u.length > 10 && !u.includes('2a96cbd8b46e442fc41c2b86b821562f')) return u;
      }
    }
  } catch {}
  return null;
}
function applyAvatarUrl(url) {
  if (!url) return;
  /* Pas de crossOrigin — évite les erreurs CORS sur certaines sources (iTunes, Deezer) */
  $.artistAvatar.src = url;
  $.artistAvatar.classList.add('loaded');
  if ($.avatarFallback) $.avatarFallback.style.opacity = '0';
}
async function updateArtistAvatar(artist) {
  if (!S.showAvatar) return;
  // Check cache FIRST — avoids flicker if image is already available
  const cached = avatarSWRCache[artist] || getAvatarFromStorage(artist);
  if (cached) {
    // We already have a URL: just apply it smoothly without resetting
    $.avatarCircle.classList.add('on');
    applyAvatarUrl(cached);
  } else {
    // No cache: reset to fallback while we fetch
    $.avatarCircle.classList.remove('on');
    $.artistAvatar.classList.remove('loaded');
    $.artistAvatar.src = '';
    if ($.avatarFallback) {
      $.avatarFallback.style.background = fallbackGradient(artist);
      $.avatarFallback.textContent = fallbackLetter(artist);
      $.avatarFallback.style.opacity = '1';
    }
    $.avatarCircle.classList.add('on');
  }
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

function startPolling() {
    poll(); 
    pollTimer = setInterval(poll, 1000);
}

async function poll() {
    if (lanyardActive && lanyardSpotifyData) {
        setStatus('ok', (window.t ? window.t('status_sync') : '⚡ AURA Sync · ') + (lanyardSpotifyData.song || ''));
        
        try {
            const { history } = await fetchRecentTracks(10);
            renderHistory(history);
        } catch (e) {
            console.error("Erreur historique:", e);
        }
        return;
    }

    if (S.sourcePriority === 'lastfm' || !lanyardActive) {
        try {
            const { current, history } = await fetchRecentTracks(10);
            handleTrack(current);
            renderHistory(history);
            setStatus('ok', username !== originalUser ? (window.t ? window.t('status_viewing') : 'Viewing: ') + username : (window.t ? window.t('status_live') : 'Live'));
        } catch (err) {
            setStatus('error', window.t ? window.t('status_network_err') : 'Network error');
        }
    }
}

/* ============================================================
   LANYARD — WebSocket
   ============================================================ */
let lanyardWs = null, lanyardHbInterval = null, lanyardReconnectTimer = null;
let lanyardActive = false, lanyardSpotifyData = null;
let lanyardTimestampStart = 0, lanyardTimestampEnd = 0, lanyardCurrentDiscordId = '';

function lanyardConnect(discordId) {
  if (!discordId) return;

  /* ── Validation : un ID Discord est un entier de 17-19 chiffres ── */
  if (!/^\d{17,19}$/.test(discordId)) {
    console.warn('[Lanyard] ID Discord invalide :', discordId);
    setLanyardStatus('error', window.t ? window.t('lanyard_invalid_id') : 'Invalid ID');
    if ($.btnLanyardConnect) {
      $.btnLanyardConnect.textContent = 'Connecter';
      $.btnLanyardConnect.classList.remove('connected');
    }
    return;
  }

  console.log('[Lanyard] Connexion avec l\'ID :', discordId);
  lanyardCurrentDiscordId = discordId;
  lanyardDisconnect();
  setLanyardStatus('connecting', window.t ? window.t('lanyard_connecting') : 'Connecting…');

  try { lanyardWs = new WebSocket('wss://api.lanyard.rest/socket'); }
  catch (err) {
    console.error('[Lanyard] WebSocket non supporté :', err);
    setLanyardStatus('error', window.t ? window.t('lanyard_ws_unsupported') : 'WebSocket not supported');
    return;
  }

  /* Timeout de connexion : si rien au bout de 8s → erreur */
  const connectTimeout = setTimeout(() => {
    if (lanyardWs && lanyardWs.readyState !== WebSocket.OPEN) {
      console.warn('[Lanyard] Timeout — aucune réponse de lanyard.rest');
      setLanyardStatus('error', window.t ? window.t('lanyard_timeout') : 'Timeout');
      lanyardWs.close();
    }
  }, 8000);

  lanyardWs.onopen = () => {
    console.log('[Lanyard] WebSocket ouvert');
    clearTimeout(connectTimeout);
  };

  lanyardWs.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      console.log('[Lanyard] Message reçu — op:', msg.op, '/ t:', msg.t || '—');

      if (msg.op === 1) {
        /* Hello — démarrer le heartbeat puis s'abonner */
        console.log('[Lanyard] Hello reçu, heartbeat:', msg.d.heartbeat_interval, 'ms');
        lanyardHbInterval = setInterval(() => {
          if (lanyardWs?.readyState === WebSocket.OPEN) {
            lanyardWs.send(JSON.stringify({ op: 3 }));
            console.log('[Lanyard] Heartbeat envoyé');
          }
        }, msg.d.heartbeat_interval);
        lanyardWs.send(JSON.stringify({ op: 2, d: { subscribe_to_id: discordId } }));
        console.log('[Lanyard] Abonnement envoyé pour l\'ID :', discordId);
        if ($.lanyardWsBadge) $.lanyardWsBadge.style.display = 'inline-block';

      } else if (msg.op === 0 && (msg.t === 'INIT_STATE' || msg.t === 'PRESENCE_UPDATE')) {
        console.log('[Lanyard] Présence reçue (', msg.t, ')');
        console.log('[Lanyard] spotify :', msg.d?.spotify || null);
        console.log('[Lanyard] activities :', msg.d?.activities?.length ?? 0, 'activité(s)');
        lanyardHandlePresence(msg.d);
      }
    } catch (err) {
      console.error('[Lanyard] Erreur de parsing du message :', err);
    }
  };

  lanyardWs.onerror = (err) => {
    console.error('[Lanyard] Erreur WebSocket :', err);
    clearTimeout(connectTimeout);
    setLanyardStatus('error', window.t ? window.t('lanyard_ws_error') : 'Connection failed');
    if ($.lanyardWsBadge) $.lanyardWsBadge.style.display = 'none';
  };

  lanyardWs.onclose = (ev) => {
    console.log('[Lanyard] WebSocket fermé — code:', ev.code, '/ raison:', ev.reason || 'inconnue');
    clearTimeout(connectTimeout);
    lanyardActive = false; lanyardSpotifyData = null;
    if ($.lanyardWsBadge) $.lanyardWsBadge.style.display = 'none';
    if (lanyardHbInterval) { clearInterval(lanyardHbInterval); lanyardHbInterval = null; }
    if (lanyardCurrentDiscordId) {
      setLanyardStatus('connecting', window.t ? window.t('lanyard_reconnecting') : 'Reconnecting in 5s…');
      console.log('[Lanyard] Tentative de reconnexion dans 5s…');
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
  setLanyardStatus('off', window.t ? window.t('sync_discord_off') : 'Disabled — enter an ID to activate');
}
/* ============================================================
   DISCORD IMAGE URL — résout toutes les variantes de large_image
   ============================================================ */
/**
 * getDiscordImageUrl(activity)
 * Prend une activité Discord brute et retourne l'URL de l'image associée.
 *   · spotify:{id}      → https://i.scdn.co/image/{id}
 *   · mp:external/...   → https://media.discordapp.net/external/...
 *   · {asset_id}        → https://cdn.discordapp.com/app-assets/{appId}/{asset_id}.png
 * Retourne null si aucune image n'est trouvée, ce qui déclenche le fallback.
 */
function getDiscordImageUrl(activity) {
  const img = activity?.assets?.large_image;
  if (!img) return null;

  if (img.startsWith('spotify:')) {
    // Pochette Spotify native
    return `https://i.scdn.co/image/${img.replace('spotify:', '')}`;
  }

  if (img.startsWith('mp:external/')) {
    // Proxy média externe Discord
    return `https://media.discordapp.net/external/${img.replace('mp:external/', '')}`;
  }

  // Asset d'application Discord standard
  const appId = activity.application_id;
  if (appId) return `https://cdn.discordapp.com/app-assets/${appId}/${img}.png`;

  return null;
}

/* ============================================================
   STATISTIQUES ÉTENDUES
   Récupère les playcounts via Last.fm avec le username pour
   obtenir à la fois les stats globales et les stats personnelles.
   ============================================================ */
async function fetchExtendedStats(artist, albumTitle, trackTitle) {
  if (!$.extendedStats && !$.subStats) return;
  if (!S.showExtendedStats) { hideSubStats(); return; }
  if (!apiKey || !artist) { if ($.extendedStats) $.extendedStats.textContent = ''; hideSubStats(); return; }

  try {
    const userParam = username ? `&username=${encodeURIComponent(username)}` : '';

    const [artRes, albRes, trkRes] = await Promise.all([
      fetch(
        `https://ws.audioscrobbler.com/2.0/` +
        `?method=artist.getInfo&artist=${encodeURIComponent(artist)}` +
        `&api_key=${apiKey}&format=json${userParam}`
      ).then(r => r.json()),

      albumTitle
        ? fetch(
            `https://ws.audioscrobbler.com/2.0/` +
            `?method=album.getInfo&artist=${encodeURIComponent(artist)}` +
            `&album=${encodeURIComponent(albumTitle)}` +
            `&api_key=${apiKey}&format=json${userParam}`
          ).then(r => r.json())
        : Promise.resolve(null),

      (S.showOwnStats && trackTitle)
        ? fetch(
            `https://ws.audioscrobbler.com/2.0/` +
            `?method=track.getInfo&artist=${encodeURIComponent(artist)}` +
            `&track=${encodeURIComponent(trackTitle)}` +
            `&api_key=${apiKey}&format=json${userParam}`
          ).then(r => r.json())
        : Promise.resolve(null),
    ]);

    /* ── Global stats ── */
    const artGlobalPlays = parseInt(artRes?.artist?.stats?.playcount || '0');
    const albGlobalPlays = parseInt(albRes?.album?.playcount || '0');

    /* ── My personal stats ── */
    const myArtPlays = S.showOwnStats ? parseInt(artRes?.artist?.stats?.userplaycount || '0') : 0;
    const myTrkPlays = S.showOwnStats ? parseInt(trkRes?.track?.userplaycount || '0') : 0;

    const locale = window.getLang ? window.getLang() + '-' + (window.getLang() === 'fr' ? 'FR' : 'US') : undefined;
    const fmt    = n  => n.toLocaleString(locale);
    const fmtK   = n  => n >= 1000000 ? (n/1000000).toFixed(1).replace('.0','') + 'M'
                       : n >= 1000    ? (n/1000).toFixed(1).replace('.0','') + 'K'
                       : String(n);
    const tStr   = k  => window.t ? window.t(k) : k;

    /* ── #extended-stats — hidden compact line (kept for reference, not shown by default) ── */
    if ($.extendedStats) $.extendedStats.textContent = '';

    /* ── #sub-stats — new card-based design ── */
    const statsType = S.statsType || 'artist';
    const nextArrow = statsType === 'artist' ? 'album' : 'artist';

    /* Determine which global count to show */
    const globalVal   = statsType === 'artist' ? artGlobalPlays : albGlobalPlays;
    const globalScope = statsType === 'artist' ? tStr('stats_scope_artist') : tStr('stats_scope_album');
    /* Personal count: artist plays for "artist" mode, track plays for "album" mode */
    const myVal       = S.showOwnStats && username
      ? (statsType === 'artist' ? myArtPlays : myTrkPlays)
      : 0;

    if (globalVal > 0 && $.subStats) {
      const switchLabel = tStr(statsType === 'artist' ? 'stats_switch_album' : 'stats_switch_artist');

      /* Build HTML */
      let html = `<div class="ss-cards">`;

      /* Card 1 — Global plays */
      html += `
        <div class="ss-card ss-card-global">
          <div class="ss-card-icon">
            <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zM2 8a6 6 0 1112 0A6 6 0 012 8z" opacity=".4"/><path d="M8 4v4.5l3 1.5-.5.87L7 9V4h1z"/></svg>
          </div>
          <div class="ss-card-body">
            <span class="ss-val">${fmtK(globalVal)}</span>
            <span class="ss-label">${globalScope}</span>
          </div>
        </div>`;

      /* Card 2 — My plays (only if enabled and > 0) */
      if (myVal > 0) {
        const myLabel = statsType === 'artist'
          ? tStr('stats_my_artist')
          : tStr('stats_my_track');
        html += `
          <div class="ss-card ss-card-personal">
            <div class="ss-card-icon">
              <svg viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="5" r="3"/><path d="M2 13c0-3.31 2.69-5 6-5s6 1.69 6 5H2z"/></svg>
            </div>
            <div class="ss-card-body">
              <span class="ss-val ss-val-accent">${fmtK(myVal)}</span>
              <span class="ss-label">${myLabel}</span>
            </div>
          </div>`;
      }

      /* Switch button */
      html += `
        <button class="ss-switch" data-next-type="${nextArrow}" title="Switch to ${switchLabel}">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <path d="M3 5h10M3 8h7M3 11h4"/>
          </svg>
          ${switchLabel}
        </button>`;

      html += `</div>`;

      $.subStats.innerHTML = html;

      /* Wire switch button */
      $.subStats.querySelector('.ss-switch')?.addEventListener('click', () => {
        S.statsType = nextArrow; saveSettings();
        syncStatsTypeButtons();
        if (currentTrack) {
          const a  = currentTrack.artist?.name || currentTrack.artist?.['#text'] || '';
          const al = currentTrack.album?.['#text'] || '';
          const t  = currentTrack.name || '';
          animateSubStats(() => fetchExtendedStats(a, al, t));
        }
      });
      showSubStats();
    } else {
      hideSubStats();
    }

  } catch {
    if ($.extendedStats) $.extendedStats.textContent = '';
    hideSubStats();
  }
}

/* ── Animation helpers pour #sub-stats ── */
function showSubStats() {
  if (!$.subStats) return;
  requestAnimationFrame(() => $.subStats.classList.add('show'));
}
function hideSubStats() {
  if (!$.subStats) return;
  $.subStats.classList.remove('show');
}
function animateSubStats(callback) {
  if (!$.subStats) { callback?.(); return; }
  hideSubStats();
  setTimeout(() => { callback?.(); }, 300);
}

/* ── Sync boutons statsType dans settings ── */
function syncStatsTypeButtons() {
  document.querySelectorAll('[data-stats-type]').forEach(b =>
    b.classList.toggle('active', b.dataset.statsType === (S.statsType || 'artist'))
  );
}

function applyExtendedStats() {
  if ($.extendedStats) {
    $.extendedStats.classList.toggle('on', S.showExtendedStats);
    if (!S.showExtendedStats) {
      $.extendedStats.textContent = '';
      hideSubStats();
    } else if (currentTrack) {
      const artist = currentTrack.artist?.name || currentTrack.artist?.['#text'] || '';
      const album  = currentTrack.album?.['#text'] || '';
      const title  = currentTrack.name || '';
      fetchExtendedStats(artist, album, title);
    }
  }
  syncStatsTypeButtons();
  /* Afficher/masquer la row statsType selon si les stats sont activées */
  const row = document.getElementById('sp-sub-stats-row');
  if (row) row.style.opacity = S.showExtendedStats ? '1' : '0.35';
}

function syncPriorityButtons() {
  document.querySelectorAll('[data-priority]').forEach(btn => {
    const active = btn.dataset.priority === S.sourcePriority;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  /* Mettre à jour le texte de description */
  const descEl = document.getElementById('priority-desc');
  if (descEl) {
    descEl.textContent = S.sourcePriority === 'lastfm'
      ? (window.t ? window.t('sync_priority_status_lastfm') : 'Discord status is ignored. AURA relies solely on your Last.fm scrobbles.')
      : (window.t ? window.t('sync_priority_status_discord') : 'When connected via Discord, your music appears in real time. Otherwise, AURA uses Last.fm automatically.');
  }
}

function lanyardHandlePresence(data) {
  let spotifyData = null, trackPaused = false;

  if (data.spotify?.song) {

    /* ── Spotify natif via Lanyard ── */
    spotifyData = data.spotify;

    /* Pause Spotify : les timestamps disparaissent entièrement.
       Si end existe et est dans le futur → en lecture.
       Si start existe mais pas end → en pause (track figée).
       Si aucun timestamps → en pause. */
    const ts = data.spotify.timestamps;
    if (!ts || !ts.start) {
      trackPaused = true;
    } else if (!ts.end) {
      /* start without end = Spotify pause */
      trackPaused = true;
    } else if (ts.end <= Date.now()) {
      /* End already passed: track finished or late pause */
      trackPaused = true;
    } else {
      /* Active timestamps confirm playback */
      trackPaused = false;
    }

    console.log('[Lanyard] Spotify natif :', spotifyData.song, '—', spotifyData.artist);
    console.log('[Lanyard] Pochette :', spotifyData.album_art_url || '(absente)');
    console.log('[Lanyard] Pause :', trackPaused, '/ ts:', ts?.start, '→', ts?.end);

  } else {

    /* ── Activité musicale Discord type 2 (toute plateforme) ──
       Supporté : Spotify, Apple Music, Deezer, Tidal, YouTube Music,
       Soundcloud, Plex, etc. — tout player avec Rich Presence type 2.
    */
    const musicActivity = (data.activities || []).find(a => a.type === 2);

    if (musicActivity) {
      console.log('[Lanyard] Activité musicale tierce :', musicActivity.name, '(type 2)');

      const ts = musicActivity.timestamps || null;

      /* Même logique de détection de pause pour les apps tierces.
         Beaucoup de players type 2 envoient start+end quand ils jouent,
         et suppriment les timestamps (ou n'envoient que start) en pause. */
      if (!ts || !ts.start) {
        trackPaused = true;
      } else if (!ts.end) {
        /* start sans end : certaines apps (ex: Apple Music) le font toujours,
           d'autres uniquement en pause → on suppose lecture par défaut ici
           car on ne peut pas distinguer sans end. */
        trackPaused = false;
      } else if (ts.end <= Date.now()) {
        trackPaused = true;
      } else {
        trackPaused = false;
      }

      spotifyData = {
        song:          musicActivity.details || musicActivity.name || '',
        artist:        musicActivity.state   || '',
        album:         musicActivity.assets?.large_text || '',
        album_art_url: getDiscordImageUrl(musicActivity),
        timestamps:    ts,
      };

      console.log('[Lanyard] Plateforme :', musicActivity.name, '/ Pause :', trackPaused);

    } else {
      console.log('[Lanyard] Aucune musique. Activités :', (data.activities || []).map(a => `type:${a.type} — ${a.name}`));
    }
  }

  if (spotifyData) {
    lanyardActive      = true;
    lanyardSpotifyData = spotifyData;

    /* Timestamps pour la barre de progression */
    lanyardTimestampStart = spotifyData.timestamps?.start || 0;
    lanyardTimestampEnd   = spotifyData.timestamps?.end   || 0;

    const durationMs = (lanyardTimestampEnd > lanyardTimestampStart)
      ? lanyardTimestampEnd - lanyardTimestampStart
      : 0;

    setLanyardStatus('connected', `${trackPaused ? '⏸' : '🎵'} ${spotifyData.song}`);

    const syntheticTrack = {
      name:            spotifyData.song,
      artist:          { name: spotifyData.artist, '#text': spotifyData.artist },
      album:           { '#text': spotifyData.album || '' },
      albumArtUrl:     spotifyData.album_art_url || '',
      image:           spotifyData.album_art_url
                         ? [{ '#text': spotifyData.album_art_url, size: 'extralarge' }]
                         : [],
      duration:        durationMs > 0 ? Math.floor(durationMs / 1000) * 1000 : 0,
      _fromLanyard:    true,
      _timestampStart: lanyardTimestampStart,
      _timestampEnd:   lanyardTimestampEnd,
      _isPaused:       trackPaused,
    };

    if (S.sourcePriority !== 'lastfm') {
      handleTrack(syntheticTrack, true);
      setPausedState(trackPaused);
    }

  } else {
    lanyardActive      = false;
    lanyardSpotifyData = null;
    lanyardTimestampStart = 0;
    lanyardTimestampEnd   = 0;
    setLanyardStatus('no-music', window.t ? window.t('lanyard_no_music') : 'No music detected');
    if (S.sourcePriority !== 'lastfm') handleTrack(null);
  }
}
/* setLanyardStatus — éclair button removed, only updates settings panel dot */
function setLanyardStatus(state, text) {
  const dot = $.lanyardDot, txtEl = $.lanyardStatusText;
  if (!dot) return;
  dot.className = 'lanyard-dot';
  if      (state === 'connecting') dot.classList.add('connecting');
  else if (state === 'connected')  dot.classList.add('connected');
  else if (state === 'no-music')   dot.classList.add('no-music');
  else if (state === 'error')      dot.classList.add('error');
  else if (state === 'test')       dot.classList.add('test');
  if (txtEl) txtEl.textContent = text;
}

/* ============================================================
   MODE TEST — simule une écoute sans Spotify ni Last.fm
   Pochette : Unsplash random (seed change à chaque activation)
   Durée simulée : 3 minutes 30
   ============================================================ */
let testModeActive = false;
let testModeInterval = null;

/* Pool de morceaux de démo, changent à chaque activation */
const TEST_TRACKS = [
  { title: 'Musique de démonstration', artist: 'Aura Test', album: 'Demo Album', seed: 'music' },
  { title: 'Neon Reverie',             artist: 'Aura Test', album: 'Neon Sessions', seed: 'neon' },
  { title: 'Midnight Gradient',        artist: 'Aura Test', album: 'Visual Sounds', seed: 'night' },
  { title: 'Frequencies',             artist: 'Aura Test', album: 'Spectrum', seed: 'abstract' },
];
let testTrackIndex = 0;

function toggleTestMode() {
  const btn = document.getElementById('btn-test-mode');

  if (testModeActive) {
    /* ── Désactivation ── */
    testModeActive = false;
    clearInterval(testModeInterval); testModeInterval = null;
    console.log('[Mode Test] Désactivé');

    setLanyardStatus('off', window.t ? window.t('sync_discord_off') : 'Disabled — enter an ID to activate');
    if ($.lanyardWsBadge) $.lanyardWsBadge.style.display = 'none';
    if (btn) { btn.textContent = window.t ? window.t('sync_test_mode_btn') : '▶ Enable Test Mode'; btn.classList.remove('test-active'); }

    /* Remettre la source normale */
    handleTrack(null);
    document.body.classList.remove('is-playing', 'is-paused');
    return;
  }

  /* ── Activation ── */
  testModeActive = true;
  testTrackIndex = (testTrackIndex + 1) % TEST_TRACKS.length;
  const t = TEST_TRACKS[testTrackIndex];
  console.log('[Mode Test] Activé — morceau :', t.title);

  /* Pochette Unsplash random avec seed fixe pour la session */
  const artUrl = `https://picsum.photos/seed/${t.seed}${Date.now() % 100}/600/600`;

  const fakeTrack = {
    name:           t.title,
    artist:         { name: t.artist, '#text': t.artist },
    album:          { '#text': t.album },
    albumArtUrl:    artUrl,
    image:          [{ '#text': artUrl, size: 'extralarge' }],
    duration:       210000, /* 3 min 30 */
    _fromLanyard:   false,
    _timestampStart: 0,
    _timestampEnd:   0,
    _isTest:        true,
  };

  setLanyardStatus('test', window.t ? window.t('lanyard_test') : '🧪 Test mode active');
  if ($.lanyardWsBadge) {
    $.lanyardWsBadge.textContent = 'TEST';
    $.lanyardWsBadge.style.display = 'inline-block';
  }
  if (btn) { btn.textContent = window.t ? window.t('sync_test_mode_off') : '⏹ Stop Test Mode'; btn.classList.add('test-active'); }

  /* Afficher le morceau de démo */
  handleTrack(fakeTrack, false);
  setPausedState(false);

  /* Simuler la progression : boucle toutes les 3m30 */
  clearInterval(testModeInterval);
  testModeInterval = setInterval(() => {
    if (!testModeActive) { clearInterval(testModeInterval); return; }
    testTrackIndex = (testTrackIndex + 1) % TEST_TRACKS.length;
    const next = TEST_TRACKS[testTrackIndex];
    const nextArt = `https://picsum.photos/seed/${next.seed}${Date.now() % 100}/600/600`;
    handleTrack({
      name:        next.title,
      artist:      { name: next.artist, '#text': next.artist },
      album:       { '#text': next.album },
      albumArtUrl: nextArt,
      image:       [{ '#text': nextArt, size: 'extralarge' }],
      duration:    210000,
      _fromLanyard: false, _isTest: true,
    }, false);
    console.log('[Mode Test] Morceau suivant :', next.title);
  }, 210000);
}

/* ---- PAUSE STATE ---- */
function setPausedState(paused) {
  if (isPaused === paused) return;
  isPaused = paused;

  const overlay = document.getElementById('pause-overlay');

  if (paused) {
    /* ── Passage en pause ── */
    trackPausedAt = Date.now();
    cancelAnimationFrame(progressRAF);

    if (lrcSynced) { cancelAnimationFrame(lrcRAF); lrcRAF = null; }
    if (!S.canvasViz) stopCanvasViz();

    /* Afficher l'overlay pause + assombrir la pochette */
    if (overlay)   overlay.classList.add('visible');
    if ($.artWrap) $.artWrap.classList.add('art-paused');

  } else {
    /* ── Reprise de lecture ── */
    if (trackPausedAt > 0) {
      /* Décaler trackStartTime de la durée de pause pour que
         la progression reprenne exactement où elle s'était arrêtée */
      trackStartTime += Date.now() - trackPausedAt;
      trackPausedAt = 0;
    }

    progressRAF = requestAnimationFrame(updateTrackProgress);

    if (lrcSynced && lyricsOpen) { cancelAnimationFrame(lrcRAF); tickLRC(); }
    if (S.canvasViz) startCanvasViz();

    /* Masquer l'overlay pause */
    if (overlay)   overlay.classList.remove('visible');
    if ($.artWrap) $.artWrap.classList.remove('art-paused');
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
  if (!trackStartTime || isPaused) return;

  let pct;

  /* Priorité absolue : si on a start ET end Discord, le pourcentage
     est calculé directement depuis les timestamps — toujours exact,
     indépendant de la durée stockée ou des dérives de timer. */
  if (
    currentTrack?._fromLanyard &&
    currentTrack._timestampStart > 0 &&
    currentTrack._timestampEnd   > 0 &&
    currentTrack._timestampEnd   > currentTrack._timestampStart
  ) {
    const elapsed = Date.now() - currentTrack._timestampStart;
    const total   = currentTrack._timestampEnd - currentTrack._timestampStart;
    pct = Math.min((elapsed / total) * 100, 100);

  } else {
    /* Fallback : durée estimée (Last.fm ou test mode) */
    if (!trackDuration) return;
    pct = Math.min((getElapsedMs() / 1000 / trackDuration) * 100, 100);
  }

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
window.addEventListener('resize', (() => {
  let resizeTimer;
  return () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (currentTrack) checkTitleOverflow(); }, 150);
  };
})());

/* ---- HANDLE TRACK ---- */
function handleTrack(track, fromLanyard = false) {
  if (!track) {
    $.noTrack.classList.add('on');
    $.content.style.opacity = '0';
    $.mq.textContent = ('· · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · ').repeat(3);
    cancelAnimationFrame(progressRAF);
    $.artWrap.classList.remove('playing');
    document.body.classList.remove('is-playing', 'is-paused', 'source-lanyard');

    /* Masquer l'overlay pause si on n'écoute plus rien */
    const overlay = document.getElementById('pause-overlay');
    if (overlay) overlay.classList.remove('visible');
    if ($.artWrap) $.artWrap.classList.remove('art-paused');
    if (S.colorThief) document.documentElement.style.setProperty('--accent', S.accentColor);
    if (S.fluidGradient && $.fluidGradientBg) $.fluidGradientBg.classList.remove('on');
    stopLRC();
    isPaused = false; trackStartTime = 0; trackPausedAt = 0;
    currentTrack = null; currentTrackId = '';
    if (!S.canvasViz) stopCanvasViz();
    if ($.extendedStats) $.extendedStats.textContent = '';
    hideSubStats();
    return;
  }

  $.noTrack.classList.remove('on');
  $.content.style.opacity = '1';
  const id = trackId(track), isSame = (id === currentTrackId);

  if (isSame && fromLanyard) {
    const np = track._isPaused || false;
    /* ── Seek / timestamp change detection ──
       If start changed significantly (>3s) → playback resumed or seeked → force play */
    const startChanged = track._timestampStart > 0 && track._timestampStart !== currentTrack._timestampStart;
    const endChanged   = track._timestampEnd   > 0 && track._timestampEnd   !== currentTrack._timestampEnd;

    /* Extra safety: if timestamps show the track is actively progressing
       (start recently set, end in the future) treat as playing regardless of _isPaused flag.
       This catches Spotify's edge case where it sends isPaused=true right after track change. */
    const tsStart = track._timestampStart || 0;
    const tsEnd   = track._timestampEnd   || 0;
    const now = Date.now();
    const tsConfirmsPlaying = tsStart > 0 && tsEnd > now && (now - tsStart) > 500;
    const resolvedPaused = tsConfirmsPlaying ? false : np;

    if (startChanged || endChanged) {
      currentTrack._timestampStart = track._timestampStart;
      currentTrack._timestampEnd   = track._timestampEnd;
      currentTrack.duration        = track.duration;
      lanyardTimestampStart = track._timestampStart;
      lanyardTimestampEnd   = track._timestampEnd;
      /* Reset progress bar instantly */
      $.progressBar.style.transition = 'none';
      $.progressBar.style.width      = '0%';
      void $.progressBar.offsetWidth;
      $.progressBar.style.transition = '';
      cancelAnimationFrame(progressRAF);
      if (!resolvedPaused) progressRAF = requestAnimationFrame(updateTrackProgress);
    }
    if (resolvedPaused !== isPaused) setPausedState(resolvedPaused);
    return;
  }
  if (isSame && !fromLanyard) return;

  /* ── New track: always clear pause state first ── */
  if (isPaused) {
    isPaused = false;
    const overlay = document.getElementById('pause-overlay');
    if (overlay) overlay.classList.remove('visible');
    if ($.artWrap) $.artWrap.classList.remove('art-paused');
    document.body.classList.remove('is-paused');
  }

  currentTrackId = id; currentTrack = track;
  /* Resolve pause state with timestamp sanity check */
  const _tsS = track._timestampStart || 0;
  const _tsE = track._timestampEnd   || 0;
  const _now = Date.now();
  const _tsConfirmsPlaying = _tsS > 0 && _tsE > _now && (_now - _tsS) > 500;
  isPaused = _tsConfirmsPlaying ? false : (track._isPaused || false);
  trackPausedAt = 0;

  /* Reset progress bar instantly */
  $.progressBar.style.transition = 'none';
  $.progressBar.style.width      = '0%';
  void $.progressBar.offsetWidth;
  $.progressBar.style.transition  = '';

  $.artWrap.classList.add('playing');
  document.body.classList.add('is-playing');
  document.body.classList.remove('is-paused');
  document.body.classList.toggle('source-lanyard', !!track._fromLanyard);

  if (track._fromLanyard && track._timestampStart > 0) {
    trackStartTime = track._timestampStart;
    trackDuration  = track.duration > 0 ? track.duration / 1000 : 180;
    /* Mettre à jour les timestamps globaux pour updateTrackProgress */
    lanyardTimestampStart = track._timestampStart;
    lanyardTimestampEnd   = track._timestampEnd || 0;
  } else {
    trackStartTime = Date.now();
    trackDuration  = track.duration && parseInt(track.duration) > 0 ? parseInt(track.duration) / 1000 : 180;
  }
  cancelAnimationFrame(progressRAF);
  if (!isPaused) progressRAF = requestAnimationFrame(updateTrackProgress);

  const artist = track.artist?.name || track.artist?.['#text'] || 'Unknown artist';
  const title  = track.name || 'Unknown title';
  $.mq.textContent = (title + '   ·   ' + artist + '   ·   ').repeat(10);

  $.title.classList.remove('show', 'scrolling', 'title-entering');
  $.artistRow.classList.remove('show');
  setTimeout(() => {
    $.title.textContent = title; $.artist.textContent = artist;
    void $.title.offsetWidth;
    $.title.classList.add('show', 'title-entering');
    $.artistRow.classList.add('show');
    setTimeout(() => { $.title.classList.remove('title-entering'); }, 800);
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

  /* Extended stats — fetch en arrière-plan avec animation */
  const album = track.album?.['#text'] || '';
  animateSubStats(() => fetchExtendedStats(artist, album, title));
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

  // Also update lyrics colors and Apple Music background
  applyLyricsColors();
  applyLyricsAmBg();

  // Auto lyrics active color from accent
  if (S.lyricsColorAuto && colors) {
    const vivid = colors.find(c => { const l=(c.r*299+c.g*587+c.b*114)/1000; return l>40&&l<200; }) || colors[0];
    if (vivid) {
      const hex = '#' + [vivid.r,vivid.g,vivid.b].map(v=>v.toString(16).padStart(2,'0')).join('');
      document.documentElement.style.setProperty('--lyrics-active-color', hex);
    }
  }
  // Auto lyrics bg
  if (S.lyricsBg === 'auto') applyLyricsBg();

  // Title color background
  if (S.bgMode === 'titlecolor' && colors) startTitleColorBg(colors);
  else stopTitleColorBg();
  updateDots();
}

/* ============================================================
   DECORATIVE DOTS — injected into .art-wrap for titlecolor mode (v8)
   ============================================================ */
let dotsContainer = null;
function ensureDotsContainer() {
  if (!$.artWrap) return null;
  if (!dotsContainer || !$.artWrap.contains(dotsContainer)) {
    dotsContainer = $.artWrap.querySelector('.title-dots-container');
    if (!dotsContainer) {
      dotsContainer = document.createElement('div');
      dotsContainer.className = 'title-dots-container';
      for (let i = 0; i < 5; i++) {
        const dot = document.createElement('div');
        dot.className = 'title-dot';
        dotsContainer.appendChild(dot);
      }
      $.artWrap.appendChild(dotsContainer);
    }
  }
  return dotsContainer;
}
function updateDots() {
  const el = ensureDotsContainer();
  if (!el) return;
  const show = S.titleDots && S.bgMode === 'titlecolor';
  el.style.opacity = show ? '1' : '0';
}

/* ---- TITLE COLOR BG — animated dominant-color orbs ---- */
let titleColorRAF = null, titleColorPhase = 0;
function startTitleColorBg(colors) {
  if ($.titleColorBg) $.titleColorBg.classList.add('on');
  if (!colors || colors.length < 2) colors = FLUID_FALLBACK;
  const [c0, c1, c2, c3] = [colors[0], colors[1], colors[2] || colors[0], colors[3] || colors[1]];

  // Build 4 orbiting radial gradients that animate via CSS keyframe injection
  const styleId = 'aura-tcbg-style';
  let el = document.getElementById(styleId);
  if (!el) { el = document.createElement('style'); el.id = styleId; document.head.appendChild(el); }

  const toRgb = c => `${c.r},${c.g},${c.b}`;
  el.textContent = `
    @property --tcbg-x0 { syntax: '<percentage>'; inherits: false; initial-value: 15%; }
    @property --tcbg-y0 { syntax: '<percentage>'; inherits: false; initial-value: 25%; }
    @property --tcbg-x1 { syntax: '<percentage>'; inherits: false; initial-value: 82%; }
    @property --tcbg-y1 { syntax: '<percentage>'; inherits: false; initial-value: 72%; }
    @property --tcbg-x2 { syntax: '<percentage>'; inherits: false; initial-value: 75%; }
    @property --tcbg-y2 { syntax: '<percentage>'; inherits: false; initial-value: 18%; }
    @property --tcbg-x3 { syntax: '<percentage>'; inherits: false; initial-value: 22%; }
    @property --tcbg-y3 { syntax: '<percentage>'; inherits: false; initial-value: 80%; }
    #title-color-bg {
      background:
        radial-gradient(ellipse 65% 55% at var(--tcbg-x0,15%) var(--tcbg-y0,25%), rgba(${toRgb(c0)},0.72) 0%, transparent 65%),
        radial-gradient(ellipse 60% 50% at var(--tcbg-x1,82%) var(--tcbg-y1,72%), rgba(${toRgb(c1)},0.60) 0%, transparent 65%),
        radial-gradient(ellipse 50% 55% at var(--tcbg-x2,75%) var(--tcbg-y2,18%), rgba(${toRgb(c2)},0.50) 0%, transparent 60%),
        radial-gradient(ellipse 55% 45% at var(--tcbg-x3,22%) var(--tcbg-y3,80%), rgba(${toRgb(c3)},0.45) 0%, transparent 60%);
      animation: titleColorBgMove0 18s ease-in-out infinite alternate,
                 titleColorBgMove1 23s ease-in-out infinite alternate-reverse,
                 titleColorBgMove2 27s ease-in-out infinite alternate,
                 titleColorBgMove3 31s ease-in-out infinite alternate-reverse;
    }
    @keyframes titleColorBgMove0 {
      0%   { --tcbg-x0:15%; --tcbg-y0:25%; }
      33%  { --tcbg-x0:28%; --tcbg-y0:18%; }
      66%  { --tcbg-x0:10%; --tcbg-y0:40%; }
      100% { --tcbg-x0:22%; --tcbg-y0:12%; }
    }
    @keyframes titleColorBgMove1 {
      0%   { --tcbg-x1:82%; --tcbg-y1:72%; }
      33%  { --tcbg-x1:70%; --tcbg-y1:80%; }
      66%  { --tcbg-x1:88%; --tcbg-y1:62%; }
      100% { --tcbg-x1:76%; --tcbg-y1:85%; }
    }
    @keyframes titleColorBgMove2 {
      0%   { --tcbg-x2:75%; --tcbg-y2:18%; }
      50%  { --tcbg-x2:60%; --tcbg-y2:30%; }
      100% { --tcbg-x2:80%; --tcbg-y2:12%; }
    }
    @keyframes titleColorBgMove3 {
      0%   { --tcbg-x3:22%; --tcbg-y3:80%; }
      50%  { --tcbg-x3:35%; --tcbg-y3:70%; }
      100% { --tcbg-x3:18%; --tcbg-y3:88%; }
    }
  `;
}
function stopTitleColorBg() {
  if ($.titleColorBg) $.titleColorBg.classList.remove('on');
  const el = document.getElementById('aura-tcbg-style');
  if (el) el.textContent = '';
}
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
    /* Fallback : image par défaut si aucune pochette n'est trouvée */
    const fallbackUrl = 'assets/default-cover.jpg';
    back.crossOrigin = 'anonymous';
    back.onerror = () => {
      /* Si l'image de fallback elle-même est absente, on utilise le dégradé */
      fbBack.style.background = grad; fbBack.textContent = letter; fbBack.style.opacity = '1';
      fbFront.style.opacity = '0'; back.style.opacity = '0'; front.style.opacity = '0';
      artSlot = artSlot==='a' ? 'b' : 'a';
      updateBg(null, grad); $.artGlow.style.background = grad; $.artGlow.style.backgroundImage = 'none';
      if (S.fluidGradient) triggerColorThief();
      setTimeout(() => { applyLyricsColors(); applyLyricsAmBg(); }, 100);
    };
    back.onload = () => {
      fbBack.style.opacity = '0'; back.style.opacity = '1';
      front.style.opacity = '0'; fbFront.style.opacity = '0';
      artSlot = artSlot==='a' ? 'b' : 'a';
      updateBg(fallbackUrl, null);
      $.artGlow.style.backgroundImage = `url('${fallbackUrl}')`;
      $.artGlow.style.background = 'transparent';
      setTimeout(() => { triggerColorThief(); applyLyricsColors(); applyLyricsAmBg(); }, 200);
    };
    back.src = fallbackUrl;
    if (back.complete && back.naturalWidth) back.onload();
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
    setTimeout(() => {
      triggerColorThief();
      applyLyricsColors();    // auto text color on new art
      applyLyricsAmBg();      // Apple Music background update
    }, 200);
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
let lrcWordRAF = null; // karaoke word-fill RAF
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

/* ── Mode basic / scroll / phrase ── */
function renderLRCLines(lines) {
  $.lrcContainer.innerHTML = '';
  const rm = S.lyricsRenderMode || 'phrase';
  lines.forEach((line, i) => {
    const div = document.createElement('div');
    div.className = 'lrc-line'; div.textContent = line.text; div.dataset.index = i;
    div.addEventListener('click', () => { lrcActiveIndex = i; updateLRCDisplay(); });
    $.lrcContainer.appendChild(div);
  });
}

/* ── Mode karaoke : split words, chaque mot = <span class="kw"> ── */
function renderLRCLinesKaraoke(lines) {
  $.lrcContainer.innerHTML = '';
  lines.forEach((line, i) => {
    const div = document.createElement('div');
    div.className = 'lrc-line'; div.dataset.index = i;
    const words = line.text.split(' ');
    words.forEach((word, wi) => {
      if (!word) return;
      const span = document.createElement('span');
      span.className = 'kw';
      span.textContent = word;
      span.dataset.word = word;  // used by ::after pseudo for overlay text
      span.dataset.wi = wi;
      span.style.setProperty('--kw-fill', '0%');
      div.appendChild(span);
      if (wi < words.length - 1) div.appendChild(document.createTextNode(' '));
    });
    div.addEventListener('click', () => { lrcActiveIndex = i; updateLRCDisplay(); });
    $.lrcContainer.appendChild(div);
  });
}

/* tickLRC — pilote tous les modes */
function tickLRC() {
  if (!lyricsOpen || !lrcSynced || !lrcLines.length) { lrcRAF = null; return; }
  if (isPaused) { lrcRAF = requestAnimationFrame(tickLRC); return; }
  const ms = getElapsedMs() + LYRICS_ADVANCE_MS + (S.lyricsOffset || 0);
  let ni = -1;
  for (let i = lrcLines.length-1; i >= 0; i--) { if (ms >= lrcLines[i].timeMs) { ni = i; break; } }
  if (ni !== lrcActiveIndex) { lrcActiveIndex = ni; updateLRCDisplay(); }
  /* Karaoke word fill */
  if ((S.lyricsRenderMode || 'phrase') === 'karaoke' && S.karaokeProgressiveFill !== false) {
    updateKaraokeWords(ms);
  }
  lrcRAF = requestAnimationFrame(tickLRC);
}

/* Karaoke progressive fill per word */
function updateKaraokeWords(ms) {
  if (lrcActiveIndex < 0 || lrcActiveIndex >= lrcLines.length) return;
  const activeLine = lrcLines[lrcActiveIndex];
  const nextLine   = lrcLines[lrcActiveIndex + 1];
  const lineStart  = activeLine.timeMs;
  const lineEnd    = nextLine ? nextLine.timeMs : lineStart + 3000;
  const lineDur    = lineEnd - lineStart;
  const words = $.lrcContainer.querySelectorAll('.lrc-line.active .kw');
  if (!words.length) return;
  const elapsed = ms - lineStart;
  const wordDur = lineDur / words.length;
  words.forEach((kw, i) => {
    const wStart = i * wordDur;
    const wEnd   = wStart + wordDur;
    if (elapsed >= wEnd) {
      kw.style.setProperty('--kw-fill', '100%');
    } else if (elapsed > wStart) {
      const pct = ((elapsed - wStart) / wordDur * 100).toFixed(1);
      kw.style.setProperty('--kw-fill', pct + '%');
    } else {
      kw.style.setProperty('--kw-fill', '0%');
    }
  });
}

function updateLRCDisplay() {
  if (!$.lrcContainer) return;
  const rm = S.lyricsRenderMode || 'phrase';
  const all = $.lrcContainer.querySelectorAll('.lrc-line');
  if (!all.length) return;

  if (rm === 'basic') {
    /* Basic: no highlight, just show all */
    all.forEach(l => { l.classList.remove('active','near'); });
    return;
  }

  if (rm === 'scroll') {
    /* Scroll: highlight active but no per-line opacity animations */
    all.forEach((line, i) => {
      line.classList.remove('active', 'near');
      if (i === lrcActiveIndex) line.classList.add('active');
    });
    /* Autoscroll */
    if (lrcActiveIndex >= 0 && S.autoScroll) {
      const activeLine = all[lrcActiveIndex];
      if (activeLine && $.lpBody) {
        const targetY = -(activeLine.offsetTop - $.lpBody.clientHeight/2 + activeLine.offsetHeight/2);
        $.lrcContainer.style.transform = `translateY(${targetY}px)`;
      }
    }
    return;
  }

  /* phrase + karaoke: full active/near treatment */
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
  $.lrcContainer.innerHTML = '<span class="lp-empty">' + (window.t ? window.t('lyrics_fetching') : 'Loading lyrics…') + '</span>';
  $.lpBody.classList.remove('lrc-mode');
  setLPBadge('');
  let lyrData = getLRCCache(artist, title);
  if (!lyrData) { lyrData = await fetchLyricsFromLRCLIB(artist, title); if (lyrData) setLRCCache(artist, title, lyrData); }
  if (!lyrData) {
    const notFound = window.t ? window.t('lyrics_not_found') : 'No lyrics found.';
    $.lrcContainer.innerHTML = `<span class="lp-empty">${notFound}<br/><a href="https://genius.com/search?q=${encodeURIComponent(artist+' '+title)}" target="_blank" style="color:rgba(255,255,255,.4);text-decoration:none">Genius →</a></span>`;
    setLPBadge('plain'); return;
  }
  if (lyrData.duration > 0) trackDuration = lyrData.duration;
  if (lyrData.syncedLyrics) {
    lrcLines = parseLRC(lyrData.syncedLyrics);
    if (lrcLines.length > 0) {
      lrcSynced = true; $.lrcContainer.innerHTML = '';
      $.lpBody.classList.add('lrc-mode');
      const rm = S.lyricsRenderMode || 'phrase';
      if (rm === 'karaoke') renderLRCLinesKaraoke(lrcLines);
      else renderLRCLines(lrcLines);
      setLPBadge('synced');
      cancelAnimationFrame(lrcRAF); tickLRC(); return;
    }
  }
  lrcSynced = false; $.lpBody.classList.remove('lrc-mode');
  const plain = lyrData.plainLyrics ? lyrData.plainLyrics.trim().replace(/</g,'&lt;').replace(/\n/g,'<br>') : '';
  $.lrcContainer.innerHTML = plain ? `<div class="plain-lyrics">${plain}</div>` : `<span class="lp-empty">${window.t ? window.t('lyrics_not_found') : 'No lyrics found.'}</span>`;
  setLPBadge('plain');
}

function setLPBadge(type) {
  if (!$.lpBadge) return;
  $.lpBadge.className = 'lp-badge';
  if (type === 'synced') { $.lpBadge.classList.add('synced'); $.lpBadge.textContent = window.t ? window.t('lyrics_synced_badge') : '● Synced'; }
  else if (type === 'plain') { $.lpBadge.classList.add('plain'); $.lpBadge.textContent = window.t ? window.t('lyrics_plain_badge') : 'Plain text'; }
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
  if (window._mnavSyncHook) window._mnavSyncHook();
}

$.btnLyrics.addEventListener('click', () => {
  const opening = !lyricsOpen;
  closeAllPanels();
  if (opening) {
    lyricsOpen=true; $.lyricsPanel.classList.add('on'); $.btnLyrics.classList.add('active');
    /* Only shift hero in right-panel mode; center/bottom modes don't need it */
    if ((S.lyricsPosition || 'right') === 'right') $.hero.classList.add('shifted');
    if (currentTrack) loadLyrics(currentTrack.artist?.name||currentTrack.artist?.['#text']||'', currentTrack.name||'');
    else { $.lrcContainer.innerHTML = "<span class='lp-empty'>" + (window.t ? window.t('lyrics_waiting') : 'Waiting for a track…') + "</span>"; setLPBadge(''); }
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

$.lpBody.addEventListener('wheel',      () => {}, { passive: true });
$.lpBody.addEventListener('touchstart', () => {}, { passive: true });

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
/* v10: Lyrics render mode */
document.querySelectorAll('[data-lrc-render]').forEach(b => b.addEventListener('click', () => {
  S.lyricsRenderMode = b.dataset.lrcRender;
  applyLyricsSettings(); saveSettings();
}));
/* v10: Karaoke progressive fill */
if ($.setKaraokeProgressiveFill) {
  $.setKaraokeProgressiveFill.addEventListener('change', () => {
    S.karaokeProgressiveFill = $.setKaraokeProgressiveFill.checked;
    applyLyricsSettings(); saveSettings();
  });
}
/* v10: Title-color brightness */
if ($.setTitleColorBrightness) {
  $.setTitleColorBrightness.addEventListener('input', () => {
    S.titleColorBrightness = parseInt($.setTitleColorBrightness.value);
    if ($.valTitleColorBrightness) $.valTitleColorBrightness.textContent = S.titleColorBrightness + '%';
    document.documentElement.style.setProperty('--tcbg-brightness', (S.titleColorBrightness/100).toFixed(2));
    saveSettings();
  }, { passive: true });
}
/* v10: Title-color contrast */
if ($.setTitleColorContrast) {
  $.setTitleColorContrast.addEventListener('input', () => {
    S.titleColorContrast = parseInt($.setTitleColorContrast.value);
    if ($.valTitleColorContrast) $.valTitleColorContrast.textContent = S.titleColorContrast + '%';
    document.documentElement.style.setProperty('--tcbg-contrast', (S.titleColorContrast/100).toFixed(2));
    saveSettings();
  }, { passive: true });
}
/* v10b: Typography */
const _typoApply = debounce(() => { applyLyricsSettings(); saveSettings(); }, 40);
if ($.setLyricsWeight)        $.setLyricsWeight.addEventListener('input',        () => { S.lyricsWeight        = parseInt($.setLyricsWeight.value);        _typoApply(); }, { passive: true });
if ($.setLyricsLetterSpacing) $.setLyricsLetterSpacing.addEventListener('input', () => { S.lyricsLetterSpacing  = parseInt($.setLyricsLetterSpacing.value);  _typoApply(); }, { passive: true });
if ($.setLyricsLineHeight)    $.setLyricsLineHeight.addEventListener('input',    () => { S.lyricsLineHeight     = parseInt($.setLyricsLineHeight.value);     _typoApply(); }, { passive: true });

/* ── Globals pour remote.js ── */
window.S = S;
window.applySettings  = applySettings;
window.saveSettings   = saveSettings;

/* ============================================================
   MOBILE NAV — boutons de la barre de navigation mobile
   Ils délèguent simplement aux boutons desktop existants
   ============================================================ */
(function() {
  const mnavLyrics   = document.getElementById('mnav-lyrics');
  const mnavHist     = document.getElementById('mnav-hist');
  const mnavSettings = document.getElementById('mnav-settings');
  const mnavFocus    = document.getElementById('mnav-focus');

  function syncMnav() {
    if (mnavLyrics)   mnavLyrics.classList.toggle('active',   lyricsOpen);
    if (mnavHist)     mnavHist.classList.toggle('active',     histOpen);
    if (mnavSettings) mnavSettings.classList.toggle('active', settingsOpen);
    if (mnavFocus)    mnavFocus.classList.toggle('active',    zenMode);
  }

  if (mnavLyrics)   mnavLyrics.addEventListener('click',   () => { $.btnLyrics.click();   syncMnav(); });
  if (mnavHist)     mnavHist.addEventListener('click',     () => { $.btnHist.click();     syncMnav(); });
  if (mnavSettings) mnavSettings.addEventListener('click', () => { $.btnSettings.click(); syncMnav(); });
  if (mnavFocus)    mnavFocus.addEventListener('click',    () => { toggleZenMode();       syncMnav(); });

  /* Sync mobile nav active states whenever panels open/close */
  const origClose = closeAllPanels;
  window._mnavSyncHook = syncMnav;
})();
