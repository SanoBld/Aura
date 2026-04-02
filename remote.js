/* AURA Remote Control — remote.js v2
 * Transport prioritaire : BroadcastChannel API (même navigateur, onglets/fenêtres)
 * Fallback automatique  : localStorage polling (même origine)
 * Firebase optionnel    : renseigner AURA_RTDB_URL pour cross-réseau
 */
const AURA_RTDB_URL = '';
const RC_LS_PREFIX  = 'aura_rc_ch_';
const RC_LS_POLL_MS = 200;

let _rcMode = null, _rcCode = '', _rcBC = null;
let _rcPollTO = null, _rcPushTO = null, _rcSendTO = null, _rcSSE = null;
let _rcConnDot = null, _rcLastTs = 0, _rcLastState = null;

const _fbOK   = () => AURA_RTDB_URL && AURA_RTDB_URL.length > 10;
const _fbPath = c => `${AURA_RTDB_URL}/aura-rc/${c}.json`;
const _lsKey  = c => RC_LS_PREFIX + c;

function _rcGenCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function _rcWrite(payload) {
  const msg = JSON.stringify(payload);
  if (_rcBC) { try { _rcBC.postMessage(payload); } catch {} }
  try { localStorage.setItem(_lsKey(_rcCode), msg); } catch {}
  if (_fbOK()) fetch(_fbPath(_rcCode), { method:'PUT', headers:{'Content-Type':'application/json'}, body: msg }).catch(()=>{});
}

/* ── DISPLAY MODE ─────────────────────────────────────────────────────────── */
function rcInitDisplay() {
  _rcCode = localStorage.getItem('aura_rc_code') || _rcGenCode();
  localStorage.setItem('aura_rc_code', _rcCode);
  _rcMode = 'display';
  if (typeof BroadcastChannel !== 'undefined') {
    _rcBC = new BroadcastChannel('aura_rc_' + _rcCode);
    _rcBC.onmessage = ev => { if (ev.data?._from === 'remote') _rcApplyRemoteData(ev.data); };
  }
  /* Listen for commands from remote via localStorage polling */
  const _lsInKey = _lsKey(_rcCode + '_cmd');
  _rcPollTO = setInterval(() => {
    try {
      const raw = localStorage.getItem(_lsInKey); if (!raw) return;
      const d = JSON.parse(raw); if (!d || d._ts <= _rcLastTs) return;
      _rcLastTs = d._ts; if (d._from === 'remote') _rcApplyRemoteData(d);
    } catch {}
  }, RC_LS_POLL_MS);
  if (_fbOK()) _rcListenFB();
  /* Delay push to ensure window.S is fully initialised */
  setTimeout(rcPushNow, 50);
  rcRenderCodeBadge(_rcCode);
}

function rcSchedulePush() {
  if (_rcMode !== 'display') return;
  clearTimeout(_rcPushTO); _rcPushTO = setTimeout(rcPushNow, 300);
}

function rcPushNow() {
  if (_rcMode !== 'display' || !_rcCode || !window.S) return;
  _rcWrite({ ...window.S, _ts: Date.now(), _from: 'display' });
}

function _rcApplyRemoteData(data) {
  const skip = new Set(['_ts','_from']); let changed = false;
  for (const k in data) {
    if (skip.has(k)) continue;
    if (Object.prototype.hasOwnProperty.call(window.S, k) && window.S[k] !== data[k]) {
      window.S[k] = data[k]; changed = true;
    }
  }
  if (changed) { window.applySettings(); window.saveSettings(true); }
}

