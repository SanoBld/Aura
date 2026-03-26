/* ══════════════════════════════════════════════════════════════
   AURA — script.js v2
   FIXES:
   - Avatar circle: multi-API (MusicBrainz → TheAudioDB → Last.fm → Deezer → initial fallback)
   - Discord Rich Presence: temps réel 2s, pause/play state, boutons avancés
   - Lyrics: parseur LRC corrigé (ignores metadata tags), translateY scroll fluide
   - Source priority: Lanyard > Last.fm > none (configurable)
   - Pause detection: currentTime figé si en pause
   - LRC/Canvas RAF: coupé quand panel fermé ou en pause
   - localStorage GC: max 50 entries, TTL 7j
══════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════
   STATE & SETTINGS
═══════════════════════════════════════ */
let apiKey = '', username = '', originalUser = '', currentTrack = null, artSlot = 'a', bgSlot = 'a';
let lyricsOpen = false, histOpen = false, settingsOpen = false;
let pollTimer = null, idleTimer = null, bgTimeout = null;
let trackStartTime = 0, trackDuration = 0, trackPausedAt = 0, progressRAF = null;
let currentTrackId = '';
let isPaused = false; // Global pause state

const S = {
  blur: 70, brightness: 55, saturate: 14,
  bgMode: 'album', showArt: true, showBg: true, showAvatar: true,
  showMarquee: true, defaultPanel: 'lyrics', accentColor: '#e0245e',
  artShape: '22px', marqueeSpeed: 32, showGlow: true, showGrain: false,
  autoScroll: true, appleMode: false, showProgress: true,
  bgAnimation: 'none', fontChoice: 'default',
  vinylMode: false, colorThief: false, fluidGradient: false,
  eqViz: false, canvasViz: false,
  // Discord RPC
  discordEnabled: false, discordClientId: '',
  discordPreviewCard: true, discordPreviewOpen: false,
  // Lanyard / AURA Sync
  lanyardId: '',
  // Source priority: 'lanyard' | 'lastfm' | 'auto'
  sourcePriority: 'lanyard',
};

/* ═══════════════════════════════════════
   DOM REFERENCES
═══════════════════════════════════════ */
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
  // Settings inputs
  setBlur: document.getElementById('set-blur'),
  setBrightness: document.getElementById('set-brightness'),
  setSaturate: document.getElementById('set-saturate'),
  setBg: document.getElementById('set-bg'), setArt: document.getElementById('set-art'),
  setGlow: document.getElementById('set-glow'), setAvatar: document.getElementById('set-avatar'),
  setMarquee: document.getElementById('set-marquee'), setGrain: document.getElementById('set-grain'),
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
  // Source priority
  priorityDesc: document.getElementById('priority-desc'),
  // Lanyard / AURA Sync
  setLanyardId: document.getElementById('set-lanyard-id'),
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
  // Canvas
  vizCanvas: document.getElementById('viz-canvas'),
};

/* ═══════════════════════════════════════
   CACHE / PERSISTENCE
═══════════════════════════════════════ */
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

/* ── LRC LYRICS CACHE with GC ── */
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
  try {
    gcLRCCache(); // GC before writing
    localStorage.setItem(lrcCacheKey(artist, title), JSON.stringify({ ...data, cachedAt: Date.now() }));
  } catch {}
}

/* ── LRC Garbage Collection: max 50 entries, TTL 7 days ── */
function gcLRCCache() {
  try {
    const prefix = 'aura_lrc_';
    const TTL = 7 * 24 * 3600 * 1000;
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
    // Remove expired
    const entries = [];
    for (const k of keys) {
      try {
        const d = JSON.parse(localStorage.getItem(k));
        if (!d || (Date.now() - d.cachedAt) > TTL) { localStorage.removeItem(k); }
        else entries.push({ k, t: d.cachedAt });
      } catch { localStorage.removeItem(k); }
    }
    // Remove oldest if > 50
    if (entries.length > 50) {
      entries.sort((a, b) => a.t - b.t);
      entries.slice(0, entries.length - 50).forEach(e => localStorage.removeItem(e.k));
    }
  } catch {}
}

/* ═══════════════════════════════════════
   SETTINGS TABS
═══════════════════════════════════════ */
document.querySelectorAll('.sp-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.sp-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.sp-tab-pane').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const target = document.getElementById('tab-' + tab.dataset.tab);
    if (target) target.classList.add('active');
  });
});

/* ═══════════════════════════════════════
   APPLY SETTINGS
═══════════════════════════════════════ */
function applySettings() {
  document.documentElement.style.setProperty('--accent', S.accentColor);
  document.querySelectorAll('[data-color]').forEach(b => b.classList.toggle('active', b.dataset.color === S.accentColor));
  document.documentElement.style.setProperty('--blur-amount', S.blur + 'px');
  document.documentElement.style.setProperty('--bg-brightness', (S.brightness / 100).toFixed(2));
  document.documentElement.style.setProperty('--bg-saturate', (S.saturate / 10).toFixed(2));

  $.setBlur.value = S.blur; updateSliderFill($.setBlur);
  $.setBrightness.value = S.brightness; updateSliderFill($.setBrightness);
  $.setSaturate.value = S.saturate; updateSliderFill($.setSaturate);
  $.setMqSpeed.value = S.marqueeSpeed; updateSliderFill($.setMqSpeed);
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

  // Lanyard field
  $.setLanyardId.value = S.lanyardId || '';

  // Priority desc
  updatePriorityDesc();
}

function updatePriorityDesc() {
  if (!$.priorityDesc) return;
  const descs = {
    lanyard: 'AURA Sync (Lanyard) est prioritaire. Last.fm prend le relais si aucun stream n\'est détecté.',
    lastfm: 'Last.fm est toujours prioritaire. Lanyard est ignoré pour les données musicales.',
    auto: 'Détection automatique : la source avec des données actives est préférée.'
  };
  $.priorityDesc.textContent = descs[S.sourcePriority] || '';
}

function updateSliderFill(el) {
  const pct = ((el.value - el.min) / (el.max - el.min) * 100) + '%';
  el.style.setProperty('--pct', pct);
}

