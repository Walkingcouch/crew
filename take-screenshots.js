/**
 * take-screenshots.js  —  Crew app screenshot generator
 * Starts a local HTTP server, renders each app in headless Chrome, saves JPEGs.
 * Usage: node take-screenshots.js
 */

const puppeteer = require('puppeteer');
const http      = require('http');
const fs        = require('fs');
const path      = require('path');
const url       = require('url');

const ROOT = __dirname;
const PORT = 7779;

// Supabase project ref (from localStorage key in the app files)
const SB_REF = 'ggocdbsspynihtqlgozv';

// ── Tiny static file server ───────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp'
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let pathname = url.parse(req.url).pathname;
      if (pathname === '/' || pathname === '') pathname = '/index.html';
      const filePath = path.join(ROOT, pathname.replace(/^\//, ''));
      const ext = path.extname(filePath).toLowerCase();
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(PORT, '127.0.0.1', () => {
      console.log(`Server running on http://127.0.0.1:${PORT}`);
      resolve(server);
    });
  });
}

// ── App definitions ───────────────────────────────────────────────────────────
const BASE = `http://127.0.0.1:${PORT}/`;

const APPS = [
  {
    id: 'customer',
    file: 'Crew_App_Customer_Role.html',
    type: 'phone',
    width: 390, height: 844,
    captures: [
      { screen: 's-home',        label: 'Home & browse' },
      { screen: 's-browse',      label: 'Browse contractors' },
      { screen: 's-report-home', label: 'Report an issue' }
    ]
  },
  {
    id: 'contractor',
    file: 'Crew_App_Crew_Member.html',
    type: 'phone',
    width: 390, height: 844,
    init: `if(typeof switchMode==='function') switchMode('contractor');`,
    captures: [
      { screen: 's-cdash',      label: 'Dashboard' },
      { screen: 's-cjob',       label: 'Active job' },
      { screen: 's-cearnings',  label: 'Earnings' }
    ]
  },
  {
    id: 'command',
    file: 'Command_Center_Desktop.html',
    type: 'desktop',
    width: 1280, height: 800,
    captures: [
      { screen: null, label: 'Command Centre' }
    ]
  },
  {
    id: 'crewbase',
    file: 'CrewBase_Dashboard.html',
    type: 'desktop',
    width: 1280, height: 800,
    captures: [
      { screen: null, label: 'CrewBase Dashboard' }
    ]
  },
  {
    id: 'field',
    file: 'CrewBase_Field_Worker_App.html',
    type: 'phone',
    width: 390, height: 844,
    captures: [
      { screen: 's-home',     label: 'Field home' },
      { screen: 's-orders',   label: 'Work orders' },
      { screen: 's-clockin',  label: 'Clock in' }
    ]
  },
  {
    id: 'supervisor',
    file: 'CrewBase_Supervisor_App.html',
    type: 'phone',
    width: 390, height: 844,
    captures: [
      { screen: 's-home',        label: 'Supervisor home' },
      { screen: 's-work-orders', label: 'Work orders' },
      { screen: 's-team',        label: 'Team view' }
    ]
  }
];

// ── Auth bypass — injected before ANY page script runs ────────────────────────
function getAuthBypassScript(sbRef) {
  return `(function() {
    var mockUser = {
      id: 'screenshot-user',
      email: 'demo@crew.au',
      full_name: 'Demo User',
      name: 'Demo User',
      role: 'admin',
      avatar_initials: 'D'
    };

    // 1. Inject fake Supabase localStorage token so early guards pass
    try {
      var fakeToken = JSON.stringify({
        access_token: 'demo-access-token-screenshots',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'demo-refresh-token',
        user: {
          id: 'screenshot-user',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'demo@crew.au',
          user_metadata: { full_name: 'Demo User', role: 'admin' }
        }
      });
      localStorage.setItem('sb-${sbRef}-auth-token', fakeToken);
    } catch(e) {}

    // 2. Lock framework globals — setter silently ignores overwrites
    function lockGlobal(name, value) {
      try {
        Object.defineProperty(window, name, {
          get: function() { return value; },
          set: function() {},
          configurable: false,
          enumerable: true
        });
      } catch(e) {}
    }

    lockGlobal('crewUI', {
      toast: function() {},
      hideLoading: function() {},
      showLoading: function() {},
      showError: function() {}
    });

    lockGlobal('crewAuth', {
      require: function() { return Promise.resolve(mockUser); },
      getUser:  function() { return Promise.resolve(mockUser); },
      signOut:  function() { return Promise.resolve(); }
    });

    lockGlobal('crewNav', {
      wireBackButtons: function() {}
    });

    lockGlobal('CrewFramework', {
      requireAuth:    function() { return Promise.resolve(mockUser); },
      getUser:        function() { return Promise.resolve(mockUser); },
      showToast:      function() {},
      hideLoading:    function() {}
    });

    // 3. Block window.location redirects to auth.html
    //    Intercept via history API and beforeunload is unreliable in headless;
    //    instead patch location setter on the prototype
    try {
      var locProto = Object.getPrototypeOf(window.location);
      var origHrefDescriptor = Object.getOwnPropertyDescriptor(locProto, 'href');
      if (origHrefDescriptor && origHrefDescriptor.set) {
        var origSetter = origHrefDescriptor.set;
        Object.defineProperty(locProto, 'href', {
          get: origHrefDescriptor.get,
          set: function(v) {
            if (typeof v === 'string' && v.indexOf('auth.html') !== -1) {
              console.log('[screenshot] blocked auth redirect to: ' + v);
              return;
            }
            origSetter.call(this, v);
          },
          configurable: true,
          enumerable: origHrefDescriptor.enumerable
        });
      }
    } catch(e) {}

    // 4. Mock @supabase/supabase-js createClient so framework doesn't crash
    window.supabase = {
      createClient: function() {
        return {
          auth: {
            getSession: function() {
              return Promise.resolve({ data: { session: { user: mockUser } }, error: null });
            },
            onAuthStateChange: function(cb) {
              setTimeout(function() { cb('SIGNED_IN', { user: mockUser }); }, 0);
              return { data: { subscription: { unsubscribe: function() {} } } };
            },
            signOut: function() { return Promise.resolve({ error: null }); }
          },
          from: function() {
            return {
              select: function() { return this; },
              eq:     function() { return this; },
              single: function() { return Promise.resolve({ data: null, error: null }); },
              limit:  function() { return Promise.resolve({ data: [], error: null }); },
              order:  function() { return this; },
              insert: function() { return Promise.resolve({ data: null, error: null }); },
              upsert: function() { return Promise.resolve({ data: null, error: null }); },
              then:   function(cb) { return Promise.resolve({ data: [], error: null }).then(cb); }
            };
          },
          channel: function() {
            return {
              on: function() { return this; },
              subscribe: function() { return this; }
            };
          }
        };
      }
    };
  })();`;
}

