/* AURA — script.js v4
   Changelog vs v3:
   - Bug fix: Auto-hide (.is-idle) now fonctionne correctement en mode Lyrics
   - Zen Mode (cinématique) via bouton top-right + touche Z
   - Menu contextuel hover sur pochette (Like, Copier, Partager)
   - generateShareImage() — canvas 1080×1920 Story avec dégradé ColorThief
   - Cache Avatar SWR (Stale-while-revalidate) via localStorage + fetch HD
   - Limiteur FPS visualiseur (30 ou 60 FPS) configurable
   - renderHistory() refactorisé avec DocumentFragment
   - Fix CORS: crossOrigin assigné avant .src dans swapArt
   - Fondu mask-image sur le conteneur paroles (géré via CSS class)
   - aria-label descriptifs sur tous les boutons iconographiques
*/

/* ---- STATE ---- */
let apiKey = '', username = '', originalUser = '', currentTrack = null, artSlot = 'a', bgSlot = 'a';
let lyricsOpen = false, histOpen = false, settingsOpen = false;
let pollTimer = null, idleTimer = null, bgTimeout = null;
let trackStartTime = 0, trackDuration = 0, trackPausedAt = 0, progressRAF = null;
let currentTrackId = '';
let isPaused = false;

/* Zen Mode */
let zenMode = false;

/* FPS limiter */
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
  // Hero appearance
  heroScale: 100,
  heroLayout: 'standard',
  heroAlign: 'center',
  // Discord RPC
  discordEnabled: false, discordClientId: '',
  discordPreviewCard: true, discordPreviewOpen: false,
  // Lanyard / AURA Sync
  lanyardId: '',
  sourcePriority: 'lanyard',
  // FPS limiter: 30 ou 60
  vizFPS: 60,
};

/* ---- DOM REFS ---- */
const $ = {
  login: document.getElementById('s-login'),
  player: document.getElementById('s-player'),
  loading: document.getElementById('loading'),
  globalNoise: document.getElementById('global-noise'),
  orbBg: document.getElementById('orb-bg'),
  inUser: document.getElementById('in-user'),
  inKey: document.getElementById('in-key'),
  btnConnect: document.getElementById('btn-connect'),
  cachedEntry: document.getElementById('cached-entry'),
  cachedName: document.getElementById('cached-name'),
  lError: document.getElementById('l-error'),
  bgA: document.getElementById('bg-a'), bgB: document.getElementById('bg-b'),
  bgFilter: document.getElementById('bg-filter'),
  artWrap: document.getElementById('art-wrap'),
  artGlow: document.getElementById('art-glow'),
  artA: document.getElementById('art-a'), artB: document.getElementById('art-b'),
  fbA: document.getElementById('fallback-a'), fbB: document.getElementById('fallback-b'),
  mq: document.getElementById('mq'), mqWrap: document.getElementById('mq-wrap'),
  title: document.getElementById('track-title'),
  artist: document.getElementById('track-artist'),
  artistRow: document.getElementById('artist-row'),
  artistAvatar: document.getElementById('artist-avatar'),
  avatarCircle: document.getElementById('avatar-circle'),
  avatarFallback: document.getElementById('avatar-fallback'),
  content: document.getElementById('track-content'),
  progressBar: document.getElementById('progress-bar'),
  noTrack: document.getElementById('no-track'),
  hero: document.getElementById('hero'),
  lyricsPanel: document.getElementById('lyrics-panel'),
  lpBody: document.getElementById('lp-body'),
  lpBadge: document.getElementById('lp-badge'),
  lrcContainer: document.getElementById('lrc-container'),
  histPanel: document.getElementById('hist-panel'),
  hpList: document.getElementById('hp-list'),
  settingsPanel: document.getElementById('settings-panel'),
  ui: document.getElementById('ui'),
  btnLyrics: document.getElementById('btn-lyrics'),
  btnHist: document.getElementById('btn-hist'),
  btnSettings: document.getElementById('btn-settings'),
  btnFs: document.getElementById('btn-fs'),
  btnLogout: document.getElementById('btn-logout'),
  stDot: document.getElementById('st-dot'),
  stText: document.getElementById('st-text'),
  displayUsername: document.getElementById('display-username'),
  // Settings sliders / toggles
  setBlur: document.getElementById('set-blur'),
  setBrightness: document.getElementById('set-brightness'),
  setSaturate: document.getElementById('set-saturate'),
  setBg: document.getElementById('set-bg'),
  setArt: document.getElementById('set-art'),
  setGlow: document.getElementById('set-glow'),
  setAvatar: document.getElementById('set-avatar'),
  setMarquee: document.getElementById('set-marquee'),
  setGrain: document.getElementById('set-grain'),
  setAutoscroll: document.getElementById('set-autoscroll'),
  setMqSpeed: document.getElementById('set-mq-speed'),
  userSearch: document.getElementById('user-search'),
  setAppleMode: document.getElementById('set-apple-mode'),
  setShowProgress: document.getElementById('set-show-progress'),
  setVinylMode: document.getElementById('set-vinyl-mode'),
  setColorThief: document.getElementById('set-color-thief'),
  setFluidGradient: document.getElementById('set-fluid-gradient'),
  setEqViz: document.getElementById('set-eq-viz'),
  setCanvasViz: document.getElementById('set-canvas-viz'),
  fluidGradientBg: document.getElementById('fluid-gradient-bg'),
  // Hero controls
  setHeroScale: document.getElementById('set-hero-scale'),
  layoutDesc: document.getElementById('layout-desc'),
  // Priority desc
  priorityDesc: document.getElementById('priority-desc'),
  // Lanyard / AURA Sync
  setLanyardId: document.getElementById('set-lanyard-id'),
  btnLanyardConnect: document.getElementById('btn-lanyard-connect'),
  lanyardStatusRow: document.getElementById('lanyard-status-row'),
  lanyardDot: document.getElementById('lanyard-dot'),
  lanyardStatusText: document.getElementById('lanyard-status-text'),
  lanyardWsBadge: document.getElementById('lanyard-ws-badge'),
  btnLanyardStatus: document.getElementById('btn-lanyard-status'),
  lanyardBadge: document.getElementById('lanyard-badge'),
  // Discord RPC
  setDiscordEnabled: document.getElementById('set-discord-enabled'),
  setDiscordClientId: document.getElementById('set-discord-client-id'),
  setDiscordPreviewCard: document.getElementById('set-discord-preview-card'),
  discordConnectBtn: document.getElementById('discord-connect-btn'),
  discordStatusDot: document.getElementById('discord-status-dot'),
  discordStatusText: document.getElementById('discord-status-text'),
  discordSettingsBody: document.getElementById('discord-settings-body'),
  discordPreviewPanel: document.getElementById('discord-preview-panel'),
  btnDiscordPreview: document.getElementById('btn-discord-preview'),
  discordRpcBadge: document.getElementById('discord-rpc-badge'),
  drpcArt: document.getElementById('drpc-art'), drpcArtFb: document.getElementById('drpc-art-fb'),
  drpcTitle: document.getElementById('drpc-title'), drpcArtist: document.getElementById('drpc-artist'),
  drpcAlbum: document.getElementById('drpc-album'), drpcElapsed: document.getElementById('drpc-elapsed'),
  drpcTotal: document.getElementById('drpc-total'),
  drpcProgressFill: document.getElementById('drpc-progress-fill'),
  drpcPauseBadge: document.getElementById('drpc-pause-badge'),
  drpcPlayingLabel: document.getElementById('drpc-playing-label'),
  drpcHeaderDot: document.getElementById('drpc-header-dot'),
  drpcHeaderStatusText: document.getElementById('drpc-header-status-text'),
  drpcBtnLyrics: document.getElementById('drpc-btn-lyrics'),
  drpcClose: document.getElementById('drpc-close'),
  drpcPlaystate: document.getElementById('drpc-playstate'),
  drpcPlaystateIcon: document.getElementById('drpc-playstate-icon'),
  drpcPlaystateText: document.getElementById('drpc-playstate-text'),
  drpcExtraRow: document.getElementById('drpc-extra-row'),
  drpcPlatformText: document.getElementById('drpc-platform-text'),
  drpcSourceText: document.getElementById('drpc-source-text'),
  vizCanvas: document.getElementById('viz-canvas'),
};

/* Extra DOM refs */
const $topActions = document.querySelector('.top-actions');

/* ---- CACHE / PERSISTENCE ---- */
function saveCache() { try { localStorage.setItem('aura_user', originalUser); localStorage.setItem('aura_key', apiKey); } catch(e) {} }
function loadCache() { try { return { u: localStorage.getItem('aura_user') || '', k: localStorage.getItem('aura_key') || '' }; } catch(e) { return { u: '', k: '' }; } }
function clearCache() { try { localStorage.removeItem('aura_user'); localStorage.removeItem('aura_key'); } catch(e) {} }

function saveSettings() { try { localStorage.setItem('aura_settings', JSON.stringify(S)); } catch(e) {} }
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

/* LRC lyrics cache — TTL 7 days, max 50 entries */
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
    const prefix = 'aura_lrc_';
    const TTL = 7 * 24 * 3600 * 1000;
    const keys = [];
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

