/* AURA Remote Control — remote.js v4 (WebRTC P2P)
 * ─────────────────────────────────────────────────────────────────────────────
 * Transport : WebRTC DataChannel via PeerJS (connexion P2P cross-device)
 *   · Display (PC/TV)     → crée un Peer → obtient un ID → génère lien+QR
 *   · Remote (téléphone)  → ouvre le lien → connexion WebRTC directe
 *
 * Aucun serveur propre nécessaire — PeerJS open source signaling seulement.
 * Fallback automatique : localStorage (même navigateur) si WebRTC bloqué.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/* ══ État interne ════════════════════════════════════════════════════════════ */
let _rcMode      = null;   // null | 'display' | 'remote'
let _rcPeerId    = '';
let _peer        = null;   // instance Peer (PeerJS)
let _conn        = null;   // DataConnection active
let _rcConnDot   = null;
let _rcLastState = null;
let _rcPushTO    = null;
let _rcSendTO    = null;

/* Fallback localStorage */
const RC_LS_KEY  = 'aura_rc_v4_';
const RC_LS_POLL = 180;
let _rcLsPoll    = null;
let _rcLsLastTs  = 0;
let _rcFallback  = false;

/* ══ Chargement dynamique PeerJS ════════════════════════════════════════════ */
let _pjLoading = false, _pjReady = false;
const _pjCbs   = [];

function _loadPeerJS(cb) {
  if (_pjReady && window.Peer) { cb(); return; }
  _pjCbs.push(cb);
  if (_pjLoading) return;
  _pjLoading = true;
  const s = document.createElement('script');
  s.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
  s.onload  = () => { _pjReady = true; _pjCbs.forEach(fn => fn()); _pjCbs.length = 0; };
  s.onerror = () => {
    console.warn('[AURA Remote] PeerJS CDN inaccessible → fallback localStorage');
    _rcFallback = true; _pjCbs.forEach(fn => fn()); _pjCbs.length = 0;
  };
  document.head.appendChild(s);
}

function _genShortId() {
  const c = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({length:10}, () => c[Math.floor(Math.random()*c.length)]).join('');
}

/* ══ localStorage helpers ════════════════════════════════════════════════════ */
function _lsWrite(key, payload) {
  try { localStorage.setItem(RC_LS_KEY + key, JSON.stringify({...payload, _ts: Date.now()})); } catch {}
}
function _lsRead(key) {
  try { return JSON.parse(localStorage.getItem(RC_LS_KEY + key) || 'null'); } catch { return null; }
}

/* ══════════════════════════════════════════════════════════════════════════════
   MODE DISPLAY — PC / TV
   Crée un Peer, publie son ID, affiche le QR code + lien partageable,
   écoute les connexions entrantes WebRTC.
══════════════════════════════════════════════════════════════════════════════ */
function rcInitDisplay() {
  _rcMode = 'display';
  _loadPeerJS(() => {
    if (_rcFallback || !window.Peer) {
      _rcPeerId = localStorage.getItem('aura_rc_peer_id') || _genShortId();
      localStorage.setItem('aura_rc_peer_id', _rcPeerId);
      _rcStartLsFallbackDisplay();
      rcRenderCodeBadge(_rcPeerId);
      setTimeout(rcPushNow, 80);
      return;
    }
    const savedId = localStorage.getItem('aura_rc_peer_id') || undefined;
    try {
      _peer = new Peer(savedId, {
        debug: 0,
        config: { iceServers: [
          {urls:'stun:stun.l.google.com:19302'},
          {urls:'stun:stun1.l.google.com:19302'}
        ]}
      });
    } catch(e) {
      _rcFallback = true;
      _rcPeerId = savedId || _genShortId();
      localStorage.setItem('aura_rc_peer_id', _rcPeerId);
      _rcStartLsFallbackDisplay();
      rcRenderCodeBadge(_rcPeerId);
      setTimeout(rcPushNow, 80);
      return;
    }
    _peer.on('open', id => {
      _rcPeerId = id;
      localStorage.setItem('aura_rc_peer_id', id);
      rcRenderCodeBadge(id);
      setTimeout(rcPushNow, 80);
    });
    _peer.on('connection', conn => { _conn = conn; _rcSetupDisplayConn(conn); });
    _peer.on('error', err => {
      if (err.type === 'unavailable-id') {
        localStorage.removeItem('aura_rc_peer_id'); _peer.destroy(); rcInitDisplay();
      } else if (['network','server-error','socket-error'].includes(err.type)) {
        _rcFallback = true; _rcStartLsFallbackDisplay();
      }
    });
    _peer.on('disconnected', () => {
      setTimeout(() => { try { if (_peer && !_peer.destroyed) _peer.reconnect(); } catch {} }, 2000);
    });
  });
}

