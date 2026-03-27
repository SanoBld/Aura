/* AURA — script.js v3
   What's new vs v2:
   - Hero scale slider + layout modes (standard / focus / minimal) + alignment (L/C/R) fully wired
   - LRC sync now uses translateY on the container instead of scrollTop — buttery smooth
   - Lanyard "Connect" button triggers the WebSocket immediately and saves the ID
   - getElapsedMs() uses Date.now() - timestamps.start for real-time Lanyard accuracy
   - Comments in English, cleaned up
*/

/* ---- STATE ---- */
let apiKey = '', username = '', originalUser = '', currentTrack = null, artSlot = 'a', bgSlot = 'a';
let lyricsOpen = false, histOpen = false, settingsOpen = false;
let pollTimer = null, idleTimer = null, bgTimeout = null;
let trackStartTime = 0, trackDuration = 0, trackPausedAt = 0, progressRAF = null;
let currentTrackId = '';
let isPaused = false;

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
  heroScale: 100,           // slider value 60–140 (maps to 0.6–1.4)
  heroLayout: 'standard',   // 'standard' | 'focus' | 'minimal'
  heroAlign: 'center',      // 'left' | 'center' | 'right'
  // Discord RPC
  discordEnabled: false, discordClientId: '',
  discordPreviewCard: true, discordPreviewOpen: false,
  // Lanyard / AURA Sync
  lanyardId: '',
  sourcePriority: 'lanyard', // 'lanyard' | 'lastfm' | 'auto'
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
  // Hero controls (new)
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

/* Extra DOM ref not in $ map */
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
  // Accent color
  document.documentElement.style.setProperty('--accent', S.accentColor);
  document.querySelectorAll('[data-color]').forEach(b => b.classList.toggle('active', b.dataset.color === S.accentColor));

  // Background filters
  document.documentElement.style.setProperty('--blur-amount', S.blur + 'px');
  document.documentElement.style.setProperty('--bg-brightness', (S.brightness / 100).toFixed(2));
  document.documentElement.style.setProperty('--bg-saturate', (S.saturate / 10).toFixed(2));

  // Sync sliders back to their inputs
  $.setBlur.value = S.blur;             updateSliderFill($.setBlur);
  $.setBrightness.value = S.brightness; updateSliderFill($.setBrightness);
  $.setSaturate.value = S.saturate;     updateSliderFill($.setSaturate);
  $.setMqSpeed.value = S.marqueeSpeed;  updateSliderFill($.setMqSpeed);
  document.documentElement.style.setProperty('--mq-speed', S.marqueeSpeed + 's');

  // Toggles
  $.setBg.checked = S.showBg; $.setArt.checked = S.showArt; $.setGlow.checked = S.showGlow;
  $.setAvatar.checked = S.showAvatar; $.setMarquee.checked = S.showMarquee;
  $.setGrain.checked = S.showGrain; $.setAutoscroll.checked = S.autoScroll;
  $.setAppleMode.checked = S.appleMode; $.setShowProgress.checked = S.showProgress;
  $.setVinylMode.checked = S.vinylMode; $.setColorThief.checked = S.colorThief;
  $.setFluidGradient.checked = S.fluidGradient; $.setEqViz.checked = S.eqViz;
  $.setCanvasViz.checked = S.canvasViz;

  // Visibility
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

  // Option groups
  document.documentElement.style.setProperty('--art-radius', S.artShape);
  document.querySelectorAll('[data-art-shape]').forEach(b => b.classList.toggle('active', b.dataset.artShape === S.artShape));
  document.querySelectorAll('[data-bg]').forEach(b => b.classList.toggle('active', b.dataset.bg === S.bgMode));
  document.querySelectorAll('[data-panel]').forEach(b => b.classList.toggle('active', b.dataset.panel === S.defaultPanel));
  document.querySelectorAll('[data-anim]').forEach(b => b.classList.toggle('active', b.dataset.anim === S.bgAnimation));
  document.querySelectorAll('[data-f]').forEach(b => b.classList.toggle('active', b.dataset.f === S.fontChoice));
  document.querySelectorAll('[data-priority]').forEach(b => b.classList.toggle('active', b.dataset.priority === S.sourcePriority));

  // Body classes
  document.body.classList.toggle('mode-apple', S.appleMode);
  document.body.classList.toggle('show-progress', S.showProgress);
  document.body.classList.remove('f-inter', 'f-modern', 'f-serif', 'f-mono', 'f-default');
  document.body.classList.add('f-' + S.fontChoice);

  $.orbBg.style.opacity = (S.bgAnimation === 'blobs') ? '1' : '0';
  $.artWrap.classList.toggle('vinyl', S.vinylMode);
  document.body.classList.toggle('show-eq', S.eqViz);
  document.body.classList.toggle('show-canvas-viz', S.canvasViz);
  if (!S.fluidGradient) $.fluidGradientBg.classList.remove('on');

  // Lanyard ID field
  $.setLanyardId.value = S.lanyardId || '';

  // Priority description
  updatePriorityDesc();

  // Hero scale — slider 60-140 → CSS var 0.6-1.4
  const scale = (S.heroScale || 100) / 100;
  document.documentElement.style.setProperty('--hero-scale', scale);
  if ($.setHeroScale) { $.setHeroScale.value = S.heroScale; updateSliderFill($.setHeroScale); }
  const heroScaleVal = document.getElementById('hero-scale-val');
  if (heroScaleVal) heroScaleVal.textContent = (S.heroScale || 100) + '%';

  // Hero layout — remove all, add the active one
  document.body.classList.remove('hero-focus', 'hero-minimal');
  if (S.heroLayout === 'focus')   document.body.classList.add('hero-focus');
  if (S.heroLayout === 'minimal') document.body.classList.add('hero-minimal');
  document.querySelectorAll('[data-layout]').forEach(b => b.classList.toggle('active', b.dataset.layout === S.heroLayout));
  updateLayoutDesc();

  // Hero alignment
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

