async function initAuth() {
  var sb = await waitForSupabase();
  var { data: { session } } = await sb.auth.getSession();
  updateNav(session);

  sb.auth.onAuthStateChange(function(event, session) {
    updateNav(session);
  });
}

function updateNav(session) {
  var nav = document.getElementById('nav-auth');
  if (!nav) return;

  if (session && session.user) {
    nav.innerHTML = '<a href="/dashboard.html">My logs</a> <button onclick="signOut()" class="btn btn-small">Sign out</button>';
  } else {
    nav.innerHTML = '<a href="/sign-in.html">Sign in</a> <a href="/sign-up.html" class="btn btn-primary btn-small">Sign up</a>';
  }
}

async function signOut() {
  var sb = await waitForSupabase();
  await sb.auth.signOut();
  window.location.href = '/';
}

async function authHeaders() {
  var sb = await waitForSupabase();
  var { data: { session } } = await sb.auth.getSession();
  return session ? { 'Authorization': 'Bearer ' + session.access_token } : {};
}

// Start
initAuth();
// Expose globally for other scripts
window.authHeaders = authHeaders;
window.signOut = signOut;