/* ---- APPLY SETTINGS ---- */
function applySettings() {
  document.documentElement.style.setProperty('--accent', S.accentColor);
  document.querySelectorAll('[data-color]').forEach(b => b.classList.toggle('active', b.dataset.color === S.accentColor));

  document.documentElement.style.setProperty('--blur-amount', S.blur + 'px');
  document.documentElement.style.setProperty('--bg-brightness', (S.brightness / 100).toFixed(2));
  document.documentElement.style.setProperty('--bg-saturate', (S.saturate / 10).toFixed(2));

  $.setBlur.value = S.blur;             updateSliderFill($.setBlur);
  $.setBrightness.value = S.brightness; updateSliderFill($.setBrightness);
  $.setSaturate.value = S.saturate;     updateSliderFill($.setSaturate);
  $.setMqSpeed.value = S.marqueeSpeed;  updateSliderFill($.setMqSpeed);
  document.documentElement.style.setProperty('--mq-speed', S.marqueeSpeed + 's');

  $.setBg.checked = S.showBg; $.setArt.checked = S.showArt; $.setGlow.checked = S.showGlow;
  $.setAvatar.checked = S.showAvatar; $.setMarquee.checked = S.showMarquee;
  $.setGrain.checked = S.showGrain; $.setAutoscroll.checked = S.autoScroll;
  $.setAppleMode.checked = S.appleMode; $.setShowProgress.checked = S.showProgress;
  $.setVinylMode.checked = S.vinylMode; $.setColorThief.checked = S.colorThief;
  $.setFluidGradient.checked = S.fluidGradient; $.setEqViz.checked = S.eqViz;
  $.setCanvasViz.checked = S.canvasViz;

  $.artWrap.style.opacity = S.showArt ? '1' : '0';
  $.artGlow.style.display = S.showGlow ? 'block' : 'none';
  $.avatarCircle.style.display = S.showAvatar ? '' : 'none';
  $.mqWrap.classList.toggle('hidden-mq', !S.showMarquee);
  $.globalNoise.classList.toggle('on', S.showGrain);

  const showBgImg = S.showBg && S.bgMode === 'album';
  $.bgA.style.display = showBgImg ? '' : 'none';
  $.bgB.style.display = showBgImg ? '' : 'none';

  if (S.bgMode === 'dark') $.bgFilter.style.background = 'rgba(0,0,0,.88)';
  else if (S.bgMode === 'color') $.bgFilter.style.background = 'rgba(10,5,20,.7)';
  else $.bgFilter.style.background = 'rgba(0,0,0,.35)';

  document.documentElement.style.setProperty('--art-radius', S.artShape);
  document.querySelectorAll('[data-art-shape]').forEach(b => b.classList.toggle('active', b.dataset.artShape === S.artShape));
  document.querySelectorAll('[data-bg]').forEach(b => b.classList.toggle('active', b.dataset.bg === S.bgMode));
  document.querySelectorAll('[data-panel]').forEach(b => b.classList.toggle('active', b.dataset.panel === S.defaultPanel));
  document.querySelectorAll('[data-anim]').forEach(b => b.classList.toggle('active', b.dataset.anim === S.bgAnimation));
  document.querySelectorAll('[data-f]').forEach(b => b.classList.toggle('active', b.dataset.f === S.fontChoice));
  document.querySelectorAll('[data-priority]').forEach(b => b.classList.toggle('active', b.dataset.priority === S.sourcePriority));

  document.body.classList.toggle('mode-apple', S.appleMode);
  document.body.classList.toggle('show-progress', S.showProgress);
  document.body.classList.remove('f-inter', 'f-modern', 'f-serif', 'f-mono', 'f-default');
  document.body.classList.add('f-' + S.fontChoice);

  $.orbBg.style.opacity = (S.bgAnimation === 'blobs') ? '1' : '0';
  $.artWrap.classList.toggle('vinyl', S.vinylMode);
  document.body.classList.toggle('show-eq', S.eqViz);
  document.body.classList.toggle('show-canvas-viz', S.canvasViz);
  if (!S.fluidGradient) $.fluidGradientBg.classList.remove('on');

  $.setLanyardId.value = S.lanyardId || '';
  updatePriorityDesc();

  const scale = (S.heroScale || 100) / 100;
  document.documentElement.style.setProperty('--hero-scale', scale);
  if ($.setHeroScale) { $.setHeroScale.value = S.heroScale; updateSliderFill($.setHeroScale); }
  const heroScaleVal = document.getElementById('hero-scale-val');
  if (heroScaleVal) heroScaleVal.textContent = (S.heroScale || 100) + '%';

  document.body.classList.remove('hero-focus', 'hero-minimal');
  if (S.heroLayout === 'focus')   document.body.classList.add('hero-focus');
  if (S.heroLayout === 'minimal') document.body.classList.add('hero-minimal');
  document.querySelectorAll('[data-layout]').forEach(b => b.classList.toggle('active', b.dataset.layout === S.heroLayout));
  updateLayoutDesc();

  document.body.classList.remove('hero-left', 'hero-right');
  if (S.heroAlign === 'left')  document.body.classList.add('hero-left');
  if (S.heroAlign === 'right') document.body.classList.add('hero-right');
  document.querySelectorAll('[data-align]').forEach(b => b.classList.toggle('active', b.dataset.align === S.heroAlign));
}

function updatePriorityDesc() {
  if (!$.priorityDesc) return;
  const descs = {
    lanyard: 'AURA Sync (Lanyard) takes priority. Last.fm picks up if no stream is detected.',
    lastfm:  'Last.fm is always primary. Lanyard data is ignored for track info.',
    auto:    'Auto mode: whichever source has active data gets used.'
  };
  $.priorityDesc.textContent = descs[S.sourcePriority] || '';
}

function updateLayoutDesc() {
  if (!$.layoutDesc) return;
  const descs = {
    standard: 'Full display — album art, title, artist.',
    focus:    'Title fills the screen. Art is hidden.',
    minimal:  'Just a progress bar and the track name.',
  };
  $.layoutDesc.textContent = descs[S.heroLayout] || '';
}

function updateSliderFill(el) {
  const pct = ((el.value - el.min) / (el.max - el.min) * 100) + '%';
  el.style.setProperty('--pct', pct);
}

/* ---- SETTINGS EVENT LISTENERS ---- */
$.setBlur.addEventListener('input', ()       => { S.blur       = parseInt($.setBlur.value);       applySettings(); saveSettings(); });
$.setBrightness.addEventListener('input', () => { S.brightness = parseInt($.setBrightness.value); applySettings(); saveSettings(); });
$.setSaturate.addEventListener('input', ()   => { S.saturate   = parseInt($.setSaturate.value);   applySettings(); saveSettings(); });
$.setMqSpeed.addEventListener('input', ()    => { S.marqueeSpeed = parseInt($.setMqSpeed.value);  applySettings(); saveSettings(); });

if ($.setHeroScale) {
  $.setHeroScale.addEventListener('input', () => {
    S.heroScale = parseInt($.setHeroScale.value);
    applySettings(); saveSettings();
  });
}

$.setBg.addEventListener('change',        () => { S.showBg     = $.setBg.checked;        applySettings(); saveSettings(); });
$.setArt.addEventListener('change',       () => { S.showArt    = $.setArt.checked;        applySettings(); saveSettings(); });
$.setGlow.addEventListener('change',      () => { S.showGlow   = $.setGlow.checked;       applySettings(); saveSettings(); });
$.setAvatar.addEventListener('change',    () => { S.showAvatar = $.setAvatar.checked;     applySettings(); saveSettings(); });
$.setMarquee.addEventListener('change',   () => { S.showMarquee = $.setMarquee.checked;   applySettings(); saveSettings(); });
$.setGrain.addEventListener('change',     () => { S.showGrain  = $.setGrain.checked;      applySettings(); saveSettings(); });
$.setAutoscroll.addEventListener('change',() => { S.autoScroll = $.setAutoscroll.checked; applySettings(); saveSettings(); });
$.setAppleMode.addEventListener('change', () => { S.appleMode  = $.setAppleMode.checked;  applySettings(); saveSettings(); });
$.setShowProgress.addEventListener('change', () => { S.showProgress = $.setShowProgress.checked; applySettings(); saveSettings(); });
$.setVinylMode.addEventListener('change', () => { S.vinylMode = $.setVinylMode.checked; applySettings(); saveSettings(); });

$.setColorThief.addEventListener('change', () => {
  S.colorThief = $.setColorThief.checked;
  if (!S.colorThief) document.documentElement.style.setProperty('--accent', S.accentColor);
  else if (currentTrack) triggerColorThief();
  saveSettings();
});

$.setFluidGradient.addEventListener('change', () => {
  S.fluidGradient = $.setFluidGradient.checked;
  if (!S.fluidGradient) $.fluidGradientBg.classList.remove('on');
  else if (currentTrack) triggerColorThief();
  saveSettings();
});

$.setEqViz.addEventListener('change', () => { S.eqViz = $.setEqViz.checked; applySettings(); saveSettings(); });
$.setCanvasViz.addEventListener('change', () => {
  S.canvasViz = $.setCanvasViz.checked;
  applySettings();
  if (S.canvasViz) startCanvasViz(); else stopCanvasViz();
  saveSettings();
});

document.querySelectorAll('[data-bg]').forEach(b       => b.addEventListener('click', () => { S.bgMode       = b.dataset.bg;       applySettings(); saveSettings(); }));
document.querySelectorAll('[data-panel]').forEach(b    => b.addEventListener('click', () => { S.defaultPanel = b.dataset.panel;    applySettings(); saveSettings(); }));
document.querySelectorAll('[data-art-shape]').forEach(b => b.addEventListener('click', () => { S.artShape   = b.dataset.artShape; applySettings(); saveSettings(); }));
document.querySelectorAll('[data-color]').forEach(b    => b.addEventListener('click', () => { S.accentColor = b.dataset.color;    applySettings(); saveSettings(); }));
document.querySelectorAll('[data-anim]').forEach(b     => b.addEventListener('click', () => { S.bgAnimation = b.dataset.anim;     applySettings(); saveSettings(); }));
document.querySelectorAll('[data-f]').forEach(b        => b.addEventListener('click', () => { S.fontChoice  = b.dataset.f;        applySettings(); saveSettings(); }));
document.querySelectorAll('[data-priority]').forEach(b => b.addEventListener('click', () => { S.sourcePriority = b.dataset.priority; applySettings(); saveSettings(); }));

document.querySelectorAll('[data-layout]').forEach(b => b.addEventListener('click', () => {
  S.heroLayout = b.dataset.layout;
  applySettings(); saveSettings();
}));

document.querySelectorAll('[data-align]').forEach(b => b.addEventListener('click', () => {
  S.heroAlign = b.dataset.align;
  applySettings(); saveSettings();
}));

$.userSearch.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const target = $.userSearch.value.trim();
    username = target !== '' ? target : originalUser;
    setStatus('loading', target !== '' ? 'Viewing: ' + target : 'Back to you…');
    clearInterval(pollTimer);
    poll();
    pollTimer = setInterval(poll, 1000);
  }
});

$.setLanyardId.addEventListener('input', () => { S.lanyardId = $.setLanyardId.value.trim(); saveSettings(); });
$.setLanyardId.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    S.lanyardId = $.setLanyardId.value.trim();
    saveSettings();
    if (S.lanyardId) lanyardConnect(S.lanyardId);
    else lanyardDisconnect();
  }
});

if ($.btnLanyardConnect) {
  $.btnLanyardConnect.addEventListener('click', () => {
    S.lanyardId = $.setLanyardId.value.trim();
    saveSettings();
    if ($.btnLanyardConnect.classList.contains('connected')) {
      lanyardDisconnect();
      $.btnLanyardConnect.textContent = 'Connect';
      $.btnLanyardConnect.classList.remove('connected');
    } else {
      if (S.lanyardId) {
        lanyardConnect(S.lanyardId);
        $.btnLanyardConnect.textContent = 'Disconnect';
        $.btnLanyardConnect.classList.add('connected');
      }
    }
  });
}

/* ---- ERROR DISPLAY ---- */
function showError(msg) { $.lError.textContent = msg; $.lError.classList.add('on'); }
function clearError()   { $.lError.classList.remove('on'); }
$.inUser.addEventListener('input', clearError);
$.inKey.addEventListener('input', clearError);
$.inUser.addEventListener('keydown', e => { if (e.key === 'Enter') $.inKey.focus(); });
$.inKey.addEventListener('keydown',  e => { if (e.key === 'Enter') attemptConnect(); });

