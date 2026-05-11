'use strict';

const fs   = require('fs');
const path = require('path');
const ROOT = __dirname;

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function strReplace(html, oldStr, newStr) {
  const idx = html.indexOf(oldStr);
  if (idx === -1) return null;
  return html.slice(0, idx) + newStr + html.slice(idx + oldStr.length);
}

function insertBefore(html, marker, newHtml) {
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  return html.slice(0, idx) + newHtml + '\n' + html.slice(idx);
}

// Replace the entire rental JS block (comment header through </script>)
function replaceRentalJS(html, newJS) {
  const startMarker = '<!-- ═══════════════════════════════════════════════════════════════════════════\n     EQUIPMENT RENTALS — JavaScript';
  const start = html.indexOf(startMarker);
  if (start === -1) return null;
  // find the </script> that closes this block
  const end = html.indexOf('</script>', start);
  if (end === -1) return null;
  return html.slice(0, start) + newJS + html.slice(end + '</script>'.length);
}

// ─── s-handover-wizard: 4-stage contractor delivery flow ─────────────────────

const S_HANDOVER_WIZARD = `
      <!-- ═══ HANDOVER WIZARD — 4-Stage Delivery ═══ -->
      <div class="screen hidden" id="s-handover-wizard" style="display:flex;flex-direction:column;overflow:hidden;">

        <!-- Header -->
        <div style="background:var(--green);padding:50px 16px 14px;position:relative;flex-shrink:0;">
          <button class="back-btn" onclick="goBack()">←</button>
          <div style="margin-left:40px;">
            <div style="color:white;font-size:19px;font-weight:600;">Rental Handover</div>
            <div id="hw-stage-label" style="color:rgba(255,255,255,0.75);font-size:13px;">Stage 1 of 4 · Pre-Departure Check</div>
          </div>
        </div>

        <!-- 4-step progress bar -->
        <div style="display:flex;background:var(--surface);border-bottom:1px solid var(--border);flex-shrink:0;padding:0 8px;">
          <div id="hw-step-1" style="flex:1;padding:9px 4px;text-align:center;border-bottom:2px solid var(--green);cursor:pointer;" onclick="hwGoStep(1)">
            <div style="font-size:16px;">🏚️</div><div style="font-size:9px;font-weight:700;color:var(--green);margin-top:2px;">Storage</div>
          </div>
          <div id="hw-step-2" style="flex:1;padding:9px 4px;text-align:center;border-bottom:2px solid var(--border);cursor:pointer;" onclick="hwGoStep(2)">
            <div style="font-size:16px;">🚚</div><div style="font-size:9px;font-weight:600;color:var(--text-3);margin-top:2px;">Delivery</div>
          </div>
          <div id="hw-step-3" style="flex:1;padding:9px 4px;text-align:center;border-bottom:2px solid var(--border);cursor:pointer;" onclick="hwGoStep(3)">
            <div style="font-size:16px;">🔄</div><div style="font-size:9px;font-weight:600;color:var(--text-3);margin-top:2px;">Pickup</div>
          </div>
          <div id="hw-step-4" style="flex:1;padding:9px 4px;text-align:center;border-bottom:2px solid var(--border);cursor:pointer;" onclick="hwGoStep(4)">
            <div style="font-size:16px;">✅</div><div style="font-size:9px;font-weight:600;color:var(--text-3);margin-top:2px;">Stored</div>
          </div>
        </div>

        <!-- Step content -->
        <div style="overflow-y:auto;flex:1;padding:14px;background:var(--bg);">

          <!-- Stage 1: Pre-Departure (Contractor storage) -->
          <div id="hw-pane-1">
            <div style="background:var(--surface);border-radius:12px;border:1px solid var(--green);padding:10px 12px;margin-bottom:12px;display:flex;gap:8px;align-items:flex-start;">
              <span style="font-size:18px;">🏚️</span>
              <div><div style="font-size:12px;font-weight:700;color:var(--green);">Stage 1 — Storage Condition</div><div style="font-size:11px;color:var(--text-3);margin-top:2px;">Contractor photographs equipment at storage before loading for delivery. Creates baseline condition record.</div></div>
            </div>

            <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:8px;">Equipment Photos — Storage Location</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
              <button onclick="hwPhoto('Front view')" style="height:82px;background:var(--surface);border:2px dashed var(--border);border-radius:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;">
                <span style="font-size:22px;">📷</span><span style="font-size:10px;font-weight:600;color:var(--text-3);">Front</span>
              </button>
              <button onclick="hwPhoto('Rear view')" style="height:82px;background:var(--surface);border:2px dashed var(--border);border-radius:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;">
                <span style="font-size:22px;">📷</span><span style="font-size:10px;font-weight:600;color:var(--text-3);">Rear</span>
              </button>
              <button onclick="hwPhoto('Engine / motor')" style="height:82px;background:var(--surface);border:2px dashed var(--border);border-radius:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;">
                <span style="font-size:22px;">📷</span><span style="font-size:10px;font-weight:600;color:var(--text-3);">Engine</span>
              </button>
              <button onclick="hwPhoto('Accessories')" style="height:82px;background:var(--surface);border:2px dashed var(--border);border-radius:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;">
                <span style="font-size:22px;">📷</span><span style="font-size:10px;font-weight:600;color:var(--text-3);">Accessories</span>
              </button>
            </div>

            <div style="background:var(--surface);border-radius:12px;border:1px solid var(--border);overflow:hidden;margin-bottom:14px;">
              <div style="padding:10px 12px;border-bottom:1px solid var(--border);font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.05em;">Pre-Departure Checklist</div>
              <label style="display:flex;align-items:center;gap:12px;padding:11px 12px;border-bottom:1px solid var(--border);cursor:pointer;">
                <input type="checkbox" checked style="width:17px;height:17px;accent-color:var(--green);flex-shrink:0;"/>
                <span style="font-size:13px;color:var(--text);">Fuel/charge level ≥ 75%</span>
              </label>
              <label style="display:flex;align-items:center;gap:12px;padding:11px 12px;border-bottom:1px solid var(--border);cursor:pointer;">
                <input type="checkbox" checked style="width:17px;height:17px;accent-color:var(--green);flex-shrink:0;"/>
                <span style="font-size:13px;color:var(--text);">All accessories packed</span>
              </label>
              <label style="display:flex;align-items:center;gap:12px;padding:11px 12px;cursor:pointer;">
                <input type="checkbox" checked style="width:17px;height:17px;accent-color:var(--green);flex-shrink:0;"/>
                <span style="font-size:13px;color:var(--text);">Clean and operational</span>
              </label>
            </div>

            <button onclick="hwGoStep(2)" style="width:100%;background:var(--green);color:white;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:600;cursor:pointer;">Load & Depart for Delivery →</button>
          </div>

          <!-- Stage 2: Delivery at customer location -->
          <div id="hw-pane-2" style="display:none;">
            <div style="background:var(--surface);border-radius:12px;border:1px solid var(--green);padding:10px 12px;margin-bottom:12px;display:flex;gap:8px;align-items:flex-start;">
              <span style="font-size:18px;">🚚</span>
              <div><div style="font-size:12px;font-weight:700;color:var(--green);">Stage 2 — Delivery Confirmation</div><div style="font-size:11px;color:var(--text-3);margin-top:2px;">Contractor photos equipment at customer's location. Customer confirms receipt.</div></div>
            </div>

            <div style="background:var(--surface);border-radius:12px;border:1px solid var(--border);padding:11px 12px;margin-bottom:12px;display:flex;gap:10px;align-items:center;">
              <span style="font-size:20px;">📍</span>
              <div>
                <div style="font-size:12px;font-weight:700;color:var(--text);">Delivery Address</div>
                <div id="hw-del-address" style="font-size:12px;color:var(--text-3);">14 Knuckey St, Katherine NT 0850</div>
              </div>
            </div>

            <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:8px;">Photos at Customer Location</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
              <button onclick="hwPhoto('Item at delivery site')" style="height:82px;background:var(--surface);border:2px dashed var(--border);border-radius:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;">
                <span style="font-size:22px;">📷</span><span style="font-size:10px;font-weight:600;color:var(--text-3);">On-site</span>
              </button>
              <button onclick="hwPhoto('Customer receiving item')" style="height:82px;background:var(--surface);border:2px dashed var(--border);border-radius:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;">
                <span style="font-size:22px;">📷</span><span style="font-size:10px;font-weight:600;color:var(--text-3);">Handover</span>
              </button>
            </div>

            <div style="background:#e8f5e9;border-radius:12px;border:1px solid var(--green);padding:13px 14px;margin-bottom:14px;text-align:center;">
              <div style="font-size:13px;font-weight:700;color:var(--green);margin-bottom:6px;">Customer — Confirm Receipt</div>
              <div style="font-size:11px;color:var(--text-3);margin-bottom:10px;">Tap to confirm you have received the equipment in the described condition.</div>
              <button onclick="hwCustomerConfirm()" style="background:var(--green);color:white;border:none;border-radius:10px;padding:11px 24px;font-size:13px;font-weight:700;cursor:pointer;">I Confirm Receipt ✓</button>
            </div>

            <div style="display:flex;gap:8px;">
              <button onclick="hwGoStep(1)" style="flex:0 0 auto;background:none;border:1.5px solid var(--border);color:var(--text-2);border-radius:12px;padding:12px 16px;font-size:13px;font-weight:600;cursor:pointer;">← Back</button>
              <button onclick="hwGoStep(3)" style="flex:1;background:var(--green);color:white;border:none;border-radius:12px;padding:12px;font-size:13px;font-weight:600;cursor:pointer;">Delivery Complete →</button>
            </div>
          </div>

          <!-- Stage 3: Return pickup at customer -->
          <div id="hw-pane-3" style="display:none;">
            <div style="background:var(--surface);border-radius:12px;border:1px solid var(--green);padding:10px 12px;margin-bottom:12px;display:flex;gap:8px;align-items:flex-start;">
              <span style="font-size:18px;">🔄</span>
              <div><div style="font-size:12px;font-weight:700;color:var(--green);">Stage 3 — Return Inspection</div><div style="font-size:11px;color:var(--text-3);margin-top:2px;">Contractor collects item. Both parties inspect and photograph return condition.</div></div>
            </div>

            <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:8px;">Return Condition Photos</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
              <button onclick="hwPhoto('Front at return')" style="height:82px;background:var(--surface);border:2px dashed var(--border);border-radius:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;">
                <span style="font-size:22px;">📷</span><span style="font-size:10px;font-weight:600;color:var(--text-3);">Front</span>
              </button>
              <button onclick="hwPhoto('Rear at return')" style="height:82px;background:var(--surface);border:2px dashed var(--border);border-radius:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;">
                <span style="font-size:22px;">📷</span><span style="font-size:10px;font-weight:600;color:var(--text-3);">Rear</span>
              </button>
              <button onclick="hwPhoto('Damage check')" style="height:82px;background:var(--surface);border:2px dashed var(--border);border-radius:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;">
                <span style="font-size:22px;">📷</span><span style="font-size:10px;font-weight:600;color:var(--text-3);">Damage?</span>
              </button>
              <button onclick="hwPhoto('Fuel/charge level')" style="height:82px;background:var(--surface);border:2px dashed var(--border);border-radius:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;">
                <span style="font-size:22px;">📷</span><span style="font-size:10px;font-weight:600;color:var(--text-3);">Fuel/Charge</span>
              </button>
            </div>

            <div style="background:var(--surface);border-radius:12px;border:1px solid var(--border);overflow:hidden;margin-bottom:12px;">
              <div style="padding:10px 12px;border-bottom:1px solid var(--border);font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.05em;">Return Damage Assessment</div>
              <div style="display:flex;gap:0;">
                <button onclick="hwDamage('none')" style="flex:1;padding:10px 4px;border:none;border-right:1px solid var(--border);background:var(--green-pale);cursor:pointer;font-size:11px;font-weight:700;color:var(--green);">✓ None</button>
                <button onclick="hwDamage('minor')" style="flex:1;padding:10px 4px;border:none;border-right:1px solid var(--border);background:none;cursor:pointer;font-size:11px;font-weight:600;color:var(--text-3);">Minor</button>
                <button onclick="hwDamage('significant')" style="flex:1;padding:10px 4px;border:none;background:none;cursor:pointer;font-size:11px;font-weight:600;color:#c62828;">Damaged</button>
              </div>
            </div>

            <div style="background:#e8f5e9;border-radius:12px;border:1px solid var(--green);padding:12px 14px;margin-bottom:14px;text-align:center;">
              <div style="font-size:13px;font-weight:700;color:var(--green);margin-bottom:4px;">Customer — Release Equipment</div>
              <div style="font-size:11px;color:var(--text-3);margin-bottom:10px;">Confirm you have returned all items including accessories.</div>
              <button onclick="hwCustomerRelease()" style="background:var(--green);color:white;border:none;border-radius:10px;padding:11px 24px;font-size:13px;font-weight:700;cursor:pointer;">I Confirm Return ✓</button>
            </div>

            <div style="display:flex;gap:8px;">
              <button onclick="hwGoStep(2)" style="flex:0 0 auto;background:none;border:1.5px solid var(--border);color:var(--text-2);border-radius:12px;padding:12px 16px;font-size:13px;font-weight:600;cursor:pointer;">← Back</button>
              <button onclick="hwGoStep(4)" style="flex:1;background:var(--green);color:white;border:none;border-radius:12px;padding:12px;font-size:13px;font-weight:600;cursor:pointer;">Return to Storage →</button>
            </div>
          </div>

          <!-- Stage 4: Back in contractor storage -->
          <div id="hw-pane-4" style="display:none;">
            <div style="background:var(--surface);border-radius:12px;border:1px solid var(--green);padding:10px 12px;margin-bottom:12px;display:flex;gap:8px;align-items:flex-start;">
              <span style="font-size:18px;">✅</span>
              <div><div style="font-size:12px;font-weight:700;color:var(--green);">Stage 4 — Storage Return</div><div style="font-size:11px;color:var(--text-3);margin-top:2px;">Final photos in storage. Completes the rental cycle and triggers deposit release.</div></div>
            </div>

            <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:8px;">Storage Return Photos</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
              <button onclick="hwPhoto('Item in storage')" style="height:82px;background:var(--surface);border:2px dashed var(--border);border-radius:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;">
                <span style="font-size:22px;">📷</span><span style="font-size:10px;font-weight:600;color:var(--text-3);">In Storage</span>
              </button>
              <button onclick="hwPhoto('Accessories packed')" style="height:82px;background:var(--surface);border:2px dashed var(--border);border-radius:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;">
                <span style="font-size:22px;">📷</span><span style="font-size:10px;font-weight:600;color:var(--text-3);">Accessories</span>
              </button>
            </div>

            <div style="background:var(--surface);border-radius:12px;border:1px solid var(--border);padding:12px 14px;margin-bottom:14px;">
              <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:8px;">Final Condition Rating</div>
              <div style="display:flex;gap:6px;">
                <button onclick="hwRate(1)" style="flex:1;padding:8px;border:1.5px solid var(--border);border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;color:var(--text-3);background:none;">Poor</button>
                <button onclick="hwRate(2)" style="flex:1;padding:8px;border:1.5px solid var(--border);border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;color:var(--text-3);background:none;">Fair</button>
                <button onclick="hwRate(3)" style="flex:1;padding:8px;border:1.5px solid var(--green);border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;color:var(--green);background:var(--green-pale);">Good ✓</button>
                <button onclick="hwRate(4)" style="flex:1;padding:8px;border:1.5px solid var(--border);border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;color:var(--text-3);background:none;">Exc.</button>
              </div>
            </div>

            <div style="background:var(--surface);border-radius:12px;border:1px solid var(--border);padding:12px 14px;margin-bottom:14px;">
              <div style="font-size:11px;color:var(--text-2);line-height:1.7;">
                <div>📸 <strong>10 photos captured</strong> across 4 stages</div>
                <div>🕐 Rental duration: <strong>7 days</strong></div>
                <div>💰 Total charged: <strong>$315</strong></div>
                <div>🔒 Deposit status: <strong>Ready to release</strong></div>
              </div>
            </div>

            <button onclick="showToast('✅','Rental complete! $150 deposit released to customer within 24hrs.')" style="width:100%;background:var(--green);color:white;border:none;border-radius:12px;padding:14px;font-size:14px;font-weight:700;cursor:pointer;">Complete — Release $150 Deposit ✓</button>
          </div>

        </div>
      </div>`;