function _rcSetupDisplayConn(conn) {
  conn.on('open', () => { _rcUpdateDot(true); rcPushNow(); });
  conn.on('data', data => { if (data?._from === 'remote') _rcApplyRemoteData(data); });
  conn.on('close', () => { _rcUpdateDot(false); _conn = null; });
  conn.on('error', () => { _rcUpdateDot(false); _conn = null; });
}

function _rcStartLsFallbackDisplay() {
  clearInterval(_rcLsPoll);
  _rcLsPoll = setInterval(() => {
    const d = _lsRead(_rcPeerId + '_cmd');
    if (!d || d._ts <= _rcLsLastTs) return;
    _rcLsLastTs = d._ts;
    if (d._from === 'remote') _rcApplyRemoteData(d);
  }, RC_LS_POLL);
}

/* ── Push settings → Remote ─────────────────────────────────────────────── */
function rcSchedulePush() {
  if (_rcMode !== 'display') return;
  clearTimeout(_rcPushTO);
  _rcPushTO = setTimeout(rcPushNow, 300);
}
function rcPushNow() {
  if (_rcMode !== 'display' || !window.S) return;
  const payload = {...window.S, _ts: Date.now(), _from: 'display'};
  if (_conn?.open) { try { _conn.send(payload); } catch {} }
  _lsWrite(_rcPeerId, payload);
}

function _rcApplyRemoteData(data) {
  const skip = new Set(['_ts','_from']);
  let changed = false;
  for (const k in data) {
    if (skip.has(k)) continue;
    if (Object.prototype.hasOwnProperty.call(window.S, k) && window.S[k] !== data[k]) {
      window.S[k] = data[k]; changed = true;
    }
  }
  if (changed) { window.applySettings?.(); window.saveSettings?.(true); }
}

/* ══════════════════════════════════════════════════════════════════════════════
   MODE REMOTE — Téléphone / tablette
   Reçoit l'ID Peer depuis l'URL → connexion WebRTC P2P directe.
══════════════════════════════════════════════════════════════════════════════ */
function rcEnterRemote(peerId) {
  peerId = (peerId || '').trim();
  if (!peerId) { _rcErr('ID / code manquant.'); return; }
  _rcShowLoading(true);
  _loadPeerJS(() => {
    if (_rcFallback || !window.Peer) { _rcEnterRemoteFallback(peerId); return; }
    let rPeer;
    try {
      rPeer = new Peer({debug:0, config:{iceServers:[
        {urls:'stun:stun.l.google.com:19302'},
        {urls:'stun:stun1.l.google.com:19302'}
      ]}});
    } catch { _rcEnterRemoteFallback(peerId); return; }

    const timer = setTimeout(() => {
      try { rPeer.destroy(); } catch {}
      _rcEnterRemoteFallback(peerId);
    }, 12000);

    rPeer.on('open', () => {
      const conn = rPeer.connect(peerId, {reliable:true, serialization:'json'});
      conn.on('open', () => {
        clearTimeout(timer);
        _rcShowLoading(false);
        _peer = rPeer; _conn = conn;
        _rcMode = 'remote'; _rcPeerId = peerId;
        _rcHideLogin();
        conn.on('data', data => {
          if (data?._from === 'display') {
            _rcLastState = {...(_rcLastState||{}), ...data};
            if (!document.getElementById('rc-panel')) _rcShowPanel(_rcLastState);
            else _rcSyncPanel(_rcLastState);
          }
        });
        conn.on('close', () => _rcUpdateDot(false));
        conn.on('error', () => _rcUpdateDot(false));
        _rcUpdateDot(true);
      });
      conn.on('error', err => {
        clearTimeout(timer); try { rPeer.destroy(); } catch {}
        _rcEnterRemoteFallback(peerId);
      });
    });
    rPeer.on('error', err => {
      clearTimeout(timer); try { rPeer.destroy(); } catch {}
      _rcEnterRemoteFallback(peerId);
    });
  });
}