/* ---- INIT ---- */
(function init() {
  loadSettings();
  gcLRCCache();
  injectZenButton();
  injectAlbumHoverMenu();
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
  if (!u) { showError('Enter your Last.fm username.'); return; }
  if (!k || k.length < 20) { showError('Invalid API key (should be 32 hex chars).'); return; }
  connectWith(u, k);
}

async function connectWith(u, k) {
  showLoading(true);
  try {
    await fetchUserInfo(u, k);
    apiKey = k; username = u; originalUser = u;
    saveCache();
    hideLogin();
    showLoading(false);
    $.player.classList.add('on');
    applySettings();
    applyDiscordSettings();

    if ($.displayUsername) $.displayUsername.textContent = u;

    if (S.defaultPanel === 'lyrics')  $.btnLyrics.click();
    if (S.defaultPanel === 'history') $.btnHist.click();

    if (S.lanyardId) lanyardConnect(S.lanyardId);

    startPolling();
    if (S.canvasViz) startCanvasViz();
    resetIdle();
  } catch(err) {
    showLoading(false);
    showError(err.message || 'Could not connect.');
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
   IDLE / UI FADE — v4 FIX
   Bug corrigé : lyricsOpen ne bloquait plus le timer dans l'ancienne
   version car la condition était vérifiée au moment du SETTIME et
   non au moment du déclenchement. Désormais on passe à une logique
   basée sur la classe .is-idle appliquée sur document.body, et le
   CSS cible `body.is-idle` pour masquer les éléments hors pochette/paroles.
   En mode Zen toute l'UI (sauf pochette + paroles) disparaît quelle
   que soit l'activité.
   ============================================================ */

function resetIdle() {
  // Annule l'état idle courant
  document.body.classList.remove('is-idle');
  document.body.style.cursor = 'default';
  clearTimeout(idleTimer);

  // Ne pas programmer le timer si un panneau de settings ou historique est ouvert
  if (settingsOpen || histOpen) return;

  // En mode Zen, pas de timer : on reste idle en permanence (l'UI est masquée)
  if (zenMode) {
    document.body.classList.add('is-idle');
    document.body.style.cursor = 'none';
    return;
  }

  // Timer 3 s — s'applique TOUJOURS, y compris quand lyricsOpen est true
  idleTimer = setTimeout(() => {
    document.body.classList.add('is-idle');
    document.body.style.cursor = 'none';
  }, 3000);
}

document.addEventListener('mousemove', resetIdle);
document.addEventListener('click',     resetIdle);
document.addEventListener('keydown',   resetIdle);

/* ============================================================
   ZEN MODE — mode cinématique
   Masque tout sauf la pochette et les paroles.
   Activable via bouton top-right ou touche Z.
   ============================================================ */

function injectZenButton() {
  // Crée le bouton s'il n'existe pas dans le HTML
  if (document.getElementById('btn-zen')) return;
  const btn = document.createElement('button');
  btn.id = 'btn-zen';
  btn.className = 'btn-icon btn-zen';
  btn.setAttribute('aria-label', 'Activer le mode cinématique Zen');
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M12 3C7.03 3 3 7.03 3 12s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm0 16c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7zm0-11c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z"/>
  </svg>`;
  btn.addEventListener('click', () => { toggleZenMode(); resetIdle(); });

  // Insère dans .top-actions s'il existe, sinon dans #ui
  const target = $topActions || $.ui;
  if (target) target.prepend(btn);
}

function toggleZenMode() {
  zenMode = !zenMode;
  document.body.classList.toggle('zen-mode', zenMode);
  const btn = document.getElementById('btn-zen');
  if (btn) {
    btn.classList.toggle('active', zenMode);
    btn.setAttribute('aria-label', zenMode ? 'Désactiver le mode Zen' : 'Activer le mode cinématique Zen');
  }

  if (zenMode) {
    // Ferme les panneaux qui polluent l'écran en zen
    if (histOpen || settingsOpen) closeAllPanels();
    document.body.classList.add('is-idle');
    document.body.style.cursor = 'none';
    clearTimeout(idleTimer);
  } else {
    document.body.classList.remove('is-idle');
    document.body.style.cursor = 'default';
    resetIdle();
  }
}

/* ============================================================
   MENU CONTEXTUEL HOVER — Pochette (.album-wrapper / #art-wrap)
   Contient : Like (Last.fm), Copier (Artiste - Titre), Partager (Story)
   ============================================================ */

function injectAlbumHoverMenu() {
  // Évite les doublons
  if (document.getElementById('album-hover-menu')) return;

  const menu = document.createElement('div');
  menu.id = 'album-hover-menu';
  menu.className = 'album-hover-menu';
  menu.setAttribute('role', 'toolbar');
  menu.setAttribute('aria-label', 'Actions sur le morceau');

  menu.innerHTML = `
    <button class="ahm-btn" id="ahm-like" aria-label="Aimer sur Last.fm">
      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
      </svg>
    </button>
    <button class="ahm-btn" id="ahm-copy" aria-label="Copier Artiste - Titre dans le presse-papier">
      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
        <path d="M16 1H4C2.9 1 2 1.9 2 3v14h2V3h12V1zm3 4H8C6.9 5 6 5.9 6 7v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
      </svg>
    </button>
    <button class="ahm-btn" id="ahm-share" aria-label="Générer une Story à partager">
      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
        <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/>
      </svg>
    </button>
  `;

  $.artWrap.style.position = 'relative';
  $.artWrap.appendChild(menu);

  // Like Last.fm
  document.getElementById('ahm-like').addEventListener('click', (e) => {
    e.stopPropagation();
    likeOnLastFm();
  });

  // Copier
  document.getElementById('ahm-copy').addEventListener('click', (e) => {
    e.stopPropagation();
    copyTrackInfo();
  });

  // Partager (Story)
  document.getElementById('ahm-share').addEventListener('click', (e) => {
    e.stopPropagation();
    generateShareImage();
  });
}

/* Like sur Last.fm — utilise la méthode track.love */
async function likeOnLastFm() {
  if (!currentTrack || !apiKey) return;
  const artist = currentTrack.artist?.name || currentTrack.artist?.['#text'] || '';
  const title  = currentTrack.name || '';
  const btn = document.getElementById('ahm-like');
  if (btn) btn.classList.add('liked');
  try {
    // Last.fm track.love nécessite une session key (auth).
    // Sans flow auth complet, on ouvre la page Last.fm du morceau.
    const url = `https://www.last.fm/music/${encodeURIComponent(artist)}/_/${encodeURIComponent(title)}`;
    window.open(url, '_blank', 'noopener');
  } catch {}
}

/* Copier "Artiste - Titre" */
async function copyTrackInfo() {
  if (!currentTrack) return;
  const artist = currentTrack.artist?.name || currentTrack.artist?.['#text'] || '';
  const title  = currentTrack.name || '';
  const text   = `${artist} - ${title}`;
  try {
    await navigator.clipboard.writeText(text);
    const btn = document.getElementById('ahm-copy');
    if (btn) {
      btn.classList.add('copied');
      setTimeout(() => btn.classList.remove('copied'), 1500);
    }
  } catch {}
}

/* ============================================================
   GENERATE SHARE IMAGE — Canvas 9:16 (1080×1920)
   Fond dégradé ColorThief + pochette centrée + texte bas
   ============================================================ */

async function generateShareImage() {
  if (!currentTrack) return;

  const artist = currentTrack.artist?.name || currentTrack.artist?.['#text'] || 'Unknown Artist';
  const title  = currentTrack.name || 'Unknown Title';
  const album  = currentTrack.album?.['#text'] || '';

  const canvas = document.createElement('canvas');
  canvas.width  = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');

  // --- Fond dégradé via ColorThief ---
  const activeImg = artSlot === 'a' ? $.artA : $.artB;
  let colors = null;
  if (activeImg && activeImg.naturalWidth) colors = extractDominantColors(activeImg, 3);
  const c1 = colors?.[0] ? `rgb(${colors[0].r},${colors[0].g},${colors[0].b})` : '#1a0030';
  const c2 = colors?.[1] ? `rgb(${colors[1].r},${colors[1].g},${colors[1].b})` : '#0a001a';
  const c3 = colors?.[2] ? `rgb(${colors[2].r},${colors[2].g},${colors[2].b})` : '#000010';

  const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1920);
  bgGrad.addColorStop(0,    c1);
  bgGrad.addColorStop(0.5,  c2);
  bgGrad.addColorStop(1,    c3);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1080, 1920);

  // Overlay sombre pour lisibilité
  const overlay = ctx.createLinearGradient(0, 0, 0, 1920);
  overlay.addColorStop(0,   'rgba(0,0,0,0.25)');
  overlay.addColorStop(0.6, 'rgba(0,0,0,0.1)');
  overlay.addColorStop(1,   'rgba(0,0,0,0.7)');
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, 1080, 1920);

  // --- Pochette centrée ---
  const artSize = 780;
  const artX = (1080 - artSize) / 2;
  const artY = 280;
  const radius = 36;

  // Ombre portée
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 80;
  ctx.shadowOffsetY = 30;

  // Clip arrondi
  ctx.beginPath();
  ctx.roundRect(artX, artY, artSize, artSize, radius);
  ctx.clip();

  // Image pochette
  let artDrawn = false;
  if (activeImg && activeImg.naturalWidth) {
    try {
      ctx.drawImage(activeImg, artX, artY, artSize, artSize);
      artDrawn = true;
    } catch {}
  }
  if (!artDrawn) {
    // Fallback gradient
    const fb = ctx.createLinearGradient(artX, artY, artX + artSize, artY + artSize);
    fb.addColorStop(0, c1); fb.addColorStop(1, c2);
    ctx.fillStyle = fb;
    ctx.fillRect(artX, artY, artSize, artSize);
  }
  ctx.restore();

  // --- Logo AURA en haut ---
  ctx.font = 'bold 52px "Bebas Neue", "Arial Narrow", sans-serif';
  ctx.letterSpacing = '8px';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.textAlign = 'center';
  ctx.fillText('AURA', 540, 120);

  // Badge "Now Playing"
  ctx.font = '28px "Bebas Neue", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText('NOW PLAYING', 540, 165);

  // --- Texte du bas ---
  const textY = artY + artSize + 90;

  // Titre
  ctx.font = 'bold 72px "Bebas Neue", "Arial Narrow", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.97)';
  ctx.textAlign = 'center';
  ctx.letterSpacing = '2px';
  wrapCanvasText(ctx, title.toUpperCase(), 540, textY, 900, 80);

  // Artiste
  ctx.font = '44px "Bebas Neue", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.letterSpacing = '3px';
  const titleLines = measureWrappedLines(ctx, title.toUpperCase(), 900, 'bold 72px "Bebas Neue", sans-serif');
  const artistY = textY + titleLines * 80 + 20;
  ctx.fillText(artist, 540, artistY);

  // Album (si présent)
  if (album) {
    ctx.font = '32px "Bebas Neue", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.letterSpacing = '2px';
    ctx.fillText(album, 540, artistY + 55);
  }

  // Lien en bas
  ctx.font = '26px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.letterSpacing = '0px';
  ctx.fillText(location.hostname || 'aura.music', 540, 1860);

  // --- Téléchargement ---
  const link = document.createElement('a');
  const safeName = (title + '_' + artist).replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
  link.download = `AURA_${safeName}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

/* Helpers Canvas */
function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  for (const word of words) {
    const testLine = line + word + ' ';
    if (ctx.measureText(testLine).width > maxWidth && line !== '') {
      ctx.fillText(line.trim(), x, currentY);
      line = word + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line.trim()) ctx.fillText(line.trim(), x, currentY);
}

function measureWrappedLines(ctx, text, maxWidth, font) {
  const savedFont = ctx.font;
  ctx.font = font;
  const words = text.split(' ');
  let line = '';
  let lines = 1;
  for (const word of words) {
    const testLine = line + word + ' ';
    if (ctx.measureText(testLine).width > maxWidth && line !== '') {
      lines++;
      line = word + ' ';
    } else {
      line = testLine;
    }
  }
  ctx.font = savedFont;
  return lines;
}

/* ============================================================
   ARIA LABELS — Accessibilité sur tous les boutons iconographiques
   ============================================================ */

function injectAriaLabels() {
  const labels = {
    'btn-lyrics':   'Ouvrir les paroles',
    'btn-hist':     'Ouvrir l\'historique',
    'btn-settings': 'Ouvrir les paramètres',
    'btn-fs':       'Basculer en plein écran',
    'btn-logout':   'Se déconnecter',
    'btn-discord-preview': 'Afficher la carte Discord RPC',
    'drpc-close':   'Fermer la carte Discord',
    'drpc-btn-lyrics': 'Aller aux paroles',
    'btn-lanyard-status': 'Statut de la connexion Lanyard',
  };
  for (const [id, label] of Object.entries(labels)) {
    const el = document.getElementById(id);
    if (el && !el.getAttribute('aria-label')) el.setAttribute('aria-label', label);
  }
  // Boutons iconographiques génériques
  document.querySelectorAll('.btn-icon:not([aria-label])').forEach(btn => {
    const svg = btn.querySelector('svg');
    if (svg) btn.setAttribute('aria-label', btn.title || 'Action');
  });
}

/* ============================================================
   CACHE AVATAR SWR (Stale-While-Revalidate)
   1. On affiche immédiatement depuis localStorage si dispo
   2. On fetch en HD (Deezer > TheAudioDB > Last.fm) en arrière-plan
   3. On met à jour l'UI sans clignotement
   ============================================================ */

const avatarSWRCache = {}; // cache mémoire session

function avatarCacheKey(artist) {
  return 'aura_avatar_' + encodeURIComponent(artist.toLowerCase()).slice(0, 80);
}

function getAvatarFromStorage(artist) {
  try {
    const raw = localStorage.getItem(avatarCacheKey(artist));
    if (!raw) return null;
    const { url, ts } = JSON.parse(raw);
    // TTL 24h pour l'avatar
    if (Date.now() - ts > 24 * 3600 * 1000) return null;
    return url;
  } catch { return null; }
}

function setAvatarInStorage(artist, url) {
  try {
    localStorage.setItem(avatarCacheKey(artist), JSON.stringify({ url, ts: Date.now() }));
  } catch {}
}

async function fetchArtistAvatarHD(artist) {
  // Priorité: Deezer (HD) → TheAudioDB MB → TheAudioDB name → Last.fm

  // 1. Deezer HD
  try {
    const r = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(artist)}&limit=1`);
    if (r.ok) {
      const d = await r.json();
      const img = d.data?.[0]?.picture_xl || d.data?.[0]?.picture_big || d.data?.[0]?.picture_medium;
      if (img) return img;
    }
  } catch {}

  // 2. MusicBrainz → TheAudioDB
  try {
    const mbResp = await fetch(`https://musicbrainz.org/ws/2/artist/?query=artist:${encodeURIComponent(artist)}&fmt=json&limit=1`, { headers: { 'User-Agent': 'AURA/4.0 (music player)' } });
    if (mbResp.ok) {
      const mbData = await mbResp.json();
      const mbid = mbData.artists?.[0]?.id;
      if (mbid) {
        const tadbResp = await fetch(`https://www.theaudiodb.com/api/v1/json/2/artist-mb.php?i=${mbid}`);
        if (tadbResp.ok) {
          const tadbData = await tadbResp.json();
          const img = tadbData.artists?.[0]?.strArtistThumb || tadbData.artists?.[0]?.strArtistBanner;
          if (img) return img;
        }
      }
    }
  } catch {}

  // 3. TheAudioDB by name
  try {
    const r = await fetch(`https://www.theaudiodb.com/api/v1/json/2/search.php?s=${encodeURIComponent(artist)}`);
    if (r.ok) {
      const d = await r.json();
      const img = d.artists?.[0]?.strArtistThumb || d.artists?.[0]?.strArtistBanner;
      if (img) return img;
    }
  } catch {}

  // 4. Last.fm
  try {
    const r = await fetch(`https://ws.audioscrobbler.com/2.0/?method=artist.getInfo&artist=${encodeURIComponent(artist)}&api_key=${apiKey}&format=json`);
    if (r.ok) {
      const d = await r.json();
      const imgs = d.artist?.image || [];
      for (let i = imgs.length - 1; i >= 0; i--) {
        const url = imgs[i]['#text'];
        if (url && url.length > 10 && !url.includes('2a96cbd8b46e442fc41c2b86b821562f')) return url;
      }
    }
  } catch {}

  return null;
}

