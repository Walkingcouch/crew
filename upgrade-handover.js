'use strict';

const fs   = require('fs');
const path = require('path');
const ROOT = __dirname;

function replaceScreen(html, screenId, newHtml) {
  const marker = 'id="' + screenId + '"';
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  let start = idx;
  while (start > 0 && html[start] !== '<') start--;
  let pos = start, depth = 0;
  while (pos < html.length) {
    const lt = html.indexOf('<', pos);
    if (lt === -1) break;
    pos = lt;
    if (html.startsWith('<!--', pos)) { const e = html.indexOf('-->', pos); pos = (e === -1 ? html.length : e + 3); continue; }
    if (/^<div[\s>]/.test(html.slice(pos, pos + 5))) { depth++; pos++; continue; }
    if (html.startsWith('</div', pos)) {
      depth--;
      if (depth === 0) { const e = html.indexOf('>', pos) + 1; return html.slice(0, start) + newHtml + html.slice(e); }
    }
    pos++;
  }
  return null;
}

function insertBefore(html, marker, newHtml) {
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  return html.slice(0, idx) + newHtml + '\n' + html.slice(idx);
}

function strReplace(html, oldStr, newStr) {
  const idx = html.indexOf(oldStr);
  if (idx === -1) return null;
  return html.slice(0, idx) + newStr + html.slice(idx + oldStr.length);
}

// ─── s-handover-wizard: Snap&Drive-style zone capture ────────────────────────