function _rcEnterRemoteFallback(peerId) {
  _rcFallback = true;
  const init = _lsRead(peerId);
  if (!init || init._from !== 'display') {
    _rcShowLoading(false);
    _rcErr('Aucun AURA trouvé. Vérifiez que le lecteur est ouvert et que vous utilisez le bon lien.');
    return;
  }
  _rcShowLoading(false);
  _rcMode = 'remote'; _rcPeerId = peerId;
  _rcLastState = {...init};
  _rcHideLogin(); _rcShowPanel(init);
  clearInterval(_rcLsPoll);
  _rcLsPoll = setInterval(() => {
    const d = _lsRead(peerId);
    if (!d || d._ts <= _rcLsLastTs) return;
    _rcLsLastTs = d._ts;
    if (d._from === 'display') { _rcLastState = {...(_rcLastState||{}), ...d}; _rcSyncPanel(_rcLastState); }
  }, RC_LS_POLL);
}

/* ── Envoi commande Remote → Display ────────────────────────────────────── */
function _rcSend(key, value) {
  if (_rcMode !== 'remote') return;
  const payload = {...(_rcLastState||{}), [key]:value, _ts:Date.now(), _from:'remote'};
  if (_conn?.open) { try { _conn.send(payload); } catch {} }
  _lsWrite(_rcPeerId + '_cmd', payload);
  if (_rcLastState) _rcLastState[key] = value;
}

/* ══ UI helpers ══════════════════════════════════════════════════════════════ */
function _rcHideLogin() {
  const el = document.getElementById('s-login');
  if (el) { el.classList.add('out'); setTimeout(() => { el.style.display = 'none'; }, 600); }
}
function _rcUpdateDot(connected) {
  _rcConnDot = _rcConnDot || document.getElementById('rc-conn-dot');
  if (_rcConnDot) _rcConnDot.classList.toggle('on', connected);
}
function _rcErr(msg) {
  const el = document.getElementById('rc-error');
  if (el) { el.textContent = msg; el.style.opacity = '1'; }
}
function _rcShowLoading(on) {
  const btn = document.getElementById('btn-rc-connect');
  if (btn) btn.textContent = on ? 'Connexion…' : 'Connecter →';
}

/* ══ PANEL REMOTE UI ════════════════════════════════════════════════════════ */
function _rcShowPanel(d) {
  _rcLastState = {...d};
  let panel = document.getElementById('rc-panel');
  if (!panel) { panel = document.createElement('div'); panel.id = 'rc-panel'; document.body.appendChild(panel); }
  panel.innerHTML = _rcBuildHTML(d);
  panel.classList.add('on');
  _rcConnDot = panel.querySelector('#rc-conn-dot');
  if (_rcConnDot) _rcConnDot.classList.add('on');
  _rcWire(panel);
}

function _rcSyncPanel(data) {
  if (data._ts) _rcLastState = {...(_rcLastState||{}), ...data};
  const panel = document.getElementById('rc-panel');
  if (!panel) return;
  panel.querySelectorAll('.rc-toggle input[data-key]').forEach(el => {
    if (el.dataset.key in data) el.checked = !!data[el.dataset.key];
  });
  panel.querySelectorAll('.rc-slider[data-key]').forEach(el => {
    if (el.dataset.key in data) {
      el.value = data[el.dataset.key];
      const lbl = panel.querySelector(`.rc-val[data-for="${el.id}"]`);
      if (lbl) lbl.textContent = data[el.dataset.key];
    }
  });
  panel.querySelectorAll('.rc-opt-grp[data-key]').forEach(grp => {
    const v = data[grp.dataset.key]; if (v === undefined) return;
    grp.querySelectorAll('.rc-opt').forEach(b => b.classList.toggle('active', String(b.dataset.val) === String(v)));
  });
  if ('accentColor' in data) {
    panel.querySelectorAll('.rc-swatch').forEach(s => s.classList.toggle('active', s.dataset.color === data.accentColor));
  }
}

