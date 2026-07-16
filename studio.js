/* =====================================================
   TRACK RECORD STUDIO - APP LOGIC
   Standalone editor, separate data model & storage key
   from the classic editor (app.js). Does not read or
   write dragrace.trackrecord.v1.
   ===================================================== */

const STUDIO_STORAGE_KEY = 'dragrace.trackrecord.studio.v1';
const DBLUE = '#0a1f7a';

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return Array.from(document.querySelectorAll(sel)); }
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ===================== DATA ===================== */
function basePlacements() {
  return [
    { id: 'winner',   label: 'WINNER',    color: '#f5c518', fg: '#3a2c00', title: 'Gagnante de la saison' },
    { id: 'runnerup', label: 'RUNNER-UP', color: '#6aa9e0', fg: '#08243f', title: 'Finaliste' },
    { id: 'win',      label: 'WIN',       color: '#3d84cf', fg: '#ffffff', title: "Gagne l'épisode" },
    { id: 'win2',     label: 'WIN×2',     color: '#2f6fb8', fg: '#ffffff', title: 'Double gagnantes' },
    { id: 'high',     label: 'HIGH',      color: '#a9d3f2', fg: '#0a2136', title: 'Dans le haut' },
    { id: 'safe',     label: 'SAFE',      color: '#d2d7dd', fg: '#2a2f36', title: 'Sauve' },
    { id: 'low',      label: 'LOW',       color: '#f4c4b4', fg: '#5a2313', title: 'Dans le bas' },
    { id: 'btm',      label: 'BTM',       color: '#ee885a', fg: '#3a1607', title: 'Derniers (bottom)' },
    { id: 'elim',     label: 'ELIM',      color: '#df4f4a', fg: '#ffffff', title: 'Éliminée' },
    { id: 'guest',    label: 'GUEST',     color: '#c6bbe2', fg: '#241a3a', title: 'Invitée' },
    { id: 'rtrn',     label: 'RTRN',      color: '#a99ad6', fg: '#1f1636', title: 'Retour en compétition' }
  ];
}

function defaultData() {
  const episodes = [];
  for (let i = 1; i <= 8; i++) episodes.push({ id: 'e' + i, name: 'Ép ' + i });
  const queens = [
    { id: 'q1', name: 'Céleste Aubade', age: '24', photo: '' },
    { id: 'q2', name: 'Vénus Delacroix', age: '27', photo: '' },
    { id: 'q3', name: 'Ambre Solaire', age: '22', photo: '' },
    { id: 'q4', name: 'Domino Noir', age: '29', photo: '' },
    { id: 'q5', name: 'Roxy Sauvage', age: '31', photo: '' },
    { id: 'q6', name: 'Gigi Papillon', age: '26', photo: '' }
  ];
  const tr = {
    q1: ['win', 'high', 'win', 'safe', 'high', 'win', 'safe', 'winner'],
    q2: ['high', 'win', 'safe', 'high', 'win', 'high', 'win', 'runnerup'],
    q3: ['safe', 'safe', 'high', 'win', 'low', 'high', 'btm', 'runnerup'],
    q4: ['low', 'safe', 'btm', 'safe', 'win', 'low', 'elim', ''],
    q5: ['btm', 'low', 'safe', 'low', 'btm', 'elim', '', ''],
    q6: ['safe', 'btm', 'elim', '', '', '', '', '']
  };
  const cells = {};
  queens.forEach(q => {
    episodes.forEach((ep, i) => {
      const v = tr[q.id] && tr[q.id][i];
      if (v) cells[q.id + ':' + ep.id] = v;
    });
  });
  return {
    seasonTitle: 'Ma Saison', description: '', showDesc: false, episodes, queens, cells,
    placements: basePlacements(), autoOut: true, autoRank: true, theme: 'dark'
  };
}

function blankData() {
  const episodes = [{ id: 'e' + Date.now(), name: 'Ép 1' }, { id: 'e' + (Date.now() + 1), name: 'Ép 2' }];
  const queens = [{ id: 'q' + Date.now(), name: '', age: '', photo: '' }, { id: 'q' + (Date.now() + 1), name: '', age: '', photo: '' }];
  return {
    seasonTitle: 'Ma Saison', description: '', showDesc: false, episodes, queens, cells: {},
    placements: basePlacements(), autoOut: true, autoRank: true, theme: 'dark'
  };
}

function reconcilePlacements(saved) {
  const base = basePlacements();
  if (!Array.isArray(saved)) return base;
  const baseById = {};
  base.forEach(p => { baseById[p.id] = p; });
  const out = saved.map(p => baseById[p.id] ? Object.assign({}, baseById[p.id]) : p);
  base.forEach(p => { if (!out.some(x => x.id === p.id)) out.push(Object.assign({}, p)); });
  return out;
}

let state = loadState();
state.customLabel = '';
state.customColor = '#c78ee0';
state.menuCell = null;
state.menuPos = { x: 120, y: 120 };
state.exporting = false;