// ─── s-list-gear (Crew Member only) ──────────────────────────────────────────

const S_LIST_GEAR = `
      <!-- ═══ LIST NEW EQUIPMENT ═══ -->
      <div class="screen hidden" id="s-list-gear" style="display:flex;flex-direction:column;overflow:hidden;">

        <div style="background:var(--green);padding:50px 16px 16px;position:relative;flex-shrink:0;">
          <button class="back-btn" onclick="goBack()">←</button>
          <div style="margin-left:40px;">
            <div style="color:white;font-size:19px;font-weight:600;">List Equipment</div>
            <div style="color:rgba(255,255,255,0.75);font-size:13px;">Add gear to the rental marketplace</div>
          </div>
        </div>

        <div style="overflow-y:auto;flex:1;padding:14px;background:var(--bg);">

          <!-- Equipment photos -->
          <div style="font-size:12px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Equipment Photos</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;">
            <button onclick="showToast('📸','Main photo captured')" style="height:75px;background:var(--surface);border:2px dashed var(--green);border-radius:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">
              <span style="font-size:20px;">📷</span><span style="font-size:9px;font-weight:700;color:var(--green);">Main ★</span>
            </button>
            <button onclick="showToast('📸','Side photo captured')" style="height:75px;background:var(--surface);border:2px dashed var(--border);border-radius:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">
              <span style="font-size:20px;">📷</span><span style="font-size:9px;font-weight:600;color:var(--text-3);">Side</span>
            </button>
            <button onclick="showToast('📸','Detail photo captured')" style="height:75px;background:var(--surface);border:2px dashed var(--border);border-radius:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">
              <span style="font-size:20px;">📷</span><span style="font-size:9px;font-weight:600;color:var(--text-3);">Detail</span>
            </button>
          </div>

          <!-- Equipment details -->
          <div style="font-size:12px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Equipment Details</div>
          <div style="background:var(--surface);border-radius:14px;border:1px solid var(--border);overflow:hidden;margin-bottom:12px;">

            <div style="padding:12px 14px;border-bottom:1px solid var(--border);">
              <div style="font-size:11px;font-weight:600;color:var(--text-3);margin-bottom:4px;">Equipment Name</div>
              <input placeholder="e.g. Honda HRX 217 Mower" style="width:100%;border:none;outline:none;font-size:14px;color:var(--text);background:none;box-sizing:border-box;"/>
            </div>

            <div style="padding:12px 14px;border-bottom:1px solid var(--border);">
              <div style="font-size:11px;font-weight:600;color:var(--text-3);margin-bottom:4px;">Short Description</div>
              <input placeholder="e.g. Self-propelled · 21&quot; cut · Petrol" style="width:100%;border:none;outline:none;font-size:14px;color:var(--text);background:none;box-sizing:border-box;"/>
            </div>

            <div style="padding:12px 14px;border-bottom:1px solid var(--border);">
              <div style="font-size:11px;font-weight:600;color:var(--text-3);margin-bottom:6px;">Category</div>
              <div style="display:flex;flex-wrap:wrap;gap:6px;">
                <button onclick="lgSetCat(this,'Lawn & Garden')" style="padding:5px 11px;border-radius:16px;border:1.5px solid var(--green);background:var(--green);color:white;font-size:11px;font-weight:600;cursor:pointer;">🌿 Lawn & Garden</button>
                <button onclick="lgSetCat(this,'Power Tools')" style="padding:5px 11px;border-radius:16px;border:1.5px solid var(--border);background:none;color:var(--text-2);font-size:11px;font-weight:600;cursor:pointer;">🔧 Power Tools</button>
                <button onclick="lgSetCat(this,'Pressure Washing')" style="padding:5px 11px;border-radius:16px;border:1.5px solid var(--border);background:none;color:var(--text-2);font-size:11px;font-weight:600;cursor:pointer;">💦 Pressure</button>
                <button onclick="lgSetCat(this,'Trailers')" style="padding:5px 11px;border-radius:16px;border:1.5px solid var(--border);background:none;color:var(--text-2);font-size:11px;font-weight:600;cursor:pointer;">🚛 Trailers</button>
                <button onclick="lgSetCat(this,'Concrete & Digging')" style="padding:5px 11px;border-radius:16px;border:1.5px solid var(--border);background:none;color:var(--text-2);font-size:11px;font-weight:600;cursor:pointer;">⛏️ Concrete</button>
                <button onclick="lgSetCat(this,'Access & Lifting')" style="padding:5px 11px;border-radius:16px;border:1.5px solid var(--border);background:none;color:var(--text-2);font-size:11px;font-weight:600;cursor:pointer;">🪜 Access</button>
              </div>
            </div>

            <div style="padding:12px 14px;border-bottom:1px solid var(--border);">
              <div style="font-size:11px;font-weight:600;color:var(--text-3);margin-bottom:4px;">Current Condition</div>
              <div style="display:flex;gap:6px;">
                <button onclick="lgCond(this,'Poor')" style="flex:1;padding:7px;border:1.5px solid var(--border);border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;color:var(--text-3);background:none;">Poor</button>
                <button onclick="lgCond(this,'Fair')" style="flex:1;padding:7px;border:1.5px solid var(--border);border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;color:var(--text-3);background:none;">Fair</button>
                <button onclick="lgCond(this,'Good')" style="flex:1;padding:7px;border:1.5px solid var(--green);border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;color:var(--green);background:var(--green-pale);">Good ✓</button>
                <button onclick="lgCond(this,'Excellent')" style="flex:1;padding:7px;border:1.5px solid var(--border);border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;color:var(--text-3);background:none;">Exc.</button>
              </div>
            </div>

            <label style="display:flex;align-items:center;gap:12px;padding:12px 14px;cursor:pointer;">
              <input type="checkbox" checked style="width:17px;height:17px;accent-color:var(--green);flex-shrink:0;"/>
              <div><div style="font-size:13px;font-weight:500;color:var(--text);">🚚 I offer delivery &amp; collection</div><div style="font-size:11px;color:var(--text-3);">Contractor delivers and picks up the equipment</div></div>
            </label>
          </div>

          <!-- Pricing -->
          <div style="font-size:12px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Pricing</div>
          <div style="background:var(--surface);border-radius:14px;border:1px solid var(--border);overflow:hidden;margin-bottom:12px;">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid var(--border);">
              <div style="padding:12px 10px;text-align:center;border-right:1px solid var(--border);">
                <div style="font-size:9px;font-weight:700;color:var(--text-3);text-transform:uppercase;margin-bottom:6px;">Half Day</div>
                <div style="display:flex;align-items:center;justify-content:center;gap:2px;"><span style="font-size:13px;color:var(--text-3);">$</span><input type="number" placeholder="28" style="width:48px;border:none;outline:none;font-size:16px;font-weight:700;color:var(--green);text-align:center;background:none;"/></div>
              </div>
              <div style="padding:12px 10px;text-align:center;border-right:1px solid var(--border);background:var(--green-pale);">
                <div style="font-size:9px;font-weight:700;color:var(--green);text-transform:uppercase;margin-bottom:6px;">Day ★</div>
                <div style="display:flex;align-items:center;justify-content:center;gap:2px;"><span style="font-size:13px;color:var(--text-3);">$</span><input type="number" placeholder="45" style="width:48px;border:none;outline:none;font-size:16px;font-weight:700;color:var(--green);text-align:center;background:none;"/></div>
              </div>
              <div style="padding:12px 10px;text-align:center;">
                <div style="font-size:9px;font-weight:700;color:var(--text-3);text-transform:uppercase;margin-bottom:6px;">Week</div>
                <div style="display:flex;align-items:center;justify-content:center;gap:2px;"><span style="font-size:13px;color:var(--text-3);">$</span><input type="number" placeholder="189" style="width:48px;border:none;outline:none;font-size:16px;font-weight:700;color:var(--green);text-align:center;background:none;"/></div>
              </div>
            </div>
            <div style="padding:12px 14px;display:flex;justify-content:space-between;align-items:center;">
              <div><div style="font-size:12px;font-weight:600;color:var(--text);">Security Deposit</div><div style="font-size:11px;color:var(--text-3);">Held and released after clean return</div></div>
              <div style="display:flex;align-items:center;gap:2px;"><span style="font-size:13px;color:var(--text-3);">$</span><input type="number" placeholder="150" style="width:60px;border:1px solid var(--border);border-radius:8px;padding:5px 8px;outline:none;font-size:14px;font-weight:700;color:var(--green);text-align:center;background:var(--bg);"/></div>
            </div>
          </div>

          <!-- Technical attributes -->
          <div style="font-size:12px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Technical Attributes (up to 3)</div>
          <div style="background:var(--surface);border-radius:14px;border:1px solid var(--border);overflow:hidden;margin-bottom:16px;">
            <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;gap:8px;align-items:center;">
              <input placeholder="e.g. Petrol" style="flex:1;border:none;outline:none;font-size:13px;color:var(--text);background:none;" maxlength="20"/>
              <input placeholder="e.g. 21&quot; Cut" style="flex:1;border:none;outline:none;font-size:13px;color:var(--text);background:none;" maxlength="20"/>
            </div>
            <div style="padding:10px 14px;display:flex;gap:8px;align-items:center;">
              <input placeholder="e.g. 35 kg" style="flex:1;border:none;outline:none;font-size:13px;color:var(--text);background:none;" maxlength="20"/>
              <div style="flex:1;"></div>
            </div>
          </div>

          <button onclick="showToast('🎉','Equipment listed! It will appear in the marketplace within 15 minutes.')" style="width:100%;background:var(--green);color:white;border:none;border-radius:12px;padding:14px;font-size:14px;font-weight:700;cursor:pointer;">Publish Listing →</button>

        </div>
      </div>`;