/* ═══════════════════════════════════════
   SETTINGS EVENT LISTENERS
═══════════════════════════════════════ */
$.setBlur.addEventListener('input', () => { S.blur = parseInt($.setBlur.value); applySettings(); saveSettings(); });
$.setBrightness.addEventListener('input', () => { S.brightness = parseInt($.setBrightness.value); applySettings(); saveSettings(); });
$.setSaturate.addEventListener('input', () => { S.saturate = parseInt($.setSaturate.value); applySettings(); saveSettings(); });
$.setMqSpeed.addEventListener('input', () => { S.marqueeSpeed = parseInt($.setMqSpeed.value); applySettings(); saveSettings(); });

$.setBg.addEventListener('change', () => { S.showBg = $.setBg.checked; applySettings(); saveSettings(); });
$.setArt.addEventListener('change', () => { S.showArt = $.setArt.checked; applySettings(); saveSettings(); });
$.setGlow.addEventListener('change', () => { S.showGlow = $.setGlow.checked; applySettings(); saveSettings(); });
$.setAvatar.addEventListener('change', () => { S.showAvatar = $.setAvatar.checked; applySettings(); saveSettings(); });
$.setMarquee.addEventListener('change', () => { S.showMarquee = $.setMarquee.checked; applySettings(); saveSettings(); });
$.setGrain.addEventListener('change', () => { S.showGrain = $.setGrain.checked; applySettings(); saveSettings(); });
$.setAutoscroll.addEventListener('change', () => { S.autoScroll = $.setAutoscroll.checked; applySettings(); saveSettings(); });
$.setAppleMode.addEventListener('change', () => { S.appleMode = $.setAppleMode.checked; applySettings(); saveSettings(); });
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
  if (S.canvasViz) startCanvasViz();
  else stopCanvasViz();
  saveSettings();
});

document.querySelectorAll('[data-bg]').forEach(b => b.addEventListener('click', () => { S.bgMode = b.dataset.bg; applySettings(); saveSettings(); }));
document.querySelectorAll('[data-panel]').forEach(b => b.addEventListener('click', () => { S.defaultPanel = b.dataset.panel; applySettings(); saveSettings(); }));
document.querySelectorAll('[data-art-shape]').forEach(b => b.addEventListener('click', () => { S.artShape = b.dataset.artShape; applySettings(); saveSettings(); }));
document.querySelectorAll('[data-color]').forEach(b => b.addEventListener('click', () => { S.accentColor = b.dataset.color; applySettings(); saveSettings(); }));
document.querySelectorAll('[data-anim]').forEach(b => b.addEventListener('click', () => { S.bgAnimation = b.dataset.anim; applySettings(); saveSettings(); }));
document.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { S.fontChoice = b.dataset.f; applySettings(); saveSettings(); }));
document.querySelectorAll('[data-priority]').forEach(b => b.addEventListener('click', () => {
  S.sourcePriority = b.dataset.priority;
  applySettings(); saveSettings();
}));

/* ── User search ── */
$.userSearch.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const target = $.userSearch.value.trim();
    username = target !== '' ? target : originalUser;
    setStatus('loading', target !== '' ? 'Vue : ' + target : 'Retour…');
    clearInterval(pollTimer);
    poll();
    pollTimer = setInterval(poll, 1000);
  }
});

/* ─ Lanyard ID ─ */
$.setLanyardId.addEventListener('input', () => { S.lanyardId = $.setLanyardId.value.trim(); saveSettings(); });
$.setLanyardId.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    S.lanyardId = $.setLanyardId.value.trim();
    saveSettings();
    if (S.lanyardId) lanyardConnect(S.lanyardId);
    else lanyardDisconnect();
  }
});

/* ═══════════════════════════════════════
   ERROR DISPLAY
═══════════════════════════════════════ */
function showError(msg) { $.lError.textContent = msg; $.lError.classList.add('on'); }
function clearError() { $.lError.classList.remove('on'); }
$.inUser.addEventListener('input', clearError);
$.inKey.addEventListener('input', clearError);
$.inUser.addEventListener('keydown', e => { if (e.key === 'Enter') $.inKey.focus(); });
$.inKey.addEventListener('keydown', e => { if (e.key === 'Enter') attemptConnect(); });

/* ═══════════════════════════════════════
   INIT
═══════════════════════════════════════ */
(function init() {
  loadSettings();
  gcLRCCache(); // Run GC on start
  const { u, k } = loadCache();
  if (u && k) {
    $.cachedName.textContent = u;
    $.cachedEntry.style.display = 'flex';
    $.cachedEntry.addEventListener('click', () => connectWith(u, k));
  }
})();

/* ═══════════════════════════════════════
   LOGIN
═══════════════════════════════════════ */
$.btnConnect.addEventListener('click', attemptConnect);