let dragPlacement = null;
let dragEpIndex = null;
let dragQueenId = null;
let rowTops = {};

function loadState() {
  try {
    const raw = localStorage.getItem(STUDIO_STORAGE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && d.queens && d.episodes) {
        d.placements = reconcilePlacements(d.placements);
        return Object.assign(defaultData(), d);
      }
    }
  } catch (e) {}
  return defaultData();
}

function serialize() {
  const { seasonTitle, description, showDesc, episodes, queens, cells, placements, autoOut, autoRank, theme } = state;
  return { seasonTitle, description, showDesc, episodes, queens, cells, placements, autoOut, autoRank, theme };
}

function saveState() {
  try { localStorage.setItem(STUDIO_STORAGE_KEY, JSON.stringify(serialize())); } catch (e) {}
}

function setState(patch) {
  const upd = typeof patch === 'function' ? patch(state) : patch;
  Object.assign(state, upd);
  saveState();
  render();
}

/* ===================== DERIVED DATA ===================== */
function getPlacement(id) { return state.placements.find(p => p.id === id) || null; }

function rankedOrder(s) {
  const info = s.queens.map((q, idx) => {
    let winner = false, runnerup = false, elimIdx = -1;
    s.episodes.forEach((ep, i) => {
      const v = s.cells[q.id + ':' + ep.id];
      if (!v) return;
      if (v === 'winner') winner = true;
      if (v === 'runnerup') runnerup = true;
      if (v === 'elim') elimIdx = i;
    });
    return { id: q.id, idx, winner, runnerup, elimIdx };
  });
  const byIdx = (a, b) => a.idx - b.idx;
  const W = info.filter(x => x.winner).sort(byIdx);
  const R = info.filter(x => !x.winner && x.runnerup).sort(byIdx);
  const A = info.filter(x => !x.winner && !x.runnerup && x.elimIdx < 0).sort(byIdx);
  const E = info.filter(x => !x.winner && !x.runnerup && x.elimIdx >= 0)
    .sort((a, b) => (b.elimIdx - a.elimIdx) || (a.idx - b.idx));
  const order = W.concat(R, A, E);
  const rankById = {};
  order.forEach((x, i) => { rankById[x.id] = i + 1; });
  return { orderIds: order.map(x => x.id), rankById };
}

function sortByRank() {
  const { orderIds } = rankedOrder(state);
  state.queens = orderIds.map(id => state.queens.find(q => q.id === id));
}

// group: 0=winner, 1=runner-up, 2=active, 3=eliminated (elimIdx used as tiebreak within group 3)
function categoryOf(qid) {
  let winner = false, runnerup = false, elimIdx = -1;
  state.episodes.forEach((ep, i) => {
    const v = state.cells[qid + ':' + ep.id];
    if (!v) return;
    if (v === 'winner') winner = true;
    if (v === 'runnerup') runnerup = true;
    if (v === 'elim') elimIdx = i;
  });
  if (winner) return { group: 0, elimIdx: -1 };
  if (runnerup) return { group: 1, elimIdx: -1 };
  if (elimIdx < 0) return { group: 2, elimIdx: -1 };
  return { group: 3, elimIdx };
}
function categoryKey(qid) {
  const c = categoryOf(qid);
  return c.group + ':' + c.elimIdx;
}
function compareCategory(a, b) {
  if (a.group !== b.group) return a.group - b.group;
  if (a.group === 3) return b.elimIdx - a.elimIdx; // more recently eliminated ranks first
  return 0; // ties within winner/runner-up/active: don't impose an order
}
// Moves only the given queen to its correct spot relative to same-category
// neighbors (e.g. among the eliminated, ordered by elimination episode).
// Everyone else's current position — including manually dragged order — is left untouched.
function repositionQueen(qid) {
  const idx = state.queens.findIndex(q => q.id === qid);
  if (idx < 0) return;
  const [q] = state.queens.splice(idx, 1);
  const cat = categoryOf(qid);
  let insertAt = 0;
  for (let i = state.queens.length; i >= 1; i--) {
    if (compareCategory(categoryOf(state.queens[i - 1].id), cat) <= 0) { insertAt = i; break; }
  }
  state.queens.splice(insertAt, 0, q);
}

function contrastFg(hex) {
  const h = (hex || '').replace('#', '');
  if (h.length < 6) return '#20182c';
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#20182c' : '#ffffff';
}

