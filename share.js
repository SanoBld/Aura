/* ============================================================
   AURA — share.js  v2.0
   ─────────────────────────────────────────────────────────────
   1. PARTAGE (URL + JSON)
   2. TÉLÉCOMMANDE complète (PeerJS/WebRTC)
      · Mode TV  : code 4 chiffres, écoute les messages
      · Mode Remote : TOUTES les options de S dans des sections
        accordéon scrollables, connexion auto via ?code=XXXX
   3. BOUTON "Use as Remote" sur l'écran de connexion
   ============================================================ */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════
     0. DÉTECTION MODE
  ══════════════════════════════════════════════════════════ */
  const _params = new URLSearchParams(location.search);
  const IS_REMOTE = _params.get('remote') === 'true';

  if (IS_REMOTE) {
    document.documentElement.dataset.auraMode = 'remote';
    const s = document.createElement('style');
    s.textContent = `
      [data-aura-mode="remote"] #s-login,
      [data-aura-mode="remote"] #s-player,
      [data-aura-mode="remote"] #loading,
      [data-aura-mode="remote"] #global-noise,
      [data-aura-mode="remote"] #orb-bg { display:none!important; }
      [data-aura-mode="remote"] html,
      [data-aura-mode="remote"] body {
        overflow:auto!important; height:auto!important;
        background:#080812!important; -webkit-overflow-scrolling:touch;
      }
    `;
    document.head.appendChild(s);
  }

  /* ══════════════════════════════════════════════════════════
     1. i18n PATCH
  ══════════════════════════════════════════════════════════ */
  const I18N = {
    en: {
      login_remote_link:       'Use as Remote Control →',
      share_section:           'Sharing',
      share_desc:              'Export your theme and settings as a shareable link or JSON file.',
      share_copy_link:         '🔗 Copy link',
      share_export_json:       '💾 Export JSON',
      share_import_json:       '📂 Import JSON',
      remote_section:          'Remote Control',
      remote_desc:             'Control this screen from your phone. Enable TV Mode, then open',
      remote_desc2:            'on your device.',
      remote_tv_mode:          'TV Mode',
      remote_tv_code:          'TV Code',
      remote_tv_waiting:       'Waiting for remote…',
      remote_tv_connected:     'Remote connected',
      remote_tv_reconnect:     'Reconnecting…',
      remote_tv_off:           'Disabled',
      remote_tv_error:         'Error',
      remote_tv_hint:          'Open ?remote=true on your phone and enter this code.',
      remote_copy_url:         '🔗 Copy Remote URL',
      rem_subtitle:            'Remote Control',
      rem_code_label:          'TV Code',
      rem_code_ph:             '0000',
      rem_connect:             'Connect',
      rem_disconnect:          'Disconnect',
      rem_idle:                'Enter the code shown on your TV',
      rem_s_connection:        '📡 Connection',
      rem_s_accent:            '🎨 Accent Color',
      rem_s_background:        '🖼 Background',
      rem_s_artwork:           '🎵 Artwork',
      rem_s_display:           '📐 Display',
      rem_s_effects:           '✨ Effects',
      rem_s_typography:        '🔤 Typography',
      rem_s_lyrics:            '🎤 Lyrics',
      rem_s_title:             '🎬 Title Style',
      rem_bg_album:            'Album',
      rem_bg_dark:             'Dark',
      rem_bg_color:            'Color',
      rem_bg_gradient:         'Gradient',
      rem_art_square:          'Square',
      rem_art_soft:            'Soft',
      rem_art_round:           'Round',
      rem_art_circle:          'Circle',
      rem_layout_full:         'Full',
      rem_layout_minimal:      'Minimal',
      rem_align_left:          '← Left',
      rem_align_center:        'Center',
      rem_align_right:         'Right →',
      rem_font_default:        'Default',
      rem_font_modern:         'Modern',
      rem_font_serif:          'Serif',
      rem_font_mono:           'Mono',
      rem_anim_none:           'None',
      rem_anim_blobs:          'Blobs',
      rem_anim_subtle:         'Subtle',
      rem_anim_energy:         'Energy',
      rem_anim_float:          'Float',
      rem_lyr_side:            'Side',
      rem_lyr_center:          'Center',
      rem_lyr_bottom:          'Bottom',
      rem_lyr_font_serif:      'Serif',
      rem_lyr_font_sans:       'Sans',
      rem_lyr_font_mono:       'Mono',
      rem_lyr_font_display:    'Display',
      rem_lyr_anim_fade:       'Fade',
      rem_lyr_anim_slide:      'Slide',
      rem_lyr_anim_scale:      'Scale',
      rem_lyr_anim_blur:       'Blur',
      rem_lyr_anim_bounce:     'Bounce',
      rem_lyr_panel_subtle:    'Subtle',
      rem_lyr_panel_apple:     '🍎 Colorful',
      rem_title_fu:            'Fade Up',
      rem_title_sl:            'Slide',
      rem_title_sc:            'Scale',
      rem_title_bl:            'Blur',
      rem_title_sp:            'Split',
      rem_title_no:            'None',
    },
    fr: {
      login_remote_link:       'Utiliser comme télécommande →',
      share_section:           'Partage',
      share_desc:              'Exportez vos réglages sous forme de lien ou de fichier JSON.',
      share_copy_link:         '🔗 Copier le lien',
      share_export_json:       '💾 Exporter JSON',
      share_import_json:       '📂 Importer JSON',
      remote_section:          'Télécommande',
      remote_desc:             'Pilotez cet écran depuis votre téléphone. Activez le Mode TV, puis ouvrez',
      remote_desc2:            'sur votre appareil.',
      remote_tv_mode:          'Mode TV',
      remote_tv_code:          'Code TV',
      remote_tv_waiting:       'En attente d\'une télécommande…',
      remote_tv_connected:     'Télécommande connectée',
      remote_tv_reconnect:     'Reconnexion…',
      remote_tv_off:           'Désactivé',
      remote_tv_error:         'Erreur',
      remote_tv_hint:          'Ouvrez ?remote=true sur votre téléphone et entrez ce code.',
      remote_copy_url:         '🔗 Copier l\'URL distante',
      rem_subtitle:            'Télécommande',
      rem_code_label:          'Code TV',
      rem_code_ph:             '0000',
      rem_connect:             'Connecter',
      rem_disconnect:          'Déconnecter',
      rem_idle:                'Entrez le code affiché sur votre TV',
      rem_s_connection:        '📡 Connexion',
      rem_s_accent:            '🎨 Couleur d\'accent',
      rem_s_background:        '🖼 Arrière-plan',
      rem_s_artwork:           '🎵 Pochette',
      rem_s_display:           '📐 Affichage',
      rem_s_effects:           '✨ Effets',
      rem_s_typography:        '🔤 Typographie',
      rem_s_lyrics:            '🎤 Paroles',
      rem_s_title:             '🎬 Style du titre',
      rem_bg_album:            'Pochette',
      rem_bg_dark:             'Sombre',
      rem_bg_color:            'Couleur',
      rem_bg_gradient:         'Dégradé',
      rem_art_square:          'Carré',
      rem_art_soft:            'Arrondi',
      rem_art_round:           'Rond',
      rem_art_circle:          'Cercle',
      rem_layout_full:         'Complet',
      rem_layout_minimal:      'Minimal',
      rem_align_left:          '← Gauche',
      rem_align_center:        'Centre',
      rem_align_right:         'Droite →',
      rem_font_default:        'Défaut',
      rem_font_modern:         'Moderne',
      rem_font_serif:          'Serif',
      rem_font_mono:           'Mono',
      rem_anim_none:           'Aucune',
      rem_anim_blobs:          'Blobs',
      rem_anim_subtle:         'Subtile',
      rem_anim_energy:         'Énergique',
      rem_anim_float:          'Flottante',
      rem_lyr_side:            'Côté',
      rem_lyr_center:          'Centre',
      rem_lyr_bottom:          'Bas',
      rem_lyr_font_serif:      'Serif',
      rem_lyr_font_sans:       'Sans',
      rem_lyr_font_mono:       'Mono',
      rem_lyr_font_display:    'Display',
      rem_lyr_anim_fade:       'Fondu',
      rem_lyr_anim_slide:      'Glissé',
      rem_lyr_anim_scale:      'Échelle',
      rem_lyr_anim_blur:       'Flou',
      rem_lyr_anim_bounce:     'Rebond',
      rem_lyr_panel_subtle:    'Subtil',
      rem_lyr_panel_apple:     '🍎 Coloré',
      rem_title_fu:            'Fade haut',
      rem_title_sl:            'Glissé',
      rem_title_sc:            'Échelle',
      rem_title_bl:            'Flou',
      rem_title_sp:            'Séparé',
      rem_title_no:            'Aucun',
    },
  };

  function patchI18n() {
    if (!window.AURA_LANGS) return;
    for (const lang of Object.keys(I18N)) {
      if (window.AURA_LANGS[lang]) Object.assign(window.AURA_LANGS[lang], I18N[lang]);
    }
  }
  patchI18n();

  function t(key, fb) {
    if (window.t && typeof window.t === 'function') {
      const v = window.t(key);
      if (v && v !== key) return v;
    }
    const lang = window.getLang ? window.getLang() : 'en';
    return I18N[lang]?.[key] ?? I18N.en?.[key] ?? fb ?? key;
  }

  /* ══════════════════════════════════════════════════════════
     2. TOAST
  ══════════════════════════════════════════════════════════ */
  function showToast(msg, ms = 2800) {
    let el = document.getElementById('aura-toast');
    if (!el) {
      el = Object.assign(document.createElement('div'), { id: 'aura-toast' });
      Object.assign(el.style, {
        position: 'fixed', bottom: '2rem', left: '50%',
        transform: 'translateX(-50%) translateY(8px)',
        background: 'rgba(10,10,18,0.97)', color: '#fff',
        padding: '0.65rem 1.3rem', borderRadius: '2rem',
        fontSize: '0.83rem', fontFamily: 'inherit', zIndex: '99999',
        pointerEvents: 'none', border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(20px)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        opacity: '0', whiteSpace: 'nowrap',
      });
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(el._t);
    el._t = setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(-50%) translateY(8px)';
    }, ms);
  }

  /* ══════════════════════════════════════════════════════════
     3. SHARE — URL + JSON
  ══════════════════════════════════════════════════════════ */
  const SKIP = new Set(['lanyardId']);
  function getS() { try { return typeof S !== 'undefined' ? S : null; } catch { return null; } }

  function exportConfigToURL() {
    const cfg = getS();
    if (!cfg) return '';
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(cfg)) {
      if (!SKIP.has(k)) p.set(k, String(v));
    }
    return `${location.origin}${location.pathname}?${p}`;
  }

  function copyShareURL() {
    const url = exportConfigToURL();
    if (!url) return;
    const fb = () => {
      const ta = document.createElement('textarea');
      Object.assign(ta, { value: url });
      Object.assign(ta.style, { position: 'fixed', opacity: '0' });
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); showToast('🔗 ' + t('share_copy_link', 'Link copied!')); } catch {}
      document.body.removeChild(ta);
    };
    navigator.clipboard
      ? navigator.clipboard.writeText(url).then(() => showToast('🔗 ' + t('share_copy_link', 'Link copied!'))).catch(fb)
      : fb();
  }

  function importConfigFromURL() {
    if (IS_REMOTE) return false;
    const p = new URLSearchParams(location.search);
    if (!p.size) return false;
    const cfg = getS();
    if (!cfg) return false;
    let n = 0;
    for (const k of Object.keys(cfg)) {
      if (SKIP.has(k) || !p.has(k)) continue;
      const raw = p.get(k), type = typeof cfg[k];
      try {
        cfg[k] = type === 'boolean' ? raw === 'true' : type === 'number' ? parseFloat(raw) : raw;
        n++;
      } catch {}
    }
    if (!n) return false;
    try { if (typeof saveSettings === 'function') saveSettings(); } catch {}
    history.replaceState({}, '', location.pathname);
    return true;
  }

  function exportConfigToJSON() {
    const cfg = getS();
    if (!cfg) { showToast('❌ Not ready'); return; }
    const out = {};
    for (const [k, v] of Object.entries(cfg)) { if (!SKIP.has(k)) out[k] = v; }
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })),
      download: 'aura_config.json',
    });
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('💾 aura_config.json exported!');
  }

  function importConfigFromJSON(file) {
    if (!file) return;
    const r = new FileReader();
    r.onload = e => {
      try {
        const parsed = JSON.parse(e.target.result);
        const cfg = getS();
        if (!cfg) { showToast('❌ Not ready'); return; }
        let n = 0;
        for (const k in parsed) {
          if (!Object.prototype.hasOwnProperty.call(cfg, k) || SKIP.has(k)) continue;
          if (typeof parsed[k] !== typeof cfg[k]) continue;
          cfg[k] = parsed[k]; n++;
        }
        try { if (typeof saveSettings  === 'function') saveSettings(); }  catch {}
        try { if (typeof applySettings === 'function') applySettings(); } catch {}
        showToast(`✅ ${n} settings imported!`);
      } catch { showToast('❌ Invalid JSON'); }
    };
    r.onerror = () => showToast('❌ Read error');
    r.readAsText(file);
  }

  /* ══════════════════════════════════════════════════════════
     4. PEERJS — lazy load
  ══════════════════════════════════════════════════════════ */
  const PEER_CDN = 'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js';
  const PEER_NS  = 'aura-tv-';
  const PEER_CFG = { host: '0.peerjs.com', port: 443, secure: true };
  let _peerLoading = false, _peerCBs = [];

  function loadPeer(cb) {
    if (window.Peer) { cb(); return; }
    _peerCBs.push(cb);
    if (_peerLoading) return;
    _peerLoading = true;
    const s = Object.assign(document.createElement('script'), { src: PEER_CDN });
    s.onload  = () => { _peerCBs.forEach(f => f()); _peerCBs = []; };
    s.onerror = () => { showToast('❌ PeerJS failed — check network'); _peerLoading = false; _peerCBs = []; };
    document.head.appendChild(s);
  }

  /* ══════════════════════════════════════════════════════════
     5. PEER STATE
  ══════════════════════════════════════════════════════════ */
  let peer = null, peerConn = null, tvCode = null;
  let isTVMode = false, isRemMode = false;

  const genCode = () => String(Math.floor(1000 + Math.random() * 9000));
  const fmtCode = c => c ? c.replace(/(\d{2})(\d{2})/, '$1 $2') : '—';

  /* ══════════════════════════════════════════════════════════
     6. TV MODE (Récepteur)
  ══════════════════════════════════════════════════════════ */
  function initTVMode() {
    if (peer) { try { peer.destroy(); } catch {} peer = null; }
    peerConn = null;
    tvCode = genCode();
    _tvCode(tvCode);
    _tvStatus('connecting');

    loadPeer(() => {
      try {
        peer = new Peer(PEER_NS + tvCode, PEER_CFG);

        peer.on('open', () => { isTVMode = true; _tvStatus('ready'); });

        peer.on('connection', conn => {
          if (peerConn?.open) { conn.close(); return; }
          peerConn = conn;
          _tvStatus('connected');
          conn.on('data',  d   => { try { _handleTV(d); } catch {} });
          conn.on('close', ()  => { peerConn = null; _tvStatus('ready'); });
          conn.on('error', err => { peerConn = null; _tvStatus('error', err.type); });
        });

        peer.on('error', err => {
          if (err.type === 'unavailable-id') {
            tvCode = genCode(); _tvCode(tvCode);
            setTimeout(() => isTVMode && initTVMode(), 400);
            return;
          }
          _tvStatus('error', err.type);
          setTimeout(() => { if (isTVMode) initTVMode(); }, 4000);
        });

        peer.on('disconnected', () => {
          if (!isTVMode) return;
          _tvStatus('reconnecting');
          try { peer.reconnect(); } catch {}
        });
      } catch (e) { _tvStatus('error', e.message); }
    });
  }

  function stopTVMode() {
    isTVMode = false;
    if (peerConn) { try { peerConn.close(); } catch {} peerConn = null; }
    if (peer)     { try { peer.destroy(); }   catch {} peer     = null; }
    tvCode = null;
    _tvCode(null);
    _tvStatus('off');
  }

  function _handleTV(data) {
    if (!data || typeof data !== 'object') return;
    if (data.type === 'UPDATE_CONFIG') {
      const cfg = getS();
      if (!cfg || !data.data) return;
      for (const k in data.data) {
        if (!Object.prototype.hasOwnProperty.call(cfg, k)) continue;
        if (typeof data.data[k] !== typeof cfg[k]) continue;
        cfg[k] = data.data[k];
      }
      try { if (typeof saveSettings  === 'function') saveSettings(); }  catch {}
      try { if (typeof applySettings === 'function') applySettings(); } catch {}
    } else if (data.type === 'PING') {
      if (peerConn?.open) peerConn.send({ type: 'PONG' });
    } else if (data.type === 'GET_CONFIG') {
      const cfg = getS();
      if (peerConn?.open && cfg) {
        const safe = {};
        for (const [k, v] of Object.entries(cfg)) { if (!SKIP.has(k)) safe[k] = v; }
        peerConn.send({ type: 'CONFIG_SNAPSHOT', data: safe });
      }
    }
  }

  function _tvCode(code) {
    const el = document.getElementById('aura-tv-code');
    if (el) el.textContent = fmtCode(code);
  }

  function _tvStatus(status, extra) {
    const dot  = document.getElementById('aura-tv-dot');
    const text = document.getElementById('aura-tv-status-text');
    if (!dot || !text) return;
    const MAP = {
      off:          ['rgba(255,255,255,0.18)', t('remote_tv_off',       'Disabled')],
      connecting:   ['#f5a623',               t('remote_tv_reconnect', 'Connecting…')],
      ready:        ['#4ade80',               t('remote_tv_waiting',   'Waiting for remote…')],
      connected:    ['#22d3ee',               t('remote_tv_connected', 'Remote connected')],
      reconnecting: ['#f5a623',               t('remote_tv_reconnect', 'Reconnecting…')],
      error:        ['#f87171',               t('remote_tv_error',     'Error') + (extra ? ': ' + extra : '')],
    };
    const [color, label] = MAP[status] || MAP.off;
    dot.style.background = color;
    dot.style.boxShadow  = ['ready', 'connected', 'connecting', 'reconnecting'].includes(status) ? `0 0 6px ${color}` : 'none';
    text.textContent = label;
  }

  /* ══════════════════════════════════════════════════════════
     7. REMOTE MODE (Émetteur)
  ══════════════════════════════════════════════════════════ */
  function initRemote(code) {
    code = (code || '').replace(/\s/g, '');
    if (!/^\d{4}$/.test(code)) { _remStatus('error', t('rem_idle', 'Enter a 4-digit code')); return; }
    if (peer) { try { peer.destroy(); } catch {} peer = null; }
    peerConn = null;
    isRemMode = false;
    _remStatus('connecting', t('remote_tv_reconnect', 'Connecting…'));
    _remEnable(false);

    loadPeer(() => {
      try {
        const remId = PEER_NS + 'r-' + Math.random().toString(36).slice(2, 10);
        peer = new Peer(remId, PEER_CFG);

        peer.on('open', () => {
          const conn = peer.connect(PEER_NS + code, { reliable: true, serialization: 'json' });
          peerConn = conn;

          conn.on('open', () => {
            isRemMode = true;
            _remStatus('connected', `TV ${code} ✓`);
            _remEnable(true);
            conn.send({ type: 'GET_CONFIG' });
            const bc = document.getElementById('rem-btn-connect');
            const bd = document.getElementById('rem-btn-disconnect');
            if (bc) bc.style.display = 'none';
            if (bd) bd.style.display = '';
          });

          conn.on('data', d => {
            if (d?.type === 'CONFIG_SNAPSHOT' && d.data) _syncUI(d.data);
          });
          conn.on('close', () => {
            isRemMode = false;
            _remStatus('off', t('rem_idle', ''));
            _remEnable(false);
            _resetConnBtns();
          });
          conn.on('error', () => {
            isRemMode = false;
            _remStatus('error', 'Connection failed');
            _remEnable(false);
            _resetConnBtns();
          });
        });

        peer.on('error', err => {
          _remStatus('error', err.type === 'peer-unavailable' ? `TV ${code} not found` : (err.type || err.message));
          _resetConnBtns();
        });
      } catch (e) { _remStatus('error', e.message); _resetConnBtns(); }
    });
  }

  function disconnectRemote() {
    isRemMode = false;
    if (peerConn) { try { peerConn.close(); } catch {} peerConn = null; }
    if (peer)     { try { peer.destroy(); }   catch {} peer     = null; }
    _remStatus('off', t('rem_idle', 'Enter the code shown on your TV'));
    _remEnable(false);
    _resetConnBtns();
  }

  function sendUpdate(data) {
    if (!isRemMode || !peerConn?.open) return;
    try { peerConn.send({ type: 'UPDATE_CONFIG', data }); } catch {}
  }

  function _resetConnBtns() {
    const bc = document.getElementById('rem-btn-connect');
    const bd = document.getElementById('rem-btn-disconnect');
    if (bc) bc.style.display = '';
    if (bd) bd.style.display = 'none';
  }

  function _remStatus(status, msg) {
    const dot  = document.getElementById('rem-status-dot');
    const text = document.getElementById('rem-status-text');
    if (!dot) return;
    const C = { off: 'rgba(255,255,255,0.2)', connecting: '#f5a623', connected: '#4ade80', error: '#f87171' };
    const c = C[status] || C.off;
    dot.style.background = c;
    dot.style.boxShadow  = status === 'connected' ? `0 0 7px ${c}` : 'none';
    if (text && msg !== undefined) text.textContent = msg;
  }

  function _remEnable(on) {
    document.querySelectorAll('.rem-section:not(.rem-section-connection)').forEach(sec => {
      sec.style.opacity       = on ? '1' : '0.3';
      sec.style.pointerEvents = on ? ''  : 'none';
    });
  }

  /* Sync remote UI to CONFIG_SNAPSHOT from TV */
  function _syncUI(cfg) {
    /* Accent swatches */
    document.querySelectorAll('.rem-swatch').forEach(b =>
      b.classList.toggle('active', b.dataset.remAccent === cfg.accentColor));
    /* Pill groups — [data-rem-key + data-rem-val] */
    document.querySelectorAll('[data-rem-key][data-rem-val]').forEach(b =>
      b.classList.toggle('active', String(cfg[b.dataset.remKey]) === b.dataset.remVal));
    /* Bool toggles — [data-rem-bool] */
    document.querySelectorAll('[data-rem-bool]').forEach(b =>
      b.classList.toggle('active', !!cfg[b.dataset.remBool]));
    /* Sliders — [data-rem-slider] */
    document.querySelectorAll('input[data-rem-slider]').forEach(sl => {
      const k = sl.dataset.remSlider;
      if (cfg[k] != null) {
        sl.value = cfg[k];
        _updateFill(sl);
        const vEl = document.getElementById(`rem-val-${k}`);
        if (vEl) vEl.textContent = _fmt(k, cfg[k]);
      }
    });
    /* Color pickers — [data-rem-color] */
    document.querySelectorAll('input[type=color][data-rem-color]').forEach(cp => {
      if (cfg[cp.dataset.remColor]) cp.value = cfg[cp.dataset.remColor];
    });
  }

  /* ══════════════════════════════════════════════════════════
     8. CSS
  ══════════════════════════════════════════════════════════ */
  function injectCSS() {
    if (document.getElementById('aura-share-css')) return;
    const s = document.createElement('style');
    s.id = 'aura-share-css';
    s.textContent = `

/* ─── Settings panel additions ──────────────────── */
.aura-share-btns { display:flex; flex-direction:column; gap:.375rem; margin-top:.75rem; }
.aura-share-btns .btn-test-mode { text-align:center; }
.aura-share-btns label.btn-test-mode { display:block; cursor:pointer; }

.aura-tv-code-row { display:flex; align-items:center; gap:.75rem; margin:.875rem 0 .375rem; }
.aura-tv-code-lbl { font-size:.68rem; text-transform:uppercase; letter-spacing:.08em; opacity:.4; }
#aura-tv-code {
  font-family:'JetBrains Mono',monospace; font-size:1.65rem;
  letter-spacing:.32em; color:var(--accent,#e0245e); font-weight:700;
}
.aura-tv-hint { font-size:.73rem; opacity:.38; line-height:1.55; margin-top:.4rem; }

/* ─── Login remote link ─────────────────────────── */
.l-remote-link {
  display:block; text-align:center; margin-top:1.25rem;
  font-size:.775rem; color:rgba(255,255,255,.28);
  text-decoration:none; letter-spacing:.02em;
  transition:color .2s;
}
.l-remote-link:hover { color:rgba(255,255,255,.65); }

/* ─── Remote page ───────────────────────────────── */
#rem-app {
  min-height:100dvh; background:#080812; color:#fff;
  font-family:'Instrument Sans',system-ui,sans-serif;
  max-width:480px; margin:0 auto; padding-bottom:5rem;
  box-sizing:border-box;
}

.rem-header {
  text-align:center; padding:1.75rem 1rem 1.25rem;
  position:sticky; top:0; z-index:10;
  background:rgba(8,8,18,.93); backdrop-filter:blur(24px);
  -webkit-backdrop-filter:blur(24px);
  border-bottom:1px solid rgba(255,255,255,.06);
}
.rem-wordmark {
  font-family:'Bebas Neue',sans-serif; font-size:2.4rem;
  letter-spacing:.18em; color:var(--accent,#e0245e); line-height:1;
}
.rem-subtitle {
  font-size:.66rem; text-transform:uppercase; letter-spacing:.14em;
  opacity:.28; margin-top:.2rem;
}

/* ─── Accordion sections ────────────────────────── */
.rem-section { border-bottom:1px solid rgba(255,255,255,.05); }

.rem-section-head {
  display:flex; align-items:center; justify-content:space-between;
  padding:.95rem 1.1rem; cursor:pointer; user-select:none;
  font-size:.82rem; font-weight:600; letter-spacing:.01em;
  -webkit-tap-highlight-color:transparent;
  transition:background .15s;
}
.rem-section-head:active { background:rgba(255,255,255,.04); }
.rem-chevron {
  font-size:1rem; opacity:.3; line-height:1;
  transition:transform .25s cubic-bezier(0.23,1,0.32,1);
  display:inline-block;
}
.rem-section.open .rem-chevron { transform:rotate(90deg); }

.rem-section-body {
  display:none; padding:.1rem 1.1rem 1.1rem;
  flex-direction:column; gap:.75rem;
}
.rem-section.open .rem-section-body { display:flex; }
/* Connection always open */
.rem-section-connection .rem-section-body  { display:flex; }
.rem-section-connection .rem-section-head  { cursor:default; }
.rem-section-connection .rem-chevron       { display:none; }

/* ─── Status row ────────────────────────────────── */
.rem-status-row {
  display:flex; align-items:center; gap:.5rem;
  font-size:.75rem; opacity:.6; margin-top:.6rem;
}
.rem-status-dot {
  width:7px; height:7px; border-radius:50%;
  background:rgba(255,255,255,.2); flex-shrink:0;
  transition:background .3s, box-shadow .3s;
}

/* ─── Code input ────────────────────────────────── */
.rem-code-input {
  width:100%; box-sizing:border-box;
  background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.12);
  border-radius:.75rem; color:#fff; font-size:2rem;
  letter-spacing:.6em; text-align:center; padding:.65rem 1rem;
  font-family:'JetBrains Mono',monospace;
  outline:none; transition:border-color .2s; -webkit-appearance:none;
}
.rem-code-input:focus { border-color:var(--accent,#e0245e); }
.rem-code-input::placeholder { letter-spacing:.3em; opacity:.2; }

/* ─── Action buttons ────────────────────────────── */
.rem-row { display:flex; gap:.45rem; margin-top:.65rem; }
.rem-btn {
  flex:1; padding:.7rem .875rem; border:none; border-radius:.7rem;
  font-size:.83rem; font-family:inherit; font-weight:600;
  cursor:pointer; transition:opacity .15s, transform .1s;
  -webkit-tap-highlight-color:transparent;
}
.rem-btn:active { transform:scale(.95); opacity:.8; }
.rem-btn-primary   { background:var(--accent,#e0245e); color:#fff; }
.rem-btn-secondary { background:rgba(255,255,255,.09); border:1px solid rgba(255,255,255,.1); color:#fff; }

/* ─── Sub-label ─────────────────────────────────── */
.rem-lbl {
  font-size:.66rem; text-transform:uppercase; letter-spacing:.09em;
  opacity:.35; margin-bottom:-.2rem;
}

/* ─── Swatches ──────────────────────────────────── */
.rem-swatches { display:flex; flex-wrap:wrap; gap:.45rem; }
.rem-swatch {
  width:2rem; height:2rem; border-radius:50%;
  border:2px solid transparent; cursor:pointer;
  transition:transform .15s, border-color .15s, box-shadow .15s;
  -webkit-tap-highlight-color:transparent; flex-shrink:0;
}
.rem-swatch:active { transform:scale(.88); }
.rem-swatch.active { border-color:#fff; transform:scale(1.15); box-shadow:0 0 10px var(--sw-c,#fff); }

/* ─── Pills ─────────────────────────────────────── */
.rem-pills { display:flex; flex-wrap:wrap; gap:.35rem; }
.rem-pill {
  padding:.44rem .82rem;
  background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.1);
  border-radius:2rem; color:rgba(255,255,255,.5);
  font-size:.77rem; font-family:inherit; cursor:pointer;
  transition:all .15s; -webkit-tap-highlight-color:transparent;
  white-space:nowrap;
}
.rem-pill:active { transform:scale(.95); }
.rem-pill.active  { background:var(--accent,#e0245e); border-color:var(--accent,#e0245e); color:#fff; }

/* ─── Boolean toggles ───────────────────────────── */
.rem-toggles { display:grid; grid-template-columns:repeat(3,1fr); gap:.35rem; }
.rem-toggle {
  padding:.58rem .4rem; background:rgba(255,255,255,.06);
  border:1px solid rgba(255,255,255,.09); border-radius:.6rem;
  color:rgba(255,255,255,.38); font-size:.74rem; font-family:inherit;
  font-weight:500; cursor:pointer; line-height:1.25;
  transition:all .15s; -webkit-tap-highlight-color:transparent;
  text-align:center;
}
.rem-toggle:active { transform:scale(.93); }
.rem-toggle.active {
  background:rgba(var(--accent-rgb,224,36,94),.18);
  border-color:var(--accent,#e0245e); color:#fff;
}

/* ─── Sliders ───────────────────────────────────── */
.rem-slider-wrap { display:flex; flex-direction:column; gap:.3rem; }
.rem-slider-head { display:flex; justify-content:space-between; align-items:baseline; }
.rem-slider-title { font-size:.75rem; opacity:.55; }
.rem-slider-val   { font-family:'JetBrains Mono',monospace; font-size:.72rem; opacity:.42; }
input.rem-slider {
  width:100%; -webkit-appearance:none; appearance:none;
  height:4px; border-radius:2px; cursor:pointer; outline:none;
  background:linear-gradient(to right,
    var(--accent,#e0245e) 0%,
    var(--accent,#e0245e) var(--pct,50%),
    rgba(255,255,255,.12) var(--pct,50%));
}
input.rem-slider::-webkit-slider-thumb {
  -webkit-appearance:none; width:18px; height:18px;
  border-radius:50%; background:#fff;
  box-shadow:0 2px 8px rgba(0,0,0,.5); cursor:pointer;
}
input.rem-slider::-moz-range-thumb {
  width:18px; height:18px; border-radius:50%;
  background:#fff; border:none; box-shadow:0 2px 8px rgba(0,0,0,.5);
}

/* ─── Color pickers ─────────────────────────────── */
.rem-color-row { display:flex; gap:.7rem; flex-wrap:wrap; }
.rem-color-item { display:flex; align-items:center; gap:.45rem; font-size:.76rem; opacity:.55; }
.rem-color-item input[type=color] {
  width:2rem; height:2rem; border-radius:.4rem;
  border:1px solid rgba(255,255,255,.15); background:none;
  cursor:pointer; padding:.12rem; outline:none; flex-shrink:0;
}
    `;
    document.head.appendChild(s);
  }

  /* ══════════════════════════════════════════════════════════
     9. REMOTE PAGE BUILDER — ALL settings
  ══════════════════════════════════════════════════════════ */

  function _updateFill(sl) {
    if (!sl) return;
    const pct = ((sl.value - sl.min) / (sl.max - sl.min)) * 100;
    sl.style.setProperty('--pct', pct + '%');
  }

  function _fmt(key, val) {
    const v = parseFloat(val);
    if (key === 'blur')               return Math.round((v / 120) * 100) + '%';
    if (key === 'brightness')         return v + '%';
    if (key === 'heroScale')          return v + '%';
    if (key === 'lyricsSize')         return v + '%';
    if (key === 'lyricsBackdropBlur') return v + '%';
    if (key === 'lyricsShadowOpacity')return v + '%';
    if (key === 'lyricsOffset')       return (v >= 0 ? '+' : '') + v + 'ms';
    return v;
  }

  /* Build a labelled slider */
  function _slider(key, title, min, max, step) {
    step = step || 1;
    const wrap = document.createElement('div');
    wrap.className = 'rem-slider-wrap';
    const id = `rem-val-${key}`;
    wrap.innerHTML = `
      <div class="rem-slider-head">
        <span class="rem-slider-title">${title}</span>
        <span class="rem-slider-val" id="${id}">—</span>
      </div>
      <input type="range" class="rem-slider" data-rem-slider="${key}"
             min="${min}" max="${max}" step="${step}" aria-label="${title}"/>
    `;
    const sl = wrap.querySelector('input');
    const vl = wrap.querySelector(`#${id}`);
    sl.addEventListener('input', () => {
      const v = parseFloat(sl.value);
      _updateFill(sl);
      if (vl) vl.textContent = _fmt(key, v);
      sendUpdate({ [key]: v });
    });
    return wrap;
  }

  /* Build a pill group */
  function _pills(key, items) {
    const wrap = document.createElement('div');
    wrap.className = 'rem-pills';
    items.forEach(([val, label]) => {
      const btn = document.createElement('button');
      btn.className = 'rem-pill';
      btn.dataset.remKey = key;
      btn.dataset.remVal = String(val);
      btn.textContent = label;
      btn.addEventListener('click', () => {
        wrap.querySelectorAll('.rem-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        sendUpdate({ [key]: val });
      });
      wrap.appendChild(btn);
    });
    return wrap;
  }

  /* Build a bool toggle grid */
  function _toggles(items) {
    const grid = document.createElement('div');
    grid.className = 'rem-toggles';
    items.forEach(([key, label]) => {
      const btn = document.createElement('button');
      btn.className = 'rem-toggle';
      btn.dataset.remBool = key;
      btn.textContent = label;
      btn.addEventListener('click', () => {
        const next = !btn.classList.contains('active');
        btn.classList.toggle('active', next);
        sendUpdate({ [key]: next });
      });
      grid.appendChild(btn);
    });
    return grid;
  }

  /* Build color pickers row */
  function _colorRow(items) {
    const row = document.createElement('div');
    row.className = 'rem-color-row';
    items.forEach(([key, label]) => {
      const item = document.createElement('div');
      item.className = 'rem-color-item';
      const cp = document.createElement('input');
      cp.type = 'color';
      cp.dataset.remColor = key;
      cp.value = '#e0245e';
      cp.title = label;
      cp.addEventListener('input', () => sendUpdate({ [key]: cp.value }));
      item.appendChild(cp);
      item.appendChild(document.createTextNode(label));
      row.appendChild(item);
    });
    return row;
  }

  /* Small label */
  function _lbl(text) {
    const d = document.createElement('div');
    d.className = 'rem-lbl';
    d.textContent = text;
    return d;
  }

  /* Collapsible section */
  function _section(id, title, startOpen) {
    const sec = document.createElement('div');
    sec.className = `rem-section rem-section-${id}${startOpen ? ' open' : ''}`;
    sec.innerHTML = `
      <div class="rem-section-head">
        <span>${title}</span>
        <span class="rem-chevron">›</span>
      </div>
      <div class="rem-section-body"></div>
    `;
    const head = sec.querySelector('.rem-section-head');
    if (id !== 'connection') {
      head.addEventListener('click', () => sec.classList.toggle('open'));
    }
    return sec;
  }

  function _add(sec, ...nodes) {
    const body = sec.querySelector('.rem-section-body');
    nodes.forEach(n => { if (n) body.appendChild(n); });
  }

  /* Main builder */
  function buildRemotePage() {
    const ACCENTS = [
      '#e0245e', '#4facfe', '#a78bfa', '#34d399',
      '#fb923c', '#f472b6', '#facc15', '#60a5fa', '#f87171', '#ffffff',
    ];

    const app = document.createElement('div');
    app.id = 'rem-app';
    app.innerHTML = `
      <div class="rem-header">
        <div class="rem-wordmark">AURA</div>
        <div class="rem-subtitle">${t('rem_subtitle', 'Remote Control')}</div>
      </div>
    `;

    /* ── CONNECTION ── */
    const sCon = _section('connection', t('rem_s_connection', '📡 Connection'), true);
    const conBody = document.createElement('div');
    conBody.innerHTML = `
      <div class="rem-lbl">${t('rem_code_label', 'TV Code')}</div>
      <input id="rem-code-input" class="rem-code-input" type="text"
        maxlength="4" inputmode="numeric" pattern="[0-9]{4}"
        placeholder="${t('rem_code_ph', '0000')}" autocomplete="off"/>
      <div class="rem-row">
        <button id="rem-btn-connect"    class="rem-btn rem-btn-primary">${t('rem_connect', 'Connect')}</button>
        <button id="rem-btn-disconnect" class="rem-btn rem-btn-secondary" style="display:none">${t('rem_disconnect', 'Disconnect')}</button>
      </div>
      <div class="rem-status-row">
        <div class="rem-status-dot" id="rem-status-dot"></div>
        <span id="rem-status-text">${t('rem_idle', 'Enter the code shown on your TV')}</span>
      </div>
    `;
    _add(sCon, conBody);
    app.appendChild(sCon);

    /* ── ACCENT COLOR ── */
    const sAcc = _section('accent', t('rem_s_accent', '🎨 Accent Color'));
    const swatchGrid = document.createElement('div');
    swatchGrid.className = 'rem-swatches';
    ACCENTS.forEach(color => {
      const btn = document.createElement('button');
      btn.className = 'rem-swatch';
      btn.dataset.remAccent = color;
      btn.style.cssText = `background:${color};--sw-c:${color}`;
      btn.title = color;
      btn.addEventListener('click', () => {
        swatchGrid.querySelectorAll('.rem-swatch').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        sendUpdate({ accentColor: color });
      });
      swatchGrid.appendChild(btn);
    });
    _add(sAcc, swatchGrid);
    app.appendChild(sAcc);

    /* ── BACKGROUND ── */
    const sBg = _section('bg', t('rem_s_background', '🖼 Background'));
    _add(sBg,
      _lbl('Mode'),
      _pills('bgMode', [
        ['album',      t('rem_bg_album',    'Album')],
        ['dark',       t('rem_bg_dark',     'Dark')],
        ['color',      t('rem_bg_color',    'Color')],
        ['titlecolor', t('rem_bg_gradient', 'Gradient')],
      ]),
      _slider('blur',       '🔵 Blur',       0,   120),
      _slider('brightness', '💡 Brightness', 10,  90),
      _slider('saturate',   '🎨 Saturation', 0,   30),
    );
    app.appendChild(sBg);

    /* ── ARTWORK ── */
    const sArt = _section('art', t('rem_s_artwork', '🎵 Artwork'));
    _add(sArt,
      _lbl('Shape'),
      _pills('artShape', [
        ['0px',  t('rem_art_square', 'Square')],
        ['12px', t('rem_art_soft',   'Soft')],
        ['22px', t('rem_art_round',  'Round')],
        ['50%',  t('rem_art_circle', 'Circle')],
      ]),
      _lbl('Toggles'),
      _toggles([
        ['showArt',      '🖼 Art'],
        ['showGlow',     '✨ Glow'],
        ['animatedGlow', '💫 Pulse'],
        ['vinylMode',    '💿 Vinyl'],
        ['showAvatar',   '👤 Avatar'],
        ['showProgress', '⏱ Progress'],
      ]),
    );
    app.appendChild(sArt);

    /* ── DISPLAY ── */
    const sDisp = _section('display', t('rem_s_display', '📐 Display'));
    _add(sDisp,
      _slider('heroScale', 'Scale', 60, 140),
      _lbl('View'),
      _pills('heroLayout', [
        ['standard', t('rem_layout_full',    'Full')],
        ['minimal',  t('rem_layout_minimal', 'Minimal')],
      ]),
      _lbl('Position'),
      _pills('heroAlign', [
        ['left',   t('rem_align_left',   '← Left')],
        ['center', t('rem_align_center', 'Center')],
        ['right',  t('rem_align_right',  'Right →')],
      ]),
      _lbl('Options'),
      _toggles([
        ['showBg',      '🖼 BG'],
        ['showMarquee', '📜 Marquee'],
        ['showGrain',   '🌾 Grain'],
      ]),
    );
    app.appendChild(sDisp);

    /* ── EFFECTS ── */
    const sEff = _section('effects', t('rem_s_effects', '✨ Effects'));
    _add(sEff,
      _toggles([
        ['fluidGradient', '🌊 Fluid'],
        ['colorThief',    '🎨 Colors'],
        ['eqViz',         '📊 EQ'],
        ['canvasViz',     '🎵 Canvas'],
        ['appleMode',     '🍎 Apple'],
        ['albumAnim',     '🔄 Anim'],
      ]),
      _lbl('BG Animation'),
      _pills('bgAnimation', [
        ['none',      t('rem_anim_none',   'None')],
        ['blobs',     t('rem_anim_blobs',  'Blobs')],
        ['legere',    t('rem_anim_subtle', 'Subtle')],
        ['energique', t('rem_anim_energy', 'Energy')],
        ['flottante', t('rem_anim_float',  'Float')],
      ]),
    );
    app.appendChild(sEff);

    /* ── TYPOGRAPHY ── */
    const sTypo = _section('typo', t('rem_s_typography', '🔤 Typography'));
    _add(sTypo,
      _lbl('UI Font'),
      _pills('fontChoice', [
        ['default', t('rem_font_default', 'Default')],
        ['modern',  t('rem_font_modern',  'Modern')],
        ['serif',   t('rem_font_serif',   'Serif')],
        ['mono',    t('rem_font_mono',    'Mono')],
      ]),
      _slider('marqueeSpeed', '🎶 Marquee Speed', 10, 60),
      _lbl('Options'),
      _toggles([
        ['showMarquee', '📜 Marquee'],
        ['showProgress','⏱ Progress'],
        ['showAvatar',  '👤 Avatar'],
      ]),
    );
    app.appendChild(sTypo);

    /* ── LYRICS ── */
    const sLyr = _section('lyrics', t('rem_s_lyrics', '🎤 Lyrics'));
    _add(sLyr,
      _lbl('Position'),
      _pills('lyricsPosition', [
        ['right',  t('rem_lyr_side',   'Side')],
        ['center', t('rem_lyr_center', 'Center')],
        ['bottom', t('rem_lyr_bottom', 'Bottom')],
      ]),
      _slider('lyricsSize', 'Size', 60, 160),
      _lbl('Font'),
      _pills('lyricsFontChoice', [
        ['serif',   t('rem_lyr_font_serif',   'Serif')],
        ['sans',    t('rem_lyr_font_sans',    'Sans')],
        ['mono',    t('rem_lyr_font_mono',    'Mono')],
        ['display', t('rem_lyr_font_display', 'Display')],
      ]),
      _lbl('Animation'),
      _pills('lyricsAnimStyle', [
        ['fade',   t('rem_lyr_anim_fade',   'Fade')],
        ['slide',  t('rem_lyr_anim_slide',  'Slide')],
        ['scale',  t('rem_lyr_anim_scale',  'Scale')],
        ['blur',   t('rem_lyr_anim_blur',   'Blur')],
        ['bounce', t('rem_lyr_anim_bounce', 'Bounce')],
        ['none',   'Off'],
      ]),
      _lbl('Panel'),
      _pills('lyricsBlurMode', [
        ['standard', t('rem_lyr_panel_subtle', 'Subtle')],
        ['apple',    t('rem_lyr_panel_apple',  '🍎 Colorful')],
      ]),
      _slider('lyricsBackdropBlur',  'Panel blur',     0,     100),
      _slider('lyricsShadowOpacity', 'Shadow opacity', 0,     100),
      _slider('lyricsOffset',        '⏱ Sync offset',  -2000, 2000, 50),
      _lbl('Options'),
      _toggles([
        ['lyricsAutoColor', '🎨 Auto color'],
        ['lyricsColorAuto', '🖌 Color auto'],
        ['autoScroll',      '📜 Auto scroll'],
      ]),
      _lbl('Colors'),
      _colorRow([
        ['lyricsActiveColor',   'Active'],
        ['lyricsInactiveColor', 'Inactive'],
      ]),
    );
    app.appendChild(sLyr);

    /* ── TITLE STYLE ── */
    const sTit = _section('title', t('rem_s_title', '🎬 Title Style'));
    _add(sTit,
      _lbl('Transition'),
      _pills('titleAnimStyle', [
        ['fade-up',   t('rem_title_fu', 'Fade Up')],
        ['slide-left',t('rem_title_sl', 'Slide')],
        ['scale-in',  t('rem_title_sc', 'Scale')],
        ['blur-in',   t('rem_title_bl', 'Blur')],
        ['split',     t('rem_title_sp', 'Split')],
        ['none',      t('rem_title_no', 'None')],
      ]),
    );
    app.appendChild(sTit);

    document.body.appendChild(app);

    /* ── Wire connection buttons ── */
    const codeInput  = document.getElementById('rem-code-input');
    const btnConnect = document.getElementById('rem-btn-connect');
    const btnDisconn = document.getElementById('rem-btn-disconnect');

    btnConnect.addEventListener('click',  () => initRemote(codeInput.value));
    btnDisconn.addEventListener('click',  disconnectRemote);
    codeInput.addEventListener('keydown', e => { if (e.key === 'Enter') btnConnect.click(); });
    codeInput.addEventListener('input',   () => {
      codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 4);
    });

    /* Pre-fill code from URL query */
    const preCode = _params.get('code');
    if (preCode && /^\d{4}$/.test(preCode)) {
      codeInput.value = preCode;
      setTimeout(() => btnConnect.click(), 600);
    }

    /* Init slider fills */
    app.querySelectorAll('input[data-rem-slider]').forEach(_updateFill);

    /* Disable controls until connected */
    _remEnable(false);
  }

  /* ══════════════════════════════════════════════════════════
     10. SETTINGS PANEL INJECTION
  ══════════════════════════════════════════════════════════ */
  function buildSettingsUI() {
    const anchor = document.querySelector('.sync-section-header[data-i18n="sync_section_dev"]');
    if (!anchor) return;
    const frag = document.createDocumentFragment();

    /* Share section */
    const shH = document.createElement('div');
    shH.className = 'sync-section-header';
    shH.textContent = t('share_section', 'Sharing');
    frag.appendChild(shH);

    const shC = document.createElement('div');
    shC.className = 'sync-card';
    shC.innerHTML = `
      <div class="aura-sync-desc">${t('share_desc','Export your theme and settings as a shareable link or JSON file.')}</div>
      <div class="aura-share-btns">
        <button class="btn-test-mode" id="btn-share-url">${t('share_copy_link','🔗 Copy link')}</button>
        <button class="btn-test-mode" id="btn-export-json">${t('share_export_json','💾 Export JSON')}</button>
        <label  class="btn-test-mode">
          ${t('share_import_json','📂 Import JSON')}
          <input type="file" id="btn-import-json-file" accept=".json" style="display:none"/>
        </label>
      </div>`;
    frag.appendChild(shC);

    /* Remote section */
    const remH = document.createElement('div');
    remH.className = 'sync-section-header';
    remH.textContent = t('remote_section', 'Remote Control');
    frag.appendChild(remH);

    const remC = document.createElement('div');
    remC.className = 'sync-card';
    remC.innerHTML = `
      <div class="aura-sync-desc">
        ${t('remote_desc','Control this screen from your phone. Enable TV Mode, then open')}
        <code style="font-family:'JetBrains Mono',monospace;font-size:.82em;
          background:rgba(255,255,255,.07);padding:.1em .4em;border-radius:.2em">?remote=true</code>
        ${t('remote_desc2','on your device.')}
      </div>
      <div class="sp-row" style="margin-top:.875rem">
        <span class="sp-row-label">${t('remote_tv_mode','TV Mode')}</span>
        <label class="toggle">
          <input type="checkbox" id="aura-tv-toggle"/>
          <div class="toggle-track"></div>
          <div class="toggle-thumb"></div>
        </label>
      </div>
      <div id="aura-tv-info" style="display:none">
        <div class="aura-tv-code-row">
          <span class="aura-tv-code-lbl">${t('remote_tv_code','TV Code')}</span>
          <span id="aura-tv-code">—</span>
        </div>
        <div class="lanyard-status-row">
          <div class="lanyard-dot" id="aura-tv-dot" style="background:rgba(255,255,255,.2)"></div>
          <span id="aura-tv-status-text">${t('remote_tv_off','Disabled')}</span>
        </div>
        <p class="aura-tv-hint">${t('remote_tv_hint','Open ?remote=true on your phone and enter this code.')}</p>
        <button class="btn-test-mode" id="btn-copy-remote-link" style="margin-top:.5rem">
          ${t('remote_copy_url','🔗 Copy Remote URL')}
        </button>
      </div>`;
    frag.appendChild(remC);

    anchor.parentNode.insertBefore(frag, anchor);

    /* Wire */
    document.getElementById('btn-share-url').addEventListener('click', copyShareURL);
    document.getElementById('btn-export-json').addEventListener('click', exportConfigToJSON);
    document.getElementById('btn-import-json-file').addEventListener('change', e => {
      if (e.target.files[0]) importConfigFromJSON(e.target.files[0]);
      e.target.value = '';
    });

    const tvToggle = document.getElementById('aura-tv-toggle');
    const tvInfo   = document.getElementById('aura-tv-info');
    tvToggle.addEventListener('change', () => {
      if (tvToggle.checked) { tvInfo.style.display = ''; initTVMode(); }
      else { tvInfo.style.display = 'none'; stopTVMode(); }
    });

    document.getElementById('btn-copy-remote-link').addEventListener('click', () => {
      const url = `${location.origin}${location.pathname}?remote=true${tvCode ? '&code=' + tvCode : ''}`;
      navigator.clipboard
        ? navigator.clipboard.writeText(url).then(() => showToast('🔗 Remote URL copied!'))
        : showToast(url);
    });
  }

  /* ══════════════════════════════════════════════════════════
     11. PATCH saveSettings — broadcast to TV when in remote
  ══════════════════════════════════════════════════════════ */
  function patchSave() {
    if (typeof window.saveSettings !== 'function') return;
    const _orig = window.saveSettings;
    window.saveSettings = function (...args) {
      _orig.apply(this, args);
      if (isRemMode && peerConn?.open) {
        try {
          const cfg = getS();
          if (cfg) {
            const safe = {};
            for (const [k, v] of Object.entries(cfg)) { if (!SKIP.has(k)) safe[k] = v; }
            peerConn.send({ type: 'UPDATE_CONFIG', data: safe });
          }
        } catch {}
      }
    };
  }

  /* ══════════════════════════════════════════════════════════
     12. INIT
  ══════════════════════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', () => {
    injectCSS();

    if (IS_REMOTE) {
      buildRemotePage();
      return;
    }

    /* Normal mode */
    setTimeout(() => {
      const imported = importConfigFromURL();
      if (imported) {
        try { if (typeof applySettings === 'function') applySettings(); } catch {}
        showToast('✅ Config loaded from link!');
      }
      buildSettingsUI();
      patchSave();
    }, 80);
  });

  /* Public API */
  window.AURA_Share = {
    exportConfigToURL, copyShareURL, exportConfigToJSON, importConfigFromJSON,
    initTVMode, stopTVMode, initRemote, disconnectRemote, sendUpdate, showToast,
  };

})();