// ─── Updated s-my-rentals (customer) — delivery-focused ──────────────────────

const S_MY_RENTALS_NEW = `
      <!-- ═══ MY RENTALS ═══ -->
      <div class="screen hidden" id="s-my-rentals" style="display:flex;flex-direction:column;overflow:hidden;">

        <div style="background:var(--green);padding:50px 16px 16px;position:relative;flex-shrink:0;">
          <button class="back-btn" onclick="goBack()">←</button>
          <div style="margin-left:40px;">
            <div style="color:white;font-size:19px;font-weight:600;">My Rentals</div>
            <div style="color:rgba(255,255,255,0.75);font-size:13px;">Deliveries · Active · Past</div>
          </div>
        </div>

        <div style="overflow-y:auto;flex:1;padding:12px;background:var(--bg);">

          <!-- Active rental with delivery status -->
          <div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.07em;padding:2px 0 8px;">Active Rental</div>

          <div style="background:var(--surface);border-radius:16px;border:2px solid var(--green);margin-bottom:14px;overflow:hidden;">

            <!-- Hero -->
            <div style="height:90px;background:linear-gradient(135deg,#2d6a4f,#52b788);display:flex;align-items:center;justify-content:center;position:relative;">
              <span style="font-size:46px;">🌿</span>
              <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.45);padding:5px 12px;display:flex;justify-content:space-between;align-items:center;">
                <span style="color:white;font-size:11px;font-weight:700;">Honda HRX Mower</span>
                <span style="background:#f4a62a;color:white;font-size:9px;font-weight:700;padding:2px 8px;border-radius:6px;">ACTIVE</span>
              </div>
            </div>

            <!-- Delivery timeline -->
            <div style="padding:12px 14px;border-bottom:1px solid var(--border);">
              <div style="font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.04em;margin-bottom:10px;">Delivery Status</div>
              <div style="display:flex;flex-direction:column;gap:0;">

                <div style="display:flex;gap:10px;align-items:flex-start;">
                  <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;">
                    <div style="width:22px;height:22px;background:var(--green);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span style="color:white;font-size:11px;">✓</span></div>
                    <div style="width:2px;flex:1;background:var(--green);min-height:18px;"></div>
                  </div>
                  <div style="padding-bottom:14px;"><div style="font-size:12px;font-weight:600;color:var(--text);">🏚️ Condition photos taken</div><div style="font-size:10px;color:var(--text-3);">Mon 5 May · 8:42 AM</div></div>
                </div>

                <div style="display:flex;gap:10px;align-items:flex-start;">
                  <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;">
                    <div style="width:22px;height:22px;background:var(--green);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span style="color:white;font-size:11px;">✓</span></div>
                    <div style="width:2px;flex:1;background:var(--green);min-height:18px;"></div>
                  </div>
                  <div style="padding-bottom:14px;"><div style="font-size:12px;font-weight:600;color:var(--text);">🚚 Delivered by Green Thumb Co.</div><div style="font-size:10px;color:var(--text-3);">Mon 5 May · 10:15 AM · 14 Knuckey St</div></div>
                </div>

                <div style="display:flex;gap:10px;align-items:flex-start;">
                  <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;">
                    <div style="width:22px;height:22px;background:var(--green);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span style="color:white;font-size:11px;">✓</span></div>
                    <div style="width:2px;flex:1;background:var(--border);min-height:18px;"></div>
                  </div>
                  <div style="padding-bottom:14px;"><div style="font-size:12px;font-weight:600;color:var(--text);">📋 Receipt confirmed by you</div><div style="font-size:10px;color:var(--text-3);">Mon 5 May · 10:18 AM</div></div>
                </div>

                <div style="display:flex;gap:10px;align-items:flex-start;">
                  <div style="flex-shrink:0;width:22px;height:22px;background:var(--bg);border:2px solid var(--border);border-radius:50%;display:flex;align-items:center;justify-content:center;">
                    <span style="color:var(--text-3);font-size:9px;font-weight:700;">4</span>
                  </div>
                  <div><div style="font-size:12px;font-weight:600;color:var(--text-3);">🔄 Return pickup</div><div style="font-size:10px;color:var(--text-3);">Scheduled Sun 11 May · Green Thumb Co. collects</div></div>
                </div>

              </div>
            </div>

            <!-- Countdown + actions -->
            <div style="padding:12px 14px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                <span style="font-size:12px;font-weight:600;color:var(--text);">⏱ 2 days remaining</span>
                <span style="font-size:11px;color:var(--text-3);">Return Sun 11 May</span>
              </div>
              <div style="background:var(--bg);border-radius:4px;height:6px;overflow:hidden;margin-bottom:10px;">
                <div style="width:71%;height:100%;background:var(--green);border-radius:4px;"></div>
              </div>
              <div style="font-size:11px;color:var(--text-3);margin-bottom:10px;">$45/day · $315 total · $150 deposit held · Contractor collects Sunday</div>
              <div style="display:flex;gap:8px;">
                <button onclick="showToast('✅','Return pickup request sent to Green Thumb Co. for Sunday 11 May.')" style="flex:1;background:var(--green);color:white;border:none;border-radius:10px;padding:9px;font-size:12px;font-weight:600;cursor:pointer;">Request Return</button>
                <button onclick="goTo('s-team-chat')" style="flex:1;background:none;border:1.5px solid var(--border);color:var(--text-2);border-radius:10px;padding:9px;font-size:12px;font-weight:600;cursor:pointer;">Message Owner</button>
              </div>
            </div>
          </div>

          <!-- Past rentals -->
          <div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.07em;padding:2px 0 8px;">Past</div>

          <div style="background:var(--surface);border-radius:14px;border:1px solid var(--border);margin-bottom:8px;padding:12px 14px;display:flex;gap:10px;align-items:center;">
            <div style="width:44px;height:44px;background:linear-gradient(135deg,#01579b,#0288d1);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:22px;">💦</div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:600;color:var(--text);">Karcher K5 Pressure Washer</div>
              <div style="font-size:11px;color:var(--text-3);">1 day · $55 · 22 Apr 2026 · Delivered &amp; collected</div>
            </div>
            <div style="flex-shrink:0;text-align:right;">
              <div style="background:var(--green-pale);color:var(--green);font-size:9px;font-weight:700;padding:2px 8px;border-radius:6px;">Returned ✓</div>
              <div style="font-size:10px;color:var(--text-3);margin-top:3px;">Deposit refunded</div>
            </div>
          </div>

          <div style="background:var(--surface);border-radius:14px;border:1px solid var(--border);margin-bottom:8px;padding:12px 14px;display:flex;gap:10px;align-items:center;">
            <div style="width:44px;height:44px;background:linear-gradient(135deg,#e65100,#f57c00);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:22px;">🚛</div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:600;color:var(--text);">7×4 Box Trailer</div>
              <div style="font-size:11px;color:var(--text-3);">2 days · $80 · 10 Apr 2026 · Delivered &amp; collected</div>
            </div>
            <div style="flex-shrink:0;text-align:right;">
              <div style="background:var(--green-pale);color:var(--green);font-size:9px;font-weight:700;padding:2px 8px;border-radius:6px;">Returned ✓</div>
              <div style="font-size:10px;color:var(--text-3);margin-top:3px;">Deposit refunded</div>
            </div>
          </div>

        </div>
      </div>`;