/* ── REMOTE MODE ──────────────────────────────────────────────────────────── */
async function rcEnterRemote(rawCode) {
  _rcCode = (rawCode || '').toUpperCase().replace(/[^A-Z0-9]/g,'');
  if (_rcCode.length !== 6) { _rcErr('Code invalide — 6 caractères.'); return; }
  _rcShowLoading(true);
  let initData = null;
  try {
    const raw = localStorage.getItem(_lsKey(_rcCode));
    if (raw) { const d = JSON.parse(raw); if (d?._from === 'display') initData = d; }
  } catch {}
  if (!initData && _fbOK()) {
    try { const r = await fetch(_fbPath(_rcCode)); if (r.ok) { const d = await r.json(); if (d?._from === 'display') initData = d; } } catch {}
  }
  if (!initData) { _rcShowLoading(false); _rcErr("Aucun AURA trouvé. Vérifiez que le lecteur est ouvert."); return; }
  _rcShowLoading(false); _rcMode = 'remote';
  const loginEl = document.getElementById('s-login');
  if (loginEl) { loginEl.classList.add('out'); setTimeout(() => { loginEl.style.display = 'none'; }, 600); }
  if (typeof BroadcastChannel !== 'undefined') {
    _rcBC = new BroadcastChannel('aura_rc_' + _rcCode);
    _rcBC.onmessage = ev => { if (ev.data?._from === 'display') _rcSyncPanel(ev.data); };
  }
  _rcPollTO = setInterval(() => {
    try {
      const raw = localStorage.getItem(_lsKey(_rcCode)); if (!raw) return;
      const d = JSON.parse(raw); if (!d || d._ts <= _rcLastTs) return;
      _rcLastTs = d._ts; if (d._from === 'display') _rcSyncPanel(d);
    } catch {}
  }, RC_LS_POLL_MS);
  if (_fbOK()) _rcListenFB();
  _rcShowPanel(initData);
}

function _rcSend(key, value) {
  if (_rcMode !== 'remote') return;
  const payload = { ...(_rcLastState || {}), [key]: value, _ts: Date.now(), _from: 'remote' };
  const msg = JSON.stringify(payload);
  if (_rcBC) { try { _rcBC.postMessage(payload); } catch {} }
  try { localStorage.setItem(_lsKey(_rcCode + '_cmd'), msg); } catch {}
  if (_fbOK()) fetch(_fbPath(_rcCode), { method:'PUT', headers:{'Content-Type':'application/json'}, body: msg }).catch(()=>{});
  if (_rcLastState) _rcLastState[key] = value;
}

/* ── FIREBASE SSE ─────────────────────────────────────────────────────────── */
function _rcListenFB() {
  if (_rcSSE) { try { _rcSSE.close(); } catch {} _rcSSE = null; }
  _rcSSE = new EventSource(_fbPath(_rcCode));
  _rcSSE.addEventListener('put', ev => {
    try {
      const data = JSON.parse(ev.data)?.data;
      if (!data || typeof data !== 'object') return;
      if (_rcMode === 'display' && data._from === 'remote') _rcApplyRemoteData(data);
      if (_rcMode === 'remote'  && data._from === 'display') _rcSyncPanel(data);
    } catch {}
  });
  _rcSSE.onerror = () => { setTimeout(_rcListenFB, 5000); };
  if (_rcConnDot) _rcConnDot.classList.add('on');
}

/* ── PANEL UI ─────────────────────────────────────────────────────────────── */
function _rcShowPanel(d) {
  _rcLastState = { ...d };
  let panel = document.getElementById('rc-panel');
  if (!panel) { panel = document.createElement('div'); panel.id = 'rc-panel'; document.body.appendChild(panel); }
  panel.innerHTML = _rcBuildHTML(d); panel.classList.add('on');
  _rcConnDot = panel.querySelector('#rc-conn-dot');
  if (_rcConnDot) _rcConnDot.classList.add('on');
  _rcWire(panel);
}

