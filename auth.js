/* =====================================================
   AUTH — état de session + popover connexion/inscription.
   Même logique qu'avant (Supabase Auth, username en metadata
   → trigger SQL crée la ligne profiles), affichée en popover.

   Expose window.trAuth :
     getUser()         -> user Supabase ou null
     getDisplayName()  -> username (ou null)
     onChange(cb)      -> abonnement (cb(user, username))
     signOut()
     openPopover(anchor)
   ===================================================== */
(function () {
  let currentUser = null;
  let username = null;
  const listeners = [];

  function notify() {
    listeners.forEach(cb => { try { cb(currentUser, username); } catch (e) {} });
  }

  async function loadUsername(user) {
    if (!user) { username = null; return; }
    username = (user.user_metadata && user.user_metadata.username) || null;
    if (window.sb) {
      const { data } = await window.sb.from('profiles').select('username').eq('id', user.id).maybeSingle();
      if (data && data.username) username = data.username;
    }
  }

  async function handleSession(session) {
    currentUser = session ? session.user : null;
    await loadUsername(currentUser);
    notify();
    if (window.trStudio && window.trStudio.renderHeader) window.trStudio.renderHeader();
  }

  if (window.sb) {
    window.sb.auth.getSession().then(({ data }) => handleSession(data.session));
    window.sb.auth.onAuthStateChange((_e, session) => handleSession(session));
  }

  // ---------------- Popover ----------------
  function openPopover(anchor) {
    if (!window.uiPopover) return;
    window.uiPopover.open(anchor, 'auth', (el) => {
      el.classList.add('ac-pop-auth');
      el.innerHTML = `
        <div class="ac-pop-tabs">
          <button class="ac-pop-tab active" data-tab="login">Connexion</button>
          <button class="ac-pop-tab" data-tab="signup">Inscription</button>
        </div>
        <form id="apLogin">
          <label class="ac-pop-label">Email</label>
          <input class="ac-pop-input" type="email" id="apLoginEmail" autocomplete="email" required />
          <label class="ac-pop-label">Mot de passe</label>
          <input class="ac-pop-input" type="password" id="apLoginPassword" autocomplete="current-password" required />
          <button class="ac-pop-btn ac-primary ac-full" type="submit" id="apLoginBtn">Se connecter</button>
        </form>
        <form id="apSignup" class="ac-hidden">
          <label class="ac-pop-label">Nom d'utilisateur</label>
          <input class="ac-pop-input" type="text" id="apSignupUsername" autocomplete="username" required />
          <label class="ac-pop-label">Email</label>
          <input class="ac-pop-input" type="email" id="apSignupEmail" autocomplete="email" required />
          <label class="ac-pop-label">Mot de passe</label>
          <input class="ac-pop-input" type="password" id="apSignupPassword" autocomplete="new-password" required />
          <button class="ac-pop-btn ac-primary ac-full" type="submit" id="apSignupBtn">Créer mon compte</button>
        </form>
        <div class="ac-pop-note" id="apMsg" style="display:none"></div>`;
      wire(el);
    });
  }

  function wire(el) {
    const q = (s) => el.querySelector(s);
    const msg = (t, kind) => {
      const m = q('#apMsg');
      m.style.display = 'block';
      m.textContent = t;
      m.className = 'ac-pop-note ' + (kind || '');
    };
    const clearMsg = () => { const m = q('#apMsg'); m.style.display = 'none'; };

    el.querySelectorAll('.ac-pop-tab').forEach(tab => tab.addEventListener('click', () => {
      const login = tab.dataset.tab === 'login';
      el.querySelectorAll('.ac-pop-tab').forEach(t => t.classList.toggle('active', t === tab));
      q('#apLogin').classList.toggle('ac-hidden', !login);
      q('#apSignup').classList.toggle('ac-hidden', login);
      clearMsg();
    }));

    if (!window.sb) { msg('Cloud non configuré.', 'err'); return; }

    // --- Connexion ---
    q('#apLogin').addEventListener('submit', async (e) => {
      e.preventDefault(); clearMsg();
      const email = q('#apLoginEmail').value.trim();
      const password = q('#apLoginPassword').value;
      const btn = q('#apLoginBtn'); btn.disabled = true; btn.textContent = 'Connexion…';
      const { error } = await window.sb.auth.signInWithPassword({ email, password });
      btn.disabled = false; btn.textContent = 'Se connecter';
      if (error) return msg(translateError(error.message), 'err');
      window.uiPopover.close(); // succès → onAuthStateChange met à jour le header
    });

    // --- Inscription ---
    q('#apSignup').addEventListener('submit', async (e) => {
      e.preventDefault(); clearMsg();
      const uname = q('#apSignupUsername').value.trim();
      const email = q('#apSignupEmail').value.trim();
      const password = q('#apSignupPassword').value;

      if (!/^[a-zA-Z0-9_]{3,20}$/.test(uname)) return msg('Nom d\'utilisateur invalide (3–20 : lettres, chiffres, _).', 'err');
      if (password.length < 6) return msg('Mot de passe : 6 caractères minimum.', 'err');

      const btn = q('#apSignupBtn'); btn.disabled = true; btn.textContent = 'Création…';

      const { data: taken, error: checkErr } = await window.sb
        .from('profiles').select('id').eq('username', uname).maybeSingle();
      if (checkErr) { btn.disabled = false; btn.textContent = 'Créer mon compte'; return msg('Erreur : ' + checkErr.message, 'err'); }
      if (taken) { btn.disabled = false; btn.textContent = 'Créer mon compte'; return msg('Ce nom d\'utilisateur est déjà pris.', 'err'); }

      const { data, error } = await window.sb.auth.signUp({
        email, password, options: { data: { username: uname } }
      });
      btn.disabled = false; btn.textContent = 'Créer mon compte';
      if (error) return msg(translateError(error.message), 'err');

      if (!data.session) {
        msg('Compte créé ! Vérifie ta boîte mail pour confirmer, puis connecte-toi.', 'ok');
      } else {
        window.uiPopover.close();
      }
    });
  }

  function translateError(m) {
    if (/Invalid login credentials/i.test(m)) return 'Email ou mot de passe incorrect.';
    if (/already registered/i.test(m)) return 'Un compte existe déjà avec cet email.';
    if (/rate limit|too many/i.test(m)) return 'Trop de tentatives, réessaie plus tard.';
    return m;
  }

  // Délégation : le bouton #btnLogin est recréé à chaque re-render du header.
  document.addEventListener('click', (e) => {
    const t = e.target.closest && e.target.closest('#btnLogin');
    if (t) openPopover(t);
  });

  window.trAuth = {
    getUser: () => currentUser,
    getDisplayName: () => username,
    onChange: (cb) => { listeners.push(cb); },
    signOut: () => (window.sb ? window.sb.auth.signOut() : Promise.resolve()),
    openPopover: openPopover
  };
})();