// Hero scale slider
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

// Option button groups
document.querySelectorAll('[data-bg]').forEach(b       => b.addEventListener('click', () => { S.bgMode       = b.dataset.bg;       applySettings(); saveSettings(); }));
document.querySelectorAll('[data-panel]').forEach(b    => b.addEventListener('click', () => { S.defaultPanel = b.dataset.panel;    applySettings(); saveSettings(); }));
document.querySelectorAll('[data-art-shape]').forEach(b => b.addEventListener('click', () => { S.artShape   = b.dataset.artShape; applySettings(); saveSettings(); }));
document.querySelectorAll('[data-color]').forEach(b    => b.addEventListener('click', () => { S.accentColor = b.dataset.color;    applySettings(); saveSettings(); }));
document.querySelectorAll('[data-anim]').forEach(b     => b.addEventListener('click', () => { S.bgAnimation = b.dataset.anim;     applySettings(); saveSettings(); }));
document.querySelectorAll('[data-f]').forEach(b        => b.addEventListener('click', () => { S.fontChoice  = b.dataset.f;        applySettings(); saveSettings(); }));
document.querySelectorAll('[data-priority]').forEach(b => b.addEventListener('click', () => { S.sourcePriority = b.dataset.priority; applySettings(); saveSettings(); }));

// Hero layout mode buttons
document.querySelectorAll('[data-layout]').forEach(b => b.addEventListener('click', () => {
  S.heroLayout = b.dataset.layout;
  applySettings(); saveSettings();
}));

// Hero alignment buttons
document.querySelectorAll('[data-align]').forEach(b => b.addEventListener('click', () => {
  S.heroAlign = b.dataset.align;
  applySettings(); saveSettings();
}));

/* user search (switch Last.fm user) */
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

/* Lanyard ID input — save on type, connect on Enter */
$.setLanyardId.addEventListener('input', () => { S.lanyardId = $.setLanyardId.value.trim(); saveSettings(); });
$.setLanyardId.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    S.lanyardId = $.setLanyardId.value.trim();
    saveSettings();
    if (S.lanyardId) lanyardConnect(S.lanyardId);
    else lanyardDisconnect();
  }
});

