// auth-guard.js — legacy shim, now delegates to crew-framework.js
// Kept for backward compatibility with any files that still reference it.
// crew-framework.js supersedes this file.
if (typeof crewAuth !== 'undefined') {
  // Framework already loaded — no action needed
  console.log('auth-guard.js: crew-framework.js already loaded');
} else {
  // Framework not loaded yet — redirect to auth if no cached user
  (function() {
    try {
      var user = JSON.parse(localStorage.getItem('crewUserProfile') || 'null');
      if (!user) window.location.href = 'auth.html';
    } catch(e) {
      window.location.href = 'auth.html';
    }
  })();
}