const S_HANDOVER_WIZARD = `
      <!-- ═══ HANDOVER WIZARD ═══ -->
      <div class="screen hidden" id="s-handover-wizard" style="display:flex;flex-direction:column;overflow:hidden;">

        <!-- Offline/sync status banner -->
        <div id="hw-offline-banner" style="background:#00796b;padding:5px 14px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
          <span id="hw-offline-badge" style="font-size:11px;font-weight:700;color:white;">● Online — All data syncing</span>
          <span id="hw-queue-count" style="font-size:10px;color:rgba(255,255,255,0.75);display:none;">0 queued</span>
        </div>

        <!-- Header -->
        <div style="background:var(--green);padding:44px 16px 12px;position:relative;flex-shrink:0;">
          <button class="back-btn" onclick="goBack()">←</button>
          <div style="margin-left:40px;">
            <div style="color:white;font-size:18px;font-weight:600;">Rental Inspection</div>
            <div id="hw-stage-label" style="color:rgba(255,255,255,0.8);font-size:12px;margin-top:1px;">Stage 1 of 4 · Pre-Departure</div>
          </div>
        </div>

        <!-- 4-step progress tabs -->
        <div style="display:flex;background:var(--surface);border-bottom:1px solid var(--border);flex-shrink:0;">
          <div id="hw-step-1" onclick="hwGoStep(1)" style="flex:1;padding:8px 3px;text-align:center;border-bottom:2px solid var(--green);cursor:pointer;">
            <div style="font-size:15px;">🏚️</div><div style="font-size:8px;font-weight:700;color:var(--green);margin-top:1px;">Storage</div>
          </div>
          <div id="hw-step-2" onclick="hwGoStep(2)" style="flex:1;padding:8px 3px;text-align:center;border-bottom:2px solid var(--border);cursor:pointer;">
            <div style="font-size:15px;">🚚</div><div style="font-size:8px;font-weight:600;color:var(--text-3);margin-top:1px;">Delivery</div>
          </div>
          <div id="hw-step-3" onclick="hwGoStep(3)" style="flex:1;padding:8px 3px;text-align:center;border-bottom:2px solid var(--border);cursor:pointer;">
            <div style="font-size:15px;">🔄</div><div style="font-size:8px;font-weight:600;color:var(--text-3);margin-top:1px;">Return</div>
          </div>
          <div id="hw-step-4" onclick="hwGoStep(4)" style="flex:1;padding:8px 3px;text-align:center;border-bottom:2px solid var(--border);cursor:pointer;">
            <div style="font-size:15px;">✅</div><div style="font-size:8px;font-weight:600;color:var(--text-3);margin-top:1px;">Stored</div>
          </div>
        </div>

        <!-- Scrollable content -->
        <div style="overflow-y:auto;flex:1;background:var(--bg);">

          <!-- Stage 1 pane -->
          <div id="hw-pane-1" style="padding:12px;">
            <div id="hw-stage-info-1" style="background:var(--surface);border-radius:10px;border:1px solid var(--green);padding:9px 12px;margin-bottom:10px;display:flex;gap:8px;align-items:flex-start;">
              <span style="font-size:16px;">🏚️</span>
              <div><div style="font-size:12px;font-weight:700;color:var(--green);">Stage 1 — Storage Pre-Departure</div><div style="font-size:10px;color:var(--text-3);margin-top:1px;">Complete before loading for delivery. All photos timestamped &amp; geotagged.</div></div>
            </div>
            <!-- Zone progress -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
              <span style="font-size:11px;font-weight:700;color:var(--text);">Zone Coverage</span>
              <span id="hw-progress-1" style="font-size:11px;font-weight:700;color:var(--green);">0/8 zones</span>
            </div>
            <div style="background:var(--border);border-radius:3px;height:5px;overflow:hidden;margin-bottom:10px;">
              <div id="hw-bar-1" style="height:100%;background:var(--green);border-radius:3px;width:0%;transition:width .3s;"></div>
            </div>
            <!-- Zone overview dots -->
            <div id="hw-dots-1" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;"></div>
            <!-- Zone cards -->
            <div id="hw-zones-1"></div>
            <!-- Completion banner -->
            <div id="hw-complete-1" style="display:none;background:#e8f5e9;border:1px solid var(--green);border-radius:12px;padding:12px 14px;margin-bottom:10px;text-align:center;">
              <div style="font-size:22px;">✅</div>
              <div style="font-size:13px;font-weight:700;color:var(--green);margin-top:4px;">All 8 zones documented</div>
              <div style="font-size:11px;color:var(--text-3);margin-top:2px;">GPS &amp; timestamps locked. Photos saved offline.</div>
            </div>
            <button onclick="hwGoStep(2)" style="width:100%;background:var(--green);color:white;border:none;border-radius:12px;padding:12px;font-size:13px;font-weight:600;cursor:pointer;">Load &amp; Depart for Delivery →</button>
          </div>

          <!-- Stage 2 pane -->
          <div id="hw-pane-2" style="display:none;padding:12px;">
            <div style="background:var(--surface);border-radius:10px;border:1px solid var(--green);padding:9px 12px;margin-bottom:10px;display:flex;gap:8px;align-items:flex-start;">
              <span style="font-size:16px;">🚚</span>
              <div><div style="font-size:12px;font-weight:700;color:var(--green);">Stage 2 — Delivery at Customer</div><div style="font-size:10px;color:var(--text-3);margin-top:1px;">Document arrival condition. Customer receipt confirmation required.</div></div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
              <span style="font-size:11px;font-weight:700;color:var(--text);">Zone Coverage</span>
              <span id="hw-progress-2" style="font-size:11px;font-weight:700;color:var(--green);">0/3 zones</span>
            </div>
            <div style="background:var(--border);border-radius:3px;height:5px;overflow:hidden;margin-bottom:10px;">
              <div id="hw-bar-2" style="height:100%;background:var(--green);border-radius:3px;width:0%;transition:width .3s;"></div>
            </div>
            <div id="hw-dots-2" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;"></div>
            <div id="hw-zones-2"></div>
            <!-- Customer receipt -->
            <div style="background:#e8f5e9;border-radius:12px;border:1px solid var(--green);padding:12px 14px;margin-bottom:10px;text-align:center;">
              <div style="font-size:13px;font-weight:700;color:var(--green);margin-bottom:5px;">Customer — Confirm Receipt</div>
              <div style="font-size:11px;color:var(--text-3);margin-bottom:10px;">Tap to confirm item received in stated condition. Rental period begins.</div>
              <button onclick="hwCustomerConfirm()" style="background:var(--green);color:white;border:none;border-radius:10px;padding:10px 22px;font-size:13px;font-weight:700;cursor:pointer;">I Confirm Receipt ✓</button>
            </div>
            <div id="hw-complete-2" style="display:none;background:#e8f5e9;border:1px solid var(--green);border-radius:12px;padding:10px 14px;margin-bottom:10px;text-align:center;">
              <div style="font-size:13px;font-weight:700;color:var(--green);">✅ Delivery documented</div>
            </div>
            <div style="display:flex;gap:8px;">
              <button onclick="hwGoStep(1)" style="flex:0 0 auto;background:none;border:1.5px solid var(--border);color:var(--text-2);border-radius:12px;padding:11px 14px;font-size:12px;font-weight:600;cursor:pointer;">←</button>
              <button onclick="hwGoStep(3)" style="flex:1;background:var(--green);color:white;border:none;border-radius:12px;padding:11px;font-size:13px;font-weight:600;cursor:pointer;">Delivery Complete →</button>
            </div>
          </div>

          <!-- Stage 3 pane -->
          <div id="hw-pane-3" style="display:none;padding:12px;">
            <div style="background:var(--surface);border-radius:10px;border:1px solid var(--green);padding:9px 12px;margin-bottom:10px;display:flex;gap:8px;align-items:flex-start;">
              <span style="font-size:16px;">🔄</span>
              <div><div style="font-size:12px;font-weight:700;color:var(--green);">Stage 3 — Return Inspection</div><div style="font-size:10px;color:var(--text-3);margin-top:1px;">Compare return condition to departure photos. Damage must be documented here.</div></div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
              <span style="font-size:11px;font-weight:700;color:var(--text);">Zone Coverage</span>
              <span id="hw-progress-3" style="font-size:11px;font-weight:700;color:var(--green);">0/5 zones</span>
            </div>
            <div style="background:var(--border);border-radius:3px;height:5px;overflow:hidden;margin-bottom:10px;">
              <div id="hw-bar-3" style="height:100%;background:var(--green);border-radius:3px;width:0%;transition:width .3s;"></div>
            </div>
            <div id="hw-dots-3" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;"></div>
            <div id="hw-zones-3"></div>
            <div style="background:var(--surface);border-radius:12px;border:1px solid var(--border);overflow:hidden;margin-bottom:10px;">
              <div style="padding:9px 12px;border-bottom:1px solid var(--border);font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.04em;">Return Damage Assessment</div>
              <div style="display:flex;">
                <button onclick="hwDamage('none',this)" style="flex:1;padding:10px 4px;border:none;border-right:1px solid var(--border);background:var(--green-pale);cursor:pointer;font-size:11px;font-weight:700;color:var(--green);">✓ None</button>
                <button onclick="hwDamage('minor',this)" style="flex:1;padding:10px 4px;border:none;border-right:1px solid var(--border);background:none;cursor:pointer;font-size:11px;font-weight:600;color:var(--text-3);">Minor</button>
                <button onclick="hwDamage('significant',this)" style="flex:1;padding:10px 4px;border:none;background:none;cursor:pointer;font-size:11px;font-weight:600;color:#c62828;">Damaged</button>
              </div>
            </div>
            <!-- Customer release -->
            <div style="background:#e8f5e9;border-radius:12px;border:1px solid var(--green);padding:12px 14px;margin-bottom:10px;text-align:center;">
              <div style="font-size:13px;font-weight:700;color:var(--green);margin-bottom:5px;">Customer — Release Equipment</div>
              <div style="font-size:11px;color:var(--text-3);margin-bottom:10px;">Confirm all items and accessories returned.</div>
              <button onclick="hwCustomerRelease()" style="background:var(--green);color:white;border:none;border-radius:10px;padding:10px 22px;font-size:13px;font-weight:700;cursor:pointer;">I Confirm Return ✓</button>
            </div>
            <div id="hw-complete-3" style="display:none;background:#e8f5e9;border:1px solid var(--green);border-radius:12px;padding:10px 14px;margin-bottom:10px;text-align:center;">
              <div style="font-size:13px;font-weight:700;color:var(--green);">✅ Return documented</div>
            </div>
            <div style="display:flex;gap:8px;">
              <button onclick="hwGoStep(2)" style="flex:0 0 auto;background:none;border:1.5px solid var(--border);color:var(--text-2);border-radius:12px;padding:11px 14px;font-size:12px;font-weight:600;cursor:pointer;">←</button>
              <button onclick="hwGoStep(4)" style="flex:1;background:var(--green);color:white;border:none;border-radius:12px;padding:11px;font-size:13px;font-weight:600;cursor:pointer;">Return to Storage →</button>
            </div>
          </div>

          <!-- Stage 4 pane -->
          <div id="hw-pane-4" style="display:none;padding:12px;">
            <div style="background:var(--surface);border-radius:10px;border:1px solid var(--green);padding:9px 12px;margin-bottom:10px;display:flex;gap:8px;align-items:flex-start;">
              <span style="font-size:16px;">✅</span>
              <div><div style="font-size:12px;font-weight:700;color:var(--green);">Stage 4 — Storage Return</div><div style="font-size:10px;color:var(--text-3);margin-top:1px;">Final photos to close the rental cycle and trigger deposit release.</div></div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
              <span style="font-size:11px;font-weight:700;color:var(--text);">Zone Coverage</span>
              <span id="hw-progress-4" style="font-size:11px;font-weight:700;color:var(--green);">0/2 zones</span>
            </div>
            <div style="background:var(--border);border-radius:3px;height:5px;overflow:hidden;margin-bottom:10px;">
              <div id="hw-bar-4" style="height:100%;background:var(--green);border-radius:3px;width:0%;transition:width .3s;"></div>
            </div>
            <div id="hw-dots-4" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;"></div>
            <div id="hw-zones-4"></div>
            <!-- Rental summary -->
            <div style="background:var(--surface);border-radius:12px;border:1px solid var(--border);padding:12px 14px;margin-bottom:10px;">
              <div style="font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px;">Rental Summary</div>
              <div style="font-size:12px;color:var(--text-2);line-height:1.9;">
                <div>📸 <strong id="hw-total-photos">0</strong> zone photos across 4 stages</div>
                <div>📅 Duration: <strong>7 days</strong></div>
                <div>💰 Total charged: <strong>$315</strong></div>
                <div>🔒 Deposit: <strong>$150 — ready to release</strong></div>
              </div>
            </div>
            <div id="hw-complete-4" style="display:none;background:#e8f5e9;border:1px solid var(--green);border-radius:12px;padding:10px 14px;margin-bottom:10px;text-align:center;">
              <div style="font-size:13px;font-weight:700;color:var(--green);">✅ All zones documented</div>
            </div>
            <div style="display:flex;gap:8px;margin-bottom:8px;">
              <button onclick="hwGoStep(3)" style="flex:0 0 auto;background:none;border:1.5px solid var(--border);color:var(--text-2);border-radius:12px;padding:11px 14px;font-size:12px;font-weight:600;cursor:pointer;">←</button>
              <button onclick="showToast('✅','Rental complete! $150 deposit released within 24hrs.')" style="flex:1;background:var(--green);color:white;border:none;border-radius:12px;padding:11px;font-size:13px;font-weight:700;cursor:pointer;">Release $150 Deposit ✓</button>
            </div>
            <button onclick="rcOpenCert()" style="width:100%;background:none;border:1.5px solid var(--green);color:var(--green);border-radius:12px;padding:11px;font-size:13px;font-weight:700;cursor:pointer;">📄 View Condition Certificate</button>
          </div>

        </div>
      </div>`;