function applyAvatarUrl(url) {
  if (!url) return;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    $.artistAvatar.src = url;
    $.artistAvatar.classList.add('loaded');
    if ($.avatarFallback) $.avatarFallback.style.opacity = '0';
  };
  img.onerror = () => {};
  img.src = url;
}

async function updateArtistAvatar(artist) {
  if (!S.showAvatar) return;

  // Reset visuel
  $.avatarCircle.classList.remove('on');
  $.artistAvatar.classList.remove('loaded');
  $.artistAvatar.src = '';

  if ($.avatarFallback) {
    $.avatarFallback.style.background = fallbackGradient(artist);
    $.avatarFallback.textContent = fallbackLetter(artist);
    $.avatarFallback.style.opacity = '1';
  }
  $.avatarCircle.classList.add('on');

  // SWR — affiche le stale immédiatement
  const stale = avatarSWRCache[artist] || getAvatarFromStorage(artist);
  if (stale) applyAvatarUrl(stale);

  // Revalide en arrière-plan
  try {
    const fresh = await fetchArtistAvatarHD(artist);
    if (fresh) {
      avatarSWRCache[artist] = fresh;
      setAvatarInStorage(artist, fresh);
      // Met à jour sans clignotement uniquement si c'est toujours le même artiste affiché
      const currentArtist = currentTrack?.artist?.name || currentTrack?.artist?.['#text'] || '';
      if (currentArtist === artist) applyAvatarUrl(fresh);
    }
  } catch {}
}

/* ---- POLLING (Last.fm) ---- */
function startPolling() { poll(); pollTimer = setInterval(poll, 1000); }

async function poll() {
  const lanyardHasData = lanyardActive && lanyardSpotifyData;

  if (lanyardHasData && (S.sourcePriority === 'lanyard' || S.sourcePriority === 'auto')) {
    setStatus('ok', '⚡ AURA Sync · ' + (lanyardSpotifyData.song || ''));
    try { const { history } = await fetchRecentTracks(10); renderHistory(history); } catch {}
    return;
  }

  if (S.sourcePriority === 'lastfm' || !lanyardHasData) {
    try {
      const { current, history } = await fetchRecentTracks(10);
      handleTrack(current);
      renderHistory(history);
      setStatus('ok', username !== originalUser ? 'Viewing: ' + username : 'Live');
    } catch(e) {
      setStatus('error', 'Network error');
    }
  }
}

function setStatus(state, text) {
  $.stDot.className = state === 'loading' ? 'loading' : state === 'error' ? 'error' : '';
  $.stText.textContent = text;
}

/* ---- LANYARD / AURA SYNC — WebSocket ---- */
let lanyardWs = null;
let lanyardHbInterval = null;
let lanyardReconnectTimer = null;
let lanyardActive = false;
let lanyardSpotifyData = null;
let lanyardTimestampStart = 0;
let lanyardTimestampEnd = 0;
let lanyardCurrentDiscordId = '';

function lanyardConnect(discordId) {
  if (!discordId) return;
  lanyardCurrentDiscordId = discordId;
  lanyardDisconnect();

  setLanyardStatus('connecting', 'Connecting to AURA Sync…');
  $.btnLanyardStatus.style.display = 'flex';

  try {
    lanyardWs = new WebSocket('wss://api.lanyard.rest/socket');
  } catch(e) {
    setLanyardStatus('error', 'WebSocket not supported');
    return;
  }

  lanyardWs.onopen = () => {};

  lanyardWs.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      switch (msg.op) {
        case 1:
          lanyardHbInterval = setInterval(() => {
            if (lanyardWs && lanyardWs.readyState === WebSocket.OPEN) {
              lanyardWs.send(JSON.stringify({ op: 3 }));
            }
          }, msg.d.heartbeat_interval);
          lanyardWs.send(JSON.stringify({ op: 2, d: { subscribe_to_id: discordId } }));
          if ($.lanyardWsBadge) $.lanyardWsBadge.style.display = 'inline-block';
          break;
        case 0:
          if (msg.t === 'INIT_STATE' || msg.t === 'PRESENCE_UPDATE') {
            lanyardHandlePresence(msg.d);
          }
          break;
      }
    } catch(e) {}
  };

  lanyardWs.onerror = () => {
    setLanyardStatus('error', 'Connection error');
    if ($.lanyardWsBadge) $.lanyardWsBadge.style.display = 'none';
  };

  lanyardWs.onclose = () => {
    lanyardActive = false;
    lanyardSpotifyData = null;
    if ($.lanyardWsBadge) $.lanyardWsBadge.style.display = 'none';
    if (lanyardHbInterval) { clearInterval(lanyardHbInterval); lanyardHbInterval = null; }
    if (lanyardCurrentDiscordId) {
      setLanyardStatus('connecting', 'Reconnecting…');
      lanyardReconnectTimer = setTimeout(() => lanyardConnect(lanyardCurrentDiscordId), 5000);
    }
  };
}

function lanyardDisconnect() {
  lanyardCurrentDiscordId = '';
  lanyardActive = false;
  lanyardSpotifyData = null;
  clearTimeout(lanyardReconnectTimer);
  if (lanyardHbInterval) { clearInterval(lanyardHbInterval); lanyardHbInterval = null; }
  if (lanyardWs) { try { lanyardWs.close(); } catch {} lanyardWs = null; }
  if ($.lanyardWsBadge) $.lanyardWsBadge.style.display = 'none';
  setLanyardStatus('off', 'Disabled — enter an ID to activate');
  $.btnLanyardStatus.style.display = 'none';
}