function _rcSyncPanel(data) {
  if (data._ts) _rcLastState = { ...(_rcLastState||{}), ...data };
  const panel = document.getElementById('rc-panel'); if (!panel) return;
  panel.querySelectorAll('.rc-toggle input[data-key]').forEach(el => { if (el.dataset.key in data) el.checked = !!data[el.dataset.key]; });
  panel.querySelectorAll('.rc-slider[data-key]').forEach(el => {
    if (el.dataset.key in data) { el.value = data[el.dataset.key]; const lbl = panel.querySelector(`.rc-val[data-for="${el.id}"]`); if (lbl) lbl.textContent = data[el.dataset.key]; }
  });
  panel.querySelectorAll('.rc-opt-grp[data-key]').forEach(grp => {
    const v = data[grp.dataset.key]; if (v === undefined) return;
    grp.querySelectorAll('.rc-opt').forEach(b => b.classList.toggle('active', String(b.dataset.val) === String(v)));
  });
  if ('accentColor' in data) panel.querySelectorAll('.rc-swatch').forEach(s => s.classList.toggle('active', s.dataset.color === data.accentColor));
}

function _rcWire(panel) {
  panel.querySelector('#rc-disc')?.addEventListener('click', () => {
    if (_rcBC) { try { _rcBC.close(); } catch {} _rcBC = null; }
    if (_rcSSE) { try { _rcSSE.close(); } catch {} _rcSSE = null; }
    clearInterval(_rcPollTO); _rcMode = null; panel.classList.remove('on');
    const loginEl = document.getElementById('s-login');
    if (loginEl) { loginEl.style.display = ''; loginEl.classList.remove('out'); }
  });
  panel.querySelectorAll('.rc-toggle input[data-key]').forEach(el => {
    el.addEventListener('change', () => _rcSend(el.dataset.key, el.checked));
  });
  panel.querySelectorAll('.rc-slider[data-key]').forEach(el => {
    el.addEventListener('input', () => {
      const lbl = panel.querySelector(`.rc-val[data-for="${el.id}"]`); if (lbl) lbl.textContent = el.value;
      clearTimeout(_rcSendTO); _rcSendTO = setTimeout(() => _rcSend(el.dataset.key, parseInt(el.value)), 60);
    }, { passive: true });
  });
  panel.querySelectorAll('.rc-color[data-key]').forEach(el => {
    el.addEventListener('input', () => { clearTimeout(_rcSendTO); _rcSendTO = setTimeout(() => _rcSend(el.dataset.key, el.value), 60); });
  });
  panel.querySelectorAll('.rc-opt-grp[data-key]').forEach(grp => {
    grp.querySelectorAll('.rc-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        grp.querySelectorAll('.rc-opt').forEach(b => b.classList.remove('active')); btn.classList.add('active');
        const val = btn.dataset.val;
        _rcSend(grp.dataset.key, (isNaN(val) || val.includes('%') || val.includes('px')) ? val : parseInt(val));
      });
    });
  });
  panel.querySelectorAll('.rc-swatch').forEach(sw => {
    sw.addEventListener('click', () => { panel.querySelectorAll('.rc-swatch').forEach(s => s.classList.remove('active')); sw.classList.add('active'); _rcSend('accentColor', sw.dataset.color); });
  });
  panel.querySelector('#rc-apply-all')?.addEventListener('click', () => {
    if (!_rcLastState) return;
    const payload = { ..._rcLastState, _ts: Date.now(), _from: 'remote' };
    const msg = JSON.stringify(payload);
    if (_rcBC) { try { _rcBC.postMessage(payload); } catch {} }
    try { localStorage.setItem(_lsKey(_rcCode + '_cmd'), msg); } catch {}
    if (_fbOK()) fetch(_fbPath(_rcCode), { method:'PUT', headers:{'Content-Type':'application/json'}, body: msg }).catch(()=>{});
    const btn = panel.querySelector('#rc-apply-all');
    if (btn) { btn.textContent = '✓ Appliqué'; setTimeout(() => { btn.textContent = 'Appliquer tout'; }, 1500); }
  });
}