// ─── Updated rental JS IIFE (area-aware + full wizard functions) ──────────────

const RENTAL_JS_V2 = `<!-- ═══════════════════════════════════════════════════════════════════════════
     EQUIPMENT RENTALS — JavaScript
     ═══════════════════════════════════════════════════════════════════════════ -->
<script>
(function(){
  'use strict';

  var RC_CATS = [
    { id:'all',      label:'All',               icon:'🏷️', subs:[] },
    { id:'lawn',     label:'Lawn & Garden',     icon:'🌿', subs:['Mowers','Ride-Ons','Trimmers','Blowers','Edgers','Aerators'] },
    { id:'pressure', label:'Pressure Washing',  icon:'💦', subs:['Electric','Petrol','Hot Water','Commercial'] },
    { id:'tools',    label:'Power Tools',       icon:'🔧', subs:['Drills','Grinders','Sanders','Saws','Compressors'] },
    { id:'trailers', label:'Trailers',          icon:'🚛', subs:['Box Trailer','Car Trailer','Tipper','Enclosed'] },
    { id:'concrete', label:'Concrete & Digging',icon:'⛏️', subs:['Mixers','Jackhammers','Post Hole','Compactors'] },
    { id:'access',   label:'Access & Lifting',  icon:'🪜', subs:['Ladders','Scaffolding','Platform'] },
    { id:'cleaning', label:'Cleaning',          icon:'🧹', subs:['Carpet','Floor Polish','Industrial Vac'] }
  ];

  var RC_ITEMS = [
    { id:'r1',  name:'Honda HRX Mower',           sub2:'Self-propelled · 21" cut · Mulch/Bag',     cat:'lawn',     sub:'Mowers',      ph:28, pd:45,  pw:189, dep:150, owner:'Green Thumb Co.',   dist:'2.1km', condLbl:'Excellent', avail:true,  delivery:true,  rented:47, areas:['Katherine NT','Darwin NT'],                         badges:[{i:'⛽',t:'Petrol'},{i:'📏',t:'21" Cut'},{i:'⚖️',t:'35 kg'}],       thumb:{bg:'linear-gradient(135deg,#2d6a4f,#52b788)',em:'🌿',sz:'58px'} },
    { id:'r2',  name:'Stihl FS 240 Trimmer',      sub2:'Petrol · Bi-directional · Pro-grade',       cat:'lawn',     sub:'Trimmers',    ph:16, pd:30,  pw:120, dep:80,  owner:'LawnKing',          dist:'4.2km', condLbl:'Good',      avail:true,  delivery:true,  rented:29, areas:['Katherine NT','Tennant Creek NT'],                   badges:[{i:'⛽',t:'Petrol'},{i:'🔄',t:'2-Stroke'},{i:'⚖️',t:'7 kg'}],        thumb:{bg:'linear-gradient(135deg,#1b5e20,#43a047)',em:'✂️',sz:'54px'} },
    { id:'r3',  name:'Husqvarna Ride-On Mower',   sub2:'42" deck · Hydrostatic · 18.5 HP',          cat:'lawn',     sub:'Ride-Ons',    ph:55, pd:95,  pw:380, dep:300, owner:'AliceGreen Pro',    dist:'3.8km', condLbl:'Excellent', avail:false, delivery:true,  rented:12, areas:['Alice Springs NT','Darwin NT'],                      badges:[{i:'⛽',t:'Petrol'},{i:'📏',t:'42" Deck'},{i:'💪',t:'18.5 HP'}],     thumb:{bg:'linear-gradient(135deg,#4a148c,#7b1fa2)',em:'🚜',sz:'58px'} },
    { id:'r4',  name:'Karcher K5 Pressure Washer',sub2:'145 bar · 500L/hr · Patio kit incl.',       cat:'pressure', sub:'Electric',    ph:28, pd:55,  pw:220, dep:120, owner:'QuickFix Repairs',  dist:'5.1km', condLbl:'Excellent', avail:true,  delivery:true,  rented:38, areas:['Katherine NT','Alice Springs NT','Darwin NT'],       badges:[{i:'⚡',t:'Electric'},{i:'💧',t:'145 Bar'},{i:'📦',t:'Kit Incl.'}], thumb:{bg:'linear-gradient(135deg,#01579b,#0288d1)',em:'💦',sz:'56px'} },
    { id:'r5',  name:'Petrol Pressure Washer',    sub2:'3000 PSI · Honda engine · 15m hose',        cat:'pressure', sub:'Petrol',      ph:38, pd:70,  pw:270, dep:180, owner:'Desert Clean NT',   dist:'6.8km', condLbl:'Good',      avail:true,  delivery:true,  rented:21, areas:['Alice Springs NT','Darwin NT'],                      badges:[{i:'⛽',t:'Petrol'},{i:'💧',t:'3000 PSI'},{i:'📏',t:'15m Hose'}], thumb:{bg:'linear-gradient(135deg,#0d47a1,#1565c0)',em:'🌊',sz:'54px'} },
    { id:'r6',  name:'Makita 18V Drill Combo',    sub2:'2× 5Ah batteries · Charger · 4-piece',     cat:'tools',    sub:'Drills',      ph:18, pd:28,  pw:98,  dep:60,  owner:'ToolMate NT',       dist:'3.4km', condLbl:'Excellent', avail:true,  delivery:true,  rented:53, areas:['Katherine NT','Alice Springs NT','Darwin NT'],       badges:[{i:'🔋',t:'18V Li-ion'},{i:'🔩',t:'4-Piece'},{i:'⚖️',t:'3.2 kg'}], thumb:{bg:'linear-gradient(135deg,#bf360c,#e64a19)',em:'🔧',sz:'56px'} },
    { id:'r7',  name:'Angle Grinder 9"',          sub2:'2400W · Paddle switch · Disc included',     cat:'tools',    sub:'Grinders',    ph:15, pd:25,  pw:85,  dep:50,  owner:'ToolMate NT',       dist:'3.4km', condLbl:'Good',      avail:true,  delivery:true,  rented:18, areas:['Katherine NT','Tennant Creek NT'],                   badges:[{i:'⚡',t:'2400W'},{i:'📏',t:'9" Disc'},{i:'⚖️',t:'5.1 kg'}],     thumb:{bg:'linear-gradient(135deg,#37474f,#546e7a)',em:'⚙️',sz:'54px'} },
    { id:'r8',  name:'7×4 Box Trailer',           sub2:'Cage sides · Jockey wheel · Ball hitch',   cat:'trailers', sub:'Box Trailer',  ph:25, pd:40,  pw:160, dep:200, owner:'TrailerHire NT',    dist:'7.2km', condLbl:'Good',      avail:true,  delivery:true,  rented:34, areas:['Katherine NT','Darwin NT'],                         badges:[{i:'📐',t:'7×4 ft'},{i:'⚖️',t:'750 kg ATM'},{i:'🔒',t:'Lockable'}],thumb:{bg:'linear-gradient(135deg,#e65100,#f57c00)',em:'🚛',sz:'58px'} },
    { id:'r9',  name:'Petrol Cement Mixer 100L',  sub2:'4HP engine · Steel drum · Stand incl.',    cat:'concrete', sub:'Mixers',      ph:35, pd:60,  pw:240, dep:150, owner:'Centralian Build',   dist:'8.5km', condLbl:'Good',      avail:true,  delivery:true,  rented:16, areas:['Alice Springs NT','Tennant Creek NT'],               badges:[{i:'⛽',t:'Petrol'},{i:'🪣',t:'100L Drum'},{i:'💪',t:'4 HP'}],     thumb:{bg:'linear-gradient(135deg,#4e342e,#6d4c41)',em:'🏗️',sz:'56px'} },
    { id:'r10', name:'Demolition Jack Hammer',    sub2:'1500W · 45J impact · SDS-Max chisel',      cat:'concrete', sub:'Jackhammers', ph:45, pd:75,  pw:280, dep:200, owner:'Centralian Build',   dist:'8.5km', condLbl:'Excellent', avail:false, delivery:true,  rented:9,  areas:['Alice Springs NT','Darwin NT'],                      badges:[{i:'⚡',t:'1500W'},{i:'💥',t:'45J Impact'},{i:'⚖️',t:'12 kg'}],   thumb:{bg:'linear-gradient(135deg,#263238,#37474f)',em:'⛏️',sz:'56px'} },
    { id:'r11', name:'Platform Ladder 3.0m',      sub2:'Fibreglass · 150kg rated · Dual access',   cat:'access',   sub:'Ladders',     ph:18, pd:30,  pw:95,  dep:50,  owner:'SafeWork NT',        dist:'4.9km', condLbl:'Excellent', avail:true,  delivery:true,  rented:41, areas:['Katherine NT','Alice Springs NT'],                   badges:[{i:'🏗️',t:'3.0m High'},{i:'⚖️',t:'150 kg Rated'},{i:'🛡️',t:'AS/NZS'}],thumb:{bg:'linear-gradient(135deg,#006064,#00838f)',em:'🪜',sz:'56px'} },
    { id:'r12', name:'Carpet Cleaner Extractor',  sub2:'Upright · 45L tank · Hose & wand kit',    cat:'cleaning', sub:'Carpet',      ph:35, pd:55,  pw:200, dep:100, owner:'CleanPro NT',        dist:'5.6km', condLbl:'Good',      avail:true,  delivery:true,  rented:26, areas:['Alice Springs NT','Darwin NT','Katherine NT'],       badges:[{i:'💧',t:'45L Tank'},{i:'⚡',t:'1200W'},{i:'📦',t:'Kit Incl.'}],  thumb:{bg:'linear-gradient(135deg,#1a237e,#283593)',em:'🧹',sz:'56px'} }
  ];

  var rcCurCat  = 'all';
  var rcCurSub  = null;
  var rcCurQ    = '';
  var rcCurArea = 'Katherine NT';
  var rcDetailItem = null;

  // ── Public API ────────────────────────────────────────────────────────────

  window.rcInit = function() {
    rcCurCat = 'all'; rcCurSub = null; rcCurQ = '';
    var si = document.getElementById('rc-search');
    if (si) si.value = '';
    _updateAreaLabel();
    _renderCats();
    _renderSubs();
    _renderItems(_filtered());
  };

  window.rcSetCat = function(id) {
    rcCurCat = id; rcCurSub = null;
    _renderCats(); _renderSubs(); _renderItems(_filtered());
  };

  window.rcSetSub = function(sub) {
    rcCurSub = (rcCurSub === sub) ? null : sub;
    _renderSubs(); _renderItems(_filtered());
  };

  window.rcSearch = function(q) {
    rcCurQ = (q || '').toLowerCase().trim();
    _renderItems(_filtered());
  };

  window.rcSetArea = function(area) {
    rcCurArea = area;
    _updateAreaLabel();
    _renderItems(_filtered());
  };

  window.rcDetail = function(id) {
    var item = null;
    for (var i = 0; i < RC_ITEMS.length; i++) { if (RC_ITEMS[i].id === id) { item = RC_ITEMS[i]; break; } }
    if (!item) return;
    rcDetailItem = item;

    var hero = document.getElementById('rd-hero');
    if (hero) hero.style.background = item.thumb.bg;
    var em = document.getElementById('rd-hero-em');
    if (em) { em.textContent = item.thumb.em; em.style.fontSize = item.thumb.sz; }

    var ab = document.getElementById('rd-avail-badge');
    if (ab) { ab.textContent = item.avail ? 'Available' : 'Unavailable'; ab.style.background = item.avail ? '#00796b' : '#757575'; }

    var db = document.getElementById('rd-del-badge');
    if (db) db.style.display = '';

    var set = function(eid, txt) { var el = document.getElementById(eid); if (el) el.textContent = txt; };
    set('rd-title', item.name);
    set('rd-subtitle', item.sub2);
    set('rd-ph', '$' + item.ph);
    set('rd-pd', '$' + item.pd);
    set('rd-pw', '$' + item.pw);
    set('rd-dep', '$' + item.dep);
    set('rd-pop', item.rented);
    set('rd-owner', item.owner);
    set('rd-dist', item.dist);

    var br = document.getElementById('rd-badges-row');
    if (br) {
      var bh = '';
      for (var j = 0; j < item.badges.length; j++)
        bh += '<span style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:4px 9px;font-size:11px;font-weight:600;color:var(--text-2);">' + item.badges[j].i + ' ' + item.badges[j].t + '</span>';
      br.innerHTML = bh;
    }

    var rb = document.getElementById('rd-reserve-btn');
    if (rb) {
      if (item.avail) {
        rb.textContent = 'Reserve — Contractor Delivers · $' + item.pd + '/day + $' + item.dep + ' deposit';
        rb.disabled = false; rb.style.background = 'var(--green)'; rb.style.cursor = 'pointer';
      } else {
        rb.textContent = 'Currently Unavailable';
        rb.disabled = true; rb.style.background = '#bdbdbd'; rb.style.cursor = 'not-allowed';
      }
    }

    // Update handover wizard item name
    var hwl = document.getElementById('hw-stage-label');
    if (hwl) hwl.textContent = 'Stage 1 of 4 · Pre-Departure Check';
    var hwa = document.getElementById('hw-del-address');
    if (hwa) hwa.textContent = rcCurArea === 'Alice Springs NT' ? '22 Todd St, Alice Springs NT 0870' : '14 Knuckey St, Katherine NT 0850';

    if (typeof goTo === 'function') goTo('s-rental-detail');
  };

  window.rcReserve = function(id) {
    var item = id ? null : rcDetailItem;
    if (id) { for (var i = 0; i < RC_ITEMS.length; i++) { if (RC_ITEMS[i].id === id) { item = RC_ITEMS[i]; break; } } }
    if (!item) { if (typeof showToast === 'function') showToast('⚠️','No item selected'); return; }
    if (!item.avail) { if (typeof showToast === 'function') showToast('⚠️','This item is currently unavailable'); return; }
    if (typeof showToast === 'function') showToast('✅', item.name + ' reserved! ' + item.owner + ' will be in touch to arrange delivery.');
  };

  window.rcTabSet = function(tab) {
    var bp = document.getElementById('rc-pane-browse');
    var gp = document.getElementById('rc-pane-gear');
    var bt = document.getElementById('rc-tab-browse');
    var gt = document.getElementById('rc-tab-gear');
    if (!bp || !gp) return;
    if (tab === 'gear') {
      bp.style.display = 'none'; gp.style.display = 'flex';
      if (bt) { bt.style.borderBottomColor = 'transparent'; bt.style.color = 'var(--text-3)'; }
      if (gt) { gt.style.borderBottomColor = 'var(--green)'; gt.style.color = 'var(--green)'; }
    } else {
      bp.style.display = 'flex'; gp.style.display = 'none';
      if (bt) { bt.style.borderBottomColor = 'var(--green)'; bt.style.color = 'var(--green)'; }
      if (gt) { gt.style.borderBottomColor = 'transparent'; gt.style.color = 'var(--text-3)'; }
    }
  };

  window.hwGoStep = function(n) {
    var labels = ['','Stage 1 of 4 · Pre-Departure Check','Stage 2 of 4 · Delivery Confirmation','Stage 3 of 4 · Return Inspection','Stage 4 of 4 · Storage Return'];
    for (var s = 1; s <= 4; s++) {
      var pane = document.getElementById('hw-pane-' + s);
      var step = document.getElementById('hw-step-' + s);
      if (pane) pane.style.display = (s === n) ? '' : 'none';
      if (step) {
        step.style.borderBottomColor = (s <= n) ? 'var(--green)' : 'var(--border)';
        var lbl = step.querySelector('div:last-child');
        if (lbl) { lbl.style.color = (s <= n) ? 'var(--green)' : 'var(--text-3)'; lbl.style.fontWeight = (s <= n) ? '700' : '600'; }
      }
    }
    var hl = document.getElementById('hw-stage-label');
    if (hl) hl.textContent = labels[n] || '';
  };

  window.hwPhoto = function(label) { if (typeof showToast === 'function') showToast('📸', label + ' photo captured'); };
  window.hwRate = function(n) { var l = ['Poor','Fair','Good','Excellent']; if (typeof showToast === 'function') showToast('⭐','Condition: ' + (l[n-1] || n)); };
  window.hwDamage = function(lvl) { var m = {none:'No damage noted ✓',minor:'Minor damage flagged',significant:'Significant damage — deposit may be claimed'}; if (typeof showToast === 'function') showToast('🔍', m[lvl] || lvl); };
  window.hwCustomerConfirm = function() { if (typeof showToast === 'function') showToast('✅','Receipt confirmed — rental clock started'); };
  window.hwCustomerRelease = function() { if (typeof showToast === 'function') showToast('✅','Equipment released — contractor heading back to storage'); };

  window.lgSetCat = function(btn, label) {
    var parent = btn.parentNode;
    var btns = parent.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) { btns[i].style.background = 'none'; btns[i].style.color = 'var(--text-2)'; btns[i].style.borderColor = 'var(--border)'; }
    btn.style.background = 'var(--green)'; btn.style.color = 'white'; btn.style.borderColor = 'var(--green)';
  };

  window.lgCond = function(btn, label) {
    var parent = btn.parentNode;
    var btns = parent.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) { btns[i].style.background = 'none'; btns[i].style.color = 'var(--text-3)'; btns[i].style.borderColor = 'var(--border)'; btns[i].style.fontWeight = '600'; }
    btn.style.background = 'var(--green-pale)'; btn.style.color = 'var(--green)'; btn.style.borderColor = 'var(--green)'; btn.style.fontWeight = '700';
  };

  // ── Private ───────────────────────────────────────────────────────────────

  function _filtered() {
    return RC_ITEMS.filter(function(item) {
      if (rcCurCat !== 'all' && item.cat !== rcCurCat) return false;
      if (rcCurSub && item.sub !== rcCurSub) return false;
      if (rcCurQ && item.name.toLowerCase().indexOf(rcCurQ) === -1 && item.sub2.toLowerCase().indexOf(rcCurQ) === -1) return false;
      if (item.areas.indexOf(rcCurArea) === -1) return false;
      return true;
    });
  }

  function _updateAreaLabel() {
    var el = document.getElementById('rc-area-label');
    if (el) el.textContent = rcCurArea;
  }

  function _renderCats() {
    var el = document.getElementById('rc-cats');
    if (!el) return;
    var html = '';
    for (var i = 0; i < RC_CATS.length; i++) {
      var c = RC_CATS[i], active = (c.id === rcCurCat);
      var bc = active ? 'var(--green)' : 'transparent';
      var tc = active ? 'var(--green)' : 'var(--text-3)';
      var fw = active ? '700' : '600';
      html += '<button onclick="rcSetCat(\'' + c.id + '\')" style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 10px;border:none;border-bottom:2px solid ' + bc + ';background:none;cursor:pointer;white-space:nowrap;flex-shrink:0;">'
            + '<span style="font-size:18px;">' + c.icon + '</span>'
            + '<span style="font-size:10px;font-weight:' + fw + ';color:' + tc + ';">' + c.label + '</span>'
            + '</button>';
    }
    el.innerHTML = html;
  }

  function _renderSubs() {
    var el = document.getElementById('rc-subs');
    if (!el) return;
    var cat = null;
    for (var i = 0; i < RC_CATS.length; i++) { if (RC_CATS[i].id === rcCurCat) { cat = RC_CATS[i]; break; } }
    if (!cat || cat.subs.length === 0) { el.innerHTML = ''; return; }
    var html = '';
    for (var j = 0; j < cat.subs.length; j++) {
      var sub = cat.subs[j], active = (sub === rcCurSub);
      var bg  = active ? 'var(--green)' : 'var(--surface)';
      var col = active ? '#fff'         : 'var(--text-2)';
      var bdr = active ? 'var(--green)' : 'var(--border)';
      html += '<button onclick="rcSetSub(\'' + sub + '\')" style="flex-shrink:0;padding:5px 12px;border-radius:20px;border:1.5px solid ' + bdr + ';background:' + bg + ';color:' + col + ';font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;">' + sub + '</button>';
    }
    el.innerHTML = html;
  }

  function _card(item) {
    var avBg  = item.avail ? '#00796b' : '#757575';
    var avTxt = item.avail ? 'Available' : 'Unavailable';
    var rsvBg = item.avail ? 'var(--green)' : '#bdbdbd';
    var rsvCur = item.avail ? 'pointer' : 'not-allowed';
    var rsvClick = item.avail
      ? 'event.stopPropagation();rcReserve(\'' + item.id + '\')'
      : 'event.stopPropagation();showToast(\'⚠️\',\'Currently unavailable\')';
    var bh = '';
    for (var b = 0; b < item.badges.length; b++)
      bh += '<span style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:3px 8px;font-size:10px;font-weight:600;color:var(--text-2);white-space:nowrap;">' + item.badges[b].i + ' ' + item.badges[b].t + '</span>';
    return '<div onclick="rcDetail(\'' + item.id + '\')" style="background:var(--surface);border-radius:16px;margin-bottom:10px;border:1px solid var(--border);overflow:hidden;cursor:pointer;">'
      + '<div style="height:140px;background:' + item.thumb.bg + ';position:relative;display:flex;align-items:center;justify-content:center;">'
      + '<span style="font-size:' + item.thumb.sz + ';user-select:none;">' + item.thumb.em + '</span>'
      + '<span style="position:absolute;top:8px;left:8px;background:' + avBg + ';color:#fff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:6px;">' + avTxt + '</span>'
      + '<span style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.48);color:#fff;font-size:9px;font-weight:600;padding:2px 8px;border-radius:6px;">⭐ ' + item.condLbl + '</span>'
      + '<span style="position:absolute;bottom:7px;left:8px;background:rgba(0,0,0,0.55);color:#fff;font-size:9px;font-weight:700;padding:2px 7px;border-radius:6px;">🚚 Delivered &amp; Collected</span>'
      + '</div>'
      + '<div style="padding:10px 12px;">'
      + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">'
      + '<div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + item.name + '</div>'
      + '<div style="font-size:11px;color:var(--text-3);margin-top:1px;">' + item.sub2 + '</div></div>'
      + '<div style="text-align:right;flex-shrink:0;margin-left:8px;"><div style="font-size:17px;font-weight:700;color:var(--green);">$' + item.pd + '</div><div style="font-size:9px;color:var(--text-3);">/day</div></div>'
      + '</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">' + bh + '</div>'
      + '<div style="font-size:11px;color:var(--text-3);margin-bottom:9px;">👤 ' + item.owner + ' · 📍 ' + item.dist + ' · 🔥 ' + item.rented + ' rentals</div>'
      + '<div style="display:flex;gap:8px;">'
      + '<button onclick="' + rsvClick + '" style="flex:1;background:' + rsvBg + ';color:white;border:none;border-radius:10px;padding:9px;font-size:12px;font-weight:600;cursor:' + rsvCur + ';">Reserve</button>'
      + '<button onclick="event.stopPropagation();rcDetail(\'' + item.id + '\')" style="flex:1;background:none;border:1.5px solid var(--green);color:var(--green);border-radius:10px;padding:9px;font-size:12px;font-weight:600;cursor:pointer;">Details</button>'
      + '</div></div></div>';
  }

  function _renderItems(items) {
    var el = document.getElementById('rc-list');
    if (!el) return;
    if (items.length === 0) {
      el.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--text-3);"><div style="font-size:36px;margin-bottom:8px;">🔍</div><div style="font-size:14px;font-weight:600;">No equipment in ' + rcCurArea + '</div><div style="font-size:12px;margin-top:4px;">Try a different category or <span onclick="goTo(\'s-area-select\')" style="color:var(--green);cursor:pointer;text-decoration:underline;">switch area</span></div></div>';
      return;
    }
    var html = '';
    for (var i = 0; i < items.length; i++) html += _card(items[i]);
    el.innerHTML = html;
  }

  // ── Patches & auto-init ───────────────────────────────────────────────────

  function _patchGoTo() {
    if (window._rcPatched) return;
    window._rcPatched = true;
    var origGoTo = window.goTo;
    if (typeof origGoTo !== 'function') return;
    window.goTo = function(id) {
      origGoTo.call(this, id);
      if (id === 's-rentals') setTimeout(function() { window.rcInit && window.rcInit(); }, 30);
    };
    // Patch ncSetArea to also refresh rentals
    var origNcSetArea = window.ncSetArea;
    if (typeof origNcSetArea === 'function') {
      window.ncSetArea = function(area) {
        origNcSetArea.call(this, area);
        window.rcSetArea && window.rcSetArea(area);
      };
    } else {
      // ncSetArea not yet defined — defer
      var _origSetArea = window.ncSetArea;
      Object.defineProperty(window, 'ncSetArea', {
        set: function(fn) {
          _origSetArea = fn;
          window.ncSetArea = function(area) { fn.call(this, area); window.rcSetArea && window.rcSetArea(area); };
        },
        get: function() { return _origSetArea; }, configurable: true
      });
    }
  }

  function _autoInit() {
    _patchGoTo();
    var el = document.getElementById('rc-list');
    if (el && !el.innerHTML.trim()) rcInit();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _autoInit);
  } else {
    _autoInit();
  }

})();
</script>`;

