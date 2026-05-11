'use strict';
const fs = require('fs');

// ── Helpers ──────────────────────────────────────────────────────────────────
function strReplace(html, oldStr, newStr, label) {
  if (!html.includes(oldStr)) { console.warn('  WARN: anchor not found —', label); return html; }
  return html.replace(oldStr, newStr);
}

// ── 1. Replace Export CTA (2 buttons → 3 buttons) ───────────────────────────
const OLD_CTA =
`        <!-- Export CTA -->
        <div style="position:absolute;bottom:0;left:0;right:0;padding:10px 14px;background:var(--surface);border-top:1px solid var(--border);display:flex;gap:8px;">
          <button onclick="rcShareCert()" style="flex:1;background:none;border:1.5px solid var(--green);color:var(--green);border-radius:12px;padding:12px;font-size:13px;font-weight:600;cursor:pointer;">Share Link</button>
          <button onclick="rcExportPDF()" style="flex:1;background:var(--green);color:white;border:none;border-radius:12px;padding:12px;font-size:13px;font-weight:700;cursor:pointer;">📄 Export PDF</button>
        </div>`;

const NEW_CTA =
`        <!-- Export CTA -->
        <div style="position:absolute;bottom:0;left:0;right:0;padding:10px 14px;background:var(--surface);border-top:1px solid var(--border);display:flex;gap:7px;">
          <button onclick="rcEmailCert()" style="flex:1;background:var(--green);color:white;border:none;border-radius:12px;padding:12px;font-size:13px;font-weight:700;cursor:pointer;">✉️ Email</button>
          <button onclick="rcShareCert()" style="flex:1;background:none;border:1.5px solid var(--green);color:var(--green);border-radius:12px;padding:12px;font-size:13px;font-weight:600;cursor:pointer;">🔗 Share</button>
          <button onclick="rcExportPDF()" style="flex:1;background:none;border:1.5px solid var(--green);color:var(--green);border-radius:12px;padding:12px;font-size:13px;font-weight:600;cursor:pointer;">📄 PDF</button>
        </div>

        <!-- Email modal — slides up over cert screen -->
        <div id="hw-email-modal" onclick="if(event.target===this)rcEmailClose()" style="display:none;position:absolute;inset:0;background:rgba(0,0,0,0.55);z-index:200;flex-direction:column;justify-content:flex-end;">
          <div style="background:var(--surface);border-radius:20px 20px 0 0;padding:18px 16px 24px;">
            <!-- Drag handle -->
            <div style="width:36px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 14px;"></div>
            <div style="font-size:16px;font-weight:700;margin-bottom:3px;">📧 Send Certificate</div>
            <div style="font-size:12px;color:var(--muted);margin-bottom:16px;">PDF copy emailed to both parties</div>

            <!-- Contractor row -->
            <div style="margin-bottom:10px;">
              <div style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.05em;margin-bottom:5px;">CONTRACTOR</div>
              <div style="display:flex;align-items:center;gap:10px;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px 12px;">
                <span style="font-size:18px;flex-shrink:0;">🔧</span>
                <div style="flex:1;min-width:0;">
                  <div id="em-contractor-name" style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>
                  <input id="em-contractor-email" type="email" style="width:100%;border:none;background:none;font-size:12px;color:var(--muted);outline:none;margin-top:1px;box-sizing:border-box;" placeholder="email@example.com" />
                </div>
                <span id="em-contractor-status" style="font-size:18px;flex-shrink:0;min-width:22px;text-align:center;"></span>
              </div>
            </div>

            <!-- Customer row -->
            <div style="margin-bottom:20px;">
              <div style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.05em;margin-bottom:5px;">CUSTOMER</div>
              <div style="display:flex;align-items:center;gap:10px;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px 12px;">
                <span style="font-size:18px;flex-shrink:0;">👤</span>
                <div style="flex:1;min-width:0;">
                  <div id="em-customer-name" style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>
                  <input id="em-customer-email" type="email" style="width:100%;border:none;background:none;font-size:12px;color:var(--muted);outline:none;margin-top:1px;box-sizing:border-box;" placeholder="email@example.com" />
                </div>
                <span id="em-customer-status" style="font-size:18px;flex-shrink:0;min-width:22px;text-align:center;"></span>
              </div>
            </div>

            <button onclick="rcSendEmail()" id="em-send-btn" style="width:100%;background:var(--green);color:white;border:none;border-radius:12px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:10px;">✉️ Send to Both</button>
            <button onclick="rcEmailClose()" style="width:100%;background:none;border:none;color:var(--muted);padding:8px;font-size:14px;cursor:pointer;">Cancel</button>
          </div>
        </div>`;