function lanyardHandlePresence(data) {
  let spotifyData = null;
  let trackPaused = false;

  if (data.spotify && data.spotify.song) {
    spotifyData = data.spotify;
    if (!data.spotify.timestamps || !data.spotify.timestamps.start) trackPaused = true;
  } else if (data.activities && Array.isArray(data.activities)) {
    const musicActivity = data.activities.find(a => a.type === 2);
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
        timestamps: musicActivity.timestamps || null
      };
      trackPaused = !musicActivity.timestamps || !musicActivity.timestamps.start;
    }
  }

  if (spotifyData) {
    lanyardActive = true;
    lanyardSpotifyData = spotifyData;

    if (spotifyData.timestamps) {
      lanyardTimestampStart = spotifyData.timestamps.start || 0;
      lanyardTimestampEnd   = spotifyData.timestamps.end   || 0;
    } else {
      lanyardTimestampStart = 0;
      lanyardTimestampEnd   = 0;
    }

    const durationMs = (lanyardTimestampEnd && lanyardTimestampStart)
      ? (lanyardTimestampEnd - lanyardTimestampStart) : 0;

    setLanyardStatus('connected', `${trackPaused ? '⏸' : '🎵'} ${spotifyData.song}`);

    const syntheticTrack = {
      name: spotifyData.song,
      artist: { name: spotifyData.artist, '#text': spotifyData.artist },
      album: { '#text': spotifyData.album || '' },
      albumArtUrl: spotifyData.album_art_url || '',
      image: spotifyData.album_art_url ? [{ '#text': spotifyData.album_art_url, size: 'extralarge' }] : [],
      duration: durationMs > 0 ? Math.floor(durationMs / 1000) * 1000 : 0,
      _fromLanyard: true,
      _timestampStart: lanyardTimestampStart,
      _isPaused: trackPaused,
    };

    if (S.sourcePriority !== 'lastfm') {
      handleTrack(syntheticTrack, true);
      setPausedState(trackPaused);
    }

    if (S.discordEnabled && S.discordPreviewCard) {
      updateDiscordPreviewCard(syntheticTrack, trackPaused);
    }

  } else {
    lanyardActive = false;
    lanyardSpotifyData = null;
    setLanyardStatus('no-music', 'No music detected');
    if (S.sourcePriority !== 'lastfm') handleTrack(null);
  }
}

function setLanyardStatus(state, text) {
  const dot   = $.lanyardDot;
  const txtEl = $.lanyardStatusText;
  const badge = $.lanyardBadge;

  dot.className   = 'lanyard-dot';
  badge.className = 'lanyard-badge';

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
    trackPausedAt = Date.now();
    cancelAnimationFrame(progressRAF);
    if (lrcSynced) { cancelAnimationFrame(lrcRAF); lrcRAF = null; }
    if (!S.canvasViz) stopCanvasViz();
  } else {
    if (trackPausedAt > 0) {
      const pausedDuration = Date.now() - trackPausedAt;
      trackStartTime += pausedDuration;
      trackPausedAt = 0;
    }
    progressRAF = requestAnimationFrame(updateTrackProgress);
    if (lrcSynced && lyricsOpen) { cancelAnimationFrame(lrcRAF); tickLRC(); }
    if (S.canvasViz) startCanvasViz();
  }

  document.body.classList.toggle('is-paused', paused);
  document.body.classList.toggle('is-playing', !paused && currentTrack !== null);
}

/* ---- TRACK PROGRESS ---- */
function getElapsedMs() {
  if (isPaused) return trackPausedAt > 0 ? (trackPausedAt - trackStartTime) : 0;
  if (currentTrack && currentTrack._fromLanyard && currentTrack._timestampStart > 0) {
    return Date.now() - currentTrack._timestampStart;
  }
  return Date.now() - trackStartTime;
}

function updateTrackProgress() {
  if (!trackDuration || trackStartTime === 0 || isPaused) return;
  const elapsed = getElapsedMs() / 1000;
  const pct = Math.min((elapsed / trackDuration) * 100, 100);
  $.progressBar.style.width = pct + '%';
  if (pct < 100) progressRAF = requestAnimationFrame(updateTrackProgress);
}

function trackId(t) {
  if (!t) return '';
  return (t.artist?.name || t.artist?.['#text'] || '') + '|||' + (t.name || '');
}

function handleTrack(track, fromLanyard = false) {
  if (!track) {
    $.noTrack.classList.add('on');
    $.content.style.opacity = '0';
    $.mq.textContent = ('· · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · ').repeat(3);
    cancelAnimationFrame(progressRAF);
    $.artWrap.classList.remove('playing');
    document.body.classList.remove('is-playing', 'is-paused', 'source-lanyard');
    if (S.colorThief) document.documentElement.style.setProperty('--accent', S.accentColor);
    if (S.fluidGradient) $.fluidGradientBg.classList.remove('on');
    stopLRC();
    isPaused = false; trackStartTime = 0; trackPausedAt = 0;
    currentTrack = null; currentTrackId = '';
    if (!S.canvasViz) stopCanvasViz();
    return;
  }

  $.noTrack.classList.remove('on');
  $.content.style.opacity = '1';

  const id = trackId(track);
  const isSame = (id === currentTrackId);

  if (isSame && fromLanyard) {
    const newPaused = track._isPaused || false;
    if (newPaused !== isPaused) setPausedState(newPaused);
    return;
  }
  if (isSame && !fromLanyard) return;

  currentTrackId = id;
  currentTrack   = track;
  isPaused       = track._isPaused || false;
  trackPausedAt  = 0;

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

  $.title.classList.remove('show');
  $.artistRow.classList.remove('show');
  setTimeout(() => {
    $.title.textContent  = title;
    $.artist.textContent = artist;
    void $.title.offsetWidth;
    $.title.classList.add('show');
    $.artistRow.classList.add('show');
  }, 400);

  let imgUrl = track.albumArtUrl || '';
  if (!imgUrl) {
    const imgs = track.image || [];
    for (let i = imgs.length - 1; i >= 0; i--) {
      if (imgs[i]['#text'] && imgs[i]['#text'].length > 10) { imgUrl = imgs[i]['#text']; break; }
    }
    if (imgUrl) imgUrl = imgUrl.replace('/300x300/', '/600x600/').replace('34s', '600x600');
  }
  swapArt(imgUrl, artist, title);
  updateArtistAvatar(artist);

  if (lyricsOpen) loadLyrics(artist, title);
  if (S.discordEnabled && S.discordPreviewCard) updateDiscordPreviewCard(track, isPaused);
}

/* ---- COLOR THIEF ---- */
function extractDominantColors(imgEl, count = 4) {
  try {
    const canvas = document.createElement('canvas');
    const size = 50; canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgEl, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    const buckets = {};
    for (let i = 0; i < data.length; i += 4) {
      const r = Math.round(data[i]     / 28) * 28;
      const g = Math.round(data[i + 1] / 28) * 28;
      const b = Math.round(data[i + 2] / 28) * 28;
      const key = `${r},${g},${b}`;
      buckets[key] = (buckets[key] || 0) + 1;
    }
    const sorted = Object.entries(buckets)
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => { const [r, g, b] = k.split(',').map(Number); return { r, g, b }; });
    const filtered = sorted.filter(c => {
      const lum = (c.r * 299 + c.g * 587 + c.b * 114) / 1000;
      return lum > 20 && lum < 230;
    });
    return (filtered.length >= 2 ? filtered : sorted).slice(0, count);
  } catch { return null; }
}

function triggerColorThief() {
  const activeImg = artSlot === 'a' ? $.artA : $.artB;
  if (!activeImg || !activeImg.naturalWidth) return;
  const colors = extractDominantColors(activeImg, 4);
  if (!colors || colors.length < 2) return;

  if (S.colorThief) {
    const vivid = colors.find(c => { const l = (c.r * 299 + c.g * 587 + c.b * 114) / 1000; return l > 40 && l < 200; }) || colors[0];
    const hex = `#${vivid.r.toString(16).padStart(2,'0')}${vivid.g.toString(16).padStart(2,'0')}${vivid.b.toString(16).padStart(2,'0')}`;
    document.documentElement.style.setProperty('--accent', hex);
  }

  if (S.fluidGradient && colors.length >= 2) {
    const stops = colors.map(c => `rgb(${c.r},${c.g},${c.b})`).join(', ');
    $.fluidGradientBg.style.backgroundImage = `radial-gradient(ellipse at 20% 50%, ${stops})`;
    $.fluidGradientBg.classList.add('on');
  }
}

/* ---- ART SWAP — CORS fix : crossOrigin AVANT .src ---- */
function fallbackGradient(str) {
  const h = [...(str || 'A')].reduce((a, c) => a + c.charCodeAt(0), 0);
  const hue = h % 360;
  return `linear-gradient(135deg, hsl(${hue},60%,25%), hsl(${(hue+40)%360},70%,18%))`;
}
function fallbackLetter(str) { return (str || '?')[0].toUpperCase(); }

function swapArt(url, artist, title) {
  const front   = artSlot === 'a' ? $.artA : $.artB;
  const back    = artSlot === 'a' ? $.artB : $.artA;
  const fbFront = artSlot === 'a' ? $.fbA  : $.fbB;
  const fbBack  = artSlot === 'a' ? $.fbB  : $.fbA;
  const grad   = fallbackGradient(artist);
  const letter = fallbackLetter(title);

  if (!url) {
    fbBack.style.background = grad; fbBack.textContent = letter; fbBack.style.opacity = '1';
    fbFront.style.opacity = '0'; back.style.opacity = '0'; front.style.opacity = '0';
    artSlot = artSlot === 'a' ? 'b' : 'a';
    updateBg(null, grad); $.artGlow.style.background = grad; $.artGlow.style.backgroundImage = 'none';
    return;
  }

  // CORS fix : crossOrigin assigné AVANT .src pour éviter le crash ColorThief
  back.crossOrigin = 'anonymous';
  back.onerror = () => {
    fbBack.style.background = grad; fbBack.textContent = letter; fbBack.style.opacity = '1';
    fbFront.style.opacity = '0'; back.style.opacity = '0'; front.style.opacity = '0';
    artSlot = artSlot === 'a' ? 'b' : 'a';
    updateBg(null, grad); $.artGlow.style.background = grad; $.artGlow.style.backgroundImage = 'none';
  };
  back.onload = () => {
    fbBack.style.opacity = '0'; back.style.opacity = '1';
    front.style.opacity = '0'; fbFront.style.opacity = '0';
    artSlot = artSlot === 'a' ? 'b' : 'a';
    updateBg(url, null);
    $.artGlow.style.backgroundImage = `url('${url}')`;
    $.artGlow.style.background = 'transparent';
    setTimeout(() => triggerColorThief(), 200);
  };
  back.src = url; // ← src assigné APRÈS crossOrigin et les handlers
  if (back.complete && back.naturalWidth) back.onload();
}

function updateBg(url, grad) {
  if (!S.showBg || S.bgMode !== 'album') return;
  const front = bgSlot === 'a' ? $.bgA : $.bgB;
  const back  = bgSlot === 'a' ? $.bgB : $.bgA;
  clearTimeout(bgTimeout);
  back.style.transition = 'none'; back.style.opacity = '0';
  void back.offsetWidth;
  back.style.transition = 'opacity 2s var(--ease)';
  if (url)       back.style.backgroundImage = `url('${url}')`;
  else if (grad) back.style.backgroundImage = grad;
  back.style.opacity = '1'; front.style.opacity = '0';
  bgSlot = bgSlot === 'a' ? 'b' : 'a';
  bgTimeout = setTimeout(() => { front.style.backgroundImage = ''; }, 2200);
}