function _rcWire(panel) {
  panel.querySelector('#rc-disc')?.addEventListener('click', () => {
    if (_conn)  { try { _conn.close();   } catch {} _conn  = null; }
    if (_peer)  { try { _peer.destroy(); } catch {} _peer  = null; }
    clearInterval(_rcLsPoll); _rcMode = null; _rcFallback = false;
    panel.classList.remove('on');
    const loginEl = document.getElementById('s-login');
    if (loginEl) { loginEl.style.display = ''; loginEl.classList.remove('out'); }
  });
  panel.querySelectorAll('.rc-toggle input[data-key]').forEach(el =>
    el.addEventListener('change', () => _rcSend(el.dataset.key, el.checked))
  );
  panel.querySelectorAll('.rc-slider[data-key]').forEach(el => {
    el.addEventListener('input', () => {
      const lbl = panel.querySelector(`.rc-val[data-for="${el.id}"]`);
      if (lbl) lbl.textContent = el.value;
      clearTimeout(_rcSendTO);
      _rcSendTO = setTimeout(() => _rcSend(el.dataset.key, parseInt(el.value)), 60);
    }, {passive:true});
  });
  panel.querySelectorAll('.rc-color[data-key]').forEach(el =>
    el.addEventListener('input', () => { clearTimeout(_rcSendTO); _rcSendTO = setTimeout(() => _rcSend(el.dataset.key, el.value), 60); })
  );
  panel.querySelectorAll('.rc-opt-grp[data-key]').forEach(grp =>
    grp.querySelectorAll('.rc-opt').forEach(btn =>
      btn.addEventListener('click', () => {
        grp.querySelectorAll('.rc-opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const val = btn.dataset.val;
        _rcSend(grp.dataset.key, (isNaN(val)||val.includes('%')||val.includes('px')) ? val : parseInt(val));
      })
    )
  );
  panel.querySelectorAll('.rc-swatch').forEach(sw =>
    sw.addEventListener('click', () => {
      panel.querySelectorAll('.rc-swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active'); _rcSend('accentColor', sw.dataset.color);
    })
  );
  panel.querySelector('#rc-apply-all')?.addEventListener('click', () => {
    if (!_rcLastState) return;
    const payload = {..._rcLastState, _ts:Date.now(), _from:'remote'};
    if (_conn?.open) { try { _conn.send(payload); } catch {} }
    _lsWrite(_rcPeerId + '_cmd', payload);
    const btn = panel.querySelector('#rc-apply-all');
    if (btn) { btn.textContent = '✓ Appliqué'; setTimeout(() => { btn.textContent = 'Appliquer tout'; }, 1500); }
  });
}

/* ── HTML helpers ──────────────────────────────────────────────────────────── */
const _sw  = (c,n,d) => `<button class="rc-swatch${d.accentColor===c?' active':''}" data-color="${c}" style="background:${c}" title="${n}" aria-label="${n}"></button>`;
const _opt = (k,pairs,d,wrap) => `<div class="rc-opt-grp${wrap?' rc-opt-grp-wrap':''}" data-key="${k}">${pairs.map(([v,l])=>`<button class="rc-opt${String(d[k])===String(v)?' active':''}" data-val="${v}">${l}</button>`).join('')}</div>`;
const _tog = (k,lbl,d) => `<div class="rc-row"><span class="rc-lbl">${lbl}</span><label class="rc-toggle" aria-label="${lbl}"><input type="checkbox" data-key="${k}"${d[k]?' checked':''}><div class="rc-tt"></div><div class="rc-th"></div></label></div>`;
const _sl  = (id,k,lbl,mn,mx,d,step) => `<div class="rc-slider-row"><span class="rc-lbl">${lbl} <span class="rc-val" data-for="${id}">${d[k]??0}</span></span><input id="${id}" class="rc-slider" type="range" min="${mn}" max="${mx}" step="${step||1}" value="${d[k]??0}" data-key="${k}" aria-label="${lbl}"/></div>`;
const _cr  = (k,lbl,d) => `<div class="rc-row"><span class="rc-lbl">${lbl}</span><input type="color" class="rc-color" data-key="${k}" value="${d[k]||'#ffffff'}" style="width:36px;height:28px;border:none;border-radius:6px;cursor:pointer;background:transparent;padding:0" aria-label="${lbl}"/></div>`;

function _rcBuildHTML(d) {
  return `<div class="rc-wrap">
    <div class="rc-hdr">
      <div class="rc-hdr-left">
        <span class="rc-wordmark">AURA</span>
        <span class="rc-badge">Télécommande</span>
      </div>
      <div class="rc-hdr-right">
        <span class="rc-dot" id="rc-conn-dot" title="Connecté"></span>
        <span class="rc-code-tag" style="font-size:.58rem;opacity:.4;letter-spacing:.03em">${_rcFallback?'LocalStorage':'P2P WebRTC'}</span>
        <button class="rc-disc" id="rc-disc" aria-label="Déconnecter">✕</button>
      </div>
    </div>
    <div class="rc-body">
      <button class="rc-apply-all-btn" id="rc-apply-all">Appliquer tout</button>

      <div class="rc-section">
        <div class="rc-sh">🎨 Apparence</div>
        <div class="rc-lbl" style="margin-bottom:.5rem">Couleur accent</div>
        <div class="rc-swatches" role="group">
          ${_sw('#e0245e','Rose',d)}${_sw('#7c3aed','Violet',d)}${_sw('#0891b2','Bleu',d)}
          ${_sw('#059669','Vert',d)}${_sw('#d97706','Orange',d)}${_sw('#ec4899','Rose clair',d)}${_sw('#ffffff','Blanc',d)}
        </div>
        ${_tog('colorThief','🎨 Couleurs auto',d)}
        ${_tog('appleMode','🍎 Style Apple',d)}
        ${_tog('vinylMode','🎵 Vinyl',d)}
        <div class="rc-lbl" style="margin:.75rem 0 .375rem">Police</div>
        ${_opt('fontChoice',[['default','Aura'],['inter','Inter'],['modern','Modern'],['serif','Serif'],['mono','Mono']],d)}
        <div class="rc-lbl" style="margin:.75rem 0 .375rem">Mode fond</div>
        ${_opt('bgMode',[['album','Album'],['color','Couleur'],['dark','Sombre'],['titlecolor','🌈 Titre']],d)}
        <div class="rc-lbl" style="margin:.75rem 0 .375rem">Mouvement</div>
        ${_opt('bgAnimation',[['none','Fixe'],['blobs','Blobs'],['legere','Léger'],['energique','Vif'],['flottante','Flottant']],d)}
        ${_tog('fluidGradient','🌊 Dégradé',d)}
        ${_tog('showGrain','✦ Grain cinéma',d)}
        ${_sl('rc-blur','blur','Flou fond',0,120,d)}
        ${_sl('rc-bright','brightness','Luminosité',10,90,d)}
        ${_sl('rc-sat','saturate','Saturation',0,30,d)}
        ${_sl('rc-mqspd','marqueeSpeed','Vitesse texte fond',10,60,d)}
      </div>

      <div class="rc-section">
        <div class="rc-sh">📐 Affichage</div>
        <div class="rc-lbl" style="margin-bottom:.375rem">Vue</div>
        ${_opt('heroLayout',[['standard','Complète'],['minimal','Minimale']],d)}
        <div class="rc-lbl" style="margin:.75rem 0 .375rem">Position</div>
        ${_opt('heroAlign',[['left','← Gauche'],['center','· Centre'],['right','Droite →']],d)}
        <div class="rc-lbl" style="margin:.75rem 0 .375rem">Forme pochette</div>
        ${_opt('artShape',[['22px','Arrondie'],['50%','Cercle'],['6px','Carré']],d)}
        ${_tog('showGlow','Lueur pochette',d)}
        ${_tog('animatedGlow','✨ Lueur pulsée',d)}
        ${_tog('showArt','Afficher pochette',d)}
        ${_tog('albumAnim','Pochette flottante',d)}
        ${_tog('showBg','Image de fond',d)}
        ${_tog('showAvatar','Photo artiste',d)}
        ${_tog('showMarquee','Texte de fond',d)}
        ${_tog('showProgress','Barre de progression',d)}
      </div>

      <div class="rc-section">
        <div class="rc-sh">🎵 Paroles</div>
        <div class="rc-lbl" style="margin-bottom:.375rem">Mode</div>
        ${_opt('lyricsRenderMode',[['basic','Statique'],['scroll','Défilement'],['phrase','Phrase'],['karaoke','🎤 Karaoké']],d)}
        ${_tog('karaokeProgressiveFill','✨ Remplissage progressif',d)}
        ${_sl('rc-lsz','lyricsSize','Taille texte',70,160,d)}
        ${_sl('rc-lwt','lyricsWeight','Graisse',100,900,d,100)}
        ${_sl('rc-lls','lyricsLetterSpacing','Espacement',-2,8,d)}
        ${_sl('rc-llh','lyricsLineHeight','Interligne',120,260,d,10)}
        <div class="rc-lbl" style="margin:.75rem 0 .375rem">Police</div>
        ${_opt('lyricsFontChoice',[['serif','Classique'],['sans','Simple'],['mono','Machine'],['display','Impact']],d)}
        ${_tog('lyricsColorAuto','Couleur auto (pochette)',d)}
        ${_cr('lyricsActiveColor','Ligne active',d)}
        ${_cr('lyricsInactiveColor','Autres lignes',d)}
        <div class="rc-lbl" style="margin:.75rem 0 .375rem">Fond</div>
        ${_opt('lyricsBg',[['none','Aucun'],['dark','Sombre'],['custom','Perso'],['auto','🌈 Pochette']],d)}
        ${_sl('rc-lbgop','lyricsBgOpacity','Opacité fond',0,100,d)}
        <div class="rc-lbl" style="margin:.75rem 0 .375rem">Animation</div>
        ${_opt('lyricsAnimStyle',[['fade','Fondu'],['slide','Glisse'],['scale','Zoom'],['blur','Flou'],['bounce','Rebond'],['none','Aucune']],d,true)}
        ${_tog('autoScroll','Suivre la ligne active',d)}
        <div class="rc-lbl" style="margin:.75rem 0 .375rem">Position</div>
        ${_opt('lyricsPosition',[['right','Côté'],['center','Centre'],['bottom','Bas']],d)}
        <div class="rc-lbl" style="margin:.75rem 0 .375rem">Style panel</div>
        ${_opt('lyricsBlurMode',[['standard','Discret'],['apple','🍎 Coloré']],d)}
        ${_sl('rc-loff','lyricsOffset','Décalage (ms)',-2000,2000,d,50)}
        ${_sl('rc-ladv','lyricsAdvanceMs','Base avance (ms)',0,1000,d,50)}
        ${_tog('lyricsAutoColor','Couleurs adaptatives',d)}
        <div class="rc-lbl" style="margin:.75rem 0 .375rem">Source</div>
        ${_opt('lyricsSource',[['lrclib','LRCLIB'],['lrclib+genius','+ Genius']],d)}
      </div>
    </div>
  </div>`;
}

/* ══ BADGE LIEN — mode display ═══════════════════════════════════════════════
   Génère un QR code + lien ?rcpeer=<id> partageable par SMS, QR, etc.
══════════════════════════════════════════════════════════════════════════════ */
function rcRenderCodeBadge(peerId) {
  const el = document.getElementById('rc-display-section');
  if (!el) return;

  const remoteUrl = _buildRemoteUrl(peerId);
  const transport = _rcFallback ? '📡 localStorage (même navigateur)' : '⚡ WebRTC P2P (cross-device)';
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=8&color=ffffff&bgcolor=00000000&data=${encodeURIComponent(remoteUrl)}`;

  el.innerHTML = `
    <div class="rc-code-block">
      <div class="rc-code-label">Télécommande ${_rcFallback ? '(mode local)' : 'P2P'}</div>

      <div style="display:flex;justify-content:center;margin:.6rem 0">
        <a href="${remoteUrl}" target="_blank" title="Scanner pour ouvrir">
          <img src="${qrSrc}" width="150" height="150" alt="QR Code AURA Remote"
               style="border-radius:12px;background:rgba(255,255,255,.05);display:block"
               onerror="this.closest('a').innerHTML='<span style=\"opacity:.4;font-size:.7rem\">QR indisponible</span>'">
        </a>
      </div>

      <div style="font-size:.68rem;opacity:.55;word-break:break-all;text-align:center;margin-bottom:.5rem;padding:0 .25rem">
        ${remoteUrl.length > 72 ? remoteUrl.slice(0, 72) + '…' : remoteUrl}
      </div>

      <div style="display:flex;gap:6px;margin-bottom:.5rem">
        <button class="rc-copy-btn" id="rc-copy-link-btn" style="flex:1">📋 Copier</button>
        <button class="rc-copy-btn" id="rc-share-btn" style="flex:1">↗ Partager</button>
      </div>

      <p class="rc-code-hint">
        ${transport}<br>
        <span style="opacity:.45;font-size:.64rem">
          Scannez le QR ou partagez le lien pour ouvrir la télécommande sur votre téléphone.
        </span>
      </p>
    </div>`;

  document.getElementById('rc-copy-link-btn')?.addEventListener('click', function () {
    navigator.clipboard.writeText(remoteUrl)
      .then(() => { this.textContent = '✓ Copié !'; setTimeout(() => { this.textContent = '📋 Copier'; }, 1800); })
      .catch(() => { prompt('Lien télécommande :', remoteUrl); });
  });

  document.getElementById('rc-share-btn')?.addEventListener('click', function () {
    if (navigator.share) {
      navigator.share({ title: 'AURA Télécommande', url: remoteUrl }).catch(() => {});
    } else {
      navigator.clipboard.writeText(remoteUrl)
        .then(() => { this.textContent = '✓ Copié !'; setTimeout(() => { this.textContent = '↗ Partager'; }, 1800); })
        .catch(() => { prompt('Lien télécommande :', remoteUrl); });
    }
  });
}

function _buildRemoteUrl(peerId) {
  const base = location.href.split('?')[0].split('#')[0];
  return `${base}?rcpeer=${encodeURIComponent(peerId)}`;
}

/* ══ Init login ══════════════════════════════════════════════════════════════ */
(function rcInit() {
  const toggleBtn  = document.getElementById('btn-rc-toggle');
  const form       = document.getElementById('rc-form');
  const input      = document.getElementById('rc-code-input');
  const connectBtn = document.getElementById('btn-rc-connect');
  const errorEl    = document.getElementById('rc-error');

  if (toggleBtn && form) {
    toggleBtn.addEventListener('click', () => {
      const open = form.style.display !== 'flex';
      form.style.display = open ? 'flex' : 'none';
      toggleBtn.classList.toggle('active', open);
      if (open && input) input.focus();
    });
  }
  if (input) {
    input.addEventListener('input', () => { if (errorEl) errorEl.style.opacity = '0'; });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') connectBtn?.click(); });
  }
  if (connectBtn) {
    connectBtn.addEventListener('click', () => { if (input) rcEnterRemote(input.value.trim()); });
  }

  /* Auto-connexion via ?rcpeer=<id> (nouveau) ou ?rcmode=remote&code=<id> (legacy) */
  const params = new URLSearchParams(location.search);
  const rcPeer = params.get('rcpeer') || (params.get('rcmode') === 'remote' ? params.get('code') : null);
  if (rcPeer) {
    setTimeout(() => { if (input) input.value = rcPeer; rcEnterRemote(rcPeer); }, 600);
  }
})();

/* ══ Exports ════════════════════════════════════════════════════════════════ */
window.rcInitDisplay  = rcInitDisplay;
window.rcSchedulePush = rcSchedulePush;
window.rcEnterRemote  = rcEnterRemote;