// ─── s-rentals area chip (inject into both files after search bar close tag) ─

const SEARCH_BAR_OLD = '            </div>\n          </div>\n        </div>\n\n        <!-- Category bar -->';
const SEARCH_BAR_NEW = `            </div>
          </div>
          <!-- Area selector chip -->
          <div onclick="goTo('s-area-select')" style="display:flex;align-items:center;gap:6px;padding:4px 0 10px;cursor:pointer;">
            <span style="font-size:13px;">📍</span>
            <span id="rc-area-label" style="color:white;font-size:12px;font-weight:600;">Katherine NT</span>
            <span style="color:rgba(255,255,255,0.55);font-size:11px;">▾ switch area</span>
          </div>
        </div>

        <!-- Category bar -->`;

// ─── s-rental-detail: updated delivery CTA ────────────────────────────────────

const OLD_RESERVE_CTA = `        <!-- Reserve CTA (sticky bottom) -->
        <div style="position:absolute;bottom:0;left:0;right:0;padding:12px 16px;background:var(--surface);border-top:1px solid var(--border);">
          <button id="rd-reserve-btn" onclick="rcReserve()" style="width:100%;background:var(--green);color:white;border:none;border-radius:12px;padding:14px;font-size:14px;font-weight:700;cursor:pointer;">Reserve · $45/day + $150 deposit</button>
        </div>`;

