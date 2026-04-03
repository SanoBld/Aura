/* AURA Remote Control — remote.js v3
 * ─────────────────────────────────────────────────────────────────────────────
 * Transport unique : BroadcastChannel API (même navigateur, multi-onglets/fenêtres)
 * Fallback          : localStorage polling à 200ms (même origine)
 *
 * ⚠ Fonctionne UNIQUEMENT entre onglets du même navigateur (même machine).
 *   Pour un usage cross-device (téléphone → PC), héberger l'app sur un serveur
 *   commun est suffisant : ouvrir AURA sur PC, copier le lien télécommande, l'ouvrir
 *   sur mobile depuis la même URL (réseau local ou serveur publié).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const RC_LS_PREFIX  = 'aura_rc_ch_';   // préfixe clé localStorage
const RC_LS_POLL_MS = 150;             // intervalle polling fallback (ms)

/* ── État interne ─────────────────────────────────────────────────────────── */
let _rcMode      = null;   // null | 'display' | 'remote'
let _rcCode      = '';
let _rcBC        = null;   // BroadcastChannel instance
let _rcPollTO    = null;   // intervalle localStorage polling
let _rcPushTO    = null;   // debounce timer push display→remote
let _rcSendTO    = null;   // debounce timer send remote→display
let _rcConnDot   = null;
let _rcLastTs    = 0;      // déduplique les messages localStorage
let _rcLastState = null;   // dernier snapshot settings côté remote

const _lsKey = c => RC_LS_PREFIX + c;

/* ── Générateur de code 6 caractères ─────────────────────────────────────── */
function _rcGenCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/* ── Écriture vers tous les canaux disponibles ────────────────────────────── */
function _rcWrite(payload) {
  /* 1. BroadcastChannel — instantané, même navigateur */
  if (_rcBC) { try { _rcBC.postMessage(payload); } catch {} }
  /* 2. localStorage — fallback, même origine */
  try { localStorage.setItem(_lsKey(_rcCode), JSON.stringify(payload)); } catch {}
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODE DISPLAY — l'AURA principal (PC/TV)
   S'annonce et pousse ses settings ; écoute les commandes de la télécommande
═══════════════════════════════════════════════════════════════════════════ */
function rcInitDisplay() {
  _rcCode = localStorage.getItem('aura_rc_code') || _rcGenCode();
  localStorage.setItem('aura_rc_code', _rcCode);
  _rcMode = 'display';

  /* BroadcastChannel — réception commandes */
  if (typeof BroadcastChannel !== 'undefined') {
    _rcBC = new BroadcastChannel('aura_rc_' + _rcCode);
    _rcBC.onmessage = ev => {
      if (ev.data?._from === 'remote') _rcApplyRemoteData(ev.data);
    };
  }

  /* Polling localStorage — réception commandes (_cmd) */
  const _lsInKey = _lsKey(_rcCode + '_cmd');
  _rcPollTO = setInterval(() => {
    try {
      const raw = localStorage.getItem(_lsInKey);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d || d._ts <= _rcLastTs) return;
      _rcLastTs = d._ts;
      if (d._from === 'remote') _rcApplyRemoteData(d);
    } catch {}
  }, RC_LS_POLL_MS);

  /* Délai 50ms pour s'assurer que window.S est initialisé */
  setTimeout(rcPushNow, 50);
  rcRenderCodeBadge(_rcCode);
}

/* Planifie un push debounce (appelé par saveSettings) */
function rcSchedulePush() {
  if (_rcMode !== 'display') return;
  clearTimeout(_rcPushTO);
  _rcPushTO = setTimeout(rcPushNow, 300);
}

/* Push immédiat des settings vers la télécommande */
function rcPushNow() {
  if (_rcMode !== 'display' || !_rcCode || !window.S) return;
  _rcWrite({ ...window.S, _ts: Date.now(), _from: 'display' });
}