/* ---- HISTORY — DocumentFragment pour éviter les reflows ---- */
function renderHistory(tracks) {
  const frag = document.createDocumentFragment();

  tracks.forEach(t => {
    const isPlaying = t['@attr']?.nowplaying === 'true';
    const artist = t.artist?.name || t.artist?.['#text'] || '';
    const title  = t.name || '';
    const imgs   = t.image || [];
    let imgUrl = '';
    for (let i = imgs.length - 1; i >= 0; i--) {
      if (imgs[i]['#text'] && imgs[i]['#text'].length > 10) { imgUrl = imgs[i]['#text']; break; }
    }
    let timeStr = '';
    if (!isPlaying && t.date?.uts) {
      const d = new Date(t.date.uts * 1000);
      timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const item = document.createElement('div');
    item.className = 'hp-item';

    // Thumb
    if (imgUrl) {
      const img = document.createElement('img');
      img.className = 'hp-thumb';
      img.src = imgUrl;
      img.alt = '';
      img.onerror = () => { img.style.display = 'none'; };
      item.appendChild(img);
    } else {
      const div = document.createElement('div');
      div.className = 'hp-thumb';
      Object.assign(div.style, {
        background: fallbackGradient(artist),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Bebas Neue', sans-serif", fontSize: '18px',
        color: 'rgba(255,255,255,.6)'
      });
      div.textContent = fallbackLetter(title);
      item.appendChild(div);
    }

    // Info
    const info = document.createElement('div');
    info.className = 'hp-info';

    const trackEl = document.createElement('div');
    trackEl.className = 'hp-track';
    trackEl.textContent = title;
    info.appendChild(trackEl);

    const artistEl = document.createElement('div');
    artistEl.className = 'hp-artist';
    artistEl.textContent = artist;
    info.appendChild(artistEl);

    if (timeStr) {
      const timeEl = document.createElement('div');
      timeEl.className = 'hp-time';
      timeEl.textContent = timeStr;
      info.appendChild(timeEl);
    }

    item.appendChild(info);

    if (isPlaying) {
      const dot = document.createElement('div');
      dot.className = 'hp-playing';
      item.appendChild(dot);
    }

    frag.appendChild(item);
  });

  // Un seul reflow : vide puis remplace
  $.hpList.innerHTML = '';
  $.hpList.appendChild(frag);
}

/* ---- LAST.FM API ---- */
async function fetchUserInfo(u, k) {
  const r = await fetch(`https://ws.audioscrobbler.com/2.0/?method=user.getInfo&user=${encodeURIComponent(u)}&api_key=${k}&format=json`);
  if (!r.ok) throw new Error('Network error.');
  const d = await r.json();
  if (d.error) throw new Error(d.message || 'Last.fm error: ' + d.error);
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
  const current = arr[0]?.['@attr']?.nowplaying === 'true' ? arr[0] : null;
  return { current, history: arr };
}

/* ---- LRC ENGINE ---- */
let lrcLines       = [];
let lrcSynced      = false;
let lrcActiveIndex = -1;
let lrcRAF         = null;

const LRC_METADATA_REGEX = /^\[(ar|ti|al|au|by|offset|re|ve|length):/i;

function parseLRC(lrcText) {
  const lines = lrcText.split('\n');
  const result = [];
  const timeRegex = /\[(\d{1,2}):(\d{2})[.:](\d{2,3})\]/g;

  for (const line of lines) {
    if (LRC_METADATA_REGEX.test(line.trim())) continue;
    const matches = [...line.matchAll(timeRegex)];
    const text = line.replace(/\[\d{1,2}:\d{2}[.:]\d{2,3}\]/g, '').trim();

    if (matches.length > 0) {
      for (const match of matches) {
        const mins  = parseInt(match[1]);
        const secs  = parseInt(match[2]);
        const csStr = match[3].padEnd(3, '0').slice(0, 3);
        const ms    = parseInt(csStr);
        result.push({ timeMs: (mins * 60 + secs) * 1000 + ms, text: text || '♪' });
      }
    }
  }
  return result.sort((a, b) => a.timeMs - b.timeMs);
}

function renderLRCLines(lines) {
  const container = $.lrcContainer;
  container.innerHTML = '';
  lines.forEach((line, i) => {
    const div = document.createElement('div');
    div.className = 'lrc-line';
    div.textContent = line.text;
    div.dataset.index = i;
    div.addEventListener('click', () => { lrcActiveIndex = i; updateLRCDisplay(); });
    container.appendChild(div);
  });
}

function tickLRC() {
  if (!lyricsOpen || !lrcSynced || !lrcLines.length) { lrcRAF = null; return; }
  if (isPaused) { lrcRAF = requestAnimationFrame(tickLRC); return; }

  const currentMs = getElapsedMs();
  let newIndex = -1;
  for (let i = lrcLines.length - 1; i >= 0; i--) {
    if (currentMs >= lrcLines[i].timeMs) { newIndex = i; break; }
  }

  if (newIndex !== lrcActiveIndex) {
    lrcActiveIndex = newIndex;
    updateLRCDisplay();
  }

  lrcRAF = requestAnimationFrame(tickLRC);
}

function updateLRCDisplay() {
  const container = $.lrcContainer;
  if (!container) return;

  const allLines = container.querySelectorAll('.lrc-line');
  if (!allLines.length) return;

  allLines.forEach((line, i) => {
    const dist = Math.abs(i - lrcActiveIndex);
    line.classList.remove('active', 'near');
    if (i === lrcActiveIndex) line.classList.add('active');
    else if (dist <= 2)       line.classList.add('near');
  });

  if (lrcActiveIndex >= 0 && S.autoScroll) {
    const activeLine = allLines[lrcActiveIndex];
    const lpBodyEl   = $.lpBody;
    if (activeLine && lpBodyEl) {
      const panelH  = lpBodyEl.clientHeight;
      const lineTop = activeLine.offsetTop;
      const lineH   = activeLine.offsetHeight;
      const targetY = -(lineTop - panelH / 2 + lineH / 2);
      container.style.transform = `translateY(${targetY}px)`;
    }
  }
}

function stopLRC() {
  cancelAnimationFrame(lrcRAF);
  lrcRAF = null;
  lrcLines       = [];
  lrcSynced      = false;
  lrcActiveIndex = -1;
  if ($.lrcContainer) $.lrcContainer.style.transform = '';
  $.lpBody.classList.remove('lrc-mode');
}

/* ---- LYRICS LOADING ---- */
async function fetchLyricsFromLRCLIB(artist, title) {
  try {
    const r = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`);
    if (r.ok) {
      const d = await r.json();
      if (d.syncedLyrics) return { syncedLyrics: d.syncedLyrics, plainLyrics: d.plainLyrics, duration: d.duration, source: 'lrclib' };
      if (d.plainLyrics)  return { syncedLyrics: null, plainLyrics: d.plainLyrics, duration: d.duration, source: 'lrclib' };
    }
  } catch {}

  try {
    const r = await fetch(`https://lrclib.net/api/search?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`);
    if (r.ok) {
      const results = await r.json();
      if (Array.isArray(results)) {
        const match = results.find(x => x.syncedLyrics) || results.find(x => x.plainLyrics);
        if (match) return { syncedLyrics: match.syncedLyrics || null, plainLyrics: match.plainLyrics || null, duration: match.duration, source: 'lrclib-search' };
      }
    }
  } catch {}

  try {
    const r = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
    if (r.ok) {
      const d = await r.json();
      if (d.lyrics && d.lyrics.trim().length > 10) return { syncedLyrics: null, plainLyrics: d.lyrics, duration: 0, source: 'lyrics.ovh' };
    }
  } catch {}

  return null;
}

async function loadLyrics(artist, title) {
  stopLRC();
  $.lrcContainer.innerHTML = '<span class="lp-empty">Chargement des paroles…</span>';
  $.lpBody.classList.remove('lrc-mode');
  setLPBadge('');

  const cached = getLRCCache(artist, title);
  let lyrData = cached;
  if (!lyrData) {
    lyrData = await fetchLyricsFromLRCLIB(artist, title);
    if (lyrData) setLRCCache(artist, title, lyrData);
  }

  if (!lyrData) {
    $.lrcContainer.innerHTML = `<span class="lp-empty">Aucune parole trouvée.<br/>Essayer sur <a href="https://genius.com/search?q=${encodeURIComponent(artist + ' ' + title)}" target="_blank" style="color:rgba(255,255,255,.4);text-decoration:none">Genius →</a></span>`;
    setLPBadge('plain');
    return;
  }

  if (lyrData.duration && lyrData.duration > 0) trackDuration = lyrData.duration;

  if (lyrData.syncedLyrics) {
    lrcLines = parseLRC(lyrData.syncedLyrics);
    if (lrcLines.length > 0) {
      lrcSynced = true;
      $.lrcContainer.innerHTML = '';
      $.lpBody.classList.add('lrc-mode');
      renderLRCLines(lrcLines);
      setLPBadge('synced');
      cancelAnimationFrame(lrcRAF);
      tickLRC();
      return;
    }
  }

  lrcSynced = false;
  $.lpBody.classList.remove('lrc-mode');
  const plain = lyrData.plainLyrics ? lyrData.plainLyrics.trim().replace(/</g, '&lt;').replace(/\n/g, '<br>') : '';
  $.lrcContainer.innerHTML = plain
    ? `<div class="plain-lyrics">${plain}</div>`
    : `<span class="lp-empty">Aucune parole trouvée.</span>`;
  setLPBadge('plain');
}

function setLPBadge(type) {
  if (!$.lpBadge) return;
  $.lpBadge.className = 'lp-badge';
  if (type === 'synced')     { $.lpBadge.classList.add('synced'); $.lpBadge.textContent = '⚡ Synced'; }
  else if (type === 'plain') { $.lpBadge.classList.add('plain');  $.lpBadge.textContent = 'Text'; }
  else                       { $.lpBadge.textContent = ''; }
}

/* ============================================================
   CANVAS VISUALIZER — Limiteur FPS (30 ou 60)
   delta-time via requestAnimationFrame timestamp
   ============================================================ */
let vizRAF = null, vizPhase = 0;

function startCanvasViz() {
  if (vizRAF) cancelAnimationFrame(vizRAF);
  vizLastFrame = 0;
  vizLoop(0);
}

function stopCanvasViz() {
  cancelAnimationFrame(vizRAF); vizRAF = null;
  const ctx = $.vizCanvas.getContext('2d');
  ctx.clearRect(0, 0, $.vizCanvas.width, $.vizCanvas.height);
}

function vizLoop(timestamp) {
  // Limiteur FPS — on saute la frame si l'intervalle minimal n'est pas atteint
  const targetInterval = 1000 / (S.vizFPS === 30 ? 30 : 60);
  const delta = timestamp - vizLastFrame;
  if (delta < targetInterval - 1) {
    if (S.canvasViz) vizRAF = requestAnimationFrame(vizLoop);
    return;
  }
  vizLastFrame = timestamp;

  const canvas = $.vizCanvas;
  const ctx    = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const barCount  = 48;
  const barW = W / barCount - 1.5;
  const gap  = W / barCount;
  const isPlaying = !isPaused && document.body.classList.contains('is-playing');
  const speedMult = isPaused ? 0.003 : 0.035;
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#e0245e';

  vizPhase += speedMult;

  for (let i = 0; i < barCount; i++) {
    const t     = i / barCount;
    const wave1 = Math.sin(t * Math.PI * 2.2  + vizPhase)       * 0.38;
    const wave2 = Math.sin(t * Math.PI * 5.7  + vizPhase * 1.7) * 0.22;
    const wave3 = Math.sin(t * Math.PI * 11   + vizPhase * 0.9) * 0.12;
    const wave4 = Math.sin(t * Math.PI * 0.8  - vizPhase * 0.5) * 0.15;
    const shape = Math.exp(-Math.pow((t - 0.35) * 2.5, 2)) * 0.6 + Math.exp(-Math.pow((t - 0.65) * 3, 2)) * 0.35 + 0.08;
    const rawH  = (wave1 + wave2 + wave3 + wave4 + shape + 0.5) * 0.5;
    const barH  = Math.max(2, rawH * H * (isPlaying ? 1 : 0.12));
    const x = i * gap, y = H - barH;
    const grad = ctx.createLinearGradient(0, y, 0, H);
    grad.addColorStop(0,   accent + 'cc');
    grad.addColorStop(0.5, accent + '88');
    grad.addColorStop(1,   accent + '22');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.roundRect(x, y, barW, barH, [2, 2, 0, 0]); ctx.fill();
  }

  if (S.canvasViz) vizRAF = requestAnimationFrame(vizLoop);
  else vizRAF = null;
}

/* ---- PANEL MANAGEMENT ---- */
function closeAllPanels() {
  if (lyricsOpen)  { lyricsOpen = false;   $.lyricsPanel.classList.remove('on'); $.btnLyrics.classList.remove('active');   stopLRC(); }
  if (histOpen)    { histOpen = false;      $.histPanel.classList.remove('on');   $.btnHist.classList.remove('active'); }
  if (settingsOpen){ settingsOpen = false;  $.settingsPanel.classList.remove('on'); $.btnSettings.classList.remove('active'); }
  $.hero.classList.remove('shifted');
  $topActions.classList.remove('icons-hidden');
}

$.btnLyrics.addEventListener('click', () => {
  const opening = !lyricsOpen;
  closeAllPanels();
  if (opening) {
    lyricsOpen = true;
    $.lyricsPanel.classList.add('on');
    $.btnLyrics.classList.add('active');
    $.hero.classList.add('shifted');
    $topActions.classList.add('icons-hidden');
    if (currentTrack) {
      const artist = currentTrack.artist?.name || currentTrack.artist?.['#text'] || '';
      loadLyrics(artist, currentTrack.name || '');
    } else {
      $.lrcContainer.innerHTML = '<span class="lp-empty">En attente d\'un titre…</span>';
      setLPBadge('');
    }
  }
  resetIdle();
});

$.btnHist.addEventListener('click', () => {
  const opening = !histOpen;
  closeAllPanels();
  if (opening) {
    histOpen = true;
    $.histPanel.classList.add('on');
    $.btnHist.classList.add('active');
    $.hero.classList.add('shifted');
    $topActions.classList.add('icons-hidden');
  }
  resetIdle();
});

$.btnSettings.addEventListener('click', (e) => {
  e.stopPropagation();
  const opening = !settingsOpen;
  closeAllPanels();
  if (opening) {
    settingsOpen = true;
    $.settingsPanel.classList.add('on');
    $.btnSettings.classList.add('active');
  }
  resetIdle();
});

document.addEventListener('click', e => {
  if (settingsOpen && !$.settingsPanel.contains(e.target) && e.target !== $.btnSettings && !$.btnSettings.contains(e.target)) {
    settingsOpen = false;
    $.settingsPanel.classList.remove('on');
    $.btnSettings.classList.remove('active');
    resetIdle();
  }
});

$.lpBody.addEventListener('wheel',      () => {});
$.lpBody.addEventListener('touchstart', () => {});

/* ---- FULLSCREEN ---- */
$.btnFs.addEventListener('click', () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
  else document.exitFullscreen().catch(() => {});
});
document.addEventListener('fullscreenchange', () => {
  const ico = $.btnFs.querySelector('svg');
  ico.innerHTML = document.fullscreenElement
    ? '<path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>'
    : '<path d="M3 3h6v2H5v4H3V3zm12 0h6v6h-2V5h-4V3zM3 15h2v4h4v2H3v-6zm16 4h-4v2h6v-6h-2v4z"/>';
});

/* ---- KEYBOARD SHORTCUTS ---- */
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (!$.player.classList.contains('on')) return;
  switch (e.key.toUpperCase()) {
    case 'L': e.preventDefault(); $.btnLyrics.click(); break;
    case 'H': e.preventDefault(); $.btnHist.click(); break;
    case 'S': e.preventDefault(); $.btnSettings.click(); break;
    case 'F': e.preventDefault(); $.btnFs.click(); break;
    case 'D': e.preventDefault(); if (S.discordEnabled) $.btnDiscordPreview.click(); break;
    case 'Z': e.preventDefault(); toggleZenMode(); break;
    case 'M':
      e.preventDefault();
      if (document.body.classList.contains('is-idle')) {
        document.body.classList.remove('is-idle');
        document.body.style.cursor = 'default';
        resetIdle();
      } else {
        clearTimeout(idleTimer);
        document.body.classList.add('is-idle');
        document.body.style.cursor = 'none';
      }
      break;
    case 'ESCAPE': e.preventDefault(); closeAllPanels(); if (zenMode) toggleZenMode(); resetIdle(); break;
  }
});