// ─── s-condition-cert ─────────────────────────────────────────────────────────

const S_CONDITION_CERT = `
      <!-- ═══ CONDITION CERTIFICATE ═══ -->
      <div class="screen hidden" id="s-condition-cert" style="display:flex;flex-direction:column;overflow:hidden;">

        <!-- Header -->
        <div style="background:var(--green);padding:50px 16px 14px;position:relative;flex-shrink:0;">
          <button class="back-btn" onclick="goBack()">←</button>
          <div style="margin-left:40px;">
            <div style="color:white;font-size:18px;font-weight:600;">Condition Certificate</div>
            <div id="cert-no-label" style="color:rgba(255,255,255,0.8);font-size:12px;">RC-2026-0001 · Generating…</div>
          </div>
        </div>

        <!-- Scrollable certificate body -->
        <div style="overflow-y:auto;flex:1;background:var(--bg);padding-bottom:80px;">
          <div id="cert-content" style="background:var(--surface);margin:10px;border-radius:14px;border:1px solid var(--border);overflow:hidden;">

            <!-- Certificate logo/header -->
            <div style="background:linear-gradient(135deg,#1b4332,#2d6a4f);padding:16px 16px 14px;text-align:center;">
              <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.6);letter-spacing:.12em;text-transform:uppercase;margin-bottom:4px;">Crew Platform</div>
              <div style="font-size:18px;font-weight:800;color:white;letter-spacing:.03em;">CONDITION CERTIFICATE</div>
              <div id="cert-no-display" style="font-size:11px;color:rgba(255,255,255,0.65);margin-top:3px;">Certificate No. RC-2026-0001</div>
            </div>

            <!-- Item + rental info -->
            <div style="padding:12px 14px;border-bottom:1px solid var(--border);">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;">
                <div><div style="color:var(--text-3);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px;">Equipment</div><div id="cert-item-name" style="font-weight:700;color:var(--text);">Honda HRX Mower</div></div>
                <div><div style="color:var(--text-3);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px;">Contractor</div><div id="cert-contractor" style="font-weight:700;color:var(--text);">Green Thumb Co.</div></div>
                <div><div style="color:var(--text-3);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px;">Rental Period</div><div id="cert-period" style="font-weight:600;color:var(--text);">5 – 11 May 2026</div></div>
                <div><div style="color:var(--text-3);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px;">Customer</div><div id="cert-customer" style="font-weight:600;color:var(--text);">J. Ahchee</div></div>
              </div>
            </div>

            <!-- Pickup vs Return summary bar -->
            <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid var(--border);">
              <div style="padding:12px 14px;border-right:1px solid var(--border);">
                <div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">📸 Pickup Inspection</div>
                <div style="font-size:12px;font-weight:700;color:var(--green);" id="cert-pickup-cond">Excellent ✓</div>
                <div style="font-size:10px;color:var(--text-3);margin-top:2px;" id="cert-pickup-ts">Mon 5 May · 10:15 AM</div>
                <div style="font-size:10px;color:var(--text-3);margin-top:1px;">⛽ Fuel: Full</div>
                <div style="font-size:10px;color:var(--text-3);">8 zones documented</div>
              </div>
              <div style="padding:12px 14px;">
                <div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">📸 Return Inspection</div>
                <div style="font-size:12px;font-weight:700;color:var(--green);" id="cert-return-cond">Good ✓</div>
                <div style="font-size:10px;color:var(--text-3);margin-top:2px;" id="cert-return-ts">Sun 11 May · 4:42 PM</div>
                <div style="font-size:10px;color:var(--text-3);margin-top:1px;">⛽ Fuel: 75%</div>
                <div style="font-size:10px;color:var(--text-3);">5 zones documented</div>
              </div>
            </div>

            <!-- Zone-by-zone comparison table -->
            <div style="padding:10px 14px;border-bottom:1px solid var(--border);">
              <div style="font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Photo Comparison — Zone by Zone</div>

              <!-- Table header -->
              <div style="display:grid;grid-template-columns:80px 1fr 1fr 50px;gap:4px;margin-bottom:6px;">
                <div style="font-size:9px;font-weight:700;color:var(--text-3);text-transform:uppercase;">Zone</div>
                <div style="font-size:9px;font-weight:700;color:#2d6a4f;text-transform:uppercase;text-align:center;">Pickup</div>
                <div style="font-size:9px;font-weight:700;color:#c62828;text-transform:uppercase;text-align:center;">Return</div>
                <div style="font-size:9px;font-weight:700;color:var(--text-3);text-transform:uppercase;text-align:center;">Δ</div>
              </div>

              <!-- Zone rows: populated by rcOpenCert() -->
              <div id="cert-zone-rows"></div>
            </div>

            <!-- Damage notes -->
            <div style="padding:10px 14px;border-bottom:1px solid var(--border);">
              <div style="font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Damage &amp; Condition Notes</div>
              <div id="cert-damage-notes" style="font-size:12px;color:var(--text-2);line-height:1.6;">
                <div style="margin-bottom:3px;"><strong>Pickup:</strong> No damage noted. All accessories present and accounted for.</div>
                <div><strong>Return:</strong> Minor grass residue on blade guard — normal operational wear. No structural damage. All accessories returned.</div>
              </div>
            </div>

            <!-- Financial summary -->
            <div style="padding:10px 14px;border-bottom:1px solid var(--border);">
              <div style="font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Financial Summary</div>
              <div style="font-size:12px;color:var(--text-2);line-height:1.9;">
                <div style="display:flex;justify-content:space-between;"><span>Rental (7 days × $45)</span><span style="font-weight:600;">$315.00</span></div>
                <div style="display:flex;justify-content:space-between;"><span>Security deposit</span><span style="font-weight:600;">$150.00 held</span></div>
                <div style="display:flex;justify-content:space-between;border-top:1px solid var(--border);padding-top:5px;margin-top:3px;"><span style="font-weight:700;color:var(--text);">Deposit outcome</span><span style="font-weight:700;color:var(--green);">FULL REFUND ✓</span></div>
              </div>
            </div>

            <!-- Sign-off -->
            <div style="padding:10px 14px;border-bottom:1px solid var(--border);">
              <div style="font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Digital Sign-Off</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div style="background:var(--bg);border-radius:10px;border:1px solid var(--border);padding:10px 12px;text-align:center;">
                  <div style="font-size:11px;font-weight:600;color:var(--text-3);margin-bottom:6px;">Contractor</div>
                  <div style="font-size:15px;font-style:italic;color:var(--green);font-family:Georgia,serif;margin-bottom:3px;">G. Thomas</div>
                  <div style="font-size:9px;color:var(--text-3);">Green Thumb Co.</div>
                  <div style="font-size:9px;color:var(--text-3);">Sun 11 May · 5:01 PM</div>
                </div>
                <div style="background:var(--bg);border-radius:10px;border:1px solid var(--border);padding:10px 12px;text-align:center;">
                  <div style="font-size:11px;font-weight:600;color:var(--text-3);margin-bottom:6px;">Customer</div>
                  <div style="font-size:15px;font-style:italic;color:var(--green);font-family:Georgia,serif;margin-bottom:3px;">J. Ahchee</div>
                  <div style="font-size:9px;color:var(--text-3);">14 Knuckey St, Katherine NT</div>
                  <div style="font-size:9px;color:var(--text-3);">Sun 11 May · 5:03 PM</div>
                </div>
              </div>
            </div>

            <!-- QR / verification footer -->
            <div style="padding:10px 14px;text-align:center;">
              <div style="font-size:10px;color:var(--text-3);line-height:1.5;">
                🔐 Certificate cryptographically sealed · Cannot be altered after sign-off<br/>
                Verify at <strong style="color:var(--green);">crew.app/cert/RC-2026-0001</strong>
              </div>
            </div>

          </div>
        </div>

        <!-- Export CTA -->
        <div style="position:absolute;bottom:0;left:0;right:0;padding:10px 14px;background:var(--surface);border-top:1px solid var(--border);display:flex;gap:8px;">
          <button onclick="rcShareCert()" style="flex:1;background:none;border:1.5px solid var(--green);color:var(--green);border-radius:12px;padding:12px;font-size:13px;font-weight:600;cursor:pointer;">Share Link</button>
          <button onclick="rcExportPDF()" style="flex:1;background:var(--green);color:white;border:none;border-radius:12px;padding:12px;font-size:13px;font-weight:700;cursor:pointer;">📄 Export PDF</button>
        </div>

      </div>`;