/* Applique les données reçues de la télécommande */
function _rcApplyRemoteData(data) {
  const skip = new Set(['_ts', '_from']);
  let changed = false;
  for (const k in data) {
    if (skip.has(k)) continue;
    if (Object.prototype.hasOwnProperty.call(window.S, k) && window.S[k] !== data[k]) {
      window.S[k] = data[k];
      changed = true;
    }
  }
  if (changed) {
    window.applySettings();
    window.saveSettings(true /* noRc — évite la boucle */);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODE REMOTE — l'appareil distant (téléphone, tablette…)
   Se connecte avec le code, contrôle l'AURA display en temps réel
═══════════════════════════════════════════════════════════════════════════ */
async function rcEnterRemote(rawCode) {
  _rcCode = (rawCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (_rcCode.length !== 6) { _rcErr('Code invalide — 6 caractères attendus.'); return; }

  _rcShowLoading(true);

  /* Lecture de l'état initial depuis localStorage */
  let initData = null;
  try {
    const raw = localStorage.getItem(_lsKey(_rcCode));
    if (raw) {
      const d = JSON.parse(raw);
      if (d?._from === 'display') initData = d;
    }
  } catch {}

  if (!initData) {
    _rcShowLoading(false);
    _rcErr('Aucun AURA trouvé avec ce code. Assurez-vous que le lecteur est ouvert dans un autre onglet du même navigateur.');
    return;
  }

  _rcShowLoading(false);
  _rcMode = 'remote';

  /* Masque l'écran de login */
  const loginEl = document.getElementById('s-login');
  if (loginEl) {
    loginEl.classList.add('out');
    setTimeout(() => { loginEl.style.display = 'none'; }, 600);
  }

  /* BroadcastChannel — réception des mises à jour du display */
  if (typeof BroadcastChannel !== 'undefined') {
    _rcBC = new BroadcastChannel('aura_rc_' + _rcCode);
    _rcBC.onmessage = ev => {
      if (ev.data?._from === 'display') _rcSyncPanel(ev.data);
    };
  }

  /* Polling localStorage — fallback sync display→remote */
  _rcPollTO = setInterval(() => {
    try {
      const raw = localStorage.getItem(_lsKey(_rcCode));
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d || d._ts <= _rcLastTs) return;
      _rcLastTs = d._ts;
      if (d._from === 'display') _rcSyncPanel(d);
    } catch {}
  }, RC_LS_POLL_MS);

  _rcShowPanel(initData);
}

/* Envoie un changement de paramètre vers le display */
function _rcSend(key, value) {
  if (_rcMode !== 'remote') return;
  const payload = { ...(_rcLastState || {}), [key]: value, _ts: Date.now(), _from: 'remote' };
  /* BroadcastChannel */
  if (_rcBC) { try { _rcBC.postMessage(payload); } catch {} }
  /* localStorage — clé _cmd pour que le display la lise via polling */
  try { localStorage.setItem(_lsKey(_rcCode + '_cmd'), JSON.stringify(payload)); } catch {}
  if (_rcLastState) _rcLastState[key] = value;
}

/* ═══════════════════════════════════════════════════════════════════════════
   PANEL REMOTE UI
═══════════════════════════════════════════════════════════════════════════ */
function _rcShowPanel(d) {
  _rcLastState = { ...d };
  let panel = document.getElementById('rc-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'rc-panel';
    document.body.appendChild(panel);
  }
  panel.innerHTML = _rcBuildHTML(d);
  panel.classList.add('on');
  _rcConnDot = panel.querySelector('#rc-conn-dot');
  if (_rcConnDot) _rcConnDot.classList.add('on');
  _rcWire(panel);
}

/* Synchronise les contrôles du panel quand le display envoie une mise à jour */
function _rcSyncPanel(data) {
  if (data._ts) _rcLastState = { ...(_rcLastState || {}), ...data };
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
    const v = data[grp.dataset.key];
    if (v === undefined) return;
    grp.querySelectorAll('.rc-opt').forEach(b =>
      b.classList.toggle('active', String(b.dataset.val) === String(v))
    );
  });
  if ('accentColor' in data) {
    panel.querySelectorAll('.rc-swatch').forEach(s =>
      s.classList.toggle('active', s.dataset.color === data.accentColor)
    );
  }
}