/* ===================== MUTATIONS ===================== */
function setCellValue(qid, eid, pid) {
  const key = qid + ':' + eid;
  const catBefore = state.autoRank ? categoryKey(qid) : null;
  setState(s => {
    const cells = Object.assign({}, s.cells);
    if (pid) cells[key] = pid; else delete cells[key];
    return { cells };
  });
  if (state.autoRank && categoryKey(qid) !== catBefore) { repositionQueen(qid); saveState(); render(); }
}
function applyToMenuCell(pid) {
  const mc = state.menuCell;
  if (!mc) return;
  const key = mc.qid + ':' + mc.eid;
  const catBefore = state.autoRank ? categoryKey(mc.qid) : null;
  const cells = Object.assign({}, state.cells);
  if (pid) cells[key] = pid; else delete cells[key];
  Object.assign(state, { cells, menuCell: null });
  if (state.autoRank && categoryKey(mc.qid) !== catBefore) repositionQueen(mc.qid);
  saveState();
  render();
  if (pid === 'winner') celebrate();
}
function closeMenu() { setState({ menuCell: null }); }

function updateQueen(id, patch) {
  setState(s => ({ queens: s.queens.map(q => q.id === id ? Object.assign({}, q, patch) : q) }));
}
// Mutates in place and skips render() — used for per-keystroke text input handlers
// so the <input> DOM node is never rebuilt (which would drop focus mid-typing).
function updateQueenLight(id, patch) {
  const q = state.queens.find(x => x.id === id);
  if (!q) return;
  Object.assign(q, patch);
  saveState();
}
function removeQueen(id) {
  setState(s => {
    const cells = Object.assign({}, s.cells);
    Object.keys(cells).forEach(k => { if (k.split(':')[0] === id) delete cells[k]; });
    return { queens: s.queens.filter(q => q.id !== id), cells };
  });
}
function addQueen() {
  const id = 'q' + Date.now();
  setState(s => ({ queens: s.queens.concat([{ id, name: '', age: '', photo: '' }]) }));
}
function addEpisode() {
  setState(s => ({ episodes: s.episodes.concat([{ id: 'e' + Date.now(), name: 'Ép ' + (s.episodes.length + 1) }]) }));
}
// No render() on every keystroke — see updateQueenLight.
function renameEpLight(id, name) {
  const ep = state.episodes.find(x => x.id === id);
  if (!ep) return;
  ep.name = name;
  saveState();
}
function removeEp(id) {
  setState(s => {
    const cells = Object.assign({}, s.cells);
    Object.keys(cells).forEach(k => { if (k.split(':')[1] === id) delete cells[k]; });
    return { episodes: s.episodes.filter(e => e.id !== id), cells };
  });
}

function pickPhoto(id) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => updateQueen(id, { photo: r.result });
    r.readAsDataURL(f);
  };
  inp.click();
}

function addCustom() {
  const label = (state.customLabel || '').trim();
  if (!label) return;
  const id = 'c' + Date.now();
  const color = state.customColor;
  const p = { id, label: label.toUpperCase(), color, fg: contrastFg(color), title: label, custom: true };
  setState(s => ({ placements: s.placements.concat([p]), customLabel: '' }));
}
function removePlacement(id) {
  setState(s => {
    const cells = Object.assign({}, s.cells);
    Object.keys(cells).forEach(k => { if (cells[k] === id) delete cells[k]; });
    return { placements: s.placements.filter(p => p.id !== id), cells };
  });
}

function resetAll() {
  if (!window.confirm('Réinitialiser la table ? Tu repars avec 2 candidates vides et 2 épisodes.')) return;
  Object.assign(state, blankData(), { menuCell: null, customLabel: '', customColor: '#c78ee0' });
  saveState();
  render();
}

/* ===================== DRAG / DROP ===================== */
function reorderEpisode(from, to) {
  if (from == null || from === to) return;
  setState(s => {
    const eps = s.episodes.slice();
    const m = eps.splice(from, 1)[0];
    eps.splice(to, 0, m);
    return { episodes: eps };
  });
  dragEpIndex = null;
}
function dropQueen(targetId) {
  const from = dragQueenId;
  dragQueenId = null;
  if (!from || from === targetId) return;
  setState(s => {
    const q = s.queens.slice();
    const fi = q.findIndex(x => x.id === from);
    if (fi < 0) return {};
    const m = q.splice(fi, 1)[0];
    const ti = q.findIndex(x => x.id === targetId);
    q.splice(ti < 0 ? q.length : ti, 0, m);
    return { queens: q };
  });
}