/* ── HTML ─────────────────────────────────────────────────────────────────── */
const _sw  = (c,n,d) => `<button class="rc-swatch${d.accentColor===c?' active':''}" data-color="${c}" style="background:${c}" title="${n}"></button>`;
const _opt = (grpKey, pairs, d, wrap) => `<div class="rc-opt-grp${wrap?' rc-opt-grp-wrap':''}" data-key="${grpKey}">${pairs.map(([v,l]) => `<button class="rc-opt${String(d[grpKey])===String(v)?' active':''}" data-val="${v}">${l}</button>`).join('')}</div>`;
const _tog = (key, label, d) => `<div class="rc-row"><span class="rc-lbl">${label}</span><label class="rc-toggle"><input type="checkbox" data-key="${key}"${d[key]?' checked':''}><div class="rc-tt"></div><div class="rc-th"></div></label></div>`;
const _sl  = (id, key, label, min, max, d, step) => `<div class="rc-slider-row"><span class="rc-lbl">${label} <span class="rc-val" data-for="${id}">${d[key]??0}</span></span><input id="${id}" class="rc-slider" type="range" min="${min}" max="${max}" step="${step||1}" value="${d[key]??0}" data-key="${key}"/></div>`;
const _cr  = (key, label, d) => `<div class="rc-row"><span class="rc-lbl">${label}</span><input type="color" class="rc-color" data-key="${key}" value="${d[key]||'#ffffff'}" style="width:36px;height:28px;border:none;border-radius:6px;cursor:pointer;background:transparent;padding:0"/></div>`;