const NEW_RESERVE_CTA = `        <!-- Reserve CTA (sticky bottom) -->
        <div style="position:absolute;bottom:0;left:0;right:0;padding:10px 14px;background:var(--surface);border-top:1px solid var(--border);">
          <div style="font-size:10px;color:var(--text-3);text-align:center;margin-bottom:6px;">🚚 Contractor delivers &amp; collects · 4-stage photo handover</div>
          <div style="display:flex;gap:8px;">
            <button id="rd-reserve-btn" onclick="rcReserve()" style="flex:1;background:var(--green);color:white;border:none;border-radius:12px;padding:12px;font-size:13px;font-weight:700;cursor:pointer;">Reserve — Contractor Delivers</button>
            <button onclick="goTo('s-handover-wizard')" style="flex:0 0 auto;background:none;border:1.5px solid var(--border);color:var(--text-2);border-radius:12px;padding:12px 10px;font-size:11px;font-weight:600;cursor:pointer;">📸 Handover</button>
          </div>
        </div>`;

// ─── Placeholder CSS ──────────────────────────────────────────────────────────

const PLACEHOLDER_CSS = `#rc-search::placeholder { color: rgba(255,255,255,0.55); }\n`;

// ─── xbtn button groups ───────────────────────────────────────────────────────

const CUST_XBTNS = `  <button onclick="goTo('s-rentals')" class="xbtn" style="border-color:#2D6A4F;color:#2D6A4F;">🔧 Rentals</button>
  <button onclick="goTo('s-rental-detail')" class="xbtn">📋 Rental Detail</button>
  <button onclick="goTo('s-my-rentals')" class="xbtn">📦 My Rentals</button>
  <button onclick="goTo('s-handover-wizard')" class="xbtn">📸 Handover</button>`;