async function attemptConnect() {
  const u = $.inUser.value.trim();
  const k = $.inKey.value.trim();
  if (!u) { showError('Entrez votre nom d\'utilisateur Last.fm.'); return; }
  if (!k || k.length < 20) { showError('Clé API invalide (32 caractères hex).'); return; }
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

    if (S.defaultPanel === 'lyrics') $.btnLyrics.click();
    if (S.defaultPanel === 'history') $.btnHist.click();

    if (S.lanyardId) lanyardConnect(S.lanyardId);

    startPolling();
    if (S.canvasViz) startCanvasViz();
    resetIdle();
  } catch(err) {
    showLoading(false);
    showError(err.message || 'Impossible de se connecter.');
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

/* ═══════════════════════════════════════
   IDLE / UI FADE
═══════════════════════════════════════ */
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

/* ═══════════════════════════════════════
   API CALLS (Last.fm)
═══════════════════════════════════════ */
async function fetchUserInfo(u, k) {
  const r = await fetch(`https://ws.audioscrobbler.com/2.0/?method=user.getInfo&user=${encodeURIComponent(u)}&api_key=${k}&format=json`);
  if (!r.ok) throw new Error('Réponse réseau invalide.');
  const d = await r.json();
  if (d.error) throw new Error(d.message || 'Erreur Last.fm: ' + d.error);
  return d.user;
}

async function fetchRecentTracks(limit = 10) {
  const r = await fetch(`https://ws.audioscrobbler.com/2.0/?method=user.getRecentTracks&user=${encodeURIComponent(username)}&api_key=${apiKey}&format=json&limit=${limit}&extended=1`);
  if (!r.ok) throw new Error('Réseau');
  const d = await r.json();
  if (d.error) throw new Error(d.message);
  const tracks = d.recenttracks?.track;
  if (!tracks) return { current: null, history: [] };
  const arr = Array.isArray(tracks) ? tracks : [tracks];
  const current = arr[0]?.['@attr']?.nowplaying === 'true' ? arr[0] : null;
  return { current, history: arr };
}

/* ═══════════════════════════════════════
   ARTIST AVATAR — Multi-API with priority cascade
   Priority: MusicBrainz+CAA → TheAudioDB → Last.fm → Deezer → initial fallback
═══════════════════════════════════════ */
const avatarCache = {};

async function fetchArtistAvatar(artist) {
  if (avatarCache[artist]) return avatarCache[artist];

  // 1. MusicBrainz + Cover Art Archive (artist image via MusicBrainz)
  try {
    const mbResp = await fetch(`https://musicbrainz.org/ws/2/artist/?query=artist:${encodeURIComponent(artist)}&fmt=json&limit=1`, {
      headers: { 'User-Agent': 'AURA/2.0 (music player)' }
    });
    if (mbResp.ok) {
      const mbData = await mbResp.json();
      const mbid = mbData.artists?.[0]?.id;
      if (mbid) {
        // Try TheAudioDB with MBID
        const tadbResp = await fetch(`https://www.theaudiodb.com/api/v1/json/2/artist-mb.php?i=${mbid}`);
        if (tadbResp.ok) {
          const tadbData = await tadbResp.json();
          const img = tadbData.artists?.[0]?.strArtistThumb || tadbData.artists?.[0]?.strArtistBanner;
          if (img) { avatarCache[artist] = img; return img; }
        }
      }
    }
  } catch {}

  // 2. TheAudioDB by name
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

  // 4. Deezer search
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

async function updateArtistAvatar(artist, title) {
  if (!S.showAvatar) return;

  // Reset
  $.avatarCircle.classList.remove('on');
  $.artistAvatar.classList.remove('loaded');
  $.artistAvatar.src = '';

  // Show initial fallback immediately
  if ($.avatarFallback) {
    $.avatarFallback.style.background = fallbackGradient(artist);
    $.avatarFallback.textContent = fallbackLetter(artist);
    $.avatarFallback.style.opacity = '1';
  }
  $.avatarCircle.classList.add('on');

  // Try to get real image
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
      // Keep fallback visible
      $.artistAvatar.classList.remove('loaded');
      if ($.avatarFallback) $.avatarFallback.style.opacity = '1';
    };
    img.src = url;
  }
}

/* ═══════════════════════════════════════
   POLLING (Last.fm)
═══════════════════════════════════════ */
function startPolling() { poll(); pollTimer = setInterval(poll, 1000); }

async function poll() {
  // Source priority logic
  const lanyardHasData = lanyardActive && lanyardSpotifyData;

  if (lanyardHasData && (S.sourcePriority === 'lanyard' || (S.sourcePriority === 'auto'))) {
    setStatus('ok', '⚡ AURA Sync · ' + (lanyardSpotifyData.song || ''));
    // Still fetch history from Last.fm
    try {
      const { history } = await fetchRecentTracks(10);
      renderHistory(history);
    } catch {}
    return;
  }

  if (S.sourcePriority === 'lastfm' || !lanyardHasData) {
    try {
      const { current, history } = await fetchRecentTracks(10);
      handleTrack(current);
      renderHistory(history);
      setStatus('ok', username !== originalUser ? 'Vue : ' + username : 'En direct');
    } catch(e) {
      setStatus('error', 'Erreur réseau');
    }
  }
}

function setStatus(state, text) {
  $.stDot.className = state === 'loading' ? 'loading' : state === 'error' ? 'error' : '';
  $.stText.textContent = text;
}

/* ═══════════════════════════════════════
   ⚡ LANYARD / AURA SYNC — WebSocket
═══════════════════════════════════════ */
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

  setLanyardStatus('connecting', 'Connexion à AURA Sync…');
  $.btnLanyardStatus.style.display = 'flex';

  try {
    lanyardWs = new WebSocket('wss://api.lanyard.rest/socket');
  } catch(e) {
    setLanyardStatus('error', 'WebSocket non supporté');
    return;
  }

  lanyardWs.onopen = () => {};

  lanyardWs.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      switch (msg.op) {
        case 1: // Hello
          lanyardHbInterval = setInterval(() => {
            if (lanyardWs && lanyardWs.readyState === WebSocket.OPEN) {
              lanyardWs.send(JSON.stringify({ op: 3 }));
            }
          }, msg.d.heartbeat_interval);
          lanyardWs.send(JSON.stringify({ op: 2, d: { subscribe_to_id: discordId } }));
          // Show WS live badge
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
    setLanyardStatus('error', 'Erreur de connexion');
    if ($.lanyardWsBadge) $.lanyardWsBadge.style.display = 'none';
  };

  lanyardWs.onclose = () => {
    lanyardActive = false;
    lanyardSpotifyData = null;
    if ($.lanyardWsBadge) $.lanyardWsBadge.style.display = 'none';
    if (lanyardHbInterval) { clearInterval(lanyardHbInterval); lanyardHbInterval = null; }
    if (lanyardCurrentDiscordId) {
      setLanyardStatus('connecting', 'Reconnexion…');
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
  setLanyardStatus('off', 'Désactivé — entrez un ID pour activer');
  $.btnLanyardStatus.style.display = 'none';
}

function lanyardHandlePresence(data) {
  let spotifyData = null;
  let trackPaused = false;

  if (data.spotify && data.spotify.song) {
    spotifyData = data.spotify;
    // Detect pause: no timestamps or end equals start
    if (!data.spotify.timestamps || !data.spotify.timestamps.start) {
      trackPaused = true;
    }
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
      lanyardTimestampEnd = spotifyData.timestamps.end || 0;
    } else {
      lanyardTimestampStart = 0;
      lanyardTimestampEnd = 0;
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
      if (trackPaused) {
        setPausedState(true);
      } else {
        setPausedState(false);
      }
    }

    // Update Discord preview panel with real-time data
    if (S.discordEnabled && S.discordPreviewCard) {
      updateDiscordPreviewCard(syntheticTrack, trackPaused);
    }

  } else {
    lanyardActive = false;
    lanyardSpotifyData = null;
    setLanyardStatus('no-music', 'Aucune musique détectée');
    if (S.sourcePriority !== 'lastfm') {
      handleTrack(null);
    }
  }
}