/* ---- DISCORD RICH PRESENCE ---- */
let discordWs = null, discordConnected = false, discordIsPaused = false;
let discordPreviewOpen = false, discordReconnectTimer = null, discordPreviewRAF = null;
let discordPreviewInterval = null;
let discordNonce = 1;

function discordNextNonce() { return 'aura_' + (discordNonce++); }

function discordSend(payload) {
  if (discordWs && discordWs.readyState === WebSocket.OPEN) {
    try { discordWs.send(JSON.stringify(payload)); } catch {}
  }
}

function setDiscordUIStatus(state) {
  const dot = $.discordStatusDot, txt = $.discordStatusText, btn = $.discordConnectBtn, badge = $.discordRpcBadge;
  dot.className = '';
  badge.className = 'discord-rpc-badge';

  if (state === 'connected') {
    dot.classList.add('dsc-connected');
    txt.textContent = 'Connected';
    btn.textContent = '✕ Disconnect';
    btn.classList.add('disc-off');
    badge.classList.remove('hidden'); badge.classList.add('dsc-live');
    discordConnected = true;
  } else if (state === 'connecting') {
    dot.classList.add('dsc-connecting');
    txt.textContent = 'Connecting…';
    btn.textContent = 'Connecting…';
    btn.classList.remove('disc-off');
    badge.classList.add('hidden');
    discordConnected = false;
  } else if (state === 'preview') {
    dot.classList.add('dsc-preview');
    txt.textContent = 'Preview mode (Discord not detected)';
    btn.innerHTML = '♻ Retry';
    btn.classList.remove('disc-off');
    badge.classList.add('hidden');
    discordConnected = false;
  } else {
    txt.textContent = 'Disconnected';
    btn.textContent = 'Connect to Discord';
    btn.classList.remove('disc-off');
    badge.classList.add('hidden');
    discordConnected = false;
  }
}

function discordConnect() {
  if (!S.discordClientId) { setDiscordUIStatus('preview'); return; }
  setDiscordUIStatus('connecting');
  clearTimeout(discordReconnectTimer);
  if (discordWs) { try { discordWs.close(); } catch {} discordWs = null; }

  try {
    const port = parseInt(localStorage.getItem('aura_discord_port') || '6463');
    discordWs = new WebSocket(`ws://127.0.0.1:${port}/?v=1&client_id=${S.discordClientId}`);
  } catch {
    setDiscordUIStatus('preview');
    return;
  }

  discordWs.onopen = () => {};
  discordWs.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.cmd === 'DISPATCH' && msg.evt === 'READY') {
        setDiscordUIStatus('connected');
        try { localStorage.setItem('aura_discord_tok', msg.data?.access_token || ''); } catch {}
        if (currentTrack) pushDiscordActivity(currentTrack, isPaused);
      }
    } catch {}
  };
  discordWs.onerror = () => { setDiscordUIStatus('preview'); discordConnected = false; };
  discordWs.onclose = () => {
    discordConnected = false;
    setDiscordUIStatus('disconnected');
    if (S.discordEnabled) discordReconnectTimer = setTimeout(discordConnect, 6000);
  };
}

function discordDisconnect() {
  clearTimeout(discordReconnectTimer);
  stopDiscordPreviewInterval();
  if (discordWs) { try { discordWs.close(); } catch {} discordWs = null; }
  discordConnected = false;
  try { localStorage.removeItem('aura_discord_tok'); } catch {}
  setDiscordUIStatus('disconnected');
  closeDiscordPreviewPanel();
}

function startDiscordPreviewInterval() {
  stopDiscordPreviewInterval();
  if (!discordPreviewOpen || !currentTrack) return;
  discordPreviewInterval = setInterval(() => {
    if (discordPreviewOpen && currentTrack) tickDiscordPreview();
  }, 2000);
}

function stopDiscordPreviewInterval() {
  if (discordPreviewInterval) { clearInterval(discordPreviewInterval); discordPreviewInterval = null; }
  cancelAnimationFrame(discordPreviewRAF);
}

function pushDiscordActivity(track, paused) {
  discordIsPaused = paused;
  if (!S.discordEnabled) return;

  if (!track) {
    if (discordConnected) discordSend({ cmd: 'SET_ACTIVITY', nonce: discordNextNonce(), args: { pid: 99999, activity: null } });
    if (S.discordPreviewCard) updateDiscordPreviewCard(null, false);
    return;
  }

  const artist   = track.artist?.name || track.artist?.['#text'] || 'Unknown artist';
  const title    = track.name || 'Unknown title';
  const album    = track.album?.['#text'] || '';
  let imgUrl     = track.albumArtUrl || '';
  if (!imgUrl) {
    const imgs = track.image || [];
    for (let i = imgs.length - 1; i >= 0; i--) { if (imgs[i]['#text'] && imgs[i]['#text'].length > 10) { imgUrl = imgs[i]['#text']; break; } }
  }

  const startSec = Math.floor(trackStartTime / 1000);
  const endSec   = (trackDuration > 0) ? startSec + Math.floor(trackDuration) : null;

  const activity = {
    details: title, state: '— ' + artist,
    ...(paused ? {} : { timestamps: { start: startSec, ...(endSec && { end: endSec }) } }),
    assets: {
      large_image: imgUrl || 'mp', large_text: album || title,
      small_image: 'aura_icon', small_text: 'AURA Music Player'
    },
    buttons: [
      { label: '🎵 AURA Lyrics', url: location.href.split('#')[0] + '#lyrics' },
      { label: '♫ Open AURA',   url: location.href.split('#')[0] }
    ]
  };

  if (discordConnected) discordSend({ cmd: 'SET_ACTIVITY', nonce: discordNextNonce(), args: { pid: 99999, activity } });
  if (S.discordPreviewCard) updateDiscordPreviewCard(track, paused);
}