/* ===================== FLIP ROW ANIMATION + CELEBRATION ===================== */
function captureRowTops() {
  const node = $('#trCapture');
  const map = {};
  if (node) node.querySelectorAll('.tr-row[data-qid]').forEach(el => { map[el.getAttribute('data-qid')] = el.getBoundingClientRect().top; });
  return map;
}
function animateReorder() {
  const node = $('#trCapture');
  if (!node) return;
  const prev = rowTops || {};
  const next = {};
  const rankById = state.exporting ? null : rankedOrder(state).rankById;
  node.querySelectorAll('.tr-row[data-qid]').forEach(el => {
    const id = el.getAttribute('data-qid');
    // Read the true resting position before touching transform below —
    // reading it after would capture the transient fake-start offset instead,
    // corrupting the baseline for the next comparison (causes a phantom replay
    // of this animation on the very next unrelated render).
    const newTop = el.getBoundingClientRect().top;
    next[id] = newTop;
    if (state.exporting) return;
    const oldTop = prev[id];
    if (oldTop == null) return;
    const delta = oldTop - newTop;
    if (Math.abs(delta) > 1) {
      el.style.transition = 'none';
      el.style.transform = 'translateY(' + delta + 'px)';
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.transition = 'transform 500ms cubic-bezier(.22,.68,.32,1.25)';
        el.style.transform = '';
      }));
      if (rankById[id] === 1 && delta > 1) {
        const r = el.getBoundingClientRect();
        burstParticles(r.left + Math.min(r.width, 280) / 2, r.top + r.height / 2, { count: 26 });
      }
    }
  });
  rowTops = next;
}

function burstParticles(x, y, opts) {
  const n = (opts && opts.count) || 34;
  const colors = ['#f5c518', '#e59ad4', '#3d84cf', '#ff5fa2', '#ffd23f', '#7ad1ff', '#ffffff'];
  const cont = document.createElement('div');
  cont.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:9998;overflow:hidden;';
  document.body.appendChild(cont);
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div');
    const size = 6 + Math.random() * 7;
    const c = colors[(Math.random() * colors.length) | 0];
    el.style.cssText = 'position:absolute;left:' + x + 'px;top:' + y + 'px;width:' + size + 'px;height:' + (size * 0.5) + 'px;background:' + c + ';border-radius:2px;';
    cont.appendChild(el);
    const ang = Math.random() * Math.PI * 2;
    const vel = 120 + Math.random() * 230;
    const dx = Math.cos(ang) * vel;
    const dy = Math.sin(ang) * vel - 150;
    const rot = Math.random() * 720 - 360;
    const dur = 900 + Math.random() * 750;
    el.animate([
      { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
      { transform: 'translate(' + dx + 'px,' + (dy + 300) + 'px) rotate(' + rot + 'deg)', opacity: 0 }
    ], { duration: dur, easing: 'cubic-bezier(.2,.6,.3,1)', fill: 'forwards' });
  }
  setTimeout(() => cont.remove(), 1800);
}

let celebrating = false;
function celebrate() {
  if (celebrating) return;
  celebrating = true;
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;display:flex;align-items:center;justify-content:center;';
  document.body.appendChild(overlay);
  const txt = document.createElement('div');
  txt.textContent = 'CONDRAGULATIONS';
  txt.style.cssText = "font-family:'Playfair Display',serif;font-weight:800;font-size:min(9vw,116px);letter-spacing:2px;text-align:center;background:linear-gradient(180deg,#fff4bd,#f5c518 46%,#c8890a);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 6px 10px rgba(0,0,0,.35));animation:condrag 3s cubic-bezier(.2,.7,.3,1.2) forwards;transform-style:preserve-3d;";
  overlay.appendChild(txt);
  const w = window.innerWidth, h = window.innerHeight;
  for (let k = 0; k < 5; k++) setTimeout(() => burstParticles(w * (0.14 + 0.18 * k), h * 0.28, { count: 40 }), k * 130);
  setTimeout(() => burstParticles(w * 0.5, h * 0.34, { count: 72 }), 110);
  setTimeout(() => { overlay.remove(); celebrating = false; }, 3200);
}

/* ===================== EXPORT / IMPORT ===================== */
async function capture() {
  const node = $('#trCapture');
  const scroll = $('#trScroll');
  const prev = { max: node.style.maxWidth, ov: scroll ? scroll.style.overflow : '', w: scroll ? scroll.style.width : '' };
  node.style.maxWidth = 'none';
  if (scroll) { scroll.style.overflow = 'visible'; scroll.style.width = 'max-content'; }
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const w = node.scrollWidth, h = node.scrollHeight;
  let url;
  try {
    url = await window.htmlToImage.toPng(node, { pixelRatio: 2, backgroundColor: getComputedStyle(node).backgroundColor, width: w, height: h });
  } finally {
    node.style.maxWidth = prev.max;
    if (scroll) { scroll.style.overflow = prev.ov; scroll.style.width = prev.w; }
  }
  return url;
}
function withExport(fn) {
  state.exporting = true;
  state.menuCell = null;
  render();
  setTimeout(async () => {
    try { await fn(); } catch (e) { console.error(e); alert('Erreur export: ' + e.message); }
    state.exporting = false;
    render();
  }, 60);
}
function exportPng() {
  withExport(async () => {
    const url = await capture();
    const a = document.createElement('a');
    a.download = (state.seasonTitle || 'track-record') + '.png';
    a.href = url; a.click();
  });
}
function exportPdf() {
  withExport(async () => {
    const url = await capture();
    const img = new Image(); img.src = url; await img.decode();
    const jsPDF = window.jspdf.jsPDF;
    const orient = img.width >= img.height ? 'l' : 'p';
    const pdf = new jsPDF({ orientation: orient, unit: 'px', format: [img.width, img.height] });
    pdf.addImage(url, 'PNG', 0, 0, img.width, img.height);
    pdf.save((state.seasonTitle || 'track-record') + '.pdf');
  });
}
function exportJson() {
  const data = JSON.stringify(serialize(), null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.download = (state.seasonTitle || 'track-record') + '.json';
  a.href = url; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function importJson() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'application/json,.json';
  inp.onchange = e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (!d.queens || !d.episodes) throw new Error('bad');
        d.placements = reconcilePlacements(d.placements);
        Object.assign(state, defaultData(), d, { menuCell: null });
        saveState();
        render();
      } catch (err) { window.alert('Fichier invalide.'); }
    };
    r.readAsText(f);
  };
  inp.click();
}

