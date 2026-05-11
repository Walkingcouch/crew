const fs = require('fs');
const path = require('path');

// ── Helpers ────────────────────────────────────────────────────────────────────
function patch(file, description, fn) {
  const p = path.join(__dirname, file);
  let c = fs.readFileSync(p, 'utf8');
  const before = c.length;
  c = fn(c);
  fs.writeFileSync(p, c, 'utf8');
  console.log(`[${c === fs.readFileSync(p,'utf8') ? 'OK' : 'ERR'}] ${file} — ${description} (${before} → ${c.length})`);
}

// ── TYPE A: Remove direct Supabase-token localStorage check ────────────────────
// These 3 pages fire an immediate redirect to auth.html if the Supabase
// token isn't in localStorage — which is never set in demo/preview mode.
// The crew_auth gate check that follows is the correct guard.

const TYPE_A_BLOCK =
`<script>
(function() {
  // Auth guard - redirect to login if no session
  var s = JSON.parse(localStorage.getItem('sb-ggocdbsspynihtqlgozv-auth-token') || 'null');
  if (!s || !s.access_token) {
    window.location.href = '/auth.html?next=' + encodeURIComponent(window.location.pathname);
  }
})();
</script>

`;

const TYPE_A_FILES = [
  'CrewBase_Field_Worker_App.html',
  'CrewBase_Supervisor_App.html',
  'CrewBase_Dashboard.html',
];

for (const f of TYPE_A_FILES) {
  patch(f, 'remove Supabase token guard', c => {
    if (!c.includes(TYPE_A_BLOCK)) {
      console.warn(`  WARNING: block not found in ${f}`);
      return c;
    }
    return c.replace(TYPE_A_BLOCK, '');
  });
}

// ── TYPE B: Add crew_auth bypass to db.auth.getSession() guards ────────────────
// These pages call getSession() and redirect to auth.html when no Supabase
// session exists. In demo mode the Supabase session is never set, so they
// always redirect. Fix: skip the redirect when crew_auth is still valid.

const BYPASS = `try { var _ca=JSON.parse(localStorage.getItem('crew_auth')||'null'); if(_ca&&_ca.exp>Date.now()) return; } catch(_){}`;

const OLD_SESSION_BLOCK =
`    db.auth.getSession().then(function(result) {
      var session = result && result.data && result.data.session;
      if (!session) {
        var next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = '/auth.html?next=' + next;
      }
    }).catch(function() {
      window.location.href = '/auth.html';
    });
  } catch(e) {
    window.location.href = '/auth.html';
  }`;

const NEW_SESSION_BLOCK =
`    db.auth.getSession().then(function(result) {
      var session = result && result.data && result.data.session;
      if (!session) {
        ${BYPASS}
        var next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = '/auth.html?next=' + next;
      }
    }).catch(function() {
      ${BYPASS}
      window.location.href = '/auth.html';
    });
  } catch(e) {
    ${BYPASS}
    window.location.href = '/auth.html';
  }`;

const TYPE_B_FILES = [
  'Command_Center_Desktop.html',
  'Command_Center_Tablet.html',
  'Crew_App_Enterprise_Team_Leader.html',
  'Crew_App_Enterprise_Team_Member.html',
  'CrewBase_App_Controls.html',
  'CrewBase_Budget_Assets.html',
  'CrewBase_OCR_Scan.html',
  'CrewBase_Printable_Forms.html',
  'CrewBase_Visitor_Management.html',
];

for (const f of TYPE_B_FILES) {
  patch(f, 'add crew_auth bypass to getSession guard', c => {
    if (!c.includes(OLD_SESSION_BLOCK)) {
      console.warn(`  WARNING: getSession block not found in ${f}`);
      return c;
    }
    return c.replace(OLD_SESSION_BLOCK, NEW_SESSION_BLOCK);
  });
}

// ── auth.html: auto-redirect when crewUserProfile already set + ?next= ──────
// When the app pages' guards redirect to auth.html with ?next=, auth.html
// currently shows the role picker again even if the user already selected one.
// Fix: if crewUserProfile is set and ?next= is present, skip the picker.

const OLD_AUTH_SESSION =
`  // Auto-login if session exists
  db.auth.getSession().then(function (res) {
    if (res.data && res.data.session) {
      loadProfileAndRoute(res.data.session.user.id);
    }
  });`;

const NEW_AUTH_SESSION =
`  // Auto-login if session exists
  db.auth.getSession().then(function (res) {
    if (res.data && res.data.session) {
      loadProfileAndRoute(res.data.session.user.id);
    }
  });

  // Demo mode: if role already chosen and redirected here via ?next=, skip picker
  (function () {
    var _next = new URLSearchParams(window.location.search).get('next');
    if (!_next) return;
    try {
      var _p = JSON.parse(localStorage.getItem('crewUserProfile') || 'null');
      if (_p && _p.role) {
        var _decoded = decodeURIComponent(_next);
        if (_decoded.startsWith('/') && !_decoded.startsWith('//')) {
          window.location.replace(_decoded);
        }
      }
    } catch (_) {}
  })();`;

patch('auth.html', 'add crewUserProfile auto-redirect for ?next= case', c => {
  if (!c.includes(OLD_AUTH_SESSION)) {
    console.warn('  WARNING: auth.html session block not found');
    return c;
  }
  return c.replace(OLD_AUTH_SESSION, NEW_AUTH_SESSION);
});

// ── Also fix mobile menu "Get started →" CTA across public pages ────────────
// The canonical nav deployed previously set this to auth.html — it should
// point to get-started.html so mobile users hit the sign-up flow, not the picker.

const PUBLIC_PAGES = [
  'blog.html', 'trust.html', 'case-studies.html', 'downloads.html',
  'get-started.html', 'rewards.html', 'privacy.html', 'terms.html', 'rewards-tc.html',
];

const OLD_CTA = `<a href="auth.html" class="mobile-menu-cta">Get started →</a>`;
const NEW_CTA = `<a href="get-started.html" class="mobile-menu-cta">Get started →</a>`;

for (const f of PUBLIC_PAGES) {
  const p = path.join(__dirname, f);
  if (!fs.existsSync(p)) continue;
  patch(f, 'fix mobile CTA: auth.html → get-started.html', c => {
    if (!c.includes(OLD_CTA)) return c; // already fixed or different
    return c.replaceAll(OLD_CTA, NEW_CTA);
  });
}

console.log('\nDone.');