const CREW_XBTNS = `  <button onclick="goTo('s-rentals')" class="xbtn" style="border-color:#2D6A4F;color:#2D6A4F;">🔧 Rentals</button>
  <button onclick="goTo('s-rental-detail')" class="xbtn">📋 Rental Detail</button>
  <button onclick="goTo('s-handover-wizard')" class="xbtn">📸 Handover</button>
  <button onclick="goTo('s-list-gear')" class="xbtn">➕ List Gear</button>`;

// ─── Main ─────────────────────────────────────────────────────────────────────

const FILES = [
  { name: 'Crew_App_Customer_Role.html', isCrew: false },
  { name: 'Crew_App_Crew_Member.html',   isCrew: true  },
];

for (const { name, isCrew } of FILES) {
  const filePath = path.join(ROOT, name);
  let html = fs.readFileSync(filePath, 'utf8');
  let ok = true;

  // 1. Replace rental JS IIFE
  let h1 = replaceRentalJS(html, RENTAL_JS_V2);
  if (!h1) { console.log('  ' + name + ': ⚠ rental JS not found'); ok = false; } else { html = h1; console.log('  ' + name + ': ✓ JS IIFE replaced (area-aware v2)'); }

  // 2. Replace s-handover-wizard (4-stage)
  let h2 = replaceScreen(html, 's-handover-wizard', S_HANDOVER_WIZARD);
  if (!h2) { console.log('  ' + name + ': ⚠ s-handover-wizard not found'); } else { html = h2; console.log('  ' + name + ': ✓ s-handover-wizard rebuilt (4 stages)'); }

  // 3. Replace s-my-rentals (customer only)
  if (!isCrew) {
    let h3 = replaceScreen(html, 's-my-rentals', S_MY_RENTALS_NEW);
    if (!h3) { console.log('  ' + name + ': ⚠ s-my-rentals not found'); } else { html = h3; console.log('  ' + name + ': ✓ s-my-rentals rebuilt (delivery timeline)'); }
  }

  // 4. Add area chip to s-rentals header
  let h4 = strReplace(html, SEARCH_BAR_OLD, SEARCH_BAR_NEW);
  if (!h4) { console.log('  ' + name + ': ⚠ search bar anchor not found (area chip skipped)'); } else { html = h4; console.log('  ' + name + ': ✓ area selector chip added'); }

  // 5. Update s-rental-detail CTA
  let h5 = strReplace(html, OLD_RESERVE_CTA, NEW_RESERVE_CTA);
  if (!h5) { console.log('  ' + name + ': ⚠ reserve CTA anchor not found'); } else { html = h5; console.log('  ' + name + ': ✓ Reserve CTA updated (delivery model)'); }

  // 6. Add placeholder CSS — inject just before the xbtn/style block
  const cssMarker = '.xbtn{font-size:12px;';
  let h6 = strReplace(html, cssMarker, PLACEHOLDER_CSS + cssMarker);
  if (!h6) { console.log('  ' + name + ': ⚠ CSS marker not found (placeholder skipped)'); } else { html = h6; console.log('  ' + name + ': ✓ placeholder CSS added'); }

  // 7. Add s-list-gear screen (crew only)
  if (isCrew) {
    const phoneMarker = '      <!-- /phone-screen -->';
    let h7 = insertBefore(html, phoneMarker, S_LIST_GEAR);
    if (!h7) { console.log('  ' + name + ': ⚠ phone-screen marker not found (s-list-gear skipped)'); } else { html = h7; console.log('  ' + name + ': ✓ s-list-gear screen inserted'); }
  }

  // 8. Add xbtn navigation buttons
  const xbtnAnchor = isCrew
    ? '  <button onclick="goTo(\'s-caddservice\')" class="xbtn">➕ Add Service</button>\n</div>'
    : '  <button onclick="goTo(\'s-caddservice\')" class="xbtn">➕ Add Service</button>\n</div>';
  const newXbtns = isCrew ? CREW_XBTNS : CUST_XBTNS;
  let h8 = strReplace(html, xbtnAnchor, '  <button onclick="goTo(\'s-caddservice\')" class="xbtn">➕ Add Service</button>\n' + newXbtns + '\n</div>');
  if (!h8) { console.log('  ' + name + ': ⚠ xbtn anchor not found'); } else { html = h8; console.log('  ' + name + ': ✓ xbtn nav buttons added'); }

  if (ok || true) {
    fs.writeFileSync(filePath, html, 'utf8');
    console.log('  ' + name + ': ✓ saved\n');
  }
}

console.log('Done.');
