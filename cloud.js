/* =====================================================
   CLOUD — sauvegarde / liste / partage / suppression des track records.
   Deux popovers ancrés dans le header (via uiPopover) :
     • #btnShare   → "Partager" : télécharger PNG/PDF + copier le lien public
     • #btnAccount → "Compte"   : enregistrer, lister, public/privé, supprimer
   Toutes les écritures passent par Supabase ; la RLS garantit qu'on ne
   touche que ses propres lignes. Un track privé (is_public=false) n'est
   plus lisible via track.html?id=... par quelqu'un d'autre (policy RLS).
   ===================================================== */
(function () {
  const CURRENT_KEY = 'dragrace.studio.cloud.currentId';
  let currentId = localStorage.getItem(CURRENT_KEY) || null;

  function setCurrentId(id) {
    currentId = id;
    if (id) localStorage.setItem(CURRENT_KEY, id); else localStorage.removeItem(CURRENT_KEY);
  }
  function user() { return window.trAuth ? window.trAuth.getUser() : null; }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function shareUrlFor(id) {
    const base = location.href.replace(/[^/]*$/, ''); // dossier courant
    return base + 'track.html?id=' + id;
  }
  function copyToClipboard(t) { if (navigator.clipboard) navigator.clipboard.writeText(t).catch(() => {}); }

  // =====================================================
  // Partage : enregistre si besoin, passe en public, renvoie l'URL
  // =====================================================
  async function shareCurrent() {
    if (!window.sb) return { error: 'Cloud non configuré.' };
    const u = user(); if (!u) return { needAuth: true };
    if (!window.trStudio) return { error: 'Éditeur indisponible.' };
    const data = window.trStudio.getData();
    const title = window.trStudio.getTitle();
    if (!currentId) {
      const { data: row, error } = await window.sb.from('trackrecords')
        .insert({ user_id: u.id, title, data, is_public: true }).select('id').single();
      if (error) return { error: error.message };
      setCurrentId(row.id);
    } else {
      const { error } = await window.sb.from('trackrecords')
        .update({ title, data, is_public: true }).eq('id', currentId);
      if (error) return { error: error.message };
    }
    return { url: shareUrlFor(currentId) };
  }
  window.trCloud = { shareCurrent: shareCurrent, shareUrlFor: shareUrlFor };

  // =====================================================
  // Popover PARTAGER (#btnShare)
  // =====================================================
  function openSharePopover(anchor) {
    window.uiPopover.open(anchor, 'share', (el) => {
      el.innerHTML = `
        <div class="ac-pop-section">
          <div class="ac-pop-title">Télécharger</div>
          <div class="ac-pop-row">
            <button class="ac-pop-btn" id="popPng">🖼 PNG</button>
            <button class="ac-pop-btn" id="popPdf">📄 PDF</button>
          </div>
        </div>
        <div class="ac-pop-divider"></div>
        <div class="ac-pop-section">
          <div class="ac-pop-title">Copier le lien</div>
          <div id="popShareBody"></div>
        </div>`;
      el.querySelector('#popPng').addEventListener('click', () => { if (window.trStudio) window.trStudio.exportPng(); });
      el.querySelector('#popPdf').addEventListener('click', () => { if (window.trStudio) window.trStudio.exportPdf(); });
      renderShareBody(el.querySelector('#popShareBody'));
    });
  }

  function renderShareBody(body) {
    if (!body) return;
    if (!window.sb) { body.innerHTML = `<div class="ac-pop-note">Cloud non configuré.</div>`; return; }
    if (!user()) {
      body.innerHTML =
        `<div class="ac-pop-note">Connecte-toi pour générer un lien public.</div>
         <button class="ac-pop-btn ac-full" id="popGoLogin" style="margin-top:8px">Se connecter</button>`;
      body.querySelector('#popGoLogin').addEventListener('click', (e) => {
        // stopPropagation : sinon ce même clic remonte au handler global de
        // uiPopover et referme aussitôt le popover auth qu'on vient d'ouvrir.
        e.stopPropagation();
        window.uiPopover.close();
        const b = document.getElementById('btnLogin');
        if (b && window.trAuth) window.trAuth.openPopover(b);
      });
      return;
    }
    body.innerHTML = `<button class="ac-pop-btn ac-primary ac-full" id="popMakeLink">Créer le lien de partage</button>`;
    body.querySelector('#popMakeLink').addEventListener('click', () => onMakeLink(body));
  }

  async function onMakeLink(body) {
    const btn = body.querySelector('#popMakeLink');
    btn.disabled = true; btn.textContent = 'Création…';
    const res = await shareCurrent();
    if (res.needAuth) { renderShareBody(body); return; }
    if (res.error) {
      btn.disabled = false; btn.textContent = 'Réessayer';
      body.insertAdjacentHTML('beforeend', `<div class="ac-pop-note err" style="margin-top:8px">${esc(res.error)}</div>`);
      return;
    }
    body.innerHTML = `
      <div class="ac-pop-share">
        <input type="text" id="popUrl" readonly value="${esc(res.url)}" />
        <button id="popCopy">Copier</button>
      </div>
      <div class="ac-pop-note ok" style="margin-top:8px">Lien public en lecture seule ✓</div>`;
    const input = body.querySelector('#popUrl');
    input.focus(); input.select();
    copyToClipboard(res.url);
    body.querySelector('#popCopy').addEventListener('click', () => {
      input.select(); copyToClipboard(input.value);
      body.querySelector('#popCopy').textContent = 'Copié ✓';
    });
  }

  // =====================================================
  // Popover COMPTE (#btnAccount)
  // =====================================================
  function openAccountPopover(anchor) {
    window.uiPopover.open(anchor, 'account', (el) => {
      el.classList.add('ac-pop-wide');
      renderAccount(el);
    });
  }

  function renderAccount(el) {
    const u = user();
    const name = window.trAuth ? window.trAuth.getDisplayName() : null;
    el.innerHTML = `
      <div class="ac-pop-section">
        <div class="ac-pop-title">Compte</div>
        <div class="ac-pop-note">Connecté : <b>${esc(name || (u && u.email) || '')}</b></div>
        <button class="ac-pop-btn ac-full" id="acLogout" style="margin-top:8px">Se déconnecter</button>
      </div>
      <div class="ac-pop-divider"></div>
      <div class="ac-pop-section">
        <div class="ac-pop-title">Mes track records</div>
        <button class="ac-pop-btn ac-primary ac-full" id="acSaveNew">💾 Enregistrer le track courant</button>
        <button class="ac-pop-btn ac-full" id="acUpdate" ${currentId ? '' : 'disabled'}>⟳ Mettre à jour le track courant</button>
        <div class="ac-pop-note" id="acMsg" style="display:none"></div>
        <ul class="ac-pop-list" id="acList"><li class="ac-empty">Chargement…</li></ul>
      </div>`;
    el.querySelector('#acLogout').addEventListener('click', async () => { await window.trAuth.signOut(); window.uiPopover.close(); });
    el.querySelector('#acSaveNew').addEventListener('click', () => saveNew(el));
    el.querySelector('#acUpdate').addEventListener('click', () => updateCurrent(el));
    loadList(el);
  }

  function acMsg(el, text, kind) {
    const m = el.querySelector('#acMsg');
    if (m) { m.style.display = 'block'; m.textContent = text; m.className = 'ac-pop-note ' + (kind || ''); }
  }

  async function saveNew(el) {
    const u = user(); if (!u) return;
    const data = window.trStudio.getData();
    const title = window.trStudio.getTitle();
    const { data: row, error } = await window.sb.from('trackrecords')
      .insert({ user_id: u.id, title, data }).select('id').single();
    if (error) return acMsg(el, 'Erreur : ' + error.message, 'err');
    setCurrentId(row.id);
    acMsg(el, 'Enregistré ✓', 'ok');
    renderAccount(el);
  }

  async function updateCurrent(el) {
    if (!currentId) return;
    const data = window.trStudio.getData();
    const title = window.trStudio.getTitle();
    const { error } = await window.sb.from('trackrecords').update({ title, data }).eq('id', currentId);
    if (error) return acMsg(el, 'Erreur : ' + error.message, 'err');
    acMsg(el, 'Mis à jour ✓', 'ok');
  }

  async function loadList(el) {
    const list = el.querySelector('#acList');
    const { data, error } = await window.sb.from('trackrecords')
      .select('id, title, is_public, updated_at').order('updated_at', { ascending: false });
    if (error) { list.innerHTML = `<li class="ac-empty">Erreur : ${esc(error.message)}</li>`; return; }
    if (!data.length) { list.innerHTML = `<li class="ac-empty">Aucun track record enregistré.</li>`; return; }
    list.innerHTML = '';
    data.forEach(row => {
      const li = document.createElement('li');
      li.className = 'ac-li';
      const isCurrent = row.id === currentId;
      li.innerHTML = `
        <div class="ac-li-head">
          <span class="ac-li-title">${esc(row.title || 'Sans titre')}${isCurrent ? ' •' : ''}</span>
          <span class="ac-li-badge ${row.is_public ? 'pub' : 'priv'}">${row.is_public ? 'PUBLIC' : 'PRIVÉ'}</span>
        </div>
        <div class="ac-li-actions">
          <button data-open="${row.id}">Ouvrir</button>
          <button data-toggle="${row.id}" data-pub="${row.is_public ? '1' : '0'}">${row.is_public ? 'Rendre privé' : 'Rendre public'}</button>
          ${row.is_public ? `<button data-copy="${row.id}">Copier le lien</button>` : ''}
          <button data-del="${row.id}" class="ac-del">Supprimer</button>
        </div>`;
      list.appendChild(li);
    });
    list.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => loadOne(el, b.dataset.open)));
    list.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', () => togglePublic(el, b.dataset.toggle, b.dataset.pub !== '1')));
    // "Copier le lien" : présent uniquement pour les tracks publics. Quand on
    // repasse en privé, togglePublic() rappelle loadList() et le bouton disparaît.
    list.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', () => {
      copyToClipboard(shareUrlFor(b.dataset.copy));
      const original = b.textContent;
      b.textContent = 'Lien copié ✓';
      setTimeout(() => { if (b.isConnected) b.textContent = original; }, 1500);
    }));
    list.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => delOne(el, b.dataset.del)));
  }

  async function loadOne(el, id) {
    const { data, error } = await window.sb.from('trackrecords').select('data').eq('id', id).single();
    if (error) return acMsg(el, 'Erreur : ' + error.message, 'err');
    window.trStudio.setData(data.data || {});
    setCurrentId(id);
    acMsg(el, 'Chargé dans l\'éditeur ✓', 'ok');
    renderAccount(el);
  }

  // Bascule is_public. Privé → le lien track.html?id=... cesse d'être
  // lisible par autrui (la policy RLS "select_public" exige is_public=true).
  async function togglePublic(el, id, makePublic) {
    const { error } = await window.sb.from('trackrecords').update({ is_public: makePublic }).eq('id', id);
    if (error) return acMsg(el, 'Erreur : ' + error.message, 'err');
    acMsg(el, makePublic ? 'Rendu public ✓' : 'Rendu privé ✓ — lien désactivé', 'ok');
    loadList(el);
  }

  async function delOne(el, id) {
    if (!window.confirm('Supprimer définitivement ce track record de la base ?')) return;
    const { error } = await window.sb.from('trackrecords').delete().eq('id', id);
    if (error) return acMsg(el, 'Erreur : ' + error.message, 'err');
    if (id === currentId) setCurrentId(null);
    acMsg(el, 'Supprimé ✓', 'ok');
    renderAccount(el);
  }

  // =====================================================
  // Déclencheurs (délégation : boutons recréés à chaque re-render du header)
  // =====================================================
  document.addEventListener('click', (e) => {
    if (!e.target.closest) return;
    const share = e.target.closest('#btnShare');
    if (share) { openSharePopover(share); return; }
    const account = e.target.closest('#btnAccount');
    if (account) { openAccountPopover(account); return; }
  });

  // Déconnexion pendant que le popover Compte est ouvert → on le ferme.
  if (window.trAuth && window.trAuth.onChange) {
    window.trAuth.onChange((u) => {
      if (!u && window.uiPopover && window.uiPopover.currentId() === 'account') window.uiPopover.close();
    });
  }
})();