// ── Screenshot helper ─────────────────────────────────────────────────────────
async function showScreen(page, screenId) {
  if (!screenId) return;
  await page.evaluate((id) => {
    document.querySelectorAll('[id^="s-"]').forEach(el => {
      el.classList.add('hidden');
      el.classList.remove('back');
      el.style.display = '';
    });
    const target = document.getElementById(id);
    if (target) {
      target.classList.remove('hidden', 'back');
      target.style.display = '';
    }
  }, screenId);
  await new Promise(r => setTimeout(r, 400));
}

async function dismissOverlays(page) {
  await page.evaluate(() => {
    const selectors = [
      '#demo-gate', '.loading-screen', '#loading-overlay', '#loading-screen',
      '[class*="gate"]', '[class*="splash"]', '[id*="loading"]',
      '.auth-overlay', '#auth-overlay', '.onboarding-overlay'
    ];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        el.style.display = 'none';
        el.style.visibility = 'hidden';
      });
    });
    // Re-apply auth bypass in case framework reset it
    if (window.crewAuth) {
      window.crewAuth.require = function() {
        return Promise.resolve({ id: 'screenshot-user', role: 'admin', full_name: 'Demo User' });
      };
    }
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function go() {
  const server = await startServer();
  const outDir = path.join(ROOT, 'screenshots');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu',
      '--disable-dev-shm-usage', '--ignore-certificate-errors',
      '--disable-web-security', '--allow-file-access-from-files'
    ]
  });

  const authScript = getAuthBypassScript(SB_REF);

  for (const app of APPS) {
    console.log(`\nCapturing: ${app.id}  (${app.file})`);
    const page = await browser.newPage();
    await page.setViewport({ width: app.width, height: app.height, deviceScaleFactor: 2 });

    // Inject auth bypass BEFORE any page script runs
    await page.evaluateOnNewDocument(authScript);

    // Block external network calls that would delay rendering
    await page.setRequestInterception(true);
    page.on('request', req => {
      const u = req.url();
      if (
        u.includes('supabase.co') || u.includes('supabase.io') ||
        u.includes('resend.com') || u.includes('fonts.googleapis.com') ||
        u.includes('fonts.gstatic.com')
      ) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Suppress console errors from the page (expected when Supabase is blocked)
    page.on('console', msg => {
      if (msg.type() === 'error') return;
    });

    try {
      await page.goto(BASE + app.file, { waitUntil: 'domcontentloaded', timeout: 15000 });
    } catch (e) { /* timeout ok — page still rendered */ }

    // Wait for JS to settle
    await new Promise(r => setTimeout(r, 1500));
    await dismissOverlays(page);

    // Run any app-specific init JS (e.g. switchMode)
    if (app.init) {
      await page.evaluate(app.init);
      await new Promise(r => setTimeout(r, 400));
    }

    // For phone apps, show the first target screen so we start from a known state
    if (app.captures[0] && app.captures[0].screen) {
      await showScreen(page, app.captures[0].screen);
    }

    const results = [];

    for (let i = 0; i < app.captures.length; i++) {
      const cap = app.captures[i];
      if (cap.screen) await showScreen(page, cap.screen);

      const buf = await page.screenshot({ type: 'jpeg', quality: 88 });
      const b64 = buf.toString('base64');
      const outPath = path.join(outDir, `${app.id}_${i}.jpg`);
      fs.writeFileSync(outPath, buf);
      results.push({ b64, label: cap.label });
      console.log(`  [${i + 1}/${app.captures.length}] ${cap.label}  →  ${Math.round(b64.length / 1024)} KB`);
    }

    fs.writeFileSync(
      path.join(outDir, `${app.id}.json`),
      JSON.stringify({ id: app.id, type: app.type, captures: results }, null, 2)
    );

    await page.close();
  }

  await browser.close();
  server.close();
  console.log('\nDone — screenshots saved to ./screenshots/');
}

go().catch(e => { console.error(e); process.exit(1); });