// ── 2. JS to inject — email functions appended before rcShareCert ─────────────
const OLD_SHARE_FN = `  window.rcShareCert = function() {`;

const EMAIL_JS = `  window.rcEmailCert = function() {
    var ci = RC_INSP;
    var contractorSlug = (ci.contractor || 'contractor').toLowerCase().replace(/\\s+/g, '.');
    var customerSlug   = (ci.customer   || 'customer'  ).toLowerCase().replace(/\\s+/g, '.');
    var cEl = document.getElementById('em-contractor-name');
    var cuEl = document.getElementById('em-customer-name');
    var cEm  = document.getElementById('em-contractor-email');
    var cuEm = document.getElementById('em-customer-email');
    if (!cEl) return;
    cEl.textContent  = ci.contractor || 'Contractor';
    cuEl.textContent = ci.customer   || 'Customer';
    cEm.value  = contractorSlug + '@crew.app';
    cuEm.value = customerSlug   + '@crew.app';
    document.getElementById('em-contractor-status').textContent = '';
    document.getElementById('em-customer-status').textContent   = '';
    document.getElementById('em-send-btn').disabled = false;
    document.getElementById('em-send-btn').textContent = '✉️ Send to Both';
    var m = document.getElementById('hw-email-modal');
    m.style.display = 'flex';
  };

  window.rcEmailClose = function() {
    var m = document.getElementById('hw-email-modal');
    if (m) m.style.display = 'none';
  };

  window.rcSendEmail = function() {
    var btn = document.getElementById('em-send-btn');
    var contractorEmail = (document.getElementById('em-contractor-email').value || '').trim();
    var customerEmail   = (document.getElementById('em-customer-email').value   || '').trim();
    if (!contractorEmail || !customerEmail) {
      if (typeof showToast === 'function') showToast('⚠️', 'Please enter both email addresses');
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Sending…';
    document.getElementById('em-contractor-status').textContent = '⏳';
    document.getElementById('em-customer-status').textContent   = '⏳';
    setTimeout(function() {
      document.getElementById('em-contractor-status').textContent = '✅';
      setTimeout(function() {
        document.getElementById('em-customer-status').textContent = '✅';
        btn.textContent = '✅ Sent';
        setTimeout(function() {
          window.rcEmailClose();
          if (typeof showToast === 'function') {
            showToast('✉️', 'Certificate sent to ' + contractorEmail + ' and ' + customerEmail);
          }
        }, 800);
      }, 500);
    }, 1100);
  };

  window.rcShareCert = function() {`;

// ── Process both files ────────────────────────────────────────────────────────
const FILES = [
  'Crew_App_Customer_Role.html',
  'Crew_App_Crew_Member.html',
];

FILES.forEach(file => {
  let html = fs.readFileSync(file, 'utf8');

  html = strReplace(html, OLD_CTA,       NEW_CTA,       'Export CTA → 3 buttons + email modal');
  html = strReplace(html, OLD_SHARE_FN,  EMAIL_JS,      'inject email JS before rcShareCert');

  fs.writeFileSync(file, html, 'utf8');
  console.log(`  ${file}: ✓ saved`);
});

console.log('\nDone.');