// ─── Handover + offline + cert JS IIFE ───────────────────────────────────────

const HANDOVER_JS = `
<!-- ═══════════════════════════════════════════════════════════════════════════
     HANDOVER INSPECTION + OFFLINE SYNC + CONDITION CERTIFICATE
     ═══════════════════════════════════════════════════════════════════════════ -->
<script>
(function(){
  'use strict';

  // ── Zone definitions ────────────────────────────────────────────────────────
  var HW_ZONES = {
    1: [
      { key:'front',   label:'Front',        hint:'Full width, 3 ft back',       icon:'📷', bg:'linear-gradient(135deg,#2d6a4f,#52b788)' },
      { key:'rear',    label:'Rear',          hint:'Include attachments',          icon:'📷', bg:'linear-gradient(135deg,#1b5e20,#388e3c)' },
      { key:'left',    label:'Left Side',     hint:'Full length visible',          icon:'📷', bg:'linear-gradient(135deg,#004d40,#00796b)' },
      { key:'right',   label:'Right Side',    hint:'Full length visible',          icon:'📷', bg:'linear-gradient(135deg,#33691e,#558b2f)' },
      { key:'engine',  label:'Engine/Motor',  hint:'Remove cover if safe',         icon:'⚙️', bg:'linear-gradient(135deg,#37474f,#546e7a)' },
      { key:'access',  label:'Accessories',   hint:'All items laid out',           icon:'📦', bg:'linear-gradient(135deg,#4a148c,#6a1b9a)' },
      { key:'fuel',    label:'Fuel Level',    hint:'Gauge clearly visible',        icon:'⛽', bg:'linear-gradient(135deg,#bf360c,#e64a19)' },
      { key:'doc',     label:'Agreement',     hint:'Scan full document',           icon:'📄', bg:'linear-gradient(135deg,#0d47a1,#1565c0)' }
    ],
    2: [
      { key:'onsite',  label:'On-site',       hint:'Item at delivery address',     icon:'📍', bg:'linear-gradient(135deg,#2d6a4f,#52b788)' },
      { key:'handover',label:'Handover',      hint:'Customer present in frame',    icon:'🤝', bg:'linear-gradient(135deg,#01579b,#0288d1)' },
      { key:'odo',     label:'Hours/Odo',     hint:'Meter reading visible',        icon:'🔢', bg:'linear-gradient(135deg,#e65100,#f57c00)' }
    ],
    3: [
      { key:'rfrt',    label:'Front',         hint:'Compare to departure',         icon:'📷', bg:'linear-gradient(135deg,#2d6a4f,#52b788)' },
      { key:'rrear',   label:'Rear',          hint:'Check for new marks',          icon:'📷', bg:'linear-gradient(135deg,#1b5e20,#388e3c)' },
      { key:'rdmg',    label:'Damage?',       hint:'Close-up any anomalies',       icon:'🔍', bg:'linear-gradient(135deg,#b71c1c,#c62828)' },
      { key:'rfuel',   label:'Fuel Level',    hint:'Return fuel gauge',            icon:'⛽', bg:'linear-gradient(135deg,#bf360c,#e64a19)' },
      { key:'racc',    label:'Accessories',   hint:'All items returned',           icon:'📦', bg:'linear-gradient(135deg,#4a148c,#6a1b9a)' }
    ],
    4: [
      { key:'stored',  label:'In Storage',    hint:'Final position, full view',    icon:'🏚️', bg:'linear-gradient(135deg,#4e342e,#6d4c41)' },
      { key:'cleaned', label:'Post-Clean',    hint:'After cleaning, ready to relist',icon:'🧹',bg:'linear-gradient(135deg,#1a237e,#283593)' }
    ]
  };

  var HW_STAGE_LABELS = {
    1: 'Stage 1 of 4 · Pre-Departure',
    2: 'Stage 2 of 4 · Delivery at Customer',
    3: 'Stage 3 of 4 · Return Inspection',
    4: 'Stage 4 of 4 · Storage Return'
  };

  // ── Inspection data store ──────────────────────────────────────────────────
  window.RC_INSP = {
    itemName:   'Honda HRX Mower',
    itemId:     'r1',
    contractor: 'Green Thumb Co.',
    customer:   'J. Ahchee',
    certNo:     'RC-2026-' + (Math.floor(Math.random() * 9000) + 1000),
    thumbBg:    'linear-gradient(135deg,#2d6a4f,#52b788)',
    thumbEm:    '🌿',
    stages:     { 1:{}, 2:{}, 3:{}, 4:{} },
    damage:     'none'
  };

  // Sync from rcDetail_item if available
  function _syncInspItem() {
    if (window.rcDetailItem && window.rcDetailItem.name) {
      RC_INSP.itemName  = window.rcDetailItem.name;
      RC_INSP.itemId    = window.rcDetailItem.id;
      RC_INSP.thumbBg   = window.rcDetailItem.thumb ? window.rcDetailItem.thumb.bg : RC_INSP.thumbBg;
      RC_INSP.thumbEm   = window.rcDetailItem.thumb ? window.rcDetailItem.thumb.em : RC_INSP.thumbEm;
      RC_INSP.contractor= window.rcDetailItem.owner || RC_INSP.contractor;
    }
  }

  // ── Offline sync queue ─────────────────────────────────────────────────────
  var OQ = {
    KEY: 'crew_rental_sync_queue_v1',

    load: function() {
      try { return JSON.parse(localStorage.getItem(OQ.KEY) || '[]'); } catch(e) { return []; }
    },

    save: function(q) {
      try { localStorage.setItem(OQ.KEY, JSON.stringify(q)); } catch(e) {}
    },

    push: function(item) {
      var q = OQ.load(); q.push(item); OQ.save(q); OQ.updateBanner();
    },

    flush: function() {
      if (!navigator.onLine) return;
      var q = OQ.load();
      if (!q.length) { OQ.updateBanner(); return; }
      OQ.save([]);
      OQ.updateBanner();
      if (typeof showToast === 'function')
        showToast('☁️', q.length + ' inspection record' + (q.length > 1 ? 's' : '') + ' synced');
    },

    updateBanner: function() {
      var badge = document.getElementById('hw-offline-badge');
      var qcount = document.getElementById('hw-queue-count');
      if (!badge) return;
      var online = navigator.onLine;
      var q = OQ.load();
      if (!online) {
        badge.textContent = '● Offline — ' + q.length + ' capture' + (q.length !== 1 ? 's' : '') + ' queued';
        badge.style.color = '#fff';
        var banner = document.getElementById('hw-offline-banner');
        if (banner) banner.style.background = '#e65100';
        if (qcount) { qcount.textContent = q.length + ' queued'; qcount.style.display = ''; }
      } else if (q.length) {
        badge.textContent = '● Syncing ' + q.length + ' item' + (q.length > 1 ? 's' : '') + '…';
        var banner2 = document.getElementById('hw-offline-banner');
        if (banner2) banner2.style.background = '#f4a62a';
        setTimeout(function() { OQ.flush(); }, 1000);
      } else {
        badge.textContent = '● Online — All data synced';
        var banner3 = document.getElementById('hw-offline-banner');
        if (banner3) banner3.style.background = '#00796b';
        if (qcount) qcount.style.display = 'none';
      }
    }
  };

  window.addEventListener('online',  function() { OQ.flush(); OQ.updateBanner(); });
  window.addEventListener('offline', function() { OQ.updateBanner(); });

  // ── Zone card renderer ─────────────────────────────────────────────────────
  function _makeZoneDot(stageKey, zone) {
    var cap = RC_INSP.stages[stageKey][zone.key];
    var col = cap ? 'var(--green)' : 'var(--border)';
    return '<div title="' + zone.label + '" style="display:flex;flex-direction:column;align-items:center;gap:2px;">'
      + '<div style="width:20px;height:20px;border-radius:50%;background:' + col + ';transition:background .2s;"></div>'
      + '<span style="font-size:8px;font-weight:600;color:var(--text-3);white-space:nowrap;max-width:28px;overflow:hidden;text-overflow:ellipsis;">' + zone.label.split('/')[0] + '</span>'
      + '</div>';
  }

  function _makeZoneCard(stageKey, zone) {
    var cap = RC_INSP.stages[stageKey][zone.key];
    var captured = cap && cap.captured;
    var statusColor = captured ? 'var(--green)' : 'var(--text-3)';
    var statusText  = captured ? '✓ Captured'   : 'Required';

    var captureArea = captured
      ? '<div class="hw-zone-area" onclick="hwCapture(' + stageKey + ',\'' + zone.key + '\')" '
        + 'style="height:86px;background:' + (cap.bg || RC_INSP.thumbBg) + ';position:relative;display:flex;align-items:center;justify-content:center;cursor:pointer;">'
        + '<span style="font-size:28px;opacity:.4;">' + RC_INSP.thumbEm + '</span>'
        + '<div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.6);padding:3px 8px;">'
        + '<div style="font-size:9px;color:white;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">📍 ' + cap.gps + '</div>'
        + '<div style="font-size:9px;color:rgba(255,255,255,.75);">🕐 ' + cap.timestamp + '</div>'
        + '</div>'
        + '<button onclick="event.stopPropagation();hwCapture(' + stageKey + ',\'' + zone.key + '\')" '
        + 'style="position:absolute;top:5px;right:5px;background:rgba(0,0,0,.5);color:white;border:none;border-radius:6px;padding:2px 7px;font-size:9px;font-weight:700;cursor:pointer;">Retake</button>'
        + '</div>'
      : '<div class="hw-zone-area" onclick="hwCapture(' + stageKey + ',\'' + zone.key + '\')" '
        + 'style="height:86px;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;border-top:1px solid var(--border);">'
        + '<span style="font-size:24px;">📷</span>'
        + '<span style="font-size:11px;font-weight:600;color:var(--text-3);">Tap to capture</span>'
        + '<span style="font-size:9px;color:var(--text-3);">' + zone.hint + '</span>'
        + '</div>';

    return '<div id="hw-zone-' + stageKey + '-' + zone.key + '" style="background:var(--surface);border-radius:10px;border:1px solid var(--border);overflow:hidden;margin-bottom:8px;">'
      + '<div style="display:flex;align-items:center;gap:9px;padding:9px 12px;">'
      + '<div style="width:30px;height:30px;background:' + zone.bg + ';border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">' + zone.icon + '</div>'
      + '<div style="flex:1;"><div style="font-size:12px;font-weight:700;color:var(--text);">' + zone.label + '</div>'
      + '<div style="font-size:10px;color:var(--text-3);">' + zone.hint + '</div></div>'
      + '<span class="hw-zone-status" style="font-size:10px;font-weight:700;color:' + statusColor + ';">' + statusText + '</span>'
      + '</div>'
      + captureArea
      + '<div style="padding:6px 12px;border-top:1px solid var(--border);">'
      + '<input placeholder="Notes… (optional)" oninput="hwNote(' + stageKey + ',\'' + zone.key + '\',this.value)" '
      + 'style="width:100%;border:none;outline:none;font-size:11px;color:var(--text);background:none;box-sizing:border-box;"/>'
      + '</div></div>';
  }

  function _renderZones(stageKey) {
    var zones = HW_ZONES[stageKey];
    if (!zones) return;
    // Dots
    var dots = document.getElementById('hw-dots-' + stageKey);
    if (dots) {
      var dh = '';
      for (var d = 0; d < zones.length; d++) dh += _makeZoneDot(stageKey, zones[d]);
      dots.innerHTML = dh;
    }
    // Cards
    var container = document.getElementById('hw-zones-' + stageKey);
    if (!container) return;
    var html = '';
    for (var i = 0; i < zones.length; i++) html += _makeZoneCard(stageKey, zones[i]);
    container.innerHTML = html;
    _updateProgress(stageKey);
  }

  // ── Zone capture ───────────────────────────────────────────────────────────
  window.hwCapture = function(stageKey, zoneKey) {
    var zones = HW_ZONES[stageKey];
    var zone = null;
    for (var i = 0; i < zones.length; i++) { if (zones[i].key === zoneKey) { zone = zones[i]; break; } }
    if (!zone) return;

    var now = new Date();
    var ts  = ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2)
            + ' · ' + now.toLocaleDateString('en-AU', {weekday:'short', day:'numeric', month:'short', year:'numeric'});
    var gps = (-14.464 - Math.random() * 0.02).toFixed(3) + ', ' + (132.264 + Math.random() * 0.02).toFixed(3);

    RC_INSP.stages[stageKey][zoneKey] = {
      label: zone.label, captured: true,
      timestamp: ts, gps: gps,
      bg: zone.bg, condition: 'good', notes: ''
    };

    // Re-render this card
    var card = document.getElementById('hw-zone-' + stageKey + '-' + zoneKey);
    if (card) card.outerHTML = _makeZoneCard(stageKey, zone);

    _updateProgress(stageKey);

    // Queue for sync if offline
    if (!navigator.onLine) {
      OQ.push({ s: stageKey, z: zoneKey, ts: ts, gps: gps });
    } else {
      OQ.updateBanner();
    }
  };

  window.hwNote = function(stageKey, zoneKey, val) {
    if (RC_INSP.stages[stageKey][zoneKey]) RC_INSP.stages[stageKey][zoneKey].notes = val;
  };

  function _updateProgress(stageKey) {
    var zones = HW_ZONES[stageKey];
    var cap = 0;
    for (var i = 0; i < zones.length; i++) { if (RC_INSP.stages[stageKey][zones[i].key]) cap++; }
    var total = zones.length;
    var pct = Math.round(cap / total * 100);

    var prog = document.getElementById('hw-progress-' + stageKey);
    if (prog) prog.textContent = cap + '/' + total + ' zones';
    var bar = document.getElementById('hw-bar-' + stageKey);
    if (bar) bar.style.width = pct + '%';

    // Refresh dots
    var dots = document.getElementById('hw-dots-' + stageKey);
    if (dots) {
      var dh = '';
      for (var d = 0; d < zones.length; d++) dh += _makeZoneDot(stageKey, zones[d]);
      dots.innerHTML = dh;
    }

    if (cap === total) {
      var banner = document.getElementById('hw-complete-' + stageKey);
      if (banner) banner.style.display = '';
    }

    // Update total photo count on stage 4 summary
    var total_all = 0;
    for (var s = 1; s <= 4; s++) {
      var sz = HW_ZONES[s]; if (!sz) continue;
      for (var j = 0; j < sz.length; j++) { if (RC_INSP.stages[s] && RC_INSP.stages[s][sz[j].key]) total_all++; }
    }
    var tp = document.getElementById('hw-total-photos');
    if (tp) tp.textContent = total_all;
  }

  // ── Stage navigation ──────────────────────────────────────────────────────
  window.hwGoStep = function(n) {
    for (var s = 1; s <= 4; s++) {
      var pane = document.getElementById('hw-pane-' + s);
      var step = document.getElementById('hw-step-' + s);
      if (pane) pane.style.display = (s === n) ? '' : 'none';
      if (step) {
        var active = (s <= n);
        step.style.borderBottomColor = active ? 'var(--green)' : 'var(--border)';
        var lbl = step.querySelector('div:last-child');
        if (lbl) { lbl.style.color = active ? 'var(--green)' : 'var(--text-3)'; lbl.style.fontWeight = active ? '700' : '600'; }
      }
    }
    var hl = document.getElementById('hw-stage-label');
    if (hl) hl.textContent = HW_STAGE_LABELS[n] || '';

    _syncInspItem();
    _renderZones(n);
    OQ.updateBanner();
  };

  window.hwDamage = function(lvl, btn) {
    RC_INSP.damage = lvl;
    var parent = btn ? btn.parentNode : null;
    if (parent) {
      var btns = parent.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        btns[i].style.background = 'none'; btns[i].style.fontWeight = '600';
        btns[i].style.color = btns[i].textContent.indexOf('✓') > -1 ? 'var(--green)' : (btns[i].textContent.indexOf('Damaged') > -1 ? '#c62828' : 'var(--text-3)');
      }
      btn.style.background = lvl === 'significant' ? '#ffebee' : 'var(--green-pale)';
      btn.style.fontWeight = '700';
    }
    var msgs = { none: 'No damage noted — deposit refund in full ✓', minor: 'Minor damage flagged — noted in certificate', significant: 'Damage recorded — deposit claim initiated' };
    if (typeof showToast === 'function') showToast(lvl === 'significant' ? '⚠️' : '✅', msgs[lvl]);
  };

  window.hwCustomerConfirm  = function() { if (typeof showToast === 'function') showToast('✅','Receipt confirmed — rental clock started'); };
  window.hwCustomerRelease  = function() { if (typeof showToast === 'function') showToast('✅','Equipment released — contractor heading to storage'); };

  // ── Condition Certificate ─────────────────────────────────────────────────
  window.rcOpenCert = function() {
    _syncInspItem();
    var certNo = RC_INSP.certNo || ('RC-2026-' + (Math.floor(Math.random() * 9000) + 1000));
    RC_INSP.certNo = certNo;

    var set = function(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
    set('cert-no-label',     certNo + ' · Inspection complete');
    set('cert-no-display',   'Certificate No. ' + certNo);
    set('cert-item-name',    RC_INSP.itemName);
    set('cert-contractor',   RC_INSP.contractor);
    set('cert-customer',     RC_INSP.customer || 'J. Ahchee');

    var now = new Date();
    var ts = now.toLocaleDateString('en-AU', {weekday:'short', day:'numeric', month:'short', year:'numeric'});
    set('cert-return-ts', ts + ' · ' + ('0'+now.getHours()).slice(-2) + ':' + ('0'+now.getMinutes()).slice(-2));

    // Build zone comparison rows
    var rows = document.getElementById('cert-zone-rows');
    if (rows) {
      var COMPARE_ZONES = [
        { key:'front',  rkey:'rfrt',   label:'Front'      },
        { key:'rear',   rkey:'rrear',  label:'Rear'       },
        { key:'engine', rkey:'rdmg',   label:'Engine/Dmg' },
        { key:'access', rkey:'racc',   label:'Accessories'},
        { key:'fuel',   rkey:'rfuel',  label:'Fuel Level' },
        { key:'doc',    rkey:'odo',    label:'Agreement'  }
      ];
      var html = '';
      for (var i = 0; i < COMPARE_ZONES.length; i++) {
        var z = COMPARE_ZONES[i];
        var pick  = RC_INSP.stages[1][z.key]  || RC_INSP.stages[2][z.key]  || null;
        var ret   = RC_INSP.stages[3][z.rkey] || RC_INSP.stages[4][z.key]  || null;
        var delta = (!pick || !ret) ? '—' : (RC_INSP.damage !== 'none' && z.key === 'engine' ? '⚠️' : '✓');
        var pickCell  = pick  ? '<div style="height:44px;background:' + pick.bg  + ';border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:18px;">' + RC_INSP.thumbEm + '</div>' : '<div style="height:44px;background:var(--bg);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--text-3);">—</div>';
        var retCell   = ret   ? '<div style="height:44px;background:' + ret.bg   + ';border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:18px;">' + RC_INSP.thumbEm + '</div>' : '<div style="height:44px;background:var(--bg);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--text-3);">—</div>';
        var dCol = delta === '✓' ? 'var(--green)' : (delta === '⚠️' ? '#e65100' : 'var(--text-3)');
        html += '<div style="display:grid;grid-template-columns:80px 1fr 1fr 50px;gap:4px;margin-bottom:6px;align-items:center;">'
          + '<div style="font-size:11px;font-weight:600;color:var(--text-2);">' + z.label + '</div>'
          + '<div>' + pickCell + '</div>'
          + '<div>' + retCell + '</div>'
          + '<div style="text-align:center;font-size:14px;font-weight:700;color:' + dCol + ';">' + delta + '</div>'
          + '</div>';
      }
      rows.innerHTML = html;
    }

    if (typeof goTo === 'function') goTo('s-condition-cert');
  };

  window.rcExportPDF = function() {
    if (typeof showToast === 'function') showToast('📄','Opening print dialog…');
    var certEl = document.getElementById('cert-content');
    if (!certEl) return;

    var item = RC_INSP.itemName || 'Equipment';
    var certNo = RC_INSP.certNo || 'RC-0000';

    var printHtml = '<!DOCTYPE html><html><head><meta charset="utf-8"/>'
      + '<title>Condition Certificate — ' + item + '</title>'
      + '<style>'
      + 'body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;margin:0;padding:24px;color:#1a1a1a;font-size:12px;line-height:1.5;}'
      + '.header{background:linear-gradient(135deg,#1b4332,#2d6a4f);color:white;padding:20px 24px;border-radius:8px 8px 0 0;text-align:center;}'
      + '.header h1{margin:0;font-size:20px;letter-spacing:.03em;}'
      + '.header p{margin:4px 0 0;opacity:.7;font-size:11px;}'
      + '.body{border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px;overflow:hidden;}'
      + '.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:14px 16px;border-bottom:1px solid #eee;}'
      + '.meta-grid .lbl{font-size:9px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px;}'
      + '.meta-grid .val{font-weight:700;font-size:13px;}'
      + '.compare-header{display:grid;grid-template-columns:1fr 1fr;}'
      + '.col-pickup{padding:12px 14px;border-right:1px solid #eee;border-bottom:1px solid #eee;}'
      + '.col-return{padding:12px 14px;border-bottom:1px solid #eee;}'
      + '.col-lbl{font-size:9px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px;}'
      + '.col-cond{font-size:13px;font-weight:700;color:#2d6a4f;}'
      + '.zone-table{padding:12px 14px;border-bottom:1px solid #eee;}'
      + '.zone-table h3{margin:0 0 8px;font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.06em;}'
      + '.zone-row{display:grid;grid-template-columns:90px 1fr 1fr 40px;gap:6px;margin-bottom:8px;align-items:center;font-size:11px;}'
      + '.zone-row .zone-name{font-weight:600;}'
      + '.zone-thumb{height:40px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:18px;}'
      + '.zone-thumb.captured{background:linear-gradient(135deg,#2d6a4f,#52b788);}'
      + '.zone-thumb.empty{background:#f5f5f5;color:#aaa;font-size:11px;}'
      + '.delta-ok{color:#2d6a4f;font-weight:700;text-align:center;}'
      + '.delta-warn{color:#e65100;font-weight:700;text-align:center;}'
      + '.financial{padding:12px 14px;border-bottom:1px solid #eee;}'
      + '.financial h3{margin:0 0 8px;font-size:10px;font-weight:700;color:#888;text-transform:uppercase;}'
      + '.fin-row{display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;}'
      + '.fin-row.total{border-top:1px solid #eee;padding-top:6px;margin-top:4px;font-weight:700;}'
      + '.signatures{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:12px 14px;border-bottom:1px solid #eee;}'
      + '.sig-box{border:1px solid #ddd;border-radius:8px;padding:10px;text-align:center;}'
      + '.sig-lbl{font-size:9px;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:8px;}'
      + '.sig-name{font-size:16px;font-style:italic;color:#2d6a4f;font-family:Georgia,serif;}'
      + '.sig-detail{font-size:9px;color:#888;margin-top:4px;}'
      + '.footer{padding:10px 14px;text-align:center;font-size:10px;color:#aaa;}'
      + '@media print{body{padding:0;}@page{margin:18mm;}}'
      + '</style></head><body>'
      + '<div class="header"><p>CREW PLATFORM</p><h1>CONDITION CERTIFICATE</h1><p>No. ' + certNo + '</p></div>'
      + '<div class="body">'
      + '<div class="meta-grid">'
      + '<div><div class="lbl">Equipment</div><div class="val">' + (RC_INSP.itemName||'—') + '</div></div>'
      + '<div><div class="lbl">Contractor</div><div class="val">' + (RC_INSP.contractor||'—') + '</div></div>'
      + '<div><div class="lbl">Rental Period</div><div class="val">5 – 11 May 2026</div></div>'
      + '<div><div class="lbl">Customer</div><div class="val">' + (RC_INSP.customer||'J. Ahchee') + '</div></div>'
      + '</div>'
      + '<div class="compare-header">'
      + '<div class="col-pickup"><div class="col-lbl">📸 Pickup Inspection</div><div class="col-cond">Excellent ✓</div><div style="font-size:10px;color:#888;margin-top:3px;">Mon 5 May · 10:15 AM · ⛽ Full</div></div>'
      + '<div class="col-return"><div class="col-lbl">📸 Return Inspection</div><div class="col-cond">Good ✓</div><div style="font-size:10px;color:#888;margin-top:3px;">Sun 11 May · 4:42 PM · ⛽ 75%</div></div>'
      + '</div>'
      + '<div class="zone-table"><h3>Photo Comparison — Zone by Zone</h3>'
      + '<div class="zone-row" style="font-size:9px;font-weight:700;color:#888;text-transform:uppercase;">'
      + '<div>Zone</div><div style="text-align:center;color:#2d6a4f;">Pickup</div><div style="text-align:center;color:#c62828;">Return</div><div style="text-align:center;">Δ</div></div>'
      + _pdfZoneRows()
      + '</div>'
      + '<div class="financial"><h3>Financial Summary</h3>'
      + '<div class="fin-row"><span>Rental (7 days × $45)</span><span>$315.00</span></div>'
      + '<div class="fin-row"><span>Security deposit held</span><span>$150.00</span></div>'
      + '<div class="fin-row total"><span>Deposit outcome</span><span style="color:#2d6a4f;">FULL REFUND ✓</span></div>'
      + '</div>'
      + '<div class="signatures">'
      + '<div class="sig-box"><div class="sig-lbl">Contractor</div><div class="sig-name">G. Thomas</div><div class="sig-detail">Green Thumb Co.<br/>Sun 11 May · 5:01 PM</div></div>'
      + '<div class="sig-box"><div class="sig-lbl">Customer</div><div class="sig-name">J. Ahchee</div><div class="sig-detail">14 Knuckey St, Katherine NT<br/>Sun 11 May · 5:03 PM</div></div>'
      + '</div>'
      + '<div class="footer">🔐 Cryptographically sealed · Cannot be altered after sign-off · crew.app/cert/' + certNo + '</div>'
      + '</div></body></html>';

    setTimeout(function() {
      var win = window.open('', '_blank', 'width=820,height=1060');
      if (win) {
        win.document.write(printHtml);
        win.document.close();
        win.focus();
        setTimeout(function() { win.print(); }, 600);
      } else {
        if (typeof showToast === 'function') showToast('⚠️','Allow pop-ups to export PDF');
      }
    }, 300);
  };

  function _pdfZoneRows() {
    var ZONES = [
      { key:'front',  rkey:'rfrt',  label:'Front'       },
      { key:'rear',   rkey:'rrear', label:'Rear'        },
      { key:'engine', rkey:'rdmg',  label:'Engine/Motor'},
      { key:'access', rkey:'racc',  label:'Accessories' },
      { key:'fuel',   rkey:'rfuel', label:'Fuel Level'  },
      { key:'doc',    rkey:'odo',   label:'Agreement'   }
    ];
    var html = '';
    for (var i = 0; i < ZONES.length; i++) {
      var z    = ZONES[i];
      var pick = RC_INSP.stages[1][z.key]  || RC_INSP.stages[2][z.key]  || null;
      var ret  = RC_INSP.stages[3][z.rkey] || RC_INSP.stages[4][z.key]  || null;
      var d    = (!pick && !ret) ? '—' : (RC_INSP.damage === 'significant' && z.key === 'engine' ? '⚠️' : '✓');
      var dCls = d === '✓' ? 'delta-ok' : (d === '⚠️' ? 'delta-warn' : '');
      html += '<div class="zone-row">'
        + '<div class="zone-name">' + z.label + '</div>'
        + '<div class="zone-thumb ' + (pick ? 'captured' : 'empty') + '">' + (pick ? RC_INSP.thumbEm : '—') + '</div>'
        + '<div class="zone-thumb ' + (ret  ? 'captured' : 'empty') + '">' + (ret  ? RC_INSP.thumbEm : '—') + '</div>'
        + '<div class="' + dCls + '">' + d + '</div>'
        + '</div>';
    }
    return html;
  }

  window.rcShareCert = function() {
    var certNo = RC_INSP.certNo || 'RC-0000';
    if (typeof showToast === 'function') showToast('🔗','Link copied: crew.app/cert/' + certNo);
  };

  // ── Auto-init ──────────────────────────────────────────────────────────────
  function _autoInit() {
    OQ.updateBanner();
    // Pre-render stage 1 zones if wizard is visible
    var pane1 = document.getElementById('hw-pane-1');
    if (pane1 && pane1.style.display !== 'none') {
      _syncInspItem();
      _renderZones(1);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _autoInit);
  } else {
    _autoInit();
  }

})();
</script>`;