/* Câble tous les contrôles du panel */
function _rcWire(panel) {
  /* Déconnexion */
  panel.querySelector('#rc-disc')?.addEventListener('click', () => {
    if (_rcBC) { try { _rcBC.close(); } catch {} _rcBC = null; }
    clearInterval(_rcPollTO);
    _rcMode = null;
    panel.classList.remove('on');
    const loginEl = document.getElementById('s-login');
    if (loginEl) { loginEl.style.display = ''; loginEl.classList.remove('out'); }
  });

  /* Toggles */
  panel.querySelectorAll('.rc-toggle input[data-key]').forEach(el => {
    el.addEventListener('change', () => _rcSend(el.dataset.key, el.checked));
  });

  /* Sliders */
  panel.querySelectorAll('.rc-slider[data-key]').forEach(el => {
    el.addEventListener('input', () => {
      const lbl = panel.querySelector(`.rc-val[data-for="${el.id}"]`);
      if (lbl) lbl.textContent = el.value;
      clearTimeout(_rcSendTO);
      _rcSendTO = setTimeout(() => _rcSend(el.dataset.key, parseInt(el.value)), 60);
    }, { passive: true });
  });

  /* Color pickers */
  panel.querySelectorAll('.rc-color[data-key]').forEach(el => {
    el.addEventListener('input', () => {
      clearTimeout(_rcSendTO);
      _rcSendTO = setTimeout(() => _rcSend(el.dataset.key, el.value), 60);
    });
  });

  /* Option groups */
  panel.querySelectorAll('.rc-opt-grp[data-key]').forEach(grp => {
    grp.querySelectorAll('.rc-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        grp.querySelectorAll('.rc-opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const val = btn.dataset.val;
        _rcSend(grp.dataset.key,
          (isNaN(val) || val.includes('%') || val.includes('px')) ? val : parseInt(val)
        );
      });
    });
  });

  /* Swatches */
  panel.querySelectorAll('.rc-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      panel.querySelectorAll('.rc-swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      _rcSend('accentColor', sw.dataset.color);
    });
  });

  /* Bouton "Appliquer tout" */
  panel.querySelector('#rc-apply-all')?.addEventListener('click', () => {
    if (!_rcLastState) return;
    const payload = { ..._rcLastState, _ts: Date.now(), _from: 'remote' };
    if (_rcBC) { try { _rcBC.postMessage(payload); } catch {} }
    try { localStorage.setItem(_lsKey(_rcCode + '_cmd'), JSON.stringify(payload)); } catch {}
    const btn = panel.querySelector('#rc-apply-all');
    if (btn) {
      btn.textContent = '✓ Appliqué';
      setTimeout(() => { btn.textContent = 'Appliquer tout'; }, 1500);
    }
  });
}

/* ── Helpers pour construire le HTML ────────────────────────────────────── */
const _sw  = (c, n, d) => `<button class="rc-swatch${d.accentColor===c?' active':''}" data-color="${c}" style="background:${c}" title="${n}" aria-label="${n}"></button>`;
const _opt = (grpKey, pairs, d, wrap) => `<div class="rc-opt-grp${wrap?' rc-opt-grp-wrap':''}" data-key="${grpKey}">${pairs.map(([v,l]) => `<button class="rc-opt${String(d[grpKey])===String(v)?' active':''}" data-val="${v}">${l}</button>`).join('')}</div>`;
const _tog = (key, label, d) => `<div class="rc-row"><span class="rc-lbl">${label}</span><label class="rc-toggle" aria-label="${label}"><input type="checkbox" data-key="${key}"${d[key]?' checked':''}><div class="rc-tt"></div><div class="rc-th"></div></label></div>`;
const _sl  = (id, key, label, min, max, d, step) => `<div class="rc-slider-row"><span class="rc-lbl">${label} <span class="rc-val" data-for="${id}">${d[key]??0}</span></span><input id="${id}" class="rc-slider" type="range" min="${min}" max="${max}" step="${step||1}" value="${d[key]??0}" data-key="${key}" aria-label="${label}"/></div>`;
const _cr  = (key, label, d) => `<div class="rc-row"><span class="rc-lbl">${label}</span><input type="color" class="rc-color" data-key="${key}" value="${d[key]||'#ffffff'}" style="width:36px;height:28px;border:none;border-radius:6px;cursor:pointer;background:transparent;padding:0" aria-label="${label}"/></div>`;

