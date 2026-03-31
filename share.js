/* ============================================================
   AURA — share.js  v1.0
   ─────────────────────────────────────────────────────────────
   Deux fonctionnalités majeures :

   1. PARTAGE DE CONFIG
      · exportConfigToURL()   → génère un lien avec tous les
        paramètres de S encodés en query string
      · importConfigFromURL() → applique les params URL au
        chargement, écrase le localStorage, nettoie l'URL
      · exportConfigToJSON()  → télécharge aura_config.json
      · importConfigFromJSON()→ importe un fichier JSON

   2. TÉLÉCOMMANDE (PeerJS / WebRTC)
      · Mode TV (Récepteur)   → ID court à 4 chiffres,
        affiche le code dans les réglages, écoute les messages
      · Mode Remote (Émetteur)→ URL ?remote=true, UI minimaliste
        pour smartphone ; connexion via le code TV
      · Protocole             → { type: 'UPDATE_CONFIG', data:{} }

   Dépendances : PeerJS 1.5.2 (chargement paresseux)
   Contraintes : JS pur ES6+, aucun bundler, compatible
                 GitHub Pages (site statique)
   ============================================================ */

(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════
     0.  DÉTECTION DU MODE REMOTE — avant tout rendu DOM
     ══════════════════════════════════════════════════════════ */
  const _params = new URLSearchParams(location.search);
  const IS_REMOTE = _params.get('remote') === 'true';

  /* En mode remote, masquer immédiatement l'interface AURA normale
     via un attribut data sur <html> ciblé par CSS inline injecté. */
  if (IS_REMOTE) {
    document.documentElement.dataset.auraMode = 'remote';
    const _hideStyle = document.createElement('style');
    _hideStyle.textContent = `
      [data-aura-mode="remote"] #s-login,
      [data-aura-mode="remote"] #s-player,
      [data-aura-mode="remote"] #loading,
      [data-aura-mode="remote"] #global-noise,
      [data-aura-mode="remote"] #orb-bg { display: none !important; }
    `;
    document.head.appendChild(_hideStyle);
  }

  /* ══════════════════════════════════════════════════════════
     1.  PATCH i18n — ajoute les clés de partage / télécommande
     ══════════════════════════════════════════════════════════ */
  const I18N_EXTRA = {
    en: {
      share_section:          'Sharing',
      share_desc:             'Export your theme and settings as a link or a file to share with others.',
      share_copy_link:        '🔗 Copy link',
      share_export_json:      '💾 Export JSON',
      share_import_json:      '📂 Import JSON',
      remote_section:         'Remote Control',
      remote_desc:            'Control AURA from your phone. Enable TV Mode here, then open',
      remote_desc_suffix:     'on your device.',
      remote_tv_mode:         'TV Mode',
      remote_tv_code_label:   'TV Code',
      remote_tv_waiting:      'Waiting for remote…',
      remote_tv_connected:    'Remote connected',
      remote_tv_reconnecting: 'Reconnecting…',
      remote_tv_off:          'Disabled — enable TV Mode to activate',
      remote_tv_error:        'Error',
      remote_tv_hint:         'Open ?remote=true on your phone and enter this code.',
      remote_page_subtitle:   'Remote Control',
      remote_code_label:      'TV Code',
      remote_code_placeholder:'0000',
      remote_btn_connect:     'Connect',
      remote_btn_disconnect:  'Disconnect',
      remote_status_idle:     'Enter the code shown on your TV',
      remote_section_theme:   '🎨 Accent color',
      remote_section_bg:      '🖼 Background',
      remote_section_effects: '✨ Effects',
      remote_section_bright:  '💡 Brightness',
      remote_section_blur:    '🔵 Blur',
      remote_section_lyrpos:  '🎤 Lyrics position',
      remote_section_artshape:'📐 Art shape',
      remote_bg_album:        'Album',
      remote_bg_dark:         'Dark',
      remote_bg_color:        'Color',
      remote_bg_gradient:     'Gradient',
      remote_eff_glow:        'Glow',
      remote_eff_grain:       'Grain',
      remote_eff_vinyl:       'Vinyl',
      remote_eff_fluid:       'Fluid',
      remote_eff_pulse:       'Pulse',
      remote_eff_colors:      'Colors',
      remote_lyr_side:        'Side',
      remote_lyr_center:      'Center',
      remote_lyr_bottom:      'Bottom',
      remote_art_square:      'Square',
      remote_art_soft:        'Soft',
      remote_art_round:       'Round',
      remote_art_circle:      'Circle',
    },
    fr: {
      share_section:          'Partage',
      share_desc:             'Exportez votre thème et vos réglages sous forme de lien ou de fichier.',
      share_copy_link:        '🔗 Copier le lien',
      share_export_json:      '💾 Exporter JSON',
      share_import_json:      '📂 Importer JSON',
      remote_section:         'Télécommande',
      remote_desc:            'Pilotez AURA depuis votre smartphone. Activez le Mode TV ici, puis ouvrez',
      remote_desc_suffix:     'sur votre appareil.',
      remote_tv_mode:         'Mode TV',
      remote_tv_code_label:   'Code TV',
      remote_tv_waiting:      'En attente d\'une télécommande…',
      remote_tv_connected:    'Télécommande connectée',
      remote_tv_reconnecting: 'Reconnexion…',
      remote_tv_off:          'Désactivé — activez le Mode TV pour démarrer',
      remote_tv_error:        'Erreur',
      remote_tv_hint:         'Ouvrez ?remote=true sur votre téléphone et entrez ce code.',
      remote_page_subtitle:   'Télécommande',
      remote_code_label:      'Code TV',
      remote_code_placeholder:'0000',
      remote_btn_connect:     'Connecter',
      remote_btn_disconnect:  'Déconnecter',
      remote_status_idle:     'Entrez le code affiché sur votre TV',
      remote_section_theme:   '🎨 Couleur d\'accent',
      remote_section_bg:      '🖼 Arrière-plan',
      remote_section_effects: '✨ Effets',
      remote_section_bright:  '💡 Luminosité',
      remote_section_blur:    '🔵 Flou',
      remote_section_lyrpos:  '🎤 Position des paroles',
      remote_section_artshape:'📐 Forme de la pochette',
      remote_bg_album:        'Pochette',
      remote_bg_dark:         'Sombre',
      remote_bg_color:        'Couleur',
      remote_bg_gradient:     'Dégradé',
      remote_eff_glow:        'Lueur',
      remote_eff_grain:       'Grain',
      remote_eff_vinyl:       'Vinyle',
      remote_eff_fluid:       'Fluide',
      remote_eff_pulse:       'Pulse',
      remote_eff_colors:      'Couleurs',
      remote_lyr_side:        'Côté',
      remote_lyr_center:      'Centre',
      remote_lyr_bottom:      'Bas',
      remote_art_square:      'Carré',
      remote_art_soft:        'Arrondi',
      remote_art_round:       'Rond',
      remote_art_circle:      'Cercle',
    },
  };

  /* Injecter dans AURA_LANGS dès que possible (i18n.js est déjà chargé) */
  function patchI18n() {
    if (!window.AURA_LANGS) return;
    for (const lang of Object.keys(I18N_EXTRA)) {
      if (window.AURA_LANGS[lang]) {
        Object.assign(window.AURA_LANGS[lang], I18N_EXTRA[lang]);
      }
    }
  }
  patchI18n();

  /* Helper de traduction court */
  function t(key, fallback) {
    if (window.t && typeof window.t === 'function') return window.t(key) || fallback || key;
    const lang = window.getLang ? window.getLang() : 'en';
    return (I18N_EXTRA[lang] && I18N_EXTRA[lang][key]) || (I18N_EXTRA.en && I18N_EXTRA.en[key]) || fallback || key;
  }

  /* ══════════════════════════════════════════════════════════
     2.  TOAST
     ══════════════════════════════════════════════════════════ */
  function showToast(msg, duration = 2800) {
    let toast = document.getElementById('aura-share-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'aura-share-toast';
      Object.assign(toast.style, {
        position: 'fixed', bottom: '2rem', left: '50%',
        transform: 'translateX(-50%) translateY(0)',
        background: 'rgba(14,14,22,0.96)',
        color: '#fff', padding: '0.7rem 1.4rem',
        borderRadius: '2rem', fontSize: '0.85rem',
        fontFamily: 'inherit', zIndex: '9999',
        pointerEvents: 'none',
        border: '1px solid rgba(255,255,255,0.12)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 6px 32px rgba(0,0,0,0.5)',
        transition: 'opacity 0.35s ease, transform 0.35s ease',
        opacity: '0',
        whiteSpace: 'nowrap',
      });
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(6px)';
    }, duration);
  }

  /* ══════════════════════════════════════════════════════════
     3.  PARTAGE — URL
     ══════════════════════════════════════════════════════════ */

  /* Clés à exclure de l'export URL (données sensibles ou inutiles) */
  const SKIP_KEYS = new Set(['lanyardId']);

  /**
   * Récupère S depuis le scope global (défini dans script.js).
   * S est une const top-level donc accessible depuis share.js
   * (même scope global pour les scripts non-module).
   */
  function getS() {
    /* S est accessible directement car partagé dans le même scope global */
    try { return typeof S !== 'undefined' ? S : null; } catch { return null; }
  }

  /**
   * Génère l'URL de partage complète avec tous les paramètres de S.
   */
  function exportConfigToURL() {
    const cfg = getS();
    if (!cfg) { showToast('❌ Settings not ready'); return ''; }

    const params = new URLSearchParams();
    for (const [key, val] of Object.entries(cfg)) {
      if (SKIP_KEYS.has(key)) continue;
      params.set(key, String(val));
    }
    return `${location.origin}${location.pathname}?${params.toString()}`;
  }

  /**
   * Copie l'URL de partage dans le presse-papier.
   */
  function copyShareURL() {
    const url = exportConfigToURL();
    if (!url) return;
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      try { document.execCommand('copy'); showToast('🔗 ' + t('share_copy_link', 'Link copied!')); }
      catch { showToast('❌ Copy failed'); }
      document.body.removeChild(ta);
    };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url)
        .then(() => showToast('🔗 ' + t('share_copy_link', 'Link copied!')))
        .catch(fallback);
    } else { fallback(); }
  }

  /**
   * Importe la config depuis les params URL au chargement.
   * Retourne true si des paramètres valides ont été trouvés et appliqués.
   */
  function importConfigFromURL() {
    if (IS_REMOTE) return false;
    const params = new URLSearchParams(location.search);
    if (!params.size) return false;

    const cfg = getS();
    if (!cfg) return false;

    let applied = 0;
    for (const key of Object.keys(cfg)) {
      if (SKIP_KEYS.has(key) || !params.has(key)) continue;
      const raw = params.get(key);
      const currentType = typeof cfg[key];
      try {
        if      (currentType === 'boolean') cfg[key] = (raw === 'true');
        else if (currentType === 'number')  cfg[key] = parseFloat(raw);
        else                                cfg[key] = raw;
        applied++;
      } catch {}
    }
    if (!applied) return false;

    /* Sauvegarder et nettoyer l'URL */
    try { if (typeof saveSettings === 'function') saveSettings(); } catch {}
    history.replaceState({}, '', location.pathname);
    return true;
  }

  /* ══════════════════════════════════════════════════════════
     4.  PARTAGE — JSON
     ══════════════════════════════════════════════════════════ */

  /**
   * Télécharge la config courante sous forme de fichier JSON.
   */
  function exportConfigToJSON() {
    const cfg = getS();
    if (!cfg) { showToast('❌ Settings not ready'); return; }

    const exportData = {};
    for (const [key, val] of Object.entries(cfg)) {
      if (!SKIP_KEYS.has(key)) exportData[key] = val;
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'aura_config.json'; a.click();
    URL.revokeObjectURL(url);
    showToast('💾 aura_config.json exported!');
  }

  /**
   * Importe une config depuis un objet File JSON.
   */
  function importConfigFromJSON(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        const cfg = getS();
        if (!cfg) { showToast('❌ Settings not ready'); return; }
        let applied = 0;
        for (const key in parsed) {
          if (!Object.prototype.hasOwnProperty.call(cfg, key)) continue;
          if (SKIP_KEYS.has(key)) continue;
          if (typeof parsed[key] !== typeof cfg[key]) continue;
          cfg[key] = parsed[key];
          applied++;
        }
        try { if (typeof saveSettings   === 'function') saveSettings(); }   catch {}
        try { if (typeof applySettings  === 'function') applySettings(); }  catch {}
        showToast(`✅ ${applied} settings imported!`);
      } catch {
        showToast('❌ Invalid JSON file');
      }
    };
    reader.onerror = () => showToast('❌ Could not read file');
    reader.readAsText(file);
  }

  /* ══════════════════════════════════════════════════════════
     5.  PEERJS — chargement paresseux
     ══════════════════════════════════════════════════════════ */
  const PEER_CDN       = 'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js';
  const PEER_NAMESPACE = 'aura-tv-';
  const PEER_CONFIG    = { host: '0.peerjs.com', port: 443, secure: true };

  let _peerJSLoaded    = false;
  let _peerJSCallbacks = [];

  function loadPeerJS(cb) {
    if (window.Peer && typeof window.Peer === 'function') { cb(); return; }
    _peerJSCallbacks.push(cb);
    if (_peerJSLoaded) return; /* Script already loading */
    _peerJSLoaded = true;
    const s   = document.createElement('script');
    s.src     = PEER_CDN;
    s.onload  = () => { _peerJSCallbacks.forEach(fn => fn()); _peerJSCallbacks = []; };
    s.onerror = () => { showToast('❌ PeerJS load failed — check your network'); _peerJSLoaded = false; _peerJSCallbacks = []; };
    document.head.appendChild(s);
  }

  /* ══════════════════════════════════════════════════════════
     6.  ÉTAT PEERJS PARTAGÉ
     ══════════════════════════════════════════════════════════ */
  let peer       = null; /* Instance Peer active */
  let peerConn   = null; /* Connexion DataChannel active */
  let tvCode     = null; /* Code à 4 chiffres (mode TV) */
  let isTVMode   = false;
  let isRemMode  = false;

  function genTVCode() { return String(Math.floor(1000 + Math.random() * 9000)); }
  function fmtCode(c)  { return c ? c.replace(/(\d{2})(\d{2})/, '$1 $2') : '—'; }

  /* ══════════════════════════════════════════════════════════
     7.  MODE TV (Récepteur)
     ══════════════════════════════════════════════════════════ */

  function initTVMode() {
    if (peer) { try { peer.destroy(); } catch {} peer = null; }
    peerConn = null;
    tvCode   = genTVCode();
    _tvSetStatus('connecting');
    _tvUpdateCode(tvCode);

    loadPeerJS(() => {
      try {
        peer = new Peer(PEER_NAMESPACE + tvCode, PEER_CONFIG);

        peer.on('open', () => {
          isTVMode = true;
          _tvSetStatus('ready');
        });

        peer.on('connection', (conn) => {
          /* Accepter un seul Remote à la fois */
          if (peerConn && peerConn.open) { conn.close(); return; }
          peerConn = conn;
          _tvSetStatus('connected', conn.peer.replace(PEER_NAMESPACE, '').replace('remote-', ''));

          conn.on('data', (data) => {
            try { _handleTVMessage(data); } catch {}
          });
          conn.on('close', () => { peerConn = null; _tvSetStatus('ready'); });
          conn.on('error', (err) => { peerConn = null; _tvSetStatus('error', err.type || err.message); });
        });

        peer.on('error', (err) => {
          /* ID déjà pris → nouveau code */
          if (err.type === 'unavailable-id') {
            tvCode = genTVCode();
            _tvUpdateCode(tvCode);
            setTimeout(() => isTVMode && initTVMode(), 400);
            return;
          }
          _tvSetStatus('error', err.type || err.message);
          setTimeout(() => { if (isTVMode) initTVMode(); }, 4000);
        });

        peer.on('disconnected', () => {
          if (!isTVMode) return;
          _tvSetStatus('reconnecting');
          try { peer.reconnect(); } catch {}
        });

      } catch (e) {
        _tvSetStatus('error', e.message);
      }
    });
  }

  function stopTVMode() {
    isTVMode = false;
    if (peerConn) { try { peerConn.close(); } catch {} peerConn = null; }
    if (peer)     { try { peer.destroy(); }   catch {} peer     = null; }
    tvCode = null;
    _tvUpdateCode(null);
    _tvSetStatus('off');
  }

  /**
   * Traite un message reçu depuis la télécommande.
   */
  function _handleTVMessage(data) {
    if (!data || typeof data !== 'object') return;

    switch (data.type) {
      case 'UPDATE_CONFIG': {
        const cfg = getS();
        if (!cfg || !data.data) break;
        for (const key in data.data) {
          if (!Object.prototype.hasOwnProperty.call(cfg, key)) continue;
          if (typeof data.data[key] !== typeof cfg[key]) continue;
          cfg[key] = data.data[key];
        }
        try { if (typeof saveSettings  === 'function') saveSettings(); }  catch {}
        try { if (typeof applySettings === 'function') applySettings(); } catch {}
        break;
      }
      case 'PING':
        if (peerConn && peerConn.open) peerConn.send({ type: 'PONG', ts: Date.now() });
        break;
      case 'GET_CONFIG': {
        const cfg = getS();
        if (peerConn && peerConn.open && cfg) {
          const safe = {};
          for (const [k, v] of Object.entries(cfg)) { if (!SKIP_KEYS.has(k)) safe[k] = v; }
          peerConn.send({ type: 'CONFIG_SNAPSHOT', data: safe });
        }
        break;
      }
    }
  }

  /* --- UI TV dans les réglages --- */
  function _tvUpdateCode(code) {
    const el = document.getElementById('aura-tv-code');
    if (el) el.textContent = fmtCode(code);
  }

  function _tvSetStatus(status, extra) {
    const dot  = document.getElementById('aura-tv-dot');
    const text = document.getElementById('aura-tv-status-text');
    if (!dot || !text) return;
    const map = {
      off:          { color: 'rgba(255,255,255,0.2)', glow: false, label: t('remote_tv_off',          'Disabled — enable TV Mode') },
      connecting:   { color: '#f5a623',               glow: true,  label: t('remote_tv_reconnecting', 'Connecting…') },
      ready:        { color: '#4ade80',               glow: true,  label: t('remote_tv_waiting',      'Waiting for remote…') },
      connected:    { color: '#22d3ee',               glow: true,  label: `${t('remote_tv_connected', 'Remote connected')}${extra ? ' (' + extra + ')' : ''}` },
      reconnecting: { color: '#f5a623',               glow: true,  label: t('remote_tv_reconnecting', 'Reconnecting…') },
      error:        { color: '#f87171',               glow: false, label: `${t('remote_tv_error', 'Error')}${extra ? ': ' + extra : ''}` },
    };
    const s = map[status] || map.off;
    dot.style.background = s.color;
    dot.style.boxShadow  = s.glow ? `0 0 7px ${s.color}` : 'none';
    text.textContent = s.label;
  }

  /* ══════════════════════════════════════════════════════════
     8.  MODE REMOTE (Émetteur / Smartphone)
     ══════════════════════════════════════════════════════════ */

  /**
   * Initialise la connexion vers la TV depuis la télécommande.
   */
  function initRemoteMode(code) {
    code = (code || '').trim().replace(/\s/g, '');
    if (!/^\d{4}$/.test(code)) { _remSetStatus('error', t('remote_status_idle', 'Enter a 4-digit code')); return; }
    if (peer) { try { peer.destroy(); } catch {} peer = null; }
    peerConn  = null;
    isRemMode = false;
    _remSetStatus('connecting', t('remote_tv_reconnecting', 'Connecting…'));
    _remEnableControls(false);

    loadPeerJS(() => {
      try {
        const remId = PEER_NAMESPACE + 'remote-' + Math.random().toString(36).slice(2, 10);
        peer = new Peer(remId, PEER_CONFIG);

        peer.on('open', () => {
          const conn = peer.connect(PEER_NAMESPACE + code, { reliable: true, serialization: 'json' });
          peerConn = conn;

          conn.on('open', () => {
            isRemMode = true;
            _remSetStatus('connected', `TV ${code} ✓`);
            _remEnableControls(true);
            /* Demander le snapshot de config actuelle */
            conn.send({ type: 'GET_CONFIG' });
          });

          conn.on('data', (data) => {
            /* CONFIG_SNAPSHOT → synchroniser les sliders et toggles du remote */
            if (data && data.type === 'CONFIG_SNAPSHOT' && data.data) {
              _syncRemoteUI(data.data);
            }
            if (data && data.type === 'PONG') {} /* heartbeat ok */
          });

          conn.on('close',  () => { isRemMode = false; _remSetStatus('off', 'Disconnected'); _remEnableControls(false); });
          conn.on('error',  () => { isRemMode = false; _remSetStatus('error', 'Connection failed'); _remEnableControls(false); });
        });

        peer.on('error', (err) => {
          _remSetStatus('error', err.type === 'peer-unavailable' ? `TV ${code} not found` : (err.type || err.message));
        });

      } catch (e) {
        _remSetStatus('error', e.message);
      }
    });
  }

  function disconnectRemote() {
    isRemMode = false;
    if (peerConn) { try { peerConn.close(); } catch {} peerConn = null; }
    if (peer)     { try { peer.destroy(); }   catch {} peer     = null; }
    _remSetStatus('off', t('remote_status_idle', 'Enter the code shown on your TV'));
    _remEnableControls(false);
  }

  /**
   * Envoie une mise à jour de config à la TV.
   */
  function sendConfigUpdate(data) {
    if (!isRemMode || !peerConn || !peerConn.open) return;
    try { peerConn.send({ type: 'UPDATE_CONFIG', data }); } catch {}
  }

  /* --- Synchronise les contrôles Remote depuis un snapshot --- */
  function _syncRemoteUI(cfg) {
    /* Accent color */
    document.querySelectorAll('.rem-swatch[data-color]').forEach(b => {
      b.classList.toggle('active', b.dataset.color === cfg.accentColor);
    });
    /* BG mode */
    document.querySelectorAll('.rem-pill[data-bg]').forEach(b => {
      b.classList.toggle('active', b.dataset.bg === cfg.bgMode);
    });
    /* Lyrics position */
    document.querySelectorAll('.rem-pill[data-lyrpos]').forEach(b => {
      b.classList.toggle('active', b.dataset.lyrpos === cfg.lyricsPosition);
    });
    /* Art shape */
    document.querySelectorAll('.rem-pill[data-artshape]').forEach(b => {
      b.classList.toggle('active', b.dataset.artshape === cfg.artShape);
    });
    /* Boolean toggles */
    document.querySelectorAll('.rem-toggle[data-key]').forEach(b => {
      b.classList.toggle('active', !!cfg[b.dataset.key]);
    });
    /* Sliders */
    const bs = document.getElementById('rem-brightness');
    const bv = document.getElementById('rem-val-brightness');
    if (bs && cfg.brightness != null) { bs.value = cfg.brightness; if (bv) bv.textContent = cfg.brightness + '%'; }
    const us = document.getElementById('rem-blur');
    const uv = document.getElementById('rem-val-blur');
    if (us && cfg.blur != null) { us.value = cfg.blur; if (uv) uv.textContent = Math.round((cfg.blur / 120) * 100) + '%'; }
    const ls = document.getElementById('rem-lyrics-size');
    const lv = document.getElementById('rem-val-lyrics-size');
    if (ls && cfg.lyricsSize != null) { ls.value = cfg.lyricsSize; if (lv) lv.textContent = cfg.lyricsSize + '%'; }
  }

  /* --- UI Remote status --- */
  function _remSetStatus(status, msg) {
    const dot  = document.getElementById('rem-status-dot');
    const text = document.getElementById('rem-status-text');
    if (!dot || !text) return;
    const colors = { off: 'rgba(255,255,255,0.2)', connecting: '#f5a623', connected: '#4ade80', error: '#f87171' };
    const c = colors[status] || colors.off;
    dot.style.background = c;
    dot.style.boxShadow  = status === 'connected' ? `0 0 7px ${c}` : 'none';
    text.textContent = msg || '';
  }

  function _remEnableControls(on) {
    const wrap = document.getElementById('rem-controls');
    if (!wrap) return;
    wrap.style.opacity       = on ? '1' : '0.4';
    wrap.style.pointerEvents = on ? '' : 'none';
  }

  /* ══════════════════════════════════════════════════════════
     9.  CSS — injection
     ══════════════════════════════════════════════════════════ */
  function injectCSS() {
    const style = document.createElement('style');
    style.id = 'aura-share-css';
    style.textContent = `

/* ── Toast ── */
#aura-share-toast { font-size: 0.85rem; }

/* ── Settings Panel additions ── */
.aura-share-actions {
  display: flex; flex-direction: column; gap: 0.4rem; margin-top: 0.75rem;
}
.aura-share-actions .btn-test-mode { text-align: center; cursor: pointer; }
.aura-share-actions label.btn-test-mode { display: block; }

.aura-tv-info { margin-top: 0.875rem; }
.aura-tv-code-row {
  display: flex; align-items: center; gap: 0.875rem; margin-bottom: 0.5rem;
}
.aura-tv-code-label {
  font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em;
  opacity: 0.45;
}
#aura-tv-code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 1.6rem; letter-spacing: 0.28em;
  color: var(--accent, #e0245e); font-weight: 700;
  min-width: 4ch;
}
.aura-tv-hint {
  margin-top: 0.5rem; font-size: 0.75rem; opacity: 0.45; line-height: 1.5;
}
.aura-remote-desc code {
  font-family: 'JetBrains Mono', monospace; font-size: 0.78em;
  background: rgba(255,255,255,0.07); padding: 0.15em 0.4em;
  border-radius: 0.25em;
}

/* ── Remote Page ── */
#rem-app {
  min-height: 100dvh;
  background: #080810;
  color: #fff;
  font-family: 'Instrument Sans', system-ui, sans-serif;
  padding: 1.25rem 1rem 6rem;
  max-width: 480px;
  margin: 0 auto;
  box-sizing: border-box;
}

.rem-header { text-align: center; padding: 1.5rem 0 1.25rem; }
.rem-wordmark {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 2.75rem; letter-spacing: 0.18em;
  color: var(--accent, #e0245e);
  line-height: 1;
}
.rem-subtitle {
  font-size: 0.7rem; text-transform: uppercase;
  letter-spacing: 0.12em; opacity: 0.35;
  margin-top: 0.3rem;
}

.rem-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 1rem; padding: 1.1rem 1rem;
  margin-bottom: 0.875rem;
}

.rem-card-label {
  font-size: 0.68rem; text-transform: uppercase;
  letter-spacing: 0.1em; opacity: 0.4; margin-bottom: 0.625rem;
}

.rem-code-input {
  width: 100%; box-sizing: border-box;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 0.75rem; color: #fff;
  font-size: 2rem; letter-spacing: 0.6em;
  text-align: center; padding: 0.7rem 1rem;
  font-family: 'JetBrains Mono', monospace;
  outline: none; transition: border-color 0.2s;
  -webkit-appearance: none;
}
.rem-code-input:focus { border-color: var(--accent, #e0245e); }
.rem-code-input::placeholder { letter-spacing: 0.3em; opacity: 0.25; }

.rem-row { display: flex; gap: 0.5rem; margin-top: 0.75rem; }
.rem-btn {
  flex: 1; padding: 0.75rem 1rem; border: none;
  border-radius: 0.75rem; font-size: 0.875rem;
  font-family: inherit; font-weight: 600; cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
  -webkit-tap-highlight-color: transparent;
}
.rem-btn:active { transform: scale(0.96); opacity: 0.8; }
.rem-btn-primary   { background: var(--accent, #e0245e); color: #fff; }
.rem-btn-secondary {
  background: rgba(255,255,255,0.09);
  border: 1px solid rgba(255,255,255,0.1); color: #fff;
}

.rem-status-row {
  display: flex; align-items: center; gap: 0.5rem;
  margin-top: 0.75rem; font-size: 0.78rem; opacity: 0.65;
}
.rem-status-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: rgba(255,255,255,0.2); flex-shrink: 0;
  transition: background 0.3s, box-shadow 0.3s;
}

/* Controls wrapper */
#rem-controls {
  transition: opacity 0.35s ease;
}

.rem-section-title {
  font-size: 0.7rem; text-transform: uppercase;
  letter-spacing: 0.09em; opacity: 0.4; margin-bottom: 0.7rem;
}

/* Swatches */
.rem-swatches { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.rem-swatch {
  width: 2.2rem; height: 2.2rem; border-radius: 50%;
  border: 2px solid transparent; cursor: pointer;
  transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
  -webkit-tap-highlight-color: transparent;
  box-shadow: none;
}
.rem-swatch:active { transform: scale(0.88); }
.rem-swatch.active {
  border-color: #fff;
  transform: scale(1.12);
  box-shadow: 0 0 10px currentColor;
}

/* Pills */
.rem-pills { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.rem-pill {
  padding: 0.5rem 0.9rem;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 2rem; color: rgba(255,255,255,0.65);
  font-size: 0.8rem; font-family: inherit; cursor: pointer;
  transition: all 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.rem-pill:active { transform: scale(0.95); }
.rem-pill.active {
  background: var(--accent, #e0245e);
  border-color: var(--accent, #e0245e);
  color: #fff;
}

/* Toggle grid */
.rem-toggles {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.4rem;
}
.rem-toggle {
  padding: 0.65rem 0.5rem;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 0.65rem;
  color: rgba(255,255,255,0.45);
  font-size: 0.78rem; font-family: inherit;
  font-weight: 500; cursor: pointer; line-height: 1;
  transition: all 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.rem-toggle:active { transform: scale(0.94); }
.rem-toggle.active {
  background: rgba(var(--accent-rgb, 224,36,94), 0.22);
  border-color: var(--accent, #e0245e);
  color: #fff;
}

/* Sliders */
.rem-slider {
  width: 100%; margin-top: 0.4rem;
  accent-color: var(--accent, #e0245e);
  -webkit-appearance: none; appearance: none;
  height: 4px; border-radius: 2px;
  background: linear-gradient(
    to right,
    var(--accent, #e0245e) 0%,
    var(--accent, #e0245e) var(--pct, 50%),
    rgba(255,255,255,0.12) var(--pct, 50%)
  );
  cursor: pointer;
}
.rem-slider::-webkit-slider-thumb {
  -webkit-appearance: none; width: 18px; height: 18px;
  border-radius: 50%; background: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.5); cursor: pointer;
}
.rem-slider-label {
  display: flex; justify-content: space-between;
  font-size: 0.72rem; opacity: 0.35; margin-top: 0.3rem;
}
.rem-slider-val {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.78rem; opacity: 0.55; float: right;
}
    `;
    document.head.appendChild(style);
  }

  /* ══════════════════════════════════════════════════════════
     10. PAGE REMOTE — construction de l'UI complète
     ══════════════════════════════════════════════════════════ */
  function buildRemotePage() {
    const app = document.createElement('div');
    app.id = 'rem-app';

    const ACCENT_COLORS = [
      '#e0245e', '#4facfe', '#a78bfa', '#34d399',
      '#fb923c', '#f472b6', '#facc15', '#60a5fa',
      '#f87171', '#ffffff',
    ];

    app.innerHTML = `
      <div class="rem-header">
        <div class="rem-wordmark">AURA</div>
        <div class="rem-subtitle">${t('remote_page_subtitle', 'Remote Control')}</div>
      </div>

      <!-- Connexion -->
      <div class="rem-card">
        <div class="rem-card-label">${t('remote_code_label', 'TV Code')}</div>
        <input  type="text"
                id="rem-code-input"
                class="rem-code-input"
                maxlength="4"
                inputmode="numeric"
                pattern="[0-9]{4}"
                placeholder="${t('remote_code_placeholder', '0000')}"
                autocomplete="off"
                aria-label="${t('remote_code_label', 'TV Code')}"/>
        <div class="rem-row">
          <button id="rem-btn-connect"    class="rem-btn rem-btn-primary">${t('remote_btn_connect', 'Connect')}</button>
          <button id="rem-btn-disconnect" class="rem-btn rem-btn-secondary" style="display:none">${t('remote_btn_disconnect', 'Disconnect')}</button>
        </div>
        <div class="rem-status-row">
          <div class="rem-status-dot" id="rem-status-dot"></div>
          <span id="rem-status-text">${t('remote_status_idle', 'Enter the code shown on your TV')}</span>
        </div>
      </div>

      <!-- Contrôles -->
      <div id="rem-controls" style="opacity:0.4;pointer-events:none">

        <!-- Couleur d'accent -->
        <div class="rem-card">
          <div class="rem-section-title">${t('remote_section_theme', '🎨 Accent color')}</div>
          <div class="rem-swatches" id="rem-swatches"></div>
        </div>

        <!-- Arrière-plan -->
        <div class="rem-card">
          <div class="rem-section-title">${t('remote_section_bg', '🖼 Background')}</div>
          <div class="rem-pills">
            <button class="rem-pill" data-bg="album"      >${t('remote_bg_album',    'Album')}</button>
            <button class="rem-pill" data-bg="dark"       >${t('remote_bg_dark',     'Dark')}</button>
            <button class="rem-pill" data-bg="color"      >${t('remote_bg_color',    'Color')}</button>
            <button class="rem-pill" data-bg="titlecolor" >${t('remote_bg_gradient', 'Gradient')}</button>
          </div>
        </div>

        <!-- Effets -->
        <div class="rem-card">
          <div class="rem-section-title">${t('remote_section_effects', '✨ Effects')}</div>
          <div class="rem-toggles">
            <button class="rem-toggle" data-key="showGlow"     >${t('remote_eff_glow',   'Glow')}</button>
            <button class="rem-toggle" data-key="showGrain"    >${t('remote_eff_grain',  'Grain')}</button>
            <button class="rem-toggle" data-key="vinylMode"    >${t('remote_eff_vinyl',  'Vinyl')}</button>
            <button class="rem-toggle" data-key="fluidGradient">${t('remote_eff_fluid',  'Fluid')}</button>
            <button class="rem-toggle" data-key="animatedGlow" >${t('remote_eff_pulse',  'Pulse')}</button>
            <button class="rem-toggle" data-key="colorThief"   >${t('remote_eff_colors', 'Colors')}</button>
          </div>
        </div>

        <!-- Luminosité -->
        <div class="rem-card">
          <div class="rem-section-title">
            ${t('remote_section_bright', '💡 Brightness')}
            <span class="rem-slider-val" id="rem-val-brightness">55%</span>
          </div>
          <input type="range" class="rem-slider" id="rem-brightness" min="10" max="90" value="55" aria-label="Brightness"/>
          <div class="rem-slider-label"><span>Min</span><span>Max</span></div>
        </div>

        <!-- Flou -->
        <div class="rem-card">
          <div class="rem-section-title">
            ${t('remote_section_blur', '🔵 Background blur')}
            <span class="rem-slider-val" id="rem-val-blur">58%</span>
          </div>
          <input type="range" class="rem-slider" id="rem-blur" min="0" max="120" value="70" aria-label="Blur"/>
          <div class="rem-slider-label"><span>0</span><span>Max</span></div>
        </div>

        <!-- Taille des paroles -->
        <div class="rem-card">
          <div class="rem-section-title">
            🔡 Lyrics size
            <span class="rem-slider-val" id="rem-val-lyrics-size">100%</span>
          </div>
          <input type="range" class="rem-slider" id="rem-lyrics-size" min="60" max="160" value="100" aria-label="Lyrics size"/>
          <div class="rem-slider-label"><span>60%</span><span>160%</span></div>
        </div>

        <!-- Position des paroles -->
        <div class="rem-card">
          <div class="rem-section-title">${t('remote_section_lyrpos', '🎤 Lyrics position')}</div>
          <div class="rem-pills">
            <button class="rem-pill" data-lyrpos="right" >${t('remote_lyr_side',   'Side')}</button>
            <button class="rem-pill" data-lyrpos="center">${t('remote_lyr_center', 'Center')}</button>
            <button class="rem-pill" data-lyrpos="bottom">${t('remote_lyr_bottom', 'Bottom')}</button>
          </div>
        </div>

        <!-- Forme de la pochette -->
        <div class="rem-card">
          <div class="rem-section-title">${t('remote_section_artshape', '📐 Art shape')}</div>
          <div class="rem-pills">
            <button class="rem-pill" data-artshape="0px" >${t('remote_art_square', 'Square')}</button>
            <button class="rem-pill" data-artshape="12px">${t('remote_art_soft',   'Soft')}</button>
            <button class="rem-pill" data-artshape="22px">${t('remote_art_round',  'Round')}</button>
            <button class="rem-pill" data-artshape="50%" >${t('remote_art_circle', 'Circle')}</button>
          </div>
        </div>

      </div><!-- /rem-controls -->
    `;

    document.body.appendChild(app);

    /* --- Swatches --- */
    const swatchGrid = document.getElementById('rem-swatches');
    ACCENT_COLORS.forEach(color => {
      const btn = document.createElement('button');
      btn.className      = 'rem-swatch';
      btn.dataset.color  = color;
      btn.style.cssText  = `background:${color};color:${color};`;
      btn.title          = color;
      btn.addEventListener('click', () => {
        document.querySelectorAll('.rem-swatch').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        sendConfigUpdate({ accentColor: color });
      });
      swatchGrid.appendChild(btn);
    });

    /* --- Pills (BG) --- */
    app.querySelectorAll('.rem-pill[data-bg]').forEach(btn => {
      btn.addEventListener('click', () => {
        app.querySelectorAll('.rem-pill[data-bg]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        sendConfigUpdate({ bgMode: btn.dataset.bg });
      });
    });

    /* --- Pills (Lyrics position) --- */
    app.querySelectorAll('.rem-pill[data-lyrpos]').forEach(btn => {
      btn.addEventListener('click', () => {
        app.querySelectorAll('.rem-pill[data-lyrpos]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        sendConfigUpdate({ lyricsPosition: btn.dataset.lyrpos });
      });
    });

    /* --- Pills (Art shape) --- */
    app.querySelectorAll('.rem-pill[data-artshape]').forEach(btn => {
      btn.addEventListener('click', () => {
        app.querySelectorAll('.rem-pill[data-artshape]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        sendConfigUpdate({ artShape: btn.dataset.artshape });
      });
    });

    /* --- Toggles (boolean S keys) --- */
    app.querySelectorAll('.rem-toggle[data-key]').forEach(btn => {
      btn.addEventListener('click', () => {
        const isActive = btn.classList.toggle('active');
        sendConfigUpdate({ [btn.dataset.key]: isActive });
      });
    });

    /* --- Slider helpers --- */
    function wireSlider(id, valId, min, max, key, fmt) {
      const sl = document.getElementById(id);
      const vl = document.getElementById(valId);
      if (!sl) return;
      const updateFill = () => {
        const pct = ((sl.value - sl.min) / (sl.max - sl.min)) * 100;
        sl.style.setProperty('--pct', pct + '%');
      };
      sl.addEventListener('input', () => {
        const v = parseFloat(sl.value);
        if (vl) vl.textContent = fmt ? fmt(v) : v;
        updateFill();
        sendConfigUpdate({ [key]: v });
      });
      updateFill();
    }

    wireSlider('rem-brightness',  'rem-val-brightness', 10,  90, 'brightness', v => v + '%');
    wireSlider('rem-blur',        'rem-val-blur',        0, 120, 'blur',       v => Math.round((v / 120) * 100) + '%');
    wireSlider('rem-lyrics-size', 'rem-val-lyrics-size', 60, 160, 'lyricsSize', v => v + '%');

    /* --- Connect / Disconnect --- */
    const codeInput  = document.getElementById('rem-code-input');
    const btnConn    = document.getElementById('rem-btn-connect');
    const btnDisconn = document.getElementById('rem-btn-disconnect');

    btnConn.addEventListener('click', () => {
      initRemoteMode(codeInput.value);
      btnConn.style.display    = 'none';
      btnDisconn.style.display = '';
    });

    btnDisconn.addEventListener('click', () => {
      disconnectRemote();
      btnDisconn.style.display = 'none';
      btnConn.style.display    = '';
    });

    codeInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') btnConn.click();
    });

    /* Pré-remplir depuis l'URL : ?remote=true&code=1234 */
    const preCode = _params.get('code');
    if (preCode && /^\d{4}$/.test(preCode)) {
      codeInput.value = preCode;
      setTimeout(() => btnConn.click(), 600);
    }
  }

  /* ══════════════════════════════════════════════════════════
     11. UI RÉGLAGES — injection dans le panel Settings
     ══════════════════════════════════════════════════════════ */
  function buildSettingsUI() {
    /* Point d'insertion : avant la section "Développement" */
    const devHeader = document.querySelector('.sync-section-header[data-i18n="sync_section_dev"]');
    if (!devHeader) return; /* Panel pas encore dans le DOM */

    const frag = document.createDocumentFragment();

    /* ── SECTION PARTAGE ── */
    const shareHeader = document.createElement('div');
    shareHeader.className   = 'sync-section-header';
    shareHeader.textContent = t('share_section', 'Sharing');
    frag.appendChild(shareHeader);

    const shareCard = document.createElement('div');
    shareCard.className = 'sync-card';
    shareCard.innerHTML = `
      <div class="aura-sync-desc aura-remote-desc">${t('share_desc', 'Export your theme and settings as a link or a file to share with others.')}</div>
      <div class="aura-share-actions">
        <button class="btn-test-mode" id="btn-share-url">${t('share_copy_link', '🔗 Copy link')}</button>
        <button class="btn-test-mode" id="btn-export-json">${t('share_export_json', '💾 Export JSON')}</button>
        <label  class="btn-test-mode" id="btn-import-json-label">
          ${t('share_import_json', '📂 Import JSON')}
          <input type="file" id="btn-import-json-file" accept=".json" style="display:none" aria-label="Import JSON config"/>
        </label>
      </div>`;
    frag.appendChild(shareCard);

    /* ── SECTION TÉLÉCOMMANDE ── */
    const remoteHeader = document.createElement('div');
    remoteHeader.className   = 'sync-section-header';
    remoteHeader.textContent = t('remote_section', 'Remote Control');
    frag.appendChild(remoteHeader);

    const remoteCard = document.createElement('div');
    remoteCard.className = 'sync-card';
    remoteCard.innerHTML = `
      <div class="aura-sync-desc aura-remote-desc">
        ${t('remote_desc', 'Control AURA from your phone. Enable TV Mode here, then open')}
        <code>?remote=true</code>
        ${t('remote_desc_suffix', 'on your device.')}
      </div>

      <div class="sp-row" style="margin-top:0.875rem">
        <span class="sp-row-label">${t('remote_tv_mode', 'TV Mode')}</span>
        <label class="toggle">
          <input type="checkbox" id="aura-tv-toggle" aria-label="${t('remote_tv_mode', 'TV Mode')}"/>
          <div class="toggle-track"></div>
          <div class="toggle-thumb"></div>
        </label>
      </div>

      <div id="aura-tv-info" class="aura-tv-info" style="display:none">
        <div class="aura-tv-code-row">
          <span class="aura-tv-code-label">${t('remote_tv_code_label', 'TV Code')}</span>
          <span id="aura-tv-code">—</span>
        </div>
        <div class="lanyard-status-row">
          <div class="lanyard-dot" id="aura-tv-dot" style="background:rgba(255,255,255,0.2)"></div>
          <span id="aura-tv-status-text">${t('remote_tv_off', 'Disabled — enable TV Mode')}</span>
        </div>
        <p class="aura-tv-hint">${t('remote_tv_hint', 'Open ?remote=true on your phone and enter this code.')}</p>
        <button class="btn-test-mode" id="btn-copy-remote-link" style="margin-top:0.5rem">🔗 Copy Remote URL</button>
      </div>`;
    frag.appendChild(remoteCard);

    /* Insertion dans le DOM */
    devHeader.parentNode.insertBefore(frag, devHeader);

    /* ── Wiring ── */

    /* Partage — URL */
    document.getElementById('btn-share-url').addEventListener('click', copyShareURL);

    /* Partage — Export JSON */
    document.getElementById('btn-export-json').addEventListener('click', exportConfigToJSON);

    /* Partage — Import JSON */
    const fileInput = document.getElementById('btn-import-json-file');
    fileInput.addEventListener('change', e => {
      if (e.target.files[0]) importConfigFromJSON(e.target.files[0]);
      e.target.value = '';
    });

    /* TV Mode toggle */
    const tvToggle = document.getElementById('aura-tv-toggle');
    const tvInfo   = document.getElementById('aura-tv-info');

    tvToggle.addEventListener('change', () => {
      if (tvToggle.checked) {
        tvInfo.style.display = '';
        initTVMode();
      } else {
        tvInfo.style.display = 'none';
        stopTVMode();
      }
    });

    /* Copy remote URL */
    document.getElementById('btn-copy-remote-link').addEventListener('click', () => {
      const url = `${location.origin}${location.pathname}?remote=true${tvCode ? '&code=' + tvCode : ''}`;
      navigator.clipboard ? navigator.clipboard.writeText(url).then(() => showToast('🔗 Remote URL copied!')) : showToast(url);
    });
  }

  /* ══════════════════════════════════════════════════════════
     12. PATCH saveSettings — broadcast en temps réel vers TV
         (si la TV est en même temps dans les réglages)
     ══════════════════════════════════════════════════════════ */
  function patchSaveSettings() {
    /* saveSettings est une function declaration → propriété de window */
    if (typeof window.saveSettings !== 'function') return;
    const _orig = window.saveSettings;
    window.saveSettings = function (...args) {
      _orig.apply(this, args);
      /* Mode TV : on ne diffuse PAS (on est le récepteur) */
      /* Mode Remote : on diffuse toute la config */
      if (isRemMode && peerConn && peerConn.open) {
        try {
          const cfg = getS();
          if (cfg) {
            const safe = {};
            for (const [k, v] of Object.entries(cfg)) { if (!SKIP_KEYS.has(k)) safe[k] = v; }
            peerConn.send({ type: 'UPDATE_CONFIG', data: safe });
          }
        } catch {}
      }
    };
  }

  /* ══════════════════════════════════════════════════════════
     13. INIT
     ══════════════════════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', () => {
    injectCSS();

    if (IS_REMOTE) {
      /* Mode télécommande : construire l'UI smartphone */
      buildRemotePage();
      return;
    }

    /* Mode normal : import URL → settings UI → patch */
    setTimeout(() => {
      const imported = importConfigFromURL();
      if (imported) {
        try { if (typeof applySettings === 'function') applySettings(); } catch {}
        showToast('✅ Config loaded from link!');
      }
      buildSettingsUI();
      patchSaveSettings();
    }, 80);
  });

  /* ══════════════════════════════════════════════════════════
     API publique (debug / extensions)
     ══════════════════════════════════════════════════════════ */
  window.AURA_Share = {
    exportConfigToURL,
    copyShareURL,
    exportConfigToJSON,
    importConfigFromJSON,
    initTVMode,
    stopTVMode,
    initRemoteMode,
    disconnectRemote,
    sendConfigUpdate,
    showToast,
  };

})();