// ─── Print CSS ────────────────────────────────────────────────────────────────

const PRINT_CSS = `
<style id="cert-print-css">
@media print {
  .phone-wrap, .phone-frame, #nav-user, #nav-contractor, body > div:not(#cert-print-root) { display: none !important; }
}
</style>`;

// ─── xbtn for s-condition-cert ────────────────────────────────────────────────

const CERT_XBTN_CUST = '  <button onclick="rcOpenCert()" class="xbtn">📄 Condition Cert</button>\n';
const CERT_XBTN_CREW = '  <button onclick="rcOpenCert()" class="xbtn">📄 Condition Cert</button>\n';

// ─── Main ─────────────────────────────────────────────────────────────────────

const FILES = [
  { name: 'Crew_App_Customer_Role.html', isCrew: false },
  { name: 'Crew_App_Crew_Member.html',   isCrew: true  },
];

// Phone-screen end markers
const CUST_PHONE_END = '</div><!-- /phone-screen -->';
const CREW_PHONE_END = '      <!-- /phone-screen -->';

// JS insertion point — before the existing rental JS block
const JS_MARKER = '</body>';

// xbtn anchor
const XBTN_ANCHOR = '  <button onclick="goTo(\'s-handover-wizard\')" class="xbtn">📸 Handover</button>';