function _rcBuildHTML(d) {
  return `<div class="rc-wrap">
    <div class="rc-hdr">
      <div class="rc-hdr-left"><span class="rc-wordmark">AURA</span><span class="rc-badge">Télécommande</span></div>
      <div class="rc-hdr-right"><span class="rc-dot" id="rc-conn-dot"></span><span class="rc-code-tag">${_rcCode}</span><button class="rc-disc" id="rc-disc">✕</button></div>
    </div>
    <div class="rc-body">
      <button class="rc-apply-all-btn" id="rc-apply-all">Appliquer tout</button>
      <div class="rc-section">
        <div class="rc-sh">🎨 Apparence</div>
        <div class="rc-lbl" style="margin-bottom:.5rem">Couleur accent</div>
        <div class="rc-swatches">${_sw('#e0245e','Rose',d)}${_sw('#7c3aed','Violet',d)}${_sw('#0891b2','Bleu',d)}${_sw('#059669','Vert',d)}${_sw('#d97706','Orange',d)}${_sw('#ec4899','Rose clair',d)}${_sw('#ffffff','Blanc',d)}</div>
        ${_tog('vinylMode','🎵 Vinyl',d)}${_tog('colorThief','🎨 Couleurs auto',d)}${_tog('appleMode','Clean style',d)}
        <div class="rc-lbl" style="margin:.75rem 0 .375rem">Police</div>
        ${_opt('fontChoice',[['default','Aura'],['inter','Inter'],['modern','Modern'],['serif','Serif'],['mono','Mono']],d)}
        <div class="rc-lbl" style="margin:.75rem 0 .375rem">Fond</div>
        ${_opt('bgMode',[['album','Album'],['color','Couleur'],['dark','Sombre'],['titlecolor','🌈 Titre']],d)}
        <div class="rc-lbl" style="margin:.75rem 0 .375rem">Mouvement</div>
        ${_opt('bgAnimation',[['none','Fixe'],['blobs','Blobs'],['legere','Léger'],['energique','Vif'],['flottante','Flottant']],d)}
        ${_tog('fluidGradient','🌊 Dégradé',d)}${_tog('showGrain','✦ Grain',d)}
        ${_sl('rc-blur','blur','Flou fond',0,120,d)}${_sl('rc-bright','brightness','Luminosité',10,90,d)}${_sl('rc-sat','saturate','Saturation',0,30,d)}${_sl('rc-mqspd','marqueeSpeed','Vitesse texte',10,60,d)}
        <div class="rc-lbl" style="margin:.75rem 0 .375rem">Ambiance Titre-Couleur</div>
        ${_sl('rc-tcbr','titleColorBrightness','Luminosité',10,200,d)}${_sl('rc-tcco','titleColorContrast','Contraste',50,150,d)}
        ${_tog('eqViz','📊 Barres son',d)}${_tog('canvasViz','🌈 Spectre son',d)}
      </div>
      <div class="rc-section">
        <div class="rc-sh">📐 Affichage</div>
        <div class="rc-lbl" style="margin-bottom:.375rem">Vue</div>
        ${_opt('heroLayout',[['standard','Complète'],['minimal','Minimale']],d)}
        <div class="rc-lbl" style="margin:.75rem 0 .375rem">Position</div>
        ${_opt('heroAlign',[['left','← Gauche'],['center','· Centre'],['right','Droite →']],d)}
        <div class="rc-lbl" style="margin:.75rem 0 .375rem">Pochette</div>
        ${_opt('artShape',[['22px','Arrondie'],['50%','Cercle'],['6px','Carré']],d)}
        ${_tog('showGlow','Lueur pochette',d)}${_tog('animatedGlow','✨ Lueur pulsée',d)}
        ${_tog('showArt','Pochette',d)}${_tog('albumAnim','Pochette flottante',d)}
        ${_tog('showBg','Image de fond',d)}${_tog('showAvatar','Photo artiste',d)}
        ${_tog('showMarquee','Texte fond',d)}${_tog('showProgress','Barre de progression',d)}
      </div>
      <div class="rc-section">
        <div class="rc-sh">🎵 Paroles</div>
        <div class="rc-lbl" style="margin-bottom:.375rem">Mode d'affichage</div>
        ${_opt('lyricsRenderMode',[['basic','Static'],['scroll','Scroll'],['phrase','Phrase'],['karaoke','🎤 Karaoke']],d)}
        ${_tog('karaokeProgressiveFill','✨ Progressive fill',d)}
        ${_sl('rc-lsz','lyricsSize','Taille texte',70,160,d)}
        <div class="rc-lbl" style="margin:.75rem 0 .375rem">Police</div>
        ${_opt('lyricsFontChoice',[['serif','Classic'],['sans','Simple'],['mono','Machine'],['display','Impact']],d)}
        ${_tog('lyricsColorAuto','Couleur auto (pochette)',d)}
        ${_cr('lyricsActiveColor','Ligne active',d)}${_cr('lyricsInactiveColor','Autres lignes',d)}
        <div class="rc-lbl" style="margin:.75rem 0 .375rem">Fond paroles</div>
        ${_opt('lyricsBg',[['none','Aucun'],['dark','Sombre'],['custom','Perso'],['auto','🌈 Pochette']],d)}
        ${_sl('rc-lbgop','lyricsBgOpacity','Opacité fond',0,100,d)}
        <div class="rc-lbl" style="margin:.75rem 0 .375rem">Animation texte</div>
        ${_opt('lyricsAnimStyle',[['fade','Fade'],['slide','Slide'],['scale','Zoom'],['blur','Flou'],['bounce','Rebond'],['none','Aucune']],d,true)}
        ${_tog('autoScroll','Suivre la ligne active',d)}
        <div class="rc-lbl" style="margin:.75rem 0 .375rem">Position paroles</div>
        ${_opt('lyricsPosition',[['right','Côté'],['center','Centre'],['bottom','Bas']],d)}
        <div class="rc-lbl" style="margin:.75rem 0 .375rem">Style panel</div>
        ${_opt('lyricsBlurMode',[['standard','Discret'],['apple','🍎 Coloré']],d)}
        ${_sl('rc-loff','lyricsOffset','Décalage (ms)',-2000,2000,d,50)}
        ${_sl('rc-shdop','lyricsShadowOpacity','Ombre intensité',0,100,d)}
        ${_tog('lyricsAutoColor','Couleurs adaptatives',d)}
        <div class="rc-sub-sh" style="margin-top:1.25rem">✦ Points lumineux</div>
        ${_tog('titleDots','Afficher les points',d)}${_cr('dotsColor','Couleur',d)}
        ${_sl('rc-dotsbr','dotsBrightness','Luminosité',10,100,d)}${_sl('rc-dotssz','dotsSize','Taille',10,100,d)}${_sl('rc-dotssp','dotsSpeed','Vitesse',10,100,d)}
        <div class="rc-lbl" style="margin:.75rem 0 .375rem">Style animation</div>
        ${_opt('dotsAnimStyle',[['orbit','Orbite'],['pulse','Pulse'],['wave','Vague'],['sparkle','Étincelle']],d)}
      </div>
    </div>
  </div>`;
}

