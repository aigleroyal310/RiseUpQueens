/* =====================================================
   TRACK-VIEW — page publique en lecture seule (/track/:id).
   Charge un track record par son id. Grâce à la RLS, l'accès
   anonyme ne réussit QUE si is_public = true ; les données
   privées des utilisateurs restent inaccessibles.
   ===================================================== */
(function () {
  const root = document.getElementById('trackRoot');
  const DBLUE = '#0a1f7a';

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // id depuis ?id=... ou depuis un chemin /track/:id (si rewrite serveur).
  function getTrackId() {
    const q = new URLSearchParams(location.search).get('id');
    if (q) return q.trim();
    const m = location.pathname.match(/\/track\/([^/?#]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function fail(html) { root.className = 'ac-center'; root.innerHTML = html; }

  if (!window.sb) { return fail('Supabase n\'est pas configuré sur cette page.'); }

  const id = getTrackId();
  if (!id) { return fail('Aucun identifiant de track record dans l\'URL.<br>Format attendu : <code>track.html?id=…</code>'); }

  loadTrack(id);

  async function loadTrack(trackId) {
    const { data, error } = await window.sb
      .from('trackrecords')
      .select('id, title, data, user_id, is_public')
      .eq('id', trackId)
      .maybeSingle();

    if (error) {
      // 22P02 = uuid invalide
      if (error.code === '22P02') return fail('Lien invalide.');
      return fail('Impossible de charger ce track record.');
    }
    if (!data) {
      // Soit l'id n'existe pas, soit il n'est pas public → la RLS renvoie 0 ligne.
      return fail('Ce track record n\'existe pas ou n\'est pas partagé publiquement.');
    }

    // Nom du créateur (lecture publique des profils autorisée par la RLS).
    let author = '';
    const { data: prof } = await window.sb
      .from('profiles').select('username').eq('id', data.user_id).maybeSingle();
    if (prof && prof.username) author = prof.username;

    render(data.data || {}, data.title || 'Track Record', author);
  }

  // ---- Classement (copie de la logique de studio.js, en lecture seule) ----
  function rankedOrder(s) {
    const info = (s.queens || []).map((q, idx) => {
      let winner = false, runnerup = false, elimIdx = -1;
      (s.episodes || []).forEach((ep, i) => {
        const v = s.cells && s.cells[q.id + ':' + ep.id];
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
    const rankById = {};
    W.concat(R, A, E).forEach((x, i) => { rankById[x.id] = i + 1; });
    return rankById;
  }

  function render(s, title, author) {
    document.documentElement.dataset.theme = s.theme || 'dark';
    const episodes = s.episodes || [];
    const queens = s.queens || [];
    const cells = s.cells || {};
    const placements = s.placements || [];
    const placementById = {};
    placements.forEach(p => { placementById[p.id] = p; });

    const winCount = {};
    episodes.forEach(ep => {
      let c = 0;
      queens.forEach(q => { if (cells[q.id + ':' + ep.id] === 'win') c++; });
      winCount[ep.id] = c;
    });

    const rankById = rankedOrder(s);

    const headCells = episodes.map(ep =>
      `<div class="tr-ep-head"><input class="tr-ep-input" value="${escapeHtml(ep.name)}" readonly tabindex="-1" /></div>`
    ).join('');

    const rows = queens.map(q => {
      let lastIdx = -1, lastVal = null;
      episodes.forEach((ep, i) => { const v = cells[q.id + ':' + ep.id]; if (v) { lastIdx = i; lastVal = v; } });
      const terminalOut = s.autoOut && lastIdx >= 0 && lastVal === 'elim';

      const cellHtml = episodes.map((ep, i) => {
        const pid = cells[q.id + ':' + ep.id];
        const p = pid ? placementById[pid] : null;
        let bg = 'var(--tr-cell-empty)', fg = 'var(--tr-cell-empty-text)', label = '';
        if (p) {
          bg = p.color; fg = p.fg; label = p.label;
          if (pid === 'win' && winCount[ep.id] >= 2) { bg = DBLUE; fg = '#ffffff'; }
        } else if (terminalOut && i > lastIdx) {
          bg = 'var(--tr-out-bg)'; fg = 'var(--tr-out-text)'; label = 'OUT';
        }
        return `<div class="tr-cell" style="background:${bg};color:${fg}"><span>${escapeHtml(label)}</span></div>`;
      }).join('');

      const initial = escapeHtml((q.name || '?').trim().charAt(0).toUpperCase() || '?');
      const photoStyle = q.photo ? `background-image:url('${escapeHtml(q.photo)}')` : '';
      return `
        <div class="tr-row">
          <div class="tr-rank">${rankById[q.id] || ''}</div>
          <div class="tr-contestant">
            <div class="tr-contestant-inner">
              <span class="tr-photo" style="${photoStyle}">${q.photo ? '' : `<span class="tr-photo-init">${initial}</span>`}</span>
              <div class="tr-name-fields">
                <div class="tr-name-input" style="font-weight:700">${escapeHtml(q.name || '')}</div>
                ${q.age ? `<div class="tr-age-input">${escapeHtml(q.age)}</div>` : ''}
              </div>
            </div>
          </div>
          ${cellHtml}
        </div>`;
    }).join('');

    root.className = '';
    root.innerHTML = `
      <div class="tr-capture">
        <div class="tr-capture-header">
          <div class="tr-capture-title-block">
            <div class="tr-capture-title-input" style="font-family:'Playfair Display',serif;font-weight:800">${escapeHtml(title)}</div>
            ${s.showDesc && s.description ? `<div class="tr-capture-desc">${escapeHtml(s.description)}</div>` : ''}
            ${author ? `<div class="tr-capture-desc">par ${escapeHtml(author)}</div>` : ''}
          </div>
          <span class="tr-capture-tag">TRACK RECORD</span>
        </div>
        <div class="tr-scroll">
          <div class="tr-grid">
            <div class="tr-head-row">
              <div class="tr-corner-rank">#</div>
              <div class="tr-corner">Candidate</div>
              ${headCells}
            </div>
            ${rows}
          </div>
        </div>
      </div>`;
  }
})();
