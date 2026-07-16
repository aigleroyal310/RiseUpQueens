/* =====================================================
   uiPopover — petit gestionnaire de popover partagé.
   Un seul popover ouvert à la fois, ancré sous un élément,
   style Canva (voir .ac-popover dans account.css).
   Fermeture : clic extérieur, Échap, resize.

   Les boutons déclencheurs doivent porter l'attribut
   [data-pop-trigger] pour que le clic extérieur les ignore
   (ils gèrent eux-mêmes l'ouverture/toggle).
   ===================================================== */
(function () {
  let current = null; // { el, id }

  function close() {
    if (current) { current.el.remove(); current = null; }
  }

  function open(anchor, id, build) {
    if (current && current.id === id) { close(); return null; } // même bouton → toggle
    close();
    const el = document.createElement('div');
    el.className = 'ac-popover';
    el.setAttribute('data-popover', id);
    document.body.appendChild(el);
    try { build(el); } catch (e) { console.error(e); }
    position(el, anchor);
    current = { el, id };
    return el;
  }

  function position(el, anchor) {
    const r = anchor.getBoundingClientRect();
    const w = el.offsetWidth || 260;
    let left = r.right - w;               // aligné à droite du bouton
    if (left < 8) left = 8;
    if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
    el.style.top = (r.bottom + 8) + 'px';
    el.style.left = left + 'px';
  }

  document.addEventListener('click', (e) => {
    if (!current) return;
    if (current.el.contains(e.target)) return;                       // clic dans le popover
    if (e.target.closest && e.target.closest('[data-pop-trigger]')) return; // clic sur un déclencheur
    close();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  window.addEventListener('resize', close);

  window.uiPopover = {
    open: open,
    close: close,
    currentId: () => (current ? current.id : null),
    getEl: () => (current ? current.el : null)
  };
})();
