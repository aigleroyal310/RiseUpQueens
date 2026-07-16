/* =====================================================
   CLIENT SUPABASE
   -----------------------------------------------------
   Le SDK est chargé via CDN (build UMD) → global `window.supabase`.
   Ce script crée le client partagé `window.sb` utilisé par
   auth.js, cloud.js et track-view.js.

   Ordre de chargement requis dans le HTML :
     1. <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     2. <script src="supabase-config.js"></script>
     3. <script src="supabaseClient.js"></script>
   ===================================================== */
(function () {
  if (!window.supabase || !window.supabase.createClient) {
    console.error('[Supabase] SDK non chargé. Vérifie le <script> CDN @supabase/supabase-js.');
    window.sb = null;
    return;
  }
  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY ||
      window.SUPABASE_URL.indexOf('TON-PROJET') !== -1) {
    console.error('[Supabase] Config manquante. Copie supabase-config.example.js → supabase-config.js et remplis tes clés.');
    window.sb = null;
    return;
  }
  window.sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
})();