/* ===================== RENDER ===================== */
function render() {
  document.documentElement.dataset.theme = state.theme || 'dark';
  renderHeader();
  renderSidebar();
  renderMain();
  renderMenu();
  animateReorder();
}

function renderHeader() {
  const el = $('#trHeader');
  el.innerHTML = `
    <div class="tr-header-left">
      <div class="tr-logo">TR</div>
      <div class="tr-title-block">
        <input id="hdrTitle" class="tr-title-input" value="${escapeHtml(state.seasonTitle)}" placeholder="Titre de la saison" />
        <span class="tr-subtitle">Éditeur de Track Record</span>
      </div>
    </div>
    <div class="tr-header-right">
      <div class="tr-theme-switch" id="themeSwitch">
        ${[['dark', 'Sombre'], ['light', 'Clair'], ['vibrant', 'Vibrant']].map(([id, label]) =>
          `<button class="tr-theme-btn${state.theme === id ? ' active' : ''}" data-theme-id="${id}">${label}</button>`
        ).join('')}
      </div>
      <button class="tr-btn tr-btn-primary" id="btnExportPng">↓ PNG</button>
      <button class="tr-btn" id="btnExportPdf">↓ PDF</button>
      <button class="tr-btn" id="btnExportJson">Exporter</button>
      <button class="tr-btn" id="btnImportJson">Importer</button>
    </div>
  `;
  $('#hdrTitle').addEventListener('input', e => { state.seasonTitle = e.target.value; saveState(); syncTitleInputs(); });
  $$('#themeSwitch [data-theme-id]').forEach(btn => {
    btn.addEventListener('click', () => setState({ theme: btn.dataset.themeId }));
  });
  $('#btnExportPng').addEventListener('click', exportPng);
  $('#btnExportPdf').addEventListener('click', exportPdf);
  $('#btnExportJson').addEventListener('click', exportJson);
  $('#btnImportJson').addEventListener('click', importJson);
}

function syncTitleInputs() {
  $$('.tr-title-input, .tr-capture-title-input').forEach(inp => {
    if (document.activeElement !== inp) inp.value = state.seasonTitle;
  });
}

