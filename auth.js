// NextOwner login helper, shared by every page.
// Loads Supabase sign-in, tracks the session, and fetches the member's plans.
(function () {
  var SDK = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  var clientPromise = null, memberPromise = null, cfgPromise = null;

  function loadSdk() {
    return new Promise(function (resolve, reject) {
      if (window.supabase && window.supabase.createClient) return resolve();
      var s = document.createElement("script");
      s.src = SDK; s.onload = resolve; s.onerror = function () { reject(new Error("Could not load sign-in")); };
      document.head.appendChild(s);
    });
  }

  function config() {
    if (!cfgPromise) cfgPromise = fetch("/api/config")
      .then(function (r) { if (!r.ok) throw new Error("Login is not set up yet."); return r.json(); });
    return cfgPromise;
  }

  function signInWithGoogle() {
    return client().then(function (c) {
      return c.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + "/account" } });
    }).then(function (r) { if (r.error) throw r.error; });
  }

  function client() {
    if (!clientPromise) {
      clientPromise = config()
        .then(function (cfg) {
          return loadSdk().then(function () {
            return window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
              auth: { persistSession: true, detectSessionInUrl: true, autoRefreshToken: true },
            });
          });
        });
    }
    return clientPromise;
  }

  function session() {
    return client().then(function (c) { return c.auth.getSession(); })
      .then(function (r) { return (r && r.data && r.data.session) || null; })
      .catch(function () { return null; });
  }

  function membership(force) {
    if (memberPromise && !force) return memberPromise;
    memberPromise = session().then(function (s) {
      if (!s) return null;
      return fetch("/api/membership", { headers: { authorization: "Bearer " + s.access_token } })
        .then(function (r) { return r.ok ? r.json() : null; });
    }).catch(function () { return null; });
    return memberPromise;
  }

  function sendLink(email) {
    return client().then(function (c) {
      return c.auth.signInWithOtp({ email: email, options: { emailRedirectTo: location.origin + "/account" } });
    }).then(function (r) { if (r.error) throw r.error; });
  }

  // Logs in with the numeric code from the sign-in email.
  function verifyCode(email, token) {
    return client().then(function (c) {
      return c.auth.verifyOtp({ email: email, token: token, type: "email" });
    }).then(function (r) { if (r.error || !r.data || !r.data.session) throw r.error || new Error("Invalid code"); memberPromise = null; return r.data.session; });
  }

  // Calls fn once this browser is signed in, including when the sign-in
  // happened in another tab (for example, the email link opened a new tab).
  function onSignIn(fn) {
    var fired = false;
    function fire() { if (!fired) { fired = true; memberPromise = null; fn(); } }
    function check() { session().then(function (s) { if (s) fire(); }); }
    client().then(function (c) {
      c.auth.onAuthStateChange(function (event, s) { if (s && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) fire(); });
    }).catch(function () {});
    window.addEventListener("storage", function (e) { if (e.key && e.key.indexOf("sb-") === 0) check(); });
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) check(); });
  }

  function signOut() {
    return client().then(function (c) { return c.auth.signOut(); }).then(function () { memberPromise = null; });
  }

  function openPortal() {
    return session().then(function (s) {
      if (!s) throw new Error("Please log in.");
      return fetch("/api/portal", { method: "POST", headers: { authorization: "Bearer " + s.access_token } });
    }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || "Could not open billing."); return d; }); })
      .then(function (d) { location.href = d.url; });
  }

  // Pre-fills the signed-in email on Stripe checkout links so the purchase
  // lands on the same account.
  function prefillCheckout(email) {
    document.querySelectorAll('a[href^="https://buy.stripe.com/"], [data-m^="https://buy.stripe.com/"]').forEach(function (a) {
      ["href", "data-m", "data-y"].forEach(function (attr) {
        var v = a.getAttribute(attr);
        if (!v || v.indexOf("https://buy.stripe.com/") !== 0) return;
        var u = new URL(v); u.searchParams.set("prefilled_email", email);
        a.setAttribute(attr, u.toString());
      });
    });
  }

  // Swaps any element with data-auth-link between "Log in" and "Account".
  function updateNav() {
    session().then(function (s) {
      document.querySelectorAll("[data-auth-link]").forEach(function (el) {
        el.textContent = s ? "Account" : "Log in";
        el.setAttribute("href", s ? "/account" : "/login");
      });
      if (s && s.user && s.user.email) prefillCheckout(s.user.email);
    });
  }

  window.NO = { client: client, session: session, membership: membership, sendLink: sendLink,
    verifyCode: verifyCode, onSignIn: onSignIn, config: config, signInWithGoogle: signInWithGoogle,
    signOut: signOut, openPortal: openPortal, prefillCheckout: prefillCheckout, updateNav: updateNav };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", updateNav); else updateNav();
  // Keep "Log in" / "Account" in sync if the person signs in from another tab.
  window.addEventListener("focus", updateNav);
  window.addEventListener("storage", function (e) { if (e.key && e.key.indexOf("sb-") === 0) updateNav(); });
})();