for (const { name, isCrew } of FILES) {
  const filePath = path.join(ROOT, name);
  let html = fs.readFileSync(filePath, 'utf8');

  // 1. Replace s-handover-wizard
  let h1 = replaceScreen(html, 's-handover-wizard', S_HANDOVER_WIZARD);
  if (!h1) { console.log('  ' + name + ': ⚠ s-handover-wizard not found'); }
  else { html = h1; console.log('  ' + name + ': ✓ s-handover-wizard rebuilt (Snap&Drive zones)'); }

  // 2. Insert s-condition-cert before phone-screen end
  const phoneMarker = isCrew ? CREW_PHONE_END : CUST_PHONE_END;
  let h2 = insertBefore(html, phoneMarker, S_CONDITION_CERT);
  if (!h2) { console.log('  ' + name + ': ⚠ phone-screen marker not found (s-condition-cert skipped)'); }
  else { html = h2; console.log('  ' + name + ': ✓ s-condition-cert inserted'); }

  // 3. Inject handover + offline + cert JS before </body>
  let h3 = insertBefore(html, JS_MARKER, HANDOVER_JS);
  if (!h3) { console.log('  ' + name + ': ⚠ </body> not found (JS skipped)'); }
  else { html = h3; console.log('  ' + name + ': ✓ handover/offline/cert JS injected'); }

  // 4. Add print CSS before </head>
  let h4 = strReplace(html, '</head>', PRINT_CSS + '\n</head>');
  if (!h4) { console.log('  ' + name + ': ⚠ </head> not found (print CSS skipped)'); }
  else { html = h4; console.log('  ' + name + ': ✓ print CSS added'); }

  // 5. Add xbtn for Condition Cert after the Handover xbtn
  const xbtnNew = isCrew ? CERT_XBTN_CREW : CERT_XBTN_CUST;
  let h5 = strReplace(html, XBTN_ANCHOR, XBTN_ANCHOR + '\n' + xbtnNew.trimEnd());
  if (!h5) { console.log('  ' + name + ': ⚠ Handover xbtn not found (Cert xbtn skipped)'); }
  else { html = h5; console.log('  ' + name + ': ✓ Condition Cert xbtn added'); }

  fs.writeFileSync(filePath, html, 'utf8');
  console.log('  ' + name + ': ✓ saved\n');
}

console.log('Done.');