function renderSidebar() {
  const el = $('#trSidebar');
  const chips = state.placements.map(p => `
    <div class="tr-chip-wrap">
      <button class="tr-chip" draggable="true" data-chip-id="${p.id}" title="${escapeHtml(p.title || p.label)}" style="background:${p.color};color:${p.fg}">${escapeHtml(p.label)}</button>
      ${p.custom ? `<button class="tr-chip-remove" data-remove-chip="${p.id}" title="Supprimer cette pastille">×</button>` : ''}
    </div>
  `).join('');

  el.innerHTML = `
    <div class="tr-panel">
      <div class="tr-panel-title">Palette</div>
      <div class="tr-hint-text">Glisse une pastille dans une case, ou clique une case pour choisir une position.</div>
      <div class="tr-chip-grid">${chips}</div>
      <div class="tr-custom-row">
        <input class="tr-custom-input" id="customLabel" value="${escapeHtml(state.customLabel)}" placeholder="Pastille perso." />
        <input class="tr-custom-color" id="customColor" type="color" value="${state.customColor}" />
        <button class="tr-btn tr-btn-primary tr-add-custom-btn" id="btnAddCustom">+</button>
      </div>
    </div>

    <div class="tr-panel">
      <div class="tr-panel-title">Édition</div>
      <div class="tr-edit-actions">
        <button class="tr-btn tr-btn-wide" id="btnAddQueen">+ Ajouter une candidate</button>
        <button class="tr-btn tr-btn-wide" id="btnAddEpisode">+ Ajouter un épisode</button>
        <label class="tr-toggle-row">
          <input type="checkbox" class="tr-checkbox" id="toggleAutoRank" ${state.autoRank ? 'checked' : ''} />
          <span>Classement automatique après chaque changement (une candidate éliminée descend au classement). Tu peux toujours glisser-déposer une candidate pour l'ordre d'affichage.</span>
        </label>
        <label class="tr-toggle-row">
          <input type="checkbox" class="tr-checkbox" id="toggleAutoOut" ${state.autoOut ? 'checked' : ''} />
          <span>Cases « OUT » automatiques après une ÉLIM</span>
        </label>
        <label class="tr-toggle-row">
          <input type="checkbox" class="tr-checkbox" id="toggleShowDesc" ${state.showDesc ? 'checked' : ''} />
          <span>Afficher une description sous le titre</span>
        </label>
        <button class="tr-btn tr-btn-danger" id="btnResetAll">Réinitialiser la table</button>
      </div>
    </div>

    <div class="tr-panel">
      <div class="tr-panel-title">Astuces</div>
      <ul class="tr-tips">
        <li>Clique une case pour choisir une position, ou glisse une pastille dedans.</li>
        <li>Survole une case remplie et clique le × pour la vider.</li>
        <li>Le rang se recalcule seul : éliminée en premier = dernière place.</li>
        <li>Clique une photo, un nom ou un titre d'épisode pour le modifier.</li>
      </ul>
    </div>
  `;

  $$('#trSidebar [data-chip-id]').forEach(chip => {
    chip.addEventListener('dragstart', e => {
      dragPlacement = chip.dataset.chipId;
      chip.classList.add('dragging');
      try { e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('text/plain', dragPlacement); } catch (_) {}
    });
    chip.addEventListener('dragend', () => {
      chip.classList.remove('dragging');
      $$('.tr-cell.drag-over').forEach(c => c.classList.remove('drag-over'));
      dragPlacement = null;
    });
  });
  $$('#trSidebar [data-remove-chip]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); removePlacement(btn.dataset.removeChip); });
  });
  $('#customLabel').addEventListener('input', e => { state.customLabel = e.target.value; });
  $('#customColor').addEventListener('input', e => { state.customColor = e.target.value; });
  $('#btnAddCustom').addEventListener('click', addCustom);
  $('#btnAddQueen').addEventListener('click', addQueen);
  $('#btnAddEpisode').addEventListener('click', addEpisode);
  $('#toggleAutoRank').addEventListener('change', e => {
    state.autoRank = e.target.checked;
    if (state.autoRank) sortByRank();
    saveState();
    render();
  });
  $('#toggleAutoOut').addEventListener('change', e => setState({ autoOut: e.target.checked }));
  $('#toggleShowDesc').addEventListener('change', e => setState({ showDesc: e.target.checked }));
  $('#btnResetAll').addEventListener('click', resetAll);
}

