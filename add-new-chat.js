/**
 * add-new-chat.js
 * Adds "New Message" (s-new-chat) and "Select Area" (s-area-select) screens to
 * Crew_App_Customer_Role.html and Crew_App_Crew_Member.html.
 * Wires the compose button in s-team-chat to open the new screen.
 */

const fs   = require('fs');
const path = require('path');
const ROOT = __dirname;

const FILES = [
  'Crew_App_Customer_Role.html',
  'Crew_App_Crew_Member.html',
];

// ── Compose-button onclick patch ──────────────────────────────────────────────
const OLD_COMPOSE = `onclick="showToast('✏️','Start a new conversation')"`;
const NEW_COMPOSE = `onclick="goTo('s-new-chat');ncInit();"`;

// ── Screens + JS to insert before </body> ─────────────────────────────────────
const INSERT = `
<!-- ═══════════════════════════════════════════════════════════════════════════
     NEW MESSAGE SCREEN  (s-new-chat)
═══════════════════════════════════════════════════════════════════════════ -->
<div class="screen hidden" id="s-new-chat">
  <div class="sb lt"><div class="sb-time">9:41</div><div class="sb-icons">📶 📡 🔋</div></div>
  <!-- green header -->
  <div style="background:var(--green);padding:50px 16px 16px;">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
      <button onclick="goTo('s-team-chat')" style="width:34px;height:34px;background:rgba(255,255,255,.2);border:none;border-radius:50%;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:white;flex-shrink:0;line-height:1;">‹</button>
      <div style="font-size:20px;font-weight:800;color:white;letter-spacing:-.3px;">New Message</div>
    </div>
    <div style="position:relative;">
      <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:14px;pointer-events:none;opacity:.7;">🔍</span>
      <input id="nc-search" type="search" oninput="ncSearch(this.value)"
        placeholder="Contractor name or service type…"
        style="width:100%;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.25);border-radius:12px;padding:10px 14px 10px 38px;font-family:inherit;font-size:14px;color:white;outline:none;box-sizing:border-box;"
        autocomplete="off">
    </div>
  </div>
  <!-- area selector row -->
  <div onclick="goTo('s-area-select');ncAreaInit();"
    style="display:flex;align-items:center;justify-content:space-between;padding:11px 16px;background:var(--surface);border-bottom:1px solid var(--border);cursor:pointer;">
    <div style="display:flex;align-items:center;gap:10px;">
      <span style="font-size:18px;">📍</span>
      <div>
        <div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;">Service Area</div>
        <div style="font-size:14px;font-weight:700;color:var(--text);" id="nc-area-label">Katherine NT</div>
      </div>
    </div>
    <div style="font-size:12px;font-weight:600;color:var(--green);">Change area ›</div>
  </div>
  <!-- results list -->
  <div id="nc-results" style="overflow-y:auto;flex:1;padding-bottom:72px;background:var(--bg);"></div>
  <!-- nav -->
  <div class="nav">
    <button class="nav-i" onclick="goTo('s-home')"><div class="nav-ico">🏠</div><div>Home</div></button>
    <button class="nav-i" onclick="goTo('s-browse')"><div class="nav-ico">🔍</div><div>Browse</div></button>
    <button class="nav-i" onclick="goTo('s-rewards')"><div class="nav-ico">⭐</div><div>Rewards</div></button>
    <button class="nav-i on"><div class="nav-ico">💬</div><div>Messages</div></button>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════════════════
     SELECT AREA SCREEN  (s-area-select)
═══════════════════════════════════════════════════════════════════════════ -->
<div class="screen hidden" id="s-area-select">
  <div class="sb lt"><div class="sb-time">9:41</div><div class="sb-icons">📶 📡 🔋</div></div>
  <!-- green header -->
  <div style="background:var(--green);padding:50px 16px 16px;">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
      <button onclick="goTo('s-new-chat')" style="width:34px;height:34px;background:rgba(255,255,255,.2);border:none;border-radius:50%;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:white;flex-shrink:0;line-height:1;">‹</button>
      <div style="font-size:20px;font-weight:800;color:white;letter-spacing:-.3px;">Select Service Area</div>
    </div>
    <div style="position:relative;">
      <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:14px;pointer-events:none;opacity:.7;">🔍</span>
      <input id="nc-area-search" type="search" oninput="ncAreaSearch(this.value)"
        placeholder="Search suburb, city or postcode…"
        style="width:100%;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.25);border-radius:12px;padding:10px 14px 10px 38px;font-family:inherit;font-size:14px;color:white;outline:none;box-sizing:border-box;"
        autocomplete="off">
    </div>
  </div>
  <!-- saved / pinned locations -->
  <div style="font-size:10px;font-weight:700;color:var(--text-3);letter-spacing:.07em;text-transform:uppercase;padding:10px 16px 4px;background:var(--bg);">🏠 My Locations</div>
  <div onclick="ncSetArea('Katherine NT')"
    style="display:flex;align-items:center;gap:12px;padding:13px 16px;border-bottom:1px solid var(--border);cursor:pointer;background:var(--surface);">
    <span style="font-size:22px;width:30px;text-align:center;flex-shrink:0;">📍</span>
    <div style="flex:1;min-width:0;">
      <div style="font-size:15px;font-weight:600;color:var(--text);">Katherine NT</div>
      <div style="font-size:12px;color:var(--text-3);">Home address · 5 contractors</div>
    </div>
    <span style="font-size:11px;font-weight:700;color:white;background:var(--green);padding:3px 8px;border-radius:10px;">Home</span>
  </div>
  <div onclick="ncSetArea('Alice Springs NT')"
    style="display:flex;align-items:center;gap:12px;padding:13px 16px;border-bottom:1px solid var(--border);cursor:pointer;background:var(--surface);">
    <span style="font-size:22px;width:30px;text-align:center;flex-shrink:0;">🏘️</span>
    <div style="flex:1;min-width:0;">
      <div style="font-size:15px;font-weight:600;color:var(--text);">Alice Springs NT</div>
      <div style="font-size:12px;color:var(--text-3);">Rental property · 5 contractors</div>
    </div>
    <span style="font-size:11px;font-weight:700;color:white;background:#d97706;padding:3px 8px;border-radius:10px;">Property</span>
  </div>
  <!-- dynamic list of all areas -->
  <div style="font-size:10px;font-weight:700;color:var(--text-3);letter-spacing:.07em;text-transform:uppercase;padding:10px 16px 4px;background:var(--bg);">All Areas</div>
  <div id="nc-area-list" style="overflow-y:auto;flex:1;padding-bottom:24px;background:var(--bg);"></div>
</div>

<!-- ═══════════════════════════════════════════════════════════════════════════
     NEW CHAT — JavaScript
═══════════════════════════════════════════════════════════════════════════ -->
<script>
(function () {
  /* ── Demo contractor data by area ──────────────────────────────────────── */
  var NC_DATA = {
    'Katherine NT': [
      { name: '[DEMO] Green Thumb Landscapes', service: 'Lawn & Garden', rating: 4.9, jobs: 127, initials: 'GT', bg: '#16a34a' },
      { name: '[DEMO] Top End Plumbing',        service: 'Plumbing',      rating: 4.8, jobs: 89,  initials: 'TE', bg: '#0891b2' },
      { name: '[DEMO] NT Electrical Services',  service: 'Electrical',    rating: 4.7, jobs: 65,  initials: 'NE', bg: '#7c3aed' },
      { name: '[DEMO] Gorge Cleaning Co.',       service: 'Cleaning',      rating: 4.6, jobs: 203, initials: 'GC', bg: '#db2777' },
      { name: '[DEMO] Katherine Handyman',       service: 'Handyman',      rating: 4.5, jobs: 44,  initials: 'KH', bg: '#d97706' },
    ],
    'Alice Springs NT': [
      { name: '[DEMO] Red Centre Landscapes',   service: 'Lawn & Garden', rating: 4.9, jobs: 98,  initials: 'RC', bg: '#dc2626' },
      { name: '[DEMO] Desert Plumbing',          service: 'Plumbing',      rating: 4.8, jobs: 72,  initials: 'DP', bg: '#0891b2' },
      { name: '[DEMO] Outback Electrical',       service: 'Electrical',    rating: 4.7, jobs: 55,  initials: 'OE', bg: '#7c3aed' },
      { name: '[DEMO] Alice Cleaning Services', service: 'Cleaning',      rating: 4.8, jobs: 156, initials: 'AC', bg: '#db2777' },
      { name: '[DEMO] MacDonnell Maintenance',  service: 'Handyman',      rating: 4.6, jobs: 38,  initials: 'MM', bg: '#0f766e' },
    ],
    'Darwin NT': [
      { name: '[DEMO] Darwin Gardens',           service: 'Lawn & Garden', rating: 4.9, jobs: 312, initials: 'DG', bg: '#16a34a' },
      { name: '[DEMO] Top End Plumbing Darwin', service: 'Plumbing',      rating: 4.8, jobs: 189, initials: 'TP', bg: '#0891b2' },
      { name: '[DEMO] Darwin Electrical Co.',   service: 'Electrical',    rating: 4.9, jobs: 234, initials: 'DE', bg: '#7c3aed' },
      { name: '[DEMO] CBD Cleaning Co.',         service: 'Cleaning',      rating: 4.7, jobs: 445, initials: 'CB', bg: '#db2777' },
      { name: '[DEMO] Darwin Handyman Services',service: 'Handyman',      rating: 4.6, jobs: 88,  initials: 'DH', bg: '#d97706' },
    ],
    'Palmerston NT': [
      { name: '[DEMO] Palmerston Lawns',         service: 'Lawn & Garden', rating: 4.8, jobs: 145, initials: 'PL', bg: '#16a34a' },
      { name: '[DEMO] Southern Cross Plumbing', service: 'Plumbing',      rating: 4.7, jobs: 92,  initials: 'SC', bg: '#0891b2' },
      { name: '[DEMO] Palmerston Electrical',   service: 'Electrical',    rating: 4.8, jobs: 78,  initials: 'PE', bg: '#7c3aed' },
      { name: '[DEMO] Clean Sweep Palmerston',  service: 'Cleaning',      rating: 4.9, jobs: 267, initials: 'CS', bg: '#db2777' },
    ],
    'Tennant Creek NT': [
      { name: '[DEMO] Barkly Lawn & Garden',    service: 'Lawn & Garden', rating: 4.7, jobs: 34,  initials: 'BL', bg: '#16a34a' },
      { name: '[DEMO] Barkly Plumbing',          service: 'Plumbing',      rating: 4.8, jobs: 28,  initials: 'BP', bg: '#0891b2' },
      { name: '[DEMO] TC Electrical Services',  service: 'Electrical',    rating: 4.6, jobs: 19,  initials: 'TC', bg: '#7c3aed' },
    ],
    'Nhulunbuy NT': [
      { name: '[DEMO] Gulf Landscapes',          service: 'Lawn & Garden', rating: 4.7, jobs: 22,  initials: 'GL', bg: '#16a34a' },
      { name: '[DEMO] Gove Plumbing',            service: 'Plumbing',      rating: 4.6, jobs: 17,  initials: 'GP', bg: '#0891b2' },
    ],
    'Katherine Region NT': [
      { name: '[DEMO] Nitmiluk Landscapes',      service: 'Lawn & Garden', rating: 4.8, jobs: 31,  initials: 'NL', bg: '#16a34a' },
      { name: '[DEMO] Katherine Region Elect.',  service: 'Electrical',    rating: 4.5, jobs: 14,  initials: 'KR', bg: '#7c3aed' },
    ],
    'Jabiru NT': [
      { name: '[DEMO] Kakadu Cleaning',          service: 'Cleaning',      rating: 4.8, jobs: 12,  initials: 'KK', bg: '#db2777' },
      { name: '[DEMO] Jabiru Handyman',          service: 'Handyman',      rating: 4.7, jobs: 9,   initials: 'JH', bg: '#d97706' },
    ],
  };

  var NC_AREAS = Object.keys(NC_DATA);
  var NC_AREA  = 'Katherine NT';

  /* ── ncInit — called when navigating to s-new-chat ─────────────────────── */
  window.ncInit = function () {
    var lbl = document.getElementById('nc-area-label');
    if (lbl) lbl.textContent = NC_AREA;
    var inp = document.getElementById('nc-search');
    if (inp) inp.value = '';
    _renderContractors('');
  };

  /* ── ncSearch — live filter as user types ───────────────────────────────── */
  window.ncSearch = function (q) {
    _renderContractors(q || '');
  };

  /* ── ncAreaInit — called when opening s-area-select ────────────────────── */
  window.ncAreaInit = function () {
    var inp = document.getElementById('nc-area-search');
    if (inp) inp.value = '';
    _renderAreas('');
  };

  /* ── ncAreaSearch — filter area list ────────────────────────────────────── */
  window.ncAreaSearch = function (q) {
    _renderAreas(q || '');
  };

  /* ── ncSetArea — choose area → return to s-new-chat ─────────────────────── */
  window.ncSetArea = function (area) {
    NC_AREA = area;
    goTo('s-new-chat');
    /* small tick so the screen is visible before we write innerHTML */
    setTimeout(ncInit, 30);
  };

  /* ── _renderContractors ─────────────────────────────────────────────────── */
  function _renderContractors(q) {
    var el = document.getElementById('nc-results');
    if (!el) return;
    var list = NC_DATA[NC_AREA] || [];
    if (q) {
      var ql = q.toLowerCase();
      list = list.filter(function (c) {
        return c.name.toLowerCase().indexOf(ql) !== -1 ||
               c.service.toLowerCase().indexOf(ql) !== -1;
      });
    }
    if (!list.length) {
      el.innerHTML = '<div style="text-align:center;padding:48px 24px;color:var(--text-3);font-size:14px;">' +
        'No contractors found in ' + NC_AREA + (q ? '<br>for "' + q + '"' : '') + '</div>';
      return;
    }
    var rows = list.map(function (c) {
      return '<div onclick="goTo(\'s-chat-room\')" style="display:flex;align-items:center;gap:12px;padding:13px 16px;cursor:pointer;border-bottom:1px solid var(--border);background:var(--surface);">' +
        '<div style="width:48px;height:48px;border-radius:50%;background:' + c.bg + ';display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:white;flex-shrink:0;">' + c.initials + '</div>' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:15px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + c.name + '</div>' +
          '<div style="font-size:12px;color:var(--text-3);margin-top:3px;">' + c.service + ' &nbsp;·&nbsp; ⭐ ' + c.rating + ' &nbsp;·&nbsp; ' + c.jobs + ' jobs</div>' +
        '</div>' +
        '<div style="font-size:13px;color:var(--green);font-weight:700;flex-shrink:0;padding-left:4px;">Chat ›</div>' +
      '</div>';
    });
    el.innerHTML =
      '<div style="font-size:10px;font-weight:700;color:var(--text-3);letter-spacing:.07em;text-transform:uppercase;padding:10px 16px 4px;background:var(--bg);">' +
        'Contractors in ' + NC_AREA +
      '</div>' + rows.join('');
  }

  /* ── _renderAreas ───────────────────────────────────────────────────────── */
  function _renderAreas(q) {
    var el = document.getElementById('nc-area-list');
    if (!el) return;
    var areas = NC_AREAS;
    if (q) {
      var ql = q.toLowerCase();
      areas = areas.filter(function (a) { return a.toLowerCase().indexOf(ql) !== -1; });
    }
    if (!areas.length) {
      el.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-3);">No areas found</div>';
      return;
    }
    el.innerHTML = areas.map(function (a) {
      var count = (NC_DATA[a] || []).length;
      return '<div onclick="ncSetArea(\'' + a + '\')" style="display:flex;align-items:center;gap:12px;padding:13px 16px;border-bottom:1px solid var(--border);cursor:pointer;background:var(--surface);">' +
        '<span style="font-size:20px;width:28px;text-align:center;flex-shrink:0;">📍</span>' +
        '<div style="flex:1;">' +
          '<div style="font-size:15px;font-weight:500;color:var(--text);">' + a + '</div>' +
          '<div style="font-size:12px;color:var(--text-3);">' + count + ' contractor' + (count !== 1 ? 's' : '') + ' available</div>' +
        '</div>' +
        '<span style="font-size:18px;color:var(--text-3);">›</span>' +
      '</div>';
    }).join('');
  }
})();
</script>
`;

// ── Apply to each file ────────────────────────────────────────────────────────
for (const file of FILES) {
  const filePath = path.join(ROOT, file);
  let html = fs.readFileSync(filePath, 'utf8');

  // 1. Patch compose button
  if (html.includes(OLD_COMPOSE)) {
    html = html.replace(new RegExp(OLD_COMPOSE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), NEW_COMPOSE);
    console.log(`  ${file}: ✓ compose button patched`);
  } else {
    console.log(`  ${file}: ⚠ compose button not found — skipped`);
  }

  // 2. Insert screens before </body>
  const bodyClose = html.lastIndexOf('</body>');
  if (bodyClose === -1) {
    console.log(`  ${file}: ⚠ </body> not found — skipped insert`);
    continue;
  }
  html = html.slice(0, bodyClose) + INSERT + '\n' + html.slice(bodyClose);
  console.log(`  ${file}: ✓ s-new-chat + s-area-select inserted`);

  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`  ${file}: → saved\n`);
}

console.log('Done.');