function rcRenderCodeBadge(code) {
  const el = document.getElementById('rc-display-section'); if (!el) return;
  const hasBc = typeof BroadcastChannel !== 'undefined';
  const hasFb = _fbOK();
  const transport = hasFb ? '🌐 Firebase (cross-réseau)' : hasBc ? '⚡ BroadcastChannel' : '📡 LocalStorage';
  const scope = hasFb ? 'Fonctionne sur tous les appareils.' : 'Fonctionne entre onglets du même navigateur uniquement.';
  const remoteUrl = location.href.split('?')[0] + '?rcmode=remote&code=' + code;
  el.innerHTML = `<div class="rc-code-block">
    <div class="rc-code-label">Code télécommande</div>
    <div class="rc-code-value">${code}</div>
    <div style="display:flex;gap:6px;margin-top:4px">
      <button class="rc-copy-btn" id="rc-copy-btn">Copier le code</button>
      <button class="rc-copy-btn" id="rc-copy-link-btn" style="flex:1">Copier le lien</button>
    </div>
    <p class="rc-code-hint">${transport} — ${scope}${!hasFb ? '<br><span style="opacity:.5">Pour cross-réseau, configurer <code>AURA_RTDB_URL</code> dans remote.js</span>' : ''}</p>
  </div>`;
  document.getElementById('rc-copy-btn')?.addEventListener('click', function() {
    navigator.clipboard.writeText(code).then(() => { this.textContent='✓ Copié!'; setTimeout(()=>{this.textContent='Copier le code';},1500); }).catch(()=>{});
  });
  document.getElementById('rc-copy-link-btn')?.addEventListener('click', function() {
    navigator.clipboard.writeText(remoteUrl).then(() => { this.textContent='✓ Lien copié!'; setTimeout(()=>{this.textContent='Copier le lien';},1500); }).catch(()=>{});
  });
}

function _rcErr(msg) { const el = document.getElementById('rc-error'); if (el) { el.textContent=msg; el.style.opacity='1'; } }
function _rcShowLoading(on) { const btn = document.getElementById('btn-rc-connect'); if (btn) btn.textContent = on ? 'Connexion…' : 'Connecter →'; }

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
    input.addEventListener('input', () => { input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6); if (errorEl) errorEl.style.opacity='0'; });
    input.addEventListener('keydown', e => { if (e.key==='Enter') connectBtn?.click(); });
  }
  if (connectBtn) connectBtn.addEventListener('click', () => { if (input) rcEnterRemote(input.value); });
  const params = new URLSearchParams(location.search);
  if (params.get('rcmode') === 'remote') {
    const code = params.get('code') || '';
    setTimeout(() => { if (input) input.value = code; connectBtn?.click(); }, 800);
  }
})();

window.rcInitDisplay  = rcInitDisplay;
window.rcSchedulePush = rcSchedulePush;
window.rcEnterRemote  = rcEnterRemote;