function _rcBuildHTML(d) {
  return `<div class="rc-wrap">
    <div class="rc-hdr">
      <div class="rc-hdr-left">
        <span class="rc-wordmark">AURA</span>
        <span class="rc-badge">Télécommande</span>
      </div>
      <div class="rc-hdr-right">
        <span class="rc-dot" id="rc-conn-dot" title="Connecté"></span>
        <span class="rc-code-tag">${_rcCode}</span>
        <button class="rc-disc" id="rc-disc" aria-label="Déconnecter">✕</button>
      </div>
    </div>
    <div class="rc-body">
      <button class="rc-apply-all-btn" id="rc-apply-all" aria-label="Appliquer tous les réglages">Appliquer tout</button>

      <!-- APPARENCE -->
      <div class="rc-section">
        <div class="rc-sh">🎨 Apparence</div>
        <div class="rc-lbl" style="margin-bottom:.5rem">Couleur accent</div>
        <div class="rc-swatches" role="group" aria-label="Couleur accent">
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

      <!-- AFFICHAGE -->
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

      <!-- PAROLES -->
      <div class="rc-section">
        <div class="rc-sh">🎵 Paroles</div>
        <div class="rc-lbl" style="margin-bottom:.375rem">Mode d'affichage</div>
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
        <div class="rc-lbl" style="margin:.75rem 0 .375rem">Fond paroles</div>
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
      </div>
    </div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   BADGE CODE — dans l'onglet Connexion des settings (mode display)
═══════════════════════════════════════════════════════════════════════════ */
function rcRenderCodeBadge(code) {
  const el = document.getElementById('rc-display-section');
  if (!el) return;
  const hasBc = typeof BroadcastChannel !== 'undefined';
  const transport = hasBc ? '⚡ BroadcastChannel' : '📡 LocalStorage';
  const remoteUrl = location.href.split('?')[0] + '?rcmode=remote&code=' + code;

  el.innerHTML = `
    <div class="rc-code-block">
      <div class="rc-code-label">Code télécommande</div>
      <div class="rc-code-value" aria-label="Code : ${code}">${code}</div>
      <div style="display:flex;gap:6px;margin-top:6px">
        <button class="rc-copy-btn" id="rc-copy-btn">Copier le code</button>
        <button class="rc-copy-btn" id="rc-copy-link-btn" style="flex:1">Copier le lien</button>
      </div>
      <p class="rc-code-hint">
        ${transport} — Fonctionne entre onglets du même navigateur.<br>
        <span style="opacity:.55;font-size:.65rem">Pour utiliser sur mobile, ouvrez le lien dans un nouvel onglet sur le même réseau (ex : via votre serveur local).</span>
      </p>
    </div>`;

  document.getElementById('rc-copy-btn')?.addEventListener('click', function () {
    navigator.clipboard.writeText(code)
      .then(() => { this.textContent = '✓ Copié !'; setTimeout(() => { this.textContent = 'Copier le code'; }, 1500); })
      .catch(() => {});
  });
  document.getElementById('rc-copy-link-btn')?.addEventListener('click', function () {
    navigator.clipboard.writeText(remoteUrl)
      .then(() => { this.textContent = '✓ Lien copié !'; setTimeout(() => { this.textContent = 'Copier le lien'; }, 1500); })
      .catch(() => {});
  });
}

/* ── Helpers UI ─────────────────────────────────────────────────────────── */
function _rcErr(msg) {
  const el = document.getElementById('rc-error');
  if (el) { el.textContent = msg; el.style.opacity = '1'; }
}
function _rcShowLoading(on) {
  const btn = document.getElementById('btn-rc-connect');
  if (btn) btn.textContent = on ? 'Connexion…' : 'Connecter →';
}

/* ── Init login card ─────────────────────────────────────────────────────── */
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
    input.addEventListener('input', () => {
      input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      if (errorEl) errorEl.style.opacity = '0';
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') connectBtn?.click(); });
  }
  if (connectBtn) {
    connectBtn.addEventListener('click', () => { if (input) rcEnterRemote(input.value); });
  }

  /* Auto-connexion via URL param ?rcmode=remote&code=XXXXXX */
  const params = new URLSearchParams(location.search);
  if (params.get('rcmode') === 'remote') {
    const code = params.get('code') || '';
    setTimeout(() => {
      if (input) input.value = code;
      connectBtn?.click();
    }, 800);
  }
})();

/* ── Exports ────────────────────────────────────────────────────────────── */
window.rcInitDisplay  = rcInitDisplay;
window.rcSchedulePush = rcSchedulePush;
window.rcEnterRemote  = rcEnterRemote;