function setLanyardStatus(state, text) {
  const dot = $.lanyardDot;
  const txtEl = $.lanyardStatusText;
  const badge = $.lanyardBadge;

  dot.className = 'lanyard-dot';
  badge.className = 'lanyard-badge';

  if (state === 'connecting') {
    dot.classList.add('connecting');
    badge.classList.add('inactive');
  } else if (state === 'connected') {
    dot.classList.add('connected');
    badge.classList.add('active');
  } else if (state === 'no-music') {
    dot.classList.add('no-music');
    badge.classList.add('inactive');
  } else if (state === 'error') {
    dot.classList.add('error');
    badge.classList.add('inactive');
  } else {
    badge.classList.add('inactive');
  }

  if (txtEl) txtEl.textContent = text;
}

/* ═══════════════════════════════════════
   PAUSE STATE MANAGEMENT
═══════════════════════════════════════ */
function setPausedState(paused) {
  if (isPaused === paused) return;
  isPaused = paused;

  if (paused) {
    // Freeze the elapsed time
    trackPausedAt = Date.now() - (trackStartTime > 0 ? (Date.now() - trackStartTime) : 0);
    cancelAnimationFrame(progressRAF);
    // Stop LRC when paused
    if (lrcSynced) {
      cancelAnimationFrame(lrcRAF);
      lrcRAF = null;
    }
    // Stop canvas viz when paused (performance)
    if (!S.canvasViz) stopCanvasViz();
  } else {
    // Resume: adjust trackStartTime so elapsed is continuous
    if (trackPausedAt > 0) {
      const pausedDuration = Date.now() - trackPausedAt;
      trackStartTime += pausedDuration;
      trackPausedAt = 0;
    }
    progressRAF = requestAnimationFrame(updateTrackProgress);
    // Resume LRC
    if (lrcSynced && lyricsOpen) {
      cancelAnimationFrame(lrcRAF);
      tickLRC();
    }
    if (S.canvasViz) startCanvasViz();
  }

  document.body.classList.toggle('is-paused', paused);
  document.body.classList.toggle('is-playing', !paused && currentTrack !== null);
}