function renderMain() {
  const el = $('#trMain');
  const showChrome = !state.exporting;

  // double-WIN detection per episode
  const winCount = {};
  state.episodes.forEach(ep => {
    let c = 0;
    state.queens.forEach(q => { if (state.cells[q.id + ':' + ep.id] === 'win') c++; });
    winCount[ep.id] = c;
  });

  const { rankById } = rankedOrder(state);
  const displayQueens = state.queens;

  const headCells = state.episodes.map((ep, epIdx) => `
    <div class="tr-ep-head" data-ep-idx="${epIdx}" data-ep-id="${ep.id}">
      ${showChrome ? `<span class="tr-ep-handle" draggable="true" data-ep-drag="${epIdx}" title="Glisser pour déplacer l'épisode">↔</span>` : ''}
      <input class="tr-ep-input" data-ep-rename="${ep.id}" value="${escapeHtml(ep.name)}" />
      ${showChrome ? `<button class="tr-ep-remove" data-ep-remove="${ep.id}" title="Supprimer l'épisode">×</button>` : ''}
    </div>
  `).join('');

  const rows = displayQueens.map(q => {
    if (!q) return '';
    let lastIdx = -1, lastVal = null;
    state.episodes.forEach((ep, i) => { const v = state.cells[q.id + ':' + ep.id]; if (v) { lastIdx = i; lastVal = v; } });
    const terminalOut = state.autoOut && lastIdx >= 0 && lastVal === 'elim';

    const cells = state.episodes.map((ep, i) => {
      const pid = state.cells[q.id + ':' + ep.id];
      const p = pid ? getPlacement(pid) : null;
      let bg = 'var(--tr-cell-empty)', fg = 'var(--tr-cell-empty-text)', label = '';
      if (p) {
        bg = p.color; fg = p.fg; label = p.label;
        if (pid === 'win' && winCount[ep.id] >= 2) { bg = DBLUE; fg = '#ffffff'; }
      } else if (terminalOut && i > lastIdx) {
        bg = 'var(--tr-out-bg)'; fg = 'var(--tr-out-text)'; label = 'OUT';
      }
      const isElim = showChrome && pid === 'elim';
      const showClear = showChrome && !!p;
      return `
        <div class="tr-cell" data-qid="${q.id}" data-eid="${ep.id}" style="background:${bg};color:${fg}">
          <span>${escapeHtml(label)}</span>
          ${isElim ? `<span class="tr-sashay">sashay away</span>` : ''}
          ${showClear ? `<button class="tr-cell-clear" data-cell-clear="${q.id}:${ep.id}" title="Vider la case">×</button>` : ''}
        </div>
      `;
    }).join('');

    const showHandle = showChrome;

    return `
      <div class="tr-row" data-qid="${q.id}">
        <div class="tr-rank">${rankById[q.id] || ''}</div>
        <div class="tr-contestant" data-row-drop="${q.id}">
          <div class="tr-contestant-inner">
            ${showHandle ? `<span class="tr-row-handle" draggable="true" data-row-drag="${q.id}" title="Glisser pour réordonner">⋮⋮</span>` : ''}
            <button class="tr-photo" data-photo="${q.id}" title="Changer la photo" style="${q.photo ? `background-image:url('${q.photo}')` : ''}">
              ${!q.photo ? `<span class="tr-photo-init">${escapeHtml((q.name || '?').trim().charAt(0).toUpperCase())}</span>` : ''}
            </button>
            <div class="tr-name-fields">
              <input class="tr-name-input" data-name="${q.id}" value="${escapeHtml(q.name)}" placeholder="Nom" />
              <input class="tr-age-input" data-age="${q.id}" value="${escapeHtml(q.age)}" placeholder="âge" />
            </div>
            ${showChrome ? `<button class="tr-remove-btn" data-remove-queen="${q.id}" title="Supprimer la candidate">×</button>` : ''}
          </div>
        </div>
        ${cells}
      </div>
    `;
  }).join('');

  el.innerHTML = `
    <div class="tr-capture" id="trCapture">
      <div class="tr-capture-header">
        <div class="tr-capture-title-block">
          <input class="tr-capture-title-input" id="captureTitle" value="${escapeHtml(state.seasonTitle)}" placeholder="Titre de la saison" />
          ${state.showDesc ? `<input class="tr-capture-desc" id="captureDesc" value="${escapeHtml(state.description)}" placeholder="Ajoute une description de la saison…" />` : ''}
        </div>
        <span class="tr-capture-tag">TRACK RECORD</span>
      </div>
      <div class="tr-scroll" id="trScroll">
        <div class="tr-grid" id="trGrid">
          <div class="tr-head-row">
            <div class="tr-corner-rank">#</div>
            <div class="tr-corner">Candidate</div>
            ${headCells}
            ${showChrome ? `<div class="tr-add-col"><button class="tr-add-col-btn" id="btnAddColEpisode" title="Ajouter un épisode">+</button></div>` : ''}
          </div>
          ${rows}
        </div>
      </div>
      ${showChrome ? `<button class="tr-btn tr-add-row-btn" id="btnAddRowQueen">+ Ajouter une candidate</button>` : ''}
    </div>
  `;

  bindMainEvents();
}