/* Lanyard "Connect" button */
if ($.btnLanyardConnect) {
  $.btnLanyardConnect.addEventListener('click', () => {
    S.lanyardId = $.setLanyardId.value.trim();
    saveSettings();
    if ($.btnLanyardConnect.classList.contains('connected')) {
      // Already connected — clicking disconnects
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

/* ---- IDLE / UI FADE ---- */
function resetIdle() {
  $.ui.classList.remove('hidden');
  document.body.style.cursor = 'default';
  clearTimeout(idleTimer);
  if (settingsOpen || lyricsOpen || histOpen) return;
  idleTimer = setTimeout(() => {
    $.ui.classList.add('hidden');
    document.body.style.cursor = 'none';
  }, 3500);
}
document.addEventListener('mousemove', resetIdle);
document.addEventListener('click', resetIdle);
document.addEventListener('keydown', resetIdle);

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

/* ---- ARTIST AVATAR — multi-API cascade ---- */
/* MusicBrainz+TheAudioDB → TheAudioDB by name → Last.fm → Deezer → gradient fallback */
const avatarCache = {};

async function fetchArtistAvatar(artist) {
  if (avatarCache[artist]) return avatarCache[artist];

  // 1. MusicBrainz → TheAudioDB
  try {
    const mbResp = await fetch(`https://musicbrainz.org/ws/2/artist/?query=artist:${encodeURIComponent(artist)}&fmt=json&limit=1`, { headers: { 'User-Agent': 'AURA/3.0 (music player)' } });
    if (mbResp.ok) {
      const mbData = await mbResp.json();
      const mbid = mbData.artists?.[0]?.id;
      if (mbid) {
        const tadbResp = await fetch(`https://www.theaudiodb.com/api/v1/json/2/artist-mb.php?i=${mbid}`);
        if (tadbResp.ok) {
          const tadbData = await tadbResp.json();
          const img = tadbData.artists?.[0]?.strArtistThumb || tadbData.artists?.[0]?.strArtistBanner;
          if (img) { avatarCache[artist] = img; return img; }
        }
      }
    }
  } catch {}

  // 2. TheAudioDB by artist name
  try {
    const r = await fetch(`https://www.theaudiodb.com/api/v1/json/2/search.php?s=${encodeURIComponent(artist)}`);
    if (r.ok) {
      const d = await r.json();
      const img = d.artists?.[0]?.strArtistThumb || d.artists?.[0]?.strArtistBanner;
      if (img) { avatarCache[artist] = img; return img; }
    }
  } catch {}

  // 3. Last.fm artist info
  try {
    const r = await fetch(`https://ws.audioscrobbler.com/2.0/?method=artist.getInfo&artist=${encodeURIComponent(artist)}&api_key=${apiKey}&format=json`);
    if (r.ok) {
      const d = await r.json();
      const imgs = d.artist?.image || [];
      for (let i = imgs.length - 1; i >= 0; i--) {
        const url = imgs[i]['#text'];
        if (url && url.length > 10 && !url.includes('2a96cbd8b46e442fc41c2b86b821562f')) {
          avatarCache[artist] = url; return url;
        }
      }
    }
  } catch {}

  // 4. Deezer
  try {
    const r = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(artist)}&limit=1`);
    if (r.ok) {
      const d = await r.json();
      const img = d.data?.[0]?.picture_medium || d.data?.[0]?.picture;
      if (img) { avatarCache[artist] = img; return img; }
    }
  } catch {}

  return null;
}

async function updateArtistAvatar(artist) {
  if (!S.showAvatar) return;
  $.avatarCircle.classList.remove('on');
  $.artistAvatar.classList.remove('loaded');
  $.artistAvatar.src = '';

  if ($.avatarFallback) {
    $.avatarFallback.style.background = fallbackGradient(artist);
    $.avatarFallback.textContent = fallbackLetter(artist);
    $.avatarFallback.style.opacity = '1';
  }
  $.avatarCircle.classList.add('on');

  const url = await fetchArtistAvatar(artist);
  if (url) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      $.artistAvatar.src = url;
      $.artistAvatar.classList.add('loaded');
      if ($.avatarFallback) $.avatarFallback.style.opacity = '0';
    };
    img.onerror = () => {
      $.artistAvatar.classList.remove('loaded');
      if ($.avatarFallback) $.avatarFallback.style.opacity = '1';
    };
    img.src = url;
  }
}

/* ---- POLLING (Last.fm) ---- */
function startPolling() { poll(); pollTimer = setInterval(poll, 1000); }

async function poll() {
  const lanyardHasData = lanyardActive && lanyardSpotifyData;

  if (lanyardHasData && (S.sourcePriority === 'lanyard' || S.sourcePriority === 'auto')) {
    setStatus('ok', '⚡ AURA Sync · ' + (lanyardSpotifyData.song || ''));
    // Still pull history from Last.fm in the background
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
        case 1: // Hello — start heartbeat + subscribe
          lanyardHbInterval = setInterval(() => {
            if (lanyardWs && lanyardWs.readyState === WebSocket.OPEN) {
              lanyardWs.send(JSON.stringify({ op: 3 }));
            }
          }, msg.d.heartbeat_interval);
          lanyardWs.send(JSON.stringify({ op: 2, d: { subscribe_to_id: discordId } }));
          if ($.lanyardWsBadge) $.lanyardWsBadge.style.display = 'inline-block';
          break;
        case 0: // Event
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
    // If there are no timestamps, the track is paused
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
    // Freeze LRC too
    if (lrcSynced) { cancelAnimationFrame(lrcRAF); lrcRAF = null; }
    if (!S.canvasViz) stopCanvasViz();
  } else {
    // Adjust start time so elapsed continues from where it was
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

// Returns elapsed milliseconds, always based on real wall-clock time for Lanyard tracks.
// This is how skips/seeks on Spotify are reflected instantly — the timestamp updates via WS.
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

  // For Lanyard: same track, only update pause state
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
  // Source indicator — green border glow when playing from Lanyard/Spotify
  document.body.classList.toggle('source-lanyard', !!track._fromLanyard);

  // Timestamps — Lanyard provides exact start, otherwise use now
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

  // Album art
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
  // After swapArt, artSlot already points to the newly active slot
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

/* ---- ART SWAP ---- */
function fallbackGradient(str) {
  const h = [...(str || 'A')].reduce((a, c) => a + c.charCodeAt(0), 0);
  const hue = h % 360;
  return `linear-gradient(135deg, hsl(${hue},60%,25%), hsl(${(hue+40)%360},70%,18%))`;
}
function fallbackLetter(str) { return (str || '?')[0].toUpperCase(); }

function swapArt(url, artist, title) {
  const front  = artSlot === 'a' ? $.artA : $.artB;
  const back   = artSlot === 'a' ? $.artB : $.artA;
  const fbFront = artSlot === 'a' ? $.fbA : $.fbB;
  const fbBack  = artSlot === 'a' ? $.fbB : $.fbA;
  const grad   = fallbackGradient(artist);
  const letter = fallbackLetter(title);

  if (!url) {
    fbBack.style.background = grad; fbBack.textContent = letter; fbBack.style.opacity = '1';
    fbFront.style.opacity = '0'; back.style.opacity = '0'; front.style.opacity = '0';
    artSlot = artSlot === 'a' ? 'b' : 'a';
    updateBg(null, grad); $.artGlow.style.background = grad; $.artGlow.style.backgroundImage = 'none';
    return;
  }

  back.crossOrigin = 'anonymous';
  back.src = url;
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
  if (url)  back.style.backgroundImage = `url('${url}')`;
  else if (grad) back.style.backgroundImage = grad;
  back.style.opacity = '1'; front.style.opacity = '0';
  bgSlot = bgSlot === 'a' ? 'b' : 'a';
  bgTimeout = setTimeout(() => { front.style.backgroundImage = ''; }, 2200);
}

/* ---- HISTORY ---- */
function renderHistory(tracks) {
  $.hpList.innerHTML = '';
  tracks.forEach(t => {
    const isPlaying = t['@attr']?.nowplaying === 'true';
    const artist = t.artist?.name || t.artist?.['#text'] || '';
    const title  = t.name || '';
    const imgs   = t.image || [];
    let imgUrl = '';
    for (let i = imgs.length - 1; i >= 0; i--) { if (imgs[i]['#text'] && imgs[i]['#text'].length > 10) { imgUrl = imgs[i]['#text']; break; } }
    let timeStr = '';
    if (!isPlaying && t.date?.uts) {
      const d = new Date(t.date.uts * 1000);
      timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const item = document.createElement('div');
    item.className = 'hp-item';
    item.innerHTML = `
      ${imgUrl
        ? `<img class="hp-thumb" src="${imgUrl}" alt="" onerror="this.style.display='none'">`
        : `<div class="hp-thumb" style="background:${fallbackGradient(artist)};display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:18px;color:rgba(255,255,255,.6)">${fallbackLetter(title)}</div>`
      }
      <div class="hp-info">
        <div class="hp-track">${title}</div>
        <div class="hp-artist">${artist}</div>
        ${timeStr ? `<div class="hp-time">${timeStr}</div>` : ''}
      </div>
      ${isPlaying ? '<div class="hp-playing"></div>' : ''}
    `;
    $.hpList.appendChild(item);
  });
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

// Uses translateY on #lrc-container to center the active line.
// The CSS handles the smooth animation via transition: transform 0.55s var(--snap).
// This avoids any scrollTop manipulation, giving a glassy feel on seek/skip.
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

  // Center active line via translateY
  if (lrcActiveIndex >= 0 && S.autoScroll) {
    const activeLine = allLines[lrcActiveIndex];
    const lpBodyEl   = $.lpBody;
    if (activeLine && lpBodyEl) {
      const panelH  = lpBodyEl.clientHeight;
      const lineTop = activeLine.offsetTop;
      const lineH   = activeLine.offsetHeight;
      // Shift the entire container so the active line sits in the middle of the panel
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
  // Reset the container position so it's ready for the next track
  if ($.lrcContainer) $.lrcContainer.style.transform = '';
  $.lpBody.classList.remove('lrc-mode');
}

/* ---- LYRICS LOADING ---- */
async function fetchLyricsFromLRCLIB(artist, title) {
  // Try exact match first (returns synced + plain)
  try {
    const r = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`);
    if (r.ok) {
      const d = await r.json();
      if (d.syncedLyrics) return { syncedLyrics: d.syncedLyrics, plainLyrics: d.plainLyrics, duration: d.duration, source: 'lrclib' };
      if (d.plainLyrics)  return { syncedLyrics: null, plainLyrics: d.plainLyrics, duration: d.duration, source: 'lrclib' };
    }
  } catch {}

  // Search fallback
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

  // Lyrics.ovh fallback
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

  // Write directly into the persistent #lrc-container — never replace $.lpBody.innerHTML
  // (replacing it creates a new element and breaks the $.lrcContainer reference)
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
      $.lpBody.classList.add('lrc-mode'); // switch to translateY mode, no scrollbar
      renderLRCLines(lrcLines);
      setLPBadge('synced');
      cancelAnimationFrame(lrcRAF);
      tickLRC();
      return;
    }
  }

  // Plain text fallback
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

/* ---- CANVAS SPECTRUM VISUALIZER ---- */
let vizRAF = null, vizPhase = 0;

function startCanvasViz() { if (vizRAF) cancelAnimationFrame(vizRAF); vizLoop(); }
function stopCanvasViz()  {
  cancelAnimationFrame(vizRAF); vizRAF = null;
  const ctx = $.vizCanvas.getContext('2d');
  ctx.clearRect(0, 0, $.vizCanvas.width, $.vizCanvas.height);
}

function vizLoop() {
  const canvas = $.vizCanvas;
  const ctx    = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const barCount = 48;
  const barW = W / barCount - 1.5;
  const gap  = W / barCount;
  const isPlaying = !isPaused && document.body.classList.contains('is-playing');
  const speedMult = isPaused ? 0.003 : 0.035;
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#e0245e';

  vizPhase += speedMult;

  for (let i = 0; i < barCount; i++) {
    const t    = i / barCount;
    const wave1 = Math.sin(t * Math.PI * 2.2  + vizPhase)       * 0.38;
    const wave2 = Math.sin(t * Math.PI * 5.7  + vizPhase * 1.7) * 0.22;
    const wave3 = Math.sin(t * Math.PI * 11   + vizPhase * 0.9) * 0.12;
    const wave4 = Math.sin(t * Math.PI * 0.8  - vizPhase * 0.5) * 0.15;
    const shape = Math.exp(-Math.pow((t - 0.35) * 2.5, 2)) * 0.6 + Math.exp(-Math.pow((t - 0.65) * 3, 2)) * 0.35 + 0.08;
    const rawH  = (wave1 + wave2 + wave3 + wave4 + shape + 0.5) * 0.5;
    const barH  = Math.max(2, rawH * H * (isPlaying ? 1 : 0.12));
    const x = i * gap, y = H - barH;
    const grad = ctx.createLinearGradient(0, y, 0, H);
    grad.addColorStop(0, accent + 'cc');
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

$.lpBody.addEventListener('wheel', () => {});
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
    case 'M':
      e.preventDefault();
      $.ui.classList.toggle('hidden');
      if ($.ui.classList.contains('hidden')) document.body.style.cursor = 'none';
      else { document.body.style.cursor = 'default'; resetIdle(); }
      break;
    case 'ESCAPE': e.preventDefault(); closeAllPanels(); resetIdle(); break;
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