function updateDiscordPreviewCard(track, paused) {
  stopDiscordPreviewInterval();
  cancelAnimationFrame(discordPreviewRAF);
  $.drpcHeaderDot.classList.remove('paused', 'live');

  if (!track) {
    $.drpcTitle.textContent = '—'; $.drpcArtist.textContent = '—'; $.drpcAlbum.textContent = '';
    $.drpcArt.src = ''; $.drpcArt.style.opacity = '0'; $.drpcArtFb.style.opacity = '0';
    $.drpcProgressFill.style.width = '0%'; $.drpcElapsed.textContent = '0:00'; $.drpcTotal.textContent = '—:——';
    $.drpcPlayingLabel.textContent = '🎵 PLAYING';
    $.drpcPauseBadge.classList.add('hidden');
    $.drpcHeaderStatusText.textContent = discordConnected ? 'Connected' : 'Preview';
    $.drpcPlaystate.classList.remove('paused');
    $.drpcPlaystateIcon.textContent = '▶'; $.drpcPlaystateText.textContent = 'No music';
    if ($.drpcExtraRow) $.drpcExtraRow.style.display = 'none';
    return;
  }

  const artist = track.artist?.name || track.artist?.['#text'] || '';
  const title  = track.name || '';
  const album  = track.album?.['#text'] || '';
  let imgUrl   = track.albumArtUrl || '';
  if (!imgUrl) {
    const imgs = track.image || [];
    for (let i = imgs.length - 1; i >= 0; i--) { if (imgs[i]['#text'] && imgs[i]['#text'].length > 10) { imgUrl = imgs[i]['#text']; break; } }
  }

  $.drpcTitle.textContent  = title;
  $.drpcArtist.textContent = artist;
  $.drpcAlbum.textContent  = album;

  if (imgUrl) { $.drpcArt.src = imgUrl; $.drpcArt.style.opacity = '1'; $.drpcArtFb.style.opacity = '0'; }
  else {
    $.drpcArt.style.opacity = '0';
    $.drpcArtFb.style.background = fallbackGradient(artist);
    $.drpcArtFb.textContent = fallbackLetter(title);
    $.drpcArtFb.style.opacity = '1';
  }

  $.drpcPauseBadge.classList.toggle('hidden', !paused);
  $.drpcPlayingLabel.textContent = paused ? '⏸ PAUSED' : '🎵 PLAYING';
  $.drpcHeaderDot.classList.toggle('paused', paused);
  if (!paused) $.drpcHeaderDot.classList.add('live');
  $.drpcHeaderStatusText.textContent = discordConnected ? 'Connected' : 'Preview';

  $.drpcPlaystate.classList.toggle('paused', paused);
  $.drpcPlaystateIcon.textContent = paused ? '⏸' : '▶';
  $.drpcPlaystateText.textContent = paused ? 'Paused' : 'Playing';

  if (trackDuration > 0) $.drpcTotal.textContent = fmtTime(trackDuration);

  if ($.drpcExtraRow) {
    $.drpcExtraRow.style.display = 'flex';
    if ($.drpcPlatformText) $.drpcPlatformText.textContent = track._fromLanyard ? 'Spotify' : 'Last.fm';
    if ($.drpcSourceText)   $.drpcSourceText.textContent   = track._fromLanyard ? 'Lanyard' : 'API';
  }

  if (!paused) {
    tickDiscordPreview();
    startDiscordPreviewInterval();
  } else {
    const elapsed = getElapsedMs() / 1000;
    $.drpcElapsed.textContent    = fmtTime(elapsed);
    const pct = trackDuration > 0 ? Math.min((elapsed / trackDuration) * 100, 100) : 0;
    $.drpcProgressFill.style.width = pct + '%';
  }
}

function tickDiscordPreview() {
  if (isPaused || !trackDuration || trackStartTime === 0) return;
  const elapsed = getElapsedMs() / 1000;
  const pct     = Math.min((elapsed / trackDuration) * 100, 100);
  $.drpcElapsed.textContent      = fmtTime(elapsed);
  $.drpcProgressFill.style.width = pct + '%';
  if (pct < 100 && discordPreviewOpen) discordPreviewRAF = requestAnimationFrame(tickDiscordPreview);
}

function openDiscordPreviewPanel() {
  discordPreviewOpen = true;
  $.discordPreviewPanel.classList.add('on');
  $.btnDiscordPreview.classList.add('active');
  S.discordPreviewOpen = true;
  if (currentTrack) updateDiscordPreviewCard(currentTrack, isPaused);
}
function closeDiscordPreviewPanel() {
  discordPreviewOpen = false;
  $.discordPreviewPanel.classList.remove('on');
  $.btnDiscordPreview.classList.remove('active');
  S.discordPreviewOpen = false;
  stopDiscordPreviewInterval();
}

function applyDiscordSettings() {
  if (!$.setDiscordEnabled) return;
  $.setDiscordEnabled.checked = S.discordEnabled;
  $.setDiscordClientId.value  = S.discordClientId || '';
  $.setDiscordPreviewCard.checked = S.discordPreviewCard;
  $.discordSettingsBody.classList.toggle('collapsed', !S.discordEnabled);
  $.btnDiscordPreview.style.display = S.discordEnabled ? 'flex' : 'none';
  if (S.discordEnabled) {
    if (S.discordClientId) discordConnect();
    else setDiscordUIStatus('preview');
  }
  if (S.discordPreviewOpen && S.discordEnabled) openDiscordPreviewPanel();
}

function fmtTime(sec) {
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60);
  return m + ':' + String(s).padStart(2, '0');
}

/* Discord event listeners */
$.btnDiscordPreview.addEventListener('click', () => {
  if (discordPreviewOpen) closeDiscordPreviewPanel(); else openDiscordPreviewPanel();
  resetIdle();
});
$.drpcClose.addEventListener('click', () => { closeDiscordPreviewPanel(); resetIdle(); });
$.drpcBtnLyrics.addEventListener('click', () => {
  closeDiscordPreviewPanel();
  if (!lyricsOpen) $.btnLyrics.click();
});

$.setDiscordEnabled.addEventListener('change', () => {
  S.discordEnabled = $.setDiscordEnabled.checked;
  $.discordSettingsBody.classList.toggle('collapsed', !S.discordEnabled);
  if (S.discordEnabled) {
    $.btnDiscordPreview.style.display = 'flex';
    S.discordClientId = $.setDiscordClientId.value.trim();
    if (S.discordClientId) discordConnect(); else setDiscordUIStatus('preview');
  } else {
    discordDisconnect(); closeDiscordPreviewPanel(); $.btnDiscordPreview.style.display = 'none';
  }
  saveSettings();
});
$.setDiscordClientId.addEventListener('input', () => { S.discordClientId = $.setDiscordClientId.value.trim(); saveSettings(); });
$.setDiscordClientId.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { S.discordClientId = $.setDiscordClientId.value.trim(); saveSettings(); discordConnect(); }
});
$.discordConnectBtn.addEventListener('click', () => {
  if (discordConnected || $.discordConnectBtn.classList.contains('disc-off')) discordDisconnect();
  else { S.discordClientId = $.setDiscordClientId.value.trim(); saveSettings(); discordConnect(); }
});
$.setDiscordPreviewCard.addEventListener('change', () => {
  S.discordPreviewCard = $.setDiscordPreviewCard.checked;
  saveSettings();
  if (!S.discordPreviewCard) closeDiscordPreviewPanel();
});

/* ============================================================
   CSS DYNAMIQUE — injecté une seule fois au chargement
   Gère : .is-idle, .zen-mode, .album-hover-menu, mask-image paroles
   Note : Le CSS principal (style.css) devrait idéalement accueillir
   ces règles, mais on les injecte ici pour être auto-suffisant.
   ============================================================ */

(function injectDynamicCSS() {
  const style = document.createElement('style');
  style.id = 'aura-dynamic-v4';
  style.textContent = `
    /* ---- IDLE AUTO-HIDE ---- */
    /* Masque l'UI en mode idle UNIQUEMENT si les paroles sont actives OU en zen */
    body.is-idle #ui,
    body.is-idle .top-actions {
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.6s ease;
    }
    #ui, .top-actions {
      transition: opacity 0.3s ease;
    }

    /* ---- ZEN MODE ---- */
    body.zen-mode #ui,
    body.zen-mode .top-actions,
    body.zen-mode #mq-wrap,
    body.zen-mode #artist-row,
    body.zen-mode .status-row,
    body.zen-mode #progress-bar,
    body.zen-mode #no-track {
      opacity: 0 !important;
      pointer-events: none !important;
    }
    /* Le bouton zen lui-même reste visible quand souris bouge */
    body.zen-mode:not(.is-idle) #btn-zen {
      opacity: 1 !important;
      pointer-events: auto !important;
    }
    body.zen-mode #btn-zen {
      position: fixed;
      top: 18px;
      right: 18px;
      z-index: 9999;
    }
    #btn-zen.active {
      color: var(--accent, #e0245e);
    }

    /* ---- MENU HOVER POCHETTE ---- */
    .album-hover-menu {
      position: absolute;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%) translateY(8px);
      display: flex;
      gap: 10px;
      background: rgba(0,0,0,0.55);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-radius: 40px;
      padding: 8px 16px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.25s ease, transform 0.25s ease;
      z-index: 20;
    }
    #art-wrap:hover .album-hover-menu {
      opacity: 1;
      pointer-events: auto;
      transform: translateX(-50%) translateY(0);
    }
    .ahm-btn {
      background: none;
      border: none;
      color: rgba(255,255,255,0.8);
      cursor: pointer;
      padding: 6px 10px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.2s, background 0.2s, transform 0.15s;
    }
    .ahm-btn:hover {
      color: #fff;
      background: rgba(255,255,255,0.12);
      transform: scale(1.15);
    }
    .ahm-btn.liked svg { fill: #e0245e; }
    .ahm-btn.copied  { color: #4cff9a; }

    /* ---- MASK-IMAGE PAROLES (fondu haut/bas) ---- */
    #lp-body {
      -webkit-mask-image: linear-gradient(
        to bottom,
        transparent 0%,
        rgba(0,0,0,0.6) 8%,
        black 18%,
        black 82%,
        rgba(0,0,0,0.6) 92%,
        transparent 100%
      );
      mask-image: linear-gradient(
        to bottom,
        transparent 0%,
        rgba(0,0,0,0.6) 8%,
        black 18%,
        black 82%,
        rgba(0,0,0,0.6) 92%,
        transparent 100%
      );
    }
  `;
  document.head.appendChild(style);
})();