/* ═══════════════════════════════════════
   TRACK PROGRESS & RENDERING
═══════════════════════════════════════ */
function getElapsedMs() {
  if (isPaused) {
    // Return the frozen elapsed time
    return trackPausedAt > 0 ? (trackPausedAt - trackStartTime) : 0;
  }
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

  if (!lrcSynced && S.autoScroll && lyricsOpen) {
    const scrollMax = $.lpBody.scrollHeight - $.lpBody.clientHeight;
    if (scrollMax > 0 && pct > 5) {
      const scrollProgress = (pct - 5) / 95;
      $.lpBody.scrollTop = scrollProgress * scrollMax;
    }
  }

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
    $.mq.textContent = '— — — — — — — — — — — — — — — — — — — — — — — — —';
    cancelAnimationFrame(progressRAF);
    $.artWrap.classList.remove('playing');
    document.body.classList.remove('is-playing', 'is-paused');
    if (S.colorThief) document.documentElement.style.setProperty('--accent', S.accentColor);
    if (S.fluidGradient) $.fluidGradientBg.classList.remove('on');
    stopLRC();
    isPaused = false;
    trackStartTime = 0;
    trackPausedAt = 0;
    currentTrack = null;
    currentTrackId = '';
    // Stop canvas when no track (save CPU)
    if (!S.canvasViz) stopCanvasViz();
    return;
  }

  $.noTrack.classList.remove('on');
  $.content.style.opacity = '1';

  const id = trackId(track);
  const isSameTrack = (id === currentTrackId);

  // Handle pause state changes on same track (Lanyard updates)
  if (isSameTrack && fromLanyard) {
    const newPaused = track._isPaused || false;
    if (newPaused !== isPaused) {
      setPausedState(newPaused);
    }
    return;
  }

  if (isSameTrack && !fromLanyard) return;

  currentTrackId = id;
  currentTrack = track;
  isPaused = track._isPaused || false;
  trackPausedAt = 0;

  $.artWrap.classList.add('playing');
  document.body.classList.add('is-playing');
  document.body.classList.remove('is-paused');

  // Timestamps
  if (track._fromLanyard && track._timestampStart > 0) {
    trackStartTime = track._timestampStart;
    const durMs = track.duration > 0 ? track.duration : 180000;
    trackDuration = durMs / 1000;
  } else {
    trackStartTime = Date.now();
    trackDuration = track.duration && parseInt(track.duration) > 0 ? parseInt(track.duration) / 1000 : 180;
  }

  cancelAnimationFrame(progressRAF);
  if (!isPaused) progressRAF = requestAnimationFrame(updateTrackProgress);

  const artist = track.artist?.name || track.artist?.['#text'] || 'Artiste inconnu';
  const title = track.name || 'Titre inconnu';

  $.mq.textContent = (title + '   ·   ' + artist + '   ·   ').repeat(10);

  $.title.classList.remove('show');
  $.artistRow.classList.remove('show');
  setTimeout(() => {
    $.title.textContent = title;
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

  // Avatar with multi-API
  updateArtistAvatar(artist, title);

  if (lyricsOpen) loadLyrics(artist, title);
  if (S.discordEnabled && S.discordPreviewCard) {
    updateDiscordPreviewCard(track, isPaused);
  }
}

/* ═══════════════════════════════════════
   COLOR THIEF — Canvas Extraction
═══════════════════════════════════════ */
function extractDominantColors(imgEl, count = 4) {
  try {
    const canvas = document.createElement('canvas');
    const size = 50; canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgEl, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    const buckets = {};
    for (let i = 0; i < data.length; i += 4) {
      const r = Math.round(data[i] / 28) * 28;
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
  const img = artSlot === 'a' ? $.artB : $.artA;
  const activeImg = img.naturalWidth > 0 ? img : (artSlot === 'a' ? $.artA : $.artB);
  if (!activeImg || !activeImg.naturalWidth) return;
  const colors = extractDominantColors(activeImg, 4);
  if (!colors || colors.length < 2) return;

  if (S.colorThief) {
    const vivid = colors.find(c => { const l = (c.r * 299 + c.g * 587 + c.b * 114) / 1000; return l > 40 && l < 200; }) || colors[0];
    const accentHex = `#${vivid.r.toString(16).padStart(2, '0')}${vivid.g.toString(16).padStart(2, '0')}${vivid.b.toString(16).padStart(2, '0')}`;
    document.documentElement.style.setProperty('--accent', accentHex);
  }

  if (S.fluidGradient) {
    const c = (i) => `rgb(${colors[i]?.r || 0},${colors[i]?.g || 0},${colors[i]?.b || 0})`;
    const grad = `linear-gradient(135deg, ${c(0)}, ${c(1)}, ${c(2) || c(1)}, ${c(3) || c(0)}, ${c(0)})`;
    $.fluidGradientBg.style.background = grad;
    $.fluidGradientBg.style.backgroundSize = '400% 400%';
    $.fluidGradientBg.classList.add('on');
  }
}

function fallbackGradient(name) {
  let h1 = 0, h2 = 0;
  for (let i = 0; i < name.length; i++) { h1 = (h1 + name.charCodeAt(i) * 7) % 360; h2 = (h2 + name.charCodeAt(i) * 13) % 360; }
  return `linear-gradient(135deg, hsl(${h1},60%,22%) 0%, hsl(${h2},50%,14%) 100%)`;
}
function fallbackLetter(text) { return (text || '?').charAt(0).toUpperCase(); }

function swapArt(url, artist, title) {
  const front = artSlot === 'a' ? $.artA : $.artB;
  const back = artSlot === 'a' ? $.artB : $.artA;
  const fbFront = artSlot === 'a' ? $.fbA : $.fbB;
  const fbBack = artSlot === 'a' ? $.fbB : $.fbA;
  const grad = fallbackGradient(artist);
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
  const back = bgSlot === 'a' ? $.bgB : $.bgA;
  clearTimeout(bgTimeout);
  back.style.transition = 'none'; back.style.opacity = '0';
  void back.offsetWidth;
  back.style.transition = 'opacity 2s var(--ease)';
  if (url) back.style.backgroundImage = `url('${url}')`;
  else if (grad) back.style.backgroundImage = grad;
  back.style.opacity = '1'; front.style.opacity = '0';
  bgSlot = bgSlot === 'a' ? 'b' : 'a';
  bgTimeout = setTimeout(() => { front.style.backgroundImage = ''; }, 2200);
}

/* ═══════════════════════════════════════
   HISTORY
═══════════════════════════════════════ */
function renderHistory(tracks) {
  $.hpList.innerHTML = '';
  tracks.forEach(t => {
    const isPlaying = t['@attr']?.nowplaying === 'true';
    const artist = t.artist?.name || t.artist?.['#text'] || '';
    const title = t.name || '';
    const imgs = t.image || [];
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

/* ═══════════════════════════════════════
   LRC ENGINE — Parser & Sync
   FIXED: Ignores metadata tags [ar:...], [ti:...] etc.
   FIXED: Uses offsetTop + scroll instead of scrollIntoView
═══════════════════════════════════════ */
let lrcLines = [];
let lrcSynced = false;
let lrcActiveIndex = -1;
let lrcRAF = null;
let lrcScrollRAF = null;

// Regex patterns for metadata tags to ignore
const LRC_METADATA_REGEX = /^\[(ar|ti|al|au|by|offset|re|ve|length):/i;

function parseLRC(lrcText) {
  const lines = lrcText.split('\n');
  const result = [];
  const timeRegex = /\[(\d{1,2}):(\d{2})[.:](\d{2,3})\]/g;

  for (const line of lines) {
    // Skip metadata lines like [ar:Artist], [ti:Title], [al:Album], etc.
    if (LRC_METADATA_REGEX.test(line.trim())) continue;

    const matches = [...line.matchAll(timeRegex)];
    // Extract text by removing ALL time tags
    const text = line.replace(/\[\d{1,2}:\d{2}[.:]\d{2,3}\]/g, '').trim();

    if (matches.length > 0 && text) {
      for (const match of matches) {
        const mins = parseInt(match[1]);
        const secs = parseInt(match[2]);
        const csStr = match[3].padEnd(3, '0').slice(0, 3); // normalize to ms
        const ms = parseInt(csStr);
        result.push({ timeMs: (mins * 60 + secs) * 1000 + ms, text });
      }
    } else if (matches.length > 0 && !text) {
      // Empty lyric line (intentional blank)
      for (const match of matches) {
        const mins = parseInt(match[1]);
        const secs = parseInt(match[2]);
        const csStr = match[3].padEnd(3, '0').slice(0, 3);
        const ms = parseInt(csStr);
        result.push({ timeMs: (mins * 60 + secs) * 1000 + ms, text: '♪' });
      }
    }
  }

  return result.sort((a, b) => a.timeMs - b.timeMs);
}

function renderLRCLines(lines) {
  const container = $.lpBody.querySelector('#lrc-container') || $.lrcContainer;
  container.innerHTML = '';
  lines.forEach((line, i) => {
    const div = document.createElement('div');
    div.className = 'lrc-line';
    div.textContent = line.text;
    div.dataset.index = i;
    div.addEventListener('click', () => {
      // Seek to this line's time (visual only, no actual seek possible)
      lrcActiveIndex = i;
      updateLRCDisplay();
    });
    container.appendChild(div);
  });
}

function tickLRC() {
  // Stop if panel closed or paused
  if (!lyricsOpen || !lrcSynced || !lrcLines.length) {
    lrcRAF = null;
    return;
  }
  // Don't advance if paused
  if (isPaused) {
    lrcRAF = requestAnimationFrame(tickLRC);
    return;
  }

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
  const lpBodyEl = $.lpBody;
  const container = lpBodyEl.querySelector('#lrc-container') || $.lrcContainer;
  if (!container) return;

  const allLines = container.querySelectorAll('.lrc-line');
  if (!allLines.length) return;

  allLines.forEach((line, i) => {
    const dist = Math.abs(i - lrcActiveIndex);
    line.classList.remove('active', 'near');
    if (i === lrcActiveIndex) {
      line.classList.add('active');
    } else if (dist <= 2) {
      line.classList.add('near');
    }
  });

  // Smooth scroll using scrollTop (no scrollIntoView to avoid jank)
  if (lrcActiveIndex >= 0 && S.autoScroll) {
    const activeLine = allLines[lrcActiveIndex];
    if (activeLine && lpBodyEl) {
      cancelAnimationFrame(lrcScrollRAF);
      const panelH = lpBodyEl.clientHeight;
      const lineTop = activeLine.offsetTop;
      const lineH = activeLine.offsetHeight;
      const targetScroll = lineTop - panelH / 2 + lineH / 2;

      // Smooth lerp scroll
      smoothScrollTo(lpBodyEl, targetScroll, 400);
    }
  }
}

function smoothScrollTo(el, target, duration) {
  const start = el.scrollTop;
  const diff = target - start;
  if (Math.abs(diff) < 2) return;
  const startTime = performance.now();

  function step(now) {
    const t = Math.min((now - startTime) / duration, 1);
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOut
    el.scrollTop = start + diff * ease;
    if (t < 1) lrcScrollRAF = requestAnimationFrame(step);
  }
  lrcScrollRAF = requestAnimationFrame(step);
}

function stopLRC() {
  cancelAnimationFrame(lrcRAF);
  cancelAnimationFrame(lrcScrollRAF);
  lrcRAF = null;
  lrcScrollRAF = null;
  lrcLines = [];
  lrcSynced = false;
  lrcActiveIndex = -1;
}

/* ═══════════════════════════════════════
   LYRICS LOADING (LRC-aware)
═══════════════════════════════════════ */
async function fetchLyricsFromLRCLIB(artist, title) {
  // Try synced lyrics first with exact match
  try {
    const r = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`);
    if (r.ok) {
      const d = await r.json();
      if (d.syncedLyrics) return { syncedLyrics: d.syncedLyrics, plainLyrics: d.plainLyrics, duration: d.duration, source: 'lrclib' };
      if (d.plainLyrics) return { syncedLyrics: null, plainLyrics: d.plainLyrics, duration: d.duration, source: 'lrclib' };
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

  // Rebuild lrc-container inside lp-body (it may have been overwritten)
  $.lpBody.innerHTML = '<div id="lrc-container"><span class="lp-empty">Chargement des paroles…</span></div>';
  const lrcContainerEl = $.lpBody.querySelector('#lrc-container');

  setLPBadge('');

  // Check cache
  const cached = getLRCCache(artist, title);
  let lyrData = cached;

  if (!lyrData) {
    lyrData = await fetchLyricsFromLRCLIB(artist, title);
    if (lyrData) setLRCCache(artist, title, lyrData);
  }

  if (!lyrData) {
    lrcContainerEl.innerHTML = `<span class="lp-empty">Paroles introuvables.<br/>Cherche sur <a href="https://genius.com/search?q=${encodeURIComponent(artist + ' ' + title)}" target="_blank" style="color:rgba(255,255,255,.4);text-decoration:none">Genius →</a></span>`;
    setLPBadge('plain');
    return;
  }

  if (lyrData.duration && lyrData.duration > 0) trackDuration = lyrData.duration;

  if (lyrData.syncedLyrics) {
    lrcLines = parseLRC(lyrData.syncedLyrics);
    if (lrcLines.length > 0) {
      lrcSynced = true;
      lrcContainerEl.innerHTML = '';
      renderLRCLines(lrcLines);
      setLPBadge('synced');
      cancelAnimationFrame(lrcRAF);
      tickLRC();
      return;
    }
  }

  // Plain text fallback
  lrcSynced = false;
  const plain = lyrData.plainLyrics ? lyrData.plainLyrics.trim().replace(/</g, '&lt;').replace(/\n/g, '<br>') : '';
  lrcContainerEl.innerHTML = plain
    ? `<div class="plain-lyrics">${plain}</div>`
    : `<span class="lp-empty">Paroles introuvables.</span>`;
  setLPBadge('plain');
}

function setLPBadge(type) {
  if (!$.lpBadge) return;
  $.lpBadge.className = 'lp-badge';
  if (type === 'synced') { $.lpBadge.classList.add('synced'); $.lpBadge.textContent = '⚡ Synchronisé'; }
  else if (type === 'plain') { $.lpBadge.classList.add('plain'); $.lpBadge.textContent = 'Texte'; }
  else { $.lpBadge.textContent = ''; }
}

/* ═══════════════════════════════════════
   CANVAS SPECTRUM VISUALIZER
   Smart: stops when paused or panel hidden
═══════════════════════════════════════ */
let vizRAF = null;
let vizPhase = 0;

function startCanvasViz() {
  if (vizRAF) cancelAnimationFrame(vizRAF);
  vizLoop();
}

function stopCanvasViz() {
  cancelAnimationFrame(vizRAF);
  vizRAF = null;
  const ctx = $.vizCanvas.getContext('2d');
  ctx.clearRect(0, 0, $.vizCanvas.width, $.vizCanvas.height);
}

function vizLoop() {
  const canvas = $.vizCanvas;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  const barCount = 48;
  const barW = W / barCount - 1.5;
  const gap = W / barCount;
  const isPlaying = !isPaused && document.body.classList.contains('is-playing');

  // Slow down animation when paused
  const speedMult = isPaused ? 0.003 : 0.035;
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#e0245e';

  vizPhase += speedMult;

  for (let i = 0; i < barCount; i++) {
    const t = i / barCount;
    const wave1 = Math.sin(t * Math.PI * 2.2 + vizPhase) * 0.38;
    const wave2 = Math.sin(t * Math.PI * 5.7 + vizPhase * 1.7) * 0.22;
    const wave3 = Math.sin(t * Math.PI * 11 + vizPhase * 0.9) * 0.12;
    const wave4 = Math.sin(t * Math.PI * 0.8 - vizPhase * 0.5) * 0.15;
    const shape = Math.exp(-Math.pow((t - 0.35) * 2.5, 2)) * 0.6 + Math.exp(-Math.pow((t - 0.65) * 3, 2)) * 0.35 + 0.08;
    const rawH = (wave1 + wave2 + wave3 + wave4 + shape + 0.5) * 0.5;
    const barH = Math.max(2, rawH * H * (isPlaying ? 1 : 0.12));

    const x = i * gap;
    const y = H - barH;
    const grad = ctx.createLinearGradient(0, y, 0, H);
    grad.addColorStop(0, accent + 'cc');
    grad.addColorStop(0.5, accent + '88');
    grad.addColorStop(1, accent + '22');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, [2, 2, 0, 0]);
    ctx.fill();
  }

  // Only continue RAF if canvas viz is enabled
  if (S.canvasViz) {
    vizRAF = requestAnimationFrame(vizLoop);
  } else {
    vizRAF = null;
  }
}

/* ═══════════════════════════════════════
   PANEL MANAGEMENT (exclusivity)
═══════════════════════════════════════ */
function closeAllPanels() {
  if (lyricsOpen) {
    lyricsOpen = false;
    $.lyricsPanel.classList.remove('on');
    $.btnLyrics.classList.remove('active');
    stopLRC(); // Stop LRC RAF when closing lyrics
  }
  if (histOpen) {
    histOpen = false;
    $.histPanel.classList.remove('on');
    $.btnHist.classList.remove('active');
  }
  if (settingsOpen) {
    settingsOpen = false;
    $.settingsPanel.classList.remove('on');
    $.btnSettings.classList.remove('active');
  }
  $.hero.classList.remove('shifted');
}

/* ── Lyrics button ── */
$.btnLyrics.addEventListener('click', () => {
  const opening = !lyricsOpen;
  closeAllPanels();
  if (opening) {
    lyricsOpen = true;
    $.lyricsPanel.classList.add('on');
    $.btnLyrics.classList.add('active');
    $.hero.classList.add('shifted');
    if (currentTrack) {
      const artist = currentTrack.artist?.name || currentTrack.artist?.['#text'] || '';
      const title = currentTrack.name || '';
      loadLyrics(artist, title);
    } else {
      // No track playing
      $.lpBody.innerHTML = '<div id="lrc-container"><span class="lp-empty">En attente d\'une musique…</span></div>';
      setLPBadge('');
    }
  }
  resetIdle();
});

/* ── History button ── */
$.btnHist.addEventListener('click', () => {
  const opening = !histOpen;
  closeAllPanels();
  if (opening) {
    histOpen = true;
    $.histPanel.classList.add('on');
    $.btnHist.classList.add('active');
    $.hero.classList.add('shifted');
  }
  resetIdle();
});

/* ── Settings button ── */
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

/* ── Click outside settings to close ── */
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

/* ═══════════════════════════════════════
   FULLSCREEN
═══════════════════════════════════════ */
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

/* ═══════════════════════════════════════
   KEYBOARD SHORTCUTS
═══════════════════════════════════════ */
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
    case 'ESCAPE':
      e.preventDefault();
      closeAllPanels();
      resetIdle();
      break;
  }
});

/* ═══════════════════════════════════════
   DISCORD RICH PRESENCE
   Updated: real-time 2s tick, pause/play state, extra info
═══════════════════════════════════════ */
let discordWs = null, discordConnected = false, discordIsPaused = false;
let discordPreviewOpen = false, discordReconnectTimer = null, discordPreviewRAF = null;
let discordPreviewInterval = null; // 2s interval for real-time updates
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
    txt.textContent = 'Connecté';
    btn.textContent = '✕ Déconnecter';
    btn.classList.add('disc-off');
    badge.classList.remove('hidden');
    badge.classList.add('dsc-live');
    discordConnected = true;
  } else if (state === 'connecting') {
    dot.classList.add('dsc-connecting');
    txt.textContent = 'Connexion…';
    btn.textContent = 'Connexion…';
    btn.classList.remove('disc-off');
    badge.classList.add('hidden');
    discordConnected = false;
  } else if (state === 'preview') {
    dot.classList.add('dsc-preview');
    txt.textContent = 'Mode aperçu (Discord non détecté)';
    btn.innerHTML = '♻ Réessayer';
    btn.classList.remove('disc-off');
    badge.classList.add('hidden');
    discordConnected = false;
  } else {
    txt.textContent = 'Déconnecté';
    btn.textContent = 'Se connecter à Discord';
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

/* ── Real-time 2s update interval for Discord preview ── */
function startDiscordPreviewInterval() {
  stopDiscordPreviewInterval();
  if (!discordPreviewOpen || !currentTrack) return;
  discordPreviewInterval = setInterval(() => {
    if (discordPreviewOpen && currentTrack) {
      tickDiscordPreview();
    }
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

  const artist = track.artist?.name || track.artist?.['#text'] || 'Artiste inconnu';
  const title = track.name || 'Titre inconnu';
  const album = track.album?.['#text'] || '';
  let imgUrl = track.albumArtUrl || '';
  if (!imgUrl) {
    const imgs = track.image || [];
    for (let i = imgs.length - 1; i >= 0; i--) { if (imgs[i]['#text'] && imgs[i]['#text'].length > 10) { imgUrl = imgs[i]['#text']; break; } }
  }

  const startSec = Math.floor(trackStartTime / 1000);
  const endSec = (trackDuration > 0) ? startSec + Math.floor(trackDuration) : null;

  const activity = {
    details: title, state: '— ' + artist,
    ...(paused ? {} : { timestamps: { start: startSec, ...(endSec && { end: endSec }) } }),
    assets: {
      large_image: imgUrl || 'mp', large_text: album || title,
      small_image: 'aura_icon', small_text: 'AURA Music Player'
    },
    buttons: [
      { label: '🎵 Paroles AURA', url: location.href.split('#')[0] + '#lyrics' },
      { label: '♫ Ouvrir AURA', url: location.href.split('#')[0] }
    ]
  };

  if (discordConnected) discordSend({ cmd: 'SET_ACTIVITY', nonce: discordNextNonce(), args: { pid: 99999, activity } });
  if (S.discordPreviewCard) updateDiscordPreviewCard(track, paused);
}

function updateDiscordPreviewCard(track, paused) {
  stopDiscordPreviewInterval();
  cancelAnimationFrame(discordPreviewRAF);

  // Update header dot
  $.drpcHeaderDot.classList.remove('paused', 'live');

  if (!track) {
    $.drpcTitle.textContent = '—'; $.drpcArtist.textContent = '—'; $.drpcAlbum.textContent = '';
    $.drpcArt.src = ''; $.drpcArt.style.opacity = '0'; $.drpcArtFb.style.opacity = '0';
    $.drpcProgressFill.style.width = '0%'; $.drpcElapsed.textContent = '0:00'; $.drpcTotal.textContent = '—:——';
    $.drpcPlayingLabel.textContent = '🎵 EN ÉCOUTE';
    $.drpcPauseBadge.classList.add('hidden');
    $.drpcHeaderStatusText.textContent = discordConnected ? 'Connecté' : 'Aperçu';
    $.drpcPlaystate.classList.remove('paused');
    $.drpcPlaystateIcon.textContent = '▶';
    $.drpcPlaystateText.textContent = 'Aucune musique';
    if ($.drpcExtraRow) $.drpcExtraRow.style.display = 'none';
    return;
  }

  const artist = track.artist?.name || track.artist?.['#text'] || '';
  const title = track.name || '';
  const album = track.album?.['#text'] || '';
  let imgUrl = track.albumArtUrl || '';
  if (!imgUrl) {
    const imgs = track.image || [];
    for (let i = imgs.length - 1; i >= 0; i--) { if (imgs[i]['#text'] && imgs[i]['#text'].length > 10) { imgUrl = imgs[i]['#text']; break; } }
  }

  $.drpcTitle.textContent = title;
  $.drpcArtist.textContent = artist;
  $.drpcAlbum.textContent = album;

  if (imgUrl) {
    $.drpcArt.src = imgUrl; $.drpcArt.style.opacity = '1'; $.drpcArtFb.style.opacity = '0';
  } else {
    $.drpcArt.style.opacity = '0';
    $.drpcArtFb.style.background = fallbackGradient(artist);
    $.drpcArtFb.textContent = fallbackLetter(title);
    $.drpcArtFb.style.opacity = '1';
  }

  // Pause/Play state
  $.drpcPauseBadge.classList.toggle('hidden', !paused);
  $.drpcPlayingLabel.textContent = paused ? '⏸ EN PAUSE' : '🎵 EN ÉCOUTE';
  $.drpcHeaderDot.classList.toggle('paused', paused);
  if (!paused) $.drpcHeaderDot.classList.add('live');
  $.drpcHeaderStatusText.textContent = discordConnected ? 'Connecté' : 'Aperçu';

  // Playstate widget
  $.drpcPlaystate.classList.toggle('paused', paused);
  $.drpcPlaystateIcon.textContent = paused ? '⏸' : '▶';
  $.drpcPlaystateText.textContent = paused ? 'En pause' : 'En lecture';

  if (trackDuration > 0) $.drpcTotal.textContent = fmtTime(trackDuration);

  // Show extra info row (source)
  if ($.drpcExtraRow) {
    $.drpcExtraRow.style.display = 'flex';
    if ($.drpcPlatformText) $.drpcPlatformText.textContent = track._fromLanyard ? 'Spotify' : 'Last.fm';
    if ($.drpcSourceText) $.drpcSourceText.textContent = track._fromLanyard ? 'Lanyard' : 'API';
  }

  // Start real-time tick (RAF for smooth progress + 2s interval for state)
  if (!paused) {
    tickDiscordPreview();
    startDiscordPreviewInterval();
  } else {
    // Show frozen elapsed time
    const elapsed = getElapsedMs() / 1000;
    $.drpcElapsed.textContent = fmtTime(elapsed);
    const pct = trackDuration > 0 ? Math.min((elapsed / trackDuration) * 100, 100) : 0;
    $.drpcProgressFill.style.width = pct + '%';
  }
}

function tickDiscordPreview() {
  if (isPaused) return;
  if (!trackDuration || trackStartTime === 0) return;
  const elapsed = getElapsedMs() / 1000;
  const pct = Math.min((elapsed / trackDuration) * 100, 100);
  $.drpcElapsed.textContent = fmtTime(elapsed);
  $.drpcProgressFill.style.width = pct + '%';
  if (pct < 100 && discordPreviewOpen) {
    discordPreviewRAF = requestAnimationFrame(tickDiscordPreview);
  }
}

function openDiscordPreviewPanel() {
  discordPreviewOpen = true;
  $.discordPreviewPanel.classList.add('on');
  $.btnDiscordPreview.classList.add('active');
  S.discordPreviewOpen = true;
  if (currentTrack) {
    updateDiscordPreviewCard(currentTrack, isPaused);
  }
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
  $.setDiscordClientId.value = S.discordClientId || '';
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

/* ── Discord event listeners ── */
$.btnDiscordPreview.addEventListener('click', () => {
  if (discordPreviewOpen) closeDiscordPreviewPanel();
  else openDiscordPreviewPanel();
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
    if (S.discordClientId) discordConnect();
    else setDiscordUIStatus('preview');
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