function bindMainEvents() {
  $('#captureTitle').addEventListener('input', e => { state.seasonTitle = e.target.value; saveState(); syncTitleInputs(); });
  const desc = $('#captureDesc');
  if (desc) desc.addEventListener('input', e => { state.description = e.target.value; saveState(); });

  // episode rename / remove / reorder
  $$('[data-ep-rename]').forEach(inp => {
    inp.addEventListener('input', e => renameEpLight(inp.dataset.epRename, e.target.value));
  });
  $$('[data-ep-remove]').forEach(btn => {
    btn.addEventListener('click', () => removeEp(btn.dataset.epRemove));
  });
  $$('[data-ep-drag]').forEach(handle => {
    handle.addEventListener('dragstart', e => {
      dragEpIndex = Number(handle.dataset.epDrag);
      dragQueenId = null; dragPlacement = null;
      const head = handle.closest('.tr-ep-head');
      if (head) head.classList.add('dragging');
      try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'ep' + dragEpIndex); } catch (_) {}
    });
    handle.addEventListener('dragend', () => {
      $$('.tr-ep-head.dragging').forEach(h => h.classList.remove('dragging'));
      $$('.tr-ep-head.drop-target').forEach(h => h.classList.remove('drop-target'));
      dragEpIndex = null;
    });
  });
  $$('.tr-ep-head').forEach(head => {
    head.addEventListener('dragover', e => {
      if (dragEpIndex != null) {
        e.preventDefault();
        $$('.tr-ep-head.drop-target').forEach(h => { if (h !== head) h.classList.remove('drop-target'); });
        head.classList.add('drop-target');
      }
    });
    head.addEventListener('dragleave', () => head.classList.remove('drop-target'));
    head.addEventListener('drop', e => {
      e.preventDefault();
      $$('.tr-ep-head.dragging').forEach(h => h.classList.remove('dragging'));
      $$('.tr-ep-head.drop-target').forEach(h => h.classList.remove('drop-target'));
      reorderEpisode(dragEpIndex, Number(head.dataset.epIdx));
    });
  });
  const addColBtn = $('#btnAddColEpisode');
  if (addColBtn) addColBtn.addEventListener('click', addEpisode);
  const addRowBtn = $('#btnAddRowQueen');
  if (addRowBtn) addRowBtn.addEventListener('click', addQueen);

  // queen fields
  $$('[data-name]').forEach(inp => inp.addEventListener('input', e => {
    updateQueenLight(inp.dataset.name, { name: e.target.value });
    const initEl = inp.closest('.tr-contestant-inner').querySelector('.tr-photo-init');
    if (initEl) initEl.textContent = (e.target.value || '?').trim().charAt(0).toUpperCase() || '?';
  }));
  $$('[data-age]').forEach(inp => inp.addEventListener('input', e => updateQueenLight(inp.dataset.age, { age: e.target.value })));
  $$('[data-photo]').forEach(btn => btn.addEventListener('click', () => pickPhoto(btn.dataset.photo)));
  $$('[data-remove-queen]').forEach(btn => btn.addEventListener('click', () => removeQueen(btn.dataset.removeQueen)));

  // row drag reorder
  $$('[data-row-drag]').forEach(handle => {
    handle.addEventListener('dragstart', e => {
      dragQueenId = handle.dataset.rowDrag;
      const row = handle.closest('.tr-row');
      if (row) row.classList.add('dragging');
      try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragQueenId); } catch (_) {}
    });
    handle.addEventListener('dragend', () => {
      $$('.tr-row.dragging').forEach(r => r.classList.remove('dragging'));
      $$('.tr-row.drop-target').forEach(r => r.classList.remove('drop-target'));
      dragQueenId = null;
    });
  });
  $$('[data-row-drop]').forEach(zone => {
    const row = zone.closest('.tr-row');
    zone.addEventListener('dragover', e => {
      if (dragQueenId && row && row.dataset.qid !== dragQueenId) {
        e.preventDefault();
        $$('.tr-row.drop-target').forEach(r => { if (r !== row) r.classList.remove('drop-target'); });
        row.classList.add('drop-target');
      }
    });
    zone.addEventListener('dragleave', () => { if (row) row.classList.remove('drop-target'); });
    zone.addEventListener('drop', e => {
      e.preventDefault();
      $$('.tr-row.dragging').forEach(r => r.classList.remove('dragging'));
      $$('.tr-row.drop-target').forEach(r => r.classList.remove('drop-target'));
      dropQueen(zone.dataset.rowDrop);
    });
  });

  // cells: click to open menu, drag/drop chip, clear button
  $$('.tr-cell').forEach(cell => {
    cell.addEventListener('click', e => {
      state.menuCell = { qid: cell.dataset.qid, eid: cell.dataset.eid };
      state.menuPos = { x: e.clientX, y: e.clientY };
      saveState(); render();
    });
    cell.addEventListener('dragover', e => { if (dragPlacement) { e.preventDefault(); cell.classList.add('drag-over'); } });
    cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
    cell.addEventListener('drop', e => {
      e.preventDefault();
      cell.classList.remove('drag-over');
      if (dragPlacement) {
        const dp = dragPlacement;
        setCellValue(cell.dataset.qid, cell.dataset.eid, dp);
        dragPlacement = null;
        if (dp === 'winner') celebrate();
      }
    });
  });
  $$('[data-cell-clear]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const [qid, eid] = btn.dataset.cellClear.split(':');
      setCellValue(qid, eid, null);
    });
  });
}

function renderMenu() {
  const root = $('#trMenuRoot');
  const showChrome = !state.exporting;
  if (!state.menuCell || !showChrome) { root.innerHTML = ''; return; }

  const mp = state.menuPos || { x: 120, y: 120 };
  const vw = window.innerWidth || 1280;
  const vh = window.innerHeight || 800;
  const left = Math.max(10, Math.min(mp.x, vw - 230));
  const top = Math.max(10, Math.min(mp.y, vh - 330));

  const items = state.placements.map(p => `
    <button class="tr-menu-item" data-menu-pid="${p.id}" style="background:${p.color};color:${p.fg}">${escapeHtml(p.label)}</button>
  `).join('');

  root.innerHTML = `
    <div class="tr-menu-backdrop" id="menuBackdrop"></div>
    <div class="tr-menu" style="left:${left}px;top:${top}px;">
      <div class="tr-menu-title">Choisir une position</div>
      <div class="tr-menu-grid">${items}</div>
      <button class="tr-menu-clear" id="btnClearMenuCell">Effacer la case</button>
    </div>
  `;
  $('#menuBackdrop').addEventListener('click', closeMenu);
  $$('[data-menu-pid]').forEach(btn => btn.addEventListener('click', () => applyToMenuCell(btn.dataset.menuPid)));
  $('#btnClearMenuCell').addEventListener('click', () => applyToMenuCell(null));
}

/* ===================== INIT ===================== */
render();
rowTops = captureRowTops();
