'use strict';

const fs   = require('fs');
const path = require('path');
const ROOT = __dirname;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Depth-count <div> tags to find the closing </div> of a screen by id */
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
    if (html.startsWith('<!--', pos)) {
      const e = html.indexOf('-->', pos); pos = (e === -1 ? html.length : e + 3); continue;
    }
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

// ─── s-rentals: Customer ──────────────────────────────────────────────────────

const CUSTOMER_S_RENTALS = `      <!-- ═══ EQUIPMENT RENTAL MARKETPLACE ═══ -->
      <div class="screen hidden" id="s-rentals" style="display:flex;flex-direction:column;overflow:hidden;">

        <!-- Green header -->
        <div style="background:var(--green);padding:50px 16px 10px;position:relative;flex-shrink:0;">
          <button class="back-btn" onclick="goBack()">←</button>
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-left:40px;">
            <div>
              <div style="color:white;font-size:19px;font-weight:600;">Equipment Rentals</div>
              <div style="color:rgba(255,255,255,0.7);font-size:13px;">Short-term gear from local crews</div>
            </div>
            <button onclick="goTo('s-my-rentals')" style="background:rgba(255,255,255,0.18);color:white;border:none;border-radius:10px;padding:6px 11px;font-size:11px;font-weight:600;cursor:pointer;flex-shrink:0;">📦 My Rentals</button>
          </div>
          <div style="margin-top:10px;">
            <div style="background:rgba(0,0,0,0.18);border-radius:10px;display:flex;align-items:center;gap:8px;padding:8px 12px;">
              <span style="color:rgba(255,255,255,0.6);font-size:14px;">🔍</span>
              <input id="rc-search" placeholder="Search equipment…" oninput="rcSearch(this.value)"
                style="background:none;border:none;outline:none;color:white;font-size:14px;flex:1;"/>
            </div>
          </div>
        </div>

        <!-- Category bar -->
        <div id="rc-cats" style="display:flex;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;background:var(--surface);border-bottom:1px solid var(--border);flex-shrink:0;padding:0 4px;"></div>

        <!-- Sub-category chips -->
        <div id="rc-subs" style="display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding:8px 12px;background:var(--bg);flex-shrink:0;min-height:40px;align-items:center;"></div>

        <!-- Bundle deal banner -->
        <div style="background:#fff8ec;border-left:3px solid #f4a62a;margin:0 12px 6px;padding:9px 12px;border-radius:0 8px 8px 0;display:flex;align-items:center;gap:10px;flex-shrink:0;">
          <span style="font-size:18px;">🎁</span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:12px;font-weight:700;color:#a06000;">Bundle — Lawn Day Pack</div>
            <div style="font-size:11px;color:#b87333;">Mower + Trimmer + Blower · Save $22</div>
          </div>
          <button onclick="showToast('✅','Lawn Day Pack added to cart!')" style="background:#f4a62a;color:white;border:none;border-radius:8px;padding:7px 11px;font-size:12px;font-weight:600;cursor:pointer;flex-shrink:0;">$89/day</button>
        </div>

        <!-- Scrollable item list -->
        <div id="rc-list" style="overflow-y:auto;flex:1;padding:0 12px 24px;background:var(--bg);"></div>

      </div>`;

// ─── s-rentals: Crew Member ───────────────────────────────────────────────────

const CREW_S_RENTALS = `      <!-- ═══ EQUIPMENT RENTAL MARKETPLACE ═══ -->
      <div class="screen hidden" id="s-rentals" style="display:flex;flex-direction:column;overflow:hidden;">

        <!-- Green header -->
        <div style="background:var(--green);padding:50px 16px 12px;position:relative;flex-shrink:0;">
          <button class="back-btn" onclick="goBack()">←</button>
          <div style="margin-left:40px;">
            <div style="color:white;font-size:19px;font-weight:600;">Equipment Rentals</div>
            <div style="color:rgba(255,255,255,0.7);font-size:13px;">Browse gear · Manage your listings</div>
          </div>
        </div>

        <!-- Tab bar -->
        <div style="display:flex;background:var(--surface);border-bottom:1px solid var(--border);flex-shrink:0;">
          <button id="rc-tab-browse" onclick="rcTabSet('browse')"
            style="flex:1;padding:11px;font-size:13px;font-weight:600;border:none;border-bottom:2px solid var(--green);background:none;cursor:pointer;color:var(--green);margin-bottom:-1px;">
            Browse
          </button>
          <button id="rc-tab-gear" onclick="rcTabSet('gear')"
            style="flex:1;padding:11px;font-size:13px;font-weight:600;border:none;border-bottom:2px solid transparent;background:none;cursor:pointer;color:var(--text-3);margin-bottom:-1px;">
            My Gear
          </button>
        </div>

        <!-- Browse pane -->
        <div id="rc-pane-browse" style="display:flex;flex-direction:column;flex:1;overflow:hidden;">
          <div id="rc-cats" style="display:flex;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;background:var(--surface);border-bottom:1px solid var(--border);flex-shrink:0;padding:0 4px;"></div>
          <div id="rc-subs" style="display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding:8px 12px;background:var(--bg);flex-shrink:0;min-height:40px;align-items:center;"></div>
          <div id="rc-list" style="overflow-y:auto;flex:1;padding:0 12px 24px;background:var(--bg);"></div>
        </div>

        <!-- My Gear pane -->
        <div id="rc-pane-gear" style="display:none;flex-direction:column;flex:1;overflow:hidden;">

          <!-- Income summary -->
          <div style="background:var(--green-pale);padding:14px 16px;border-bottom:1px solid var(--border);flex-shrink:0;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-size:11px;color:var(--text-3);font-weight:500;text-transform:uppercase;letter-spacing:.04em;">May Rental Income</div>
              <div style="font-size:24px;font-weight:700;color:var(--green);">$347</div>
              <div style="font-size:11px;color:var(--text-3);">6 bookings · 3 items listed</div>
            </div>
            <button onclick="showToast('➕','List New Equipment coming soon!')" style="background:var(--green);color:white;border:none;border-radius:10px;padding:10px 14px;font-size:12px;font-weight:600;cursor:pointer;">+ List New</button>
          </div>

          <!-- Listed items -->
          <div style="overflow-y:auto;flex:1;padding:12px;background:var(--bg);">

            <!-- Gear item 1 -->
            <div style="background:var(--surface);border-radius:14px;border:1px solid var(--border);margin-bottom:10px;overflow:hidden;">
              <div style="height:80px;background:linear-gradient(135deg,#2d6a4f,#52b788);display:flex;align-items:center;justify-content:center;position:relative;">
                <span style="font-size:42px;">🌿</span>
                <span style="position:absolute;top:6px;left:8px;background:#00796b;color:#fff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:6px;">● Available</span>
              </div>
              <div style="padding:10px 12px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
                  <div><div style="font-size:13px;font-weight:700;color:var(--text);">Honda HRX Mower</div><div style="font-size:11px;color:var(--text-3);">$45/day · 3 bookings this month</div></div>
                  <div style="text-align:right;"><div style="font-size:15px;font-weight:700;color:var(--green);">$135</div><div style="font-size:9px;color:var(--text-3);">earned</div></div>
                </div>
                <div style="display:flex;gap:8px;">
                  <button onclick="showToast('✏️','Edit listing coming soon!')" style="flex:1;background:none;border:1.5px solid var(--border);border-radius:8px;padding:7px;font-size:11px;font-weight:600;color:var(--text-2);cursor:pointer;">Edit</button>
                  <button onclick="showToast('📋','3 bookings: Fri, Sat, Sun')" style="flex:1;background:var(--green);color:white;border:none;border-radius:8px;padding:7px;font-size:11px;font-weight:600;cursor:pointer;">Bookings (3)</button>
                </div>
              </div>
            </div>

            <!-- Gear item 2 -->
            <div style="background:var(--surface);border-radius:14px;border:1px solid var(--border);margin-bottom:10px;overflow:hidden;">
              <div style="height:80px;background:linear-gradient(135deg,#01579b,#0288d1);display:flex;align-items:center;justify-content:center;position:relative;">
                <span style="font-size:42px;">💦</span>
                <span style="position:absolute;top:6px;left:8px;background:#e65100;color:#fff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:6px;">● Booked until Thu</span>
              </div>
              <div style="padding:10px 12px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
                  <div><div style="font-size:13px;font-weight:700;color:var(--text);">Karcher K5 Pressure Washer</div><div style="font-size:11px;color:var(--text-3);">$55/day · 2 bookings this month</div></div>
                  <div style="text-align:right;"><div style="font-size:15px;font-weight:700;color:var(--green);">$110</div><div style="font-size:9px;color:var(--text-3);">earned</div></div>
                </div>
                <div style="display:flex;gap:8px;">
                  <button onclick="showToast('✏️','Edit listing coming soon!')" style="flex:1;background:none;border:1.5px solid var(--border);border-radius:8px;padding:7px;font-size:11px;font-weight:600;color:var(--text-2);cursor:pointer;">Edit</button>
                  <button onclick="showToast('📋','2 bookings: Mon–Wed, Thu–Fri')" style="flex:1;background:var(--green);color:white;border:none;border-radius:8px;padding:7px;font-size:11px;font-weight:600;cursor:pointer;">Bookings (2)</button>
                </div>
              </div>
            </div>

            <!-- Gear item 3 -->
            <div style="background:var(--surface);border-radius:14px;border:1px solid var(--border);margin-bottom:10px;overflow:hidden;">
              <div style="height:80px;background:linear-gradient(135deg,#e65100,#f57c00);display:flex;align-items:center;justify-content:center;position:relative;">
                <span style="font-size:42px;">🚛</span>
                <span style="position:absolute;top:6px;left:8px;background:#00796b;color:#fff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:6px;">● Available</span>
              </div>
              <div style="padding:10px 12px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
                  <div><div style="font-size:13px;font-weight:700;color:var(--text);">7×4 Box Trailer</div><div style="font-size:11px;color:var(--text-3);">$40/day · 1 booking this month</div></div>
                  <div style="text-align:right;"><div style="font-size:15px;font-weight:700;color:var(--green);">$40</div><div style="font-size:9px;color:var(--text-3);">earned</div></div>
                </div>
                <div style="display:flex;gap:8px;">
                  <button onclick="showToast('✏️','Edit listing coming soon!')" style="flex:1;background:none;border:1.5px solid var(--border);border-radius:8px;padding:7px;font-size:11px;font-weight:600;color:var(--text-2);cursor:pointer;">Edit</button>
                  <button onclick="showToast('📋','1 booking: Saturday')" style="flex:1;background:var(--green);color:white;border:none;border-radius:8px;padding:7px;font-size:11px;font-weight:600;cursor:pointer;">Bookings (1)</button>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>`;

// ─── s-rental-detail (both apps) ─────────────────────────────────────────────

const S_RENTAL_DETAIL = `
      <!-- ═══ RENTAL DETAIL ═══ -->
      <div class="screen hidden" id="s-rental-detail" style="display:flex;flex-direction:column;overflow:hidden;">

        <!-- Hero -->
        <div id="rd-hero" style="height:190px;background:linear-gradient(135deg,#2d6a4f,#52b788);position:relative;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <button onclick="goBack()" style="position:absolute;top:46px;left:14px;width:34px;height:34px;background:rgba(0,0,0,0.35);border:none;border-radius:50%;color:white;font-size:17px;cursor:pointer;display:flex;align-items:center;justify-content:center;">←</button>
          <span id="rd-hero-em" style="font-size:70px;user-select:none;">🌿</span>
          <span id="rd-avail-badge" style="position:absolute;top:46px;right:14px;background:#00796b;color:#fff;font-size:10px;font-weight:700;padding:3px 10px;border-radius:8px;">Available</span>
          <span id="rd-del-badge" style="position:absolute;bottom:10px;left:14px;background:rgba(0,0,0,0.5);color:#fff;font-size:9px;font-weight:700;padding:2px 9px;border-radius:6px;">🚚 Delivery Available</span>
        </div>

        <!-- Scrollable body -->
        <div style="overflow-y:auto;flex:1;background:var(--bg);padding-bottom:80px;">

          <!-- Title section -->
          <div style="background:var(--surface);padding:14px 16px;border-bottom:1px solid var(--border);">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
              <div style="flex:1;min-width:0;">
                <div id="rd-title" style="font-size:18px;font-weight:700;color:var(--text);">Honda HRX Mower</div>
                <div id="rd-subtitle" style="font-size:12px;color:var(--text-3);margin-top:2px;">Self-propelled · 21" cut · Mulch/Bag</div>
              </div>
              <div id="rd-pop" style="flex-shrink:0;margin-left:10px;text-align:center;">
                <div style="font-size:18px;font-weight:700;color:var(--green);">47</div>
                <div style="font-size:9px;color:var(--text-3);">rentals</div>
              </div>
            </div>
            <div id="rd-badges-row" style="display:flex;flex-wrap:wrap;gap:5px;margin-top:10px;"></div>
          </div>

          <!-- Pricing grid -->
          <div style="margin:10px 12px 0;background:var(--surface);border-radius:14px;border:1px solid var(--border);overflow:hidden;">
            <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:12px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.05em;">Pricing</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;">
              <div style="padding:12px;text-align:center;border-right:1px solid var(--border);">
                <div style="font-size:9px;color:var(--text-3);font-weight:600;text-transform:uppercase;margin-bottom:4px;">Half Day</div>
                <div id="rd-ph" style="font-size:18px;font-weight:700;color:var(--green);">$28</div>
                <div style="font-size:9px;color:var(--text-3);">4 hrs</div>
              </div>
              <div style="padding:12px;text-align:center;border-right:1px solid var(--border);background:var(--green-pale);">
                <div style="font-size:9px;color:var(--green);font-weight:700;text-transform:uppercase;margin-bottom:4px;">Full Day ★</div>
                <div id="rd-pd" style="font-size:18px;font-weight:700;color:var(--green);">$45</div>
                <div style="font-size:9px;color:var(--text-3);">8 hrs</div>
              </div>
              <div style="padding:12px;text-align:center;">
                <div style="font-size:9px;color:var(--text-3);font-weight:600;text-transform:uppercase;margin-bottom:4px;">Week</div>
                <div id="rd-pw" style="font-size:18px;font-weight:700;color:var(--green);">$189</div>
                <div style="font-size:9px;color:var(--text-3);">7 days</div>
              </div>
            </div>
          </div>

          <!-- Security deposit -->
          <div style="margin:8px 12px 0;background:#fff8ec;border:1px solid rgba(244,166,42,0.35);border-radius:12px;padding:11px 14px;display:flex;align-items:center;gap:10px;">
            <span style="font-size:20px;">🔒</span>
            <div>
              <div style="font-size:12px;font-weight:700;color:#a06000;">Security Deposit Required</div>
              <div id="rd-dep" style="font-size:15px;font-weight:700;color:#a06000;">$150</div>
              <div style="font-size:10px;color:#b87333;">Refunded within 24hrs of clean return</div>
            </div>
          </div>

          <!-- Owner card -->
          <div style="margin:8px 12px 0;background:var(--surface);border-radius:14px;border:1px solid var(--border);padding:12px 14px;">
            <div style="font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Listed By</div>
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:38px;height:38px;background:var(--green);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:16px;font-weight:700;flex-shrink:0;">G</div>
              <div style="flex:1;">
                <div id="rd-owner" style="font-size:14px;font-weight:600;color:var(--text);">Green Thumb Co.</div>
                <div style="font-size:11px;color:var(--text-3);">⭐ 4.9 · 📍 <span id="rd-dist">2.1km</span> away · Verified contractor</div>
              </div>
              <button onclick="goTo('s-team-chat')" style="background:none;border:1.5px solid var(--green);color:var(--green);border-radius:8px;padding:6px 10px;font-size:11px;font-weight:600;cursor:pointer;">Chat</button>
            </div>
          </div>

          <!-- Availability week view -->
          <div style="margin:8px 12px 0;background:var(--surface);border-radius:14px;border:1px solid var(--border);padding:12px 14px;">
            <div style="font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px;">This Week</div>
            <div style="display:flex;gap:4px;">
              <div style="flex:1;text-align:center;"><div style="font-size:9px;color:var(--text-3);margin-bottom:4px;">Mon</div><div style="width:28px;height:28px;background:#00796b;border-radius:50%;margin:0 auto;"></div></div>
              <div style="flex:1;text-align:center;"><div style="font-size:9px;color:var(--text-3);margin-bottom:4px;">Tue</div><div style="width:28px;height:28px;background:#00796b;border-radius:50%;margin:0 auto;"></div></div>
              <div style="flex:1;text-align:center;"><div style="font-size:9px;color:var(--text-3);margin-bottom:4px;">Wed</div><div style="width:28px;height:28px;background:#bdbdbd;border-radius:50%;margin:0 auto;"></div></div>
              <div style="flex:1;text-align:center;"><div style="font-size:9px;color:var(--text-3);margin-bottom:4px;">Thu</div><div style="width:28px;height:28px;background:#bdbdbd;border-radius:50%;margin:0 auto;"></div></div>
              <div style="flex:1;text-align:center;"><div style="font-size:9px;color:var(--text-3);margin-bottom:4px;">Fri</div><div style="width:28px;height:28px;background:#00796b;border-radius:50%;margin:0 auto;"></div></div>
              <div style="flex:1;text-align:center;"><div style="font-size:9px;color:var(--text-3);margin-bottom:4px;">Sat</div><div style="width:28px;height:28px;background:#00796b;border-radius:50%;margin:0 auto;"></div></div>
              <div style="flex:1;text-align:center;"><div style="font-size:9px;color:var(--text-3);margin-bottom:4px;">Sun</div><div style="width:28px;height:28px;background:#00796b;border-radius:50%;margin:0 auto;"></div></div>
            </div>
            <div style="display:flex;gap:16px;margin-top:8px;justify-content:center;">
              <div style="display:flex;align-items:center;gap:5px;"><div style="width:10px;height:10px;background:#00796b;border-radius:50%;"></div><span style="font-size:10px;color:var(--text-3);">Available</span></div>
              <div style="display:flex;align-items:center;gap:5px;"><div style="width:10px;height:10px;background:#bdbdbd;border-radius:50%;"></div><span style="font-size:10px;color:var(--text-3);">Booked</span></div>
            </div>
          </div>

          <!-- Insurance note -->
          <div style="margin:8px 12px 0;font-size:11px;color:var(--text-3);line-height:1.5;">🛡️ All rentals include equipment insurance up to $2,000. Handover photos required at pickup and return.</div>

        </div>

        <!-- Reserve CTA (sticky bottom) -->
        <div style="position:absolute;bottom:0;left:0;right:0;padding:12px 16px;background:var(--surface);border-top:1px solid var(--border);">
          <button id="rd-reserve-btn" onclick="rcReserve()" style="width:100%;background:var(--green);color:white;border:none;border-radius:12px;padding:14px;font-size:14px;font-weight:700;cursor:pointer;">Reserve · $45/day + $150 deposit</button>
        </div>

      </div>`;

// ─── s-handover-wizard (both apps) ───────────────────────────────────────────

const S_HANDOVER_WIZARD = `
      <!-- ═══ HANDOVER WIZARD ═══ -->
      <div class="screen hidden" id="s-handover-wizard" style="display:flex;flex-direction:column;overflow:hidden;">

        <!-- Header -->
        <div style="background:var(--green);padding:50px 16px 16px;position:relative;flex-shrink:0;">
          <button class="back-btn" onclick="goBack()">←</button>
          <div style="margin-left:40px;">
            <div style="color:white;font-size:19px;font-weight:600;">Handover Inspection</div>
            <div style="color:rgba(255,255,255,0.75);font-size:13px;">Honda HRX Mower · Pickup condition</div>
          </div>
        </div>

        <!-- Progress steps -->
        <div style="display:flex;background:var(--surface);border-bottom:1px solid var(--border);flex-shrink:0;padding:0 16px;">
          <div id="hw-step-1" style="flex:1;padding:10px 0;text-align:center;border-bottom:2px solid var(--green);">
            <div style="font-size:18px;">📸</div><div style="font-size:9px;font-weight:700;color:var(--green);margin-top:2px;">Photos</div>
          </div>
          <div id="hw-step-2" style="flex:1;padding:10px 0;text-align:center;border-bottom:2px solid var(--border);">
            <div style="font-size:18px;">☑️</div><div style="font-size:9px;font-weight:600;color:var(--text-3);margin-top:2px;">Checklist</div>
          </div>
          <div id="hw-step-3" style="flex:1;padding:10px 0;text-align:center;border-bottom:2px solid var(--border);">
            <div style="font-size:18px;">✍️</div><div style="font-size:9px;font-weight:600;color:var(--text-3);margin-top:2px;">Sign-off</div>
          </div>
        </div>

        <!-- Step content -->
        <div style="overflow-y:auto;flex:1;padding:16px;background:var(--bg);">

          <!-- Step 1: Photos -->
          <div id="hw-pane-1">
            <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px;">Step 1: Condition Photos</div>
            <div style="font-size:12px;color:var(--text-3);margin-bottom:14px;">Take 3–4 photos of the equipment before you take it. These protect you if any disputes arise.</div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;">
              <button onclick="showToast('📸','Photo 1 captured — Front view')" style="height:90px;background:var(--surface);border:2px dashed var(--border);border-radius:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;">
                <span style="font-size:24px;">📷</span><span style="font-size:11px;color:var(--text-3);">Front</span>
              </button>
              <button onclick="showToast('📸','Photo 2 captured — Side view')" style="height:90px;background:var(--surface);border:2px dashed var(--border);border-radius:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;">
                <span style="font-size:24px;">📷</span><span style="font-size:11px;color:var(--text-3);">Side</span>
              </button>
              <button onclick="showToast('📸','Photo 3 captured — Engine/motor')" style="height:90px;background:var(--surface);border:2px dashed var(--border);border-radius:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;">
                <span style="font-size:24px;">📷</span><span style="font-size:11px;color:var(--text-3);">Engine</span>
              </button>
              <button onclick="showToast('📸','Photo 4 captured — Any damage')" style="height:90px;background:var(--surface);border:2px dashed var(--border);border-radius:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;">
                <span style="font-size:24px;">📷</span><span style="font-size:11px;color:var(--text-3);">Damage?</span>
              </button>
            </div>

            <div style="background:var(--surface);border-radius:12px;border:1px solid var(--border);padding:12px 14px;margin-bottom:14px;">
              <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:6px;">Overall Condition Rating</div>
              <div style="display:flex;gap:8px;">
                <button onclick="hwRate(1)" style="flex:1;padding:8px;border:1.5px solid var(--border);border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;color:var(--text-3);background:none;">Poor</button>
                <button onclick="hwRate(2)" style="flex:1;padding:8px;border:1.5px solid var(--border);border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;color:var(--text-3);background:none;">Fair</button>
                <button onclick="hwRate(3)" style="flex:1;padding:8px;border:1.5px solid var(--green);border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;color:var(--green);background:var(--green-pale);">Good</button>
                <button onclick="hwRate(4)" style="flex:1;padding:8px;border:1.5px solid var(--border);border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;color:var(--text-3);background:none;">Exc.</button>
              </div>
            </div>

            <button onclick="hwGoStep(2)" style="width:100%;background:var(--green);color:white;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:600;cursor:pointer;">Next — Accessories Checklist →</button>
          </div>

          <!-- Step 2: Checklist -->
          <div id="hw-pane-2" style="display:none;">
            <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px;">Step 2: Accessories</div>
            <div style="font-size:12px;color:var(--text-3);margin-bottom:14px;">Confirm all listed accessories are present at pickup.</div>

            <div style="background:var(--surface);border-radius:12px;border:1px solid var(--border);overflow:hidden;margin-bottom:14px;">
              <label style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid var(--border);cursor:pointer;">
                <input type="checkbox" checked style="width:18px;height:18px;accent-color:var(--green);flex-shrink:0;"/>
                <div><div style="font-size:13px;font-weight:500;color:var(--text);">Fuel tank (min 50% full)</div><div style="font-size:11px;color:var(--text-3);">Owner confirms tank level</div></div>
              </label>
              <label style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid var(--border);cursor:pointer;">
                <input type="checkbox" checked style="width:18px;height:18px;accent-color:var(--green);flex-shrink:0;"/>
                <div><div style="font-size:13px;font-weight:500;color:var(--text);">Grass catcher / bag</div></div>
              </label>
              <label style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid var(--border);cursor:pointer;">
                <input type="checkbox" checked style="width:18px;height:18px;accent-color:var(--green);flex-shrink:0;"/>
                <div><div style="font-size:13px;font-weight:500;color:var(--text);">Blade guard</div></div>
              </label>
              <label style="display:flex;align-items:center;gap:12px;padding:12px 14px;cursor:pointer;">
                <input type="checkbox" style="width:18px;height:18px;accent-color:var(--green);flex-shrink:0;"/>
                <div><div style="font-size:13px;font-weight:500;color:var(--text);">Instruction manual</div><div style="font-size:11px;color:var(--text-3);">Optional — tick if present</div></div>
              </label>
            </div>

            <div style="display:flex;gap:8px;">
              <button onclick="hwGoStep(1)" style="flex:0 0 auto;background:none;border:1.5px solid var(--border);color:var(--text-2);border-radius:12px;padding:13px 18px;font-size:13px;font-weight:600;cursor:pointer;">← Back</button>
              <button onclick="hwGoStep(3)" style="flex:1;background:var(--green);color:white;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:600;cursor:pointer;">Next — Sign-off →</button>
            </div>
          </div>

          <!-- Step 3: Sign-off -->
          <div id="hw-pane-3" style="display:none;">
            <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px;">Step 3: Confirm & Sign</div>
            <div style="font-size:12px;color:var(--text-3);margin-bottom:14px;">Both parties confirm pickup condition. This is recorded and cannot be altered after submission.</div>

            <div style="background:var(--surface);border-radius:12px;border:1px solid var(--border);padding:14px;margin-bottom:12px;">
              <div style="font-size:12px;color:var(--text-2);line-height:1.6;">
                <div style="margin-bottom:6px;">📸 <strong>4 photos captured</strong></div>
                <div style="margin-bottom:6px;">⭐ Condition rated: <strong>Good</strong></div>
                <div style="margin-bottom:6px;">☑️ <strong>3/4</strong> accessories confirmed</div>
                <div>🕐 Pickup: <strong>Today, 9:00 AM</strong></div>
              </div>
            </div>

            <div style="background:#fff8ec;border-radius:12px;border:1px solid rgba(244,166,42,0.3);padding:11px 14px;margin-bottom:14px;font-size:11px;color:#a06000;line-height:1.5;">
              ⚠️ By confirming, you agree the equipment is in the stated condition. Any undisclosed damage may result in deposit deductions.
            </div>

            <div style="display:flex;gap:8px;">
              <button onclick="hwGoStep(2)" style="flex:0 0 auto;background:none;border:1.5px solid var(--border);color:var(--text-2);border-radius:12px;padding:13px 18px;font-size:13px;font-weight:600;cursor:pointer;">← Back</button>
              <button onclick="showToast('✅','Pickup confirmed! Enjoy your rental. Return by Sunday 5pm.')" style="flex:1;background:var(--green);color:white;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:700;cursor:pointer;">Confirm Pickup ✓</button>
            </div>
          </div>

        </div>
      </div>`;

// ─── s-my-rentals (Customer only) ────────────────────────────────────────────

const S_MY_RENTALS = `
      <!-- ═══ MY RENTALS ═══ -->
      <div class="screen hidden" id="s-my-rentals" style="display:flex;flex-direction:column;overflow:hidden;">

        <!-- Header -->
        <div style="background:var(--green);padding:50px 16px 16px;position:relative;flex-shrink:0;">
          <button class="back-btn" onclick="goBack()">←</button>
          <div style="margin-left:40px;">
            <div style="color:white;font-size:19px;font-weight:600;">My Rentals</div>
            <div style="color:rgba(255,255,255,0.75);font-size:13px;">Active & past equipment bookings</div>
          </div>
        </div>

        <div style="overflow-y:auto;flex:1;padding:12px;background:var(--bg);">

          <!-- Active rental -->
          <div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.07em;padding:2px 0 8px;">Active</div>
          <div style="background:var(--surface);border-radius:16px;border:2px solid var(--green);margin-bottom:12px;overflow:hidden;">
            <div style="height:100px;background:linear-gradient(135deg,#2d6a4f,#52b788);display:flex;align-items:center;justify-content:center;position:relative;">
              <span style="font-size:50px;">🌿</span>
              <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.45);padding:6px 12px;display:flex;justify-content:space-between;align-items:center;">
                <span style="color:white;font-size:11px;font-weight:700;">Honda HRX Mower</span>
                <span style="background:#f4a62a;color:white;font-size:9px;font-weight:700;padding:2px 8px;border-radius:6px;">ACTIVE</span>
              </div>
            </div>
            <div style="padding:12px 14px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                <div style="font-size:12px;color:var(--text-3);">📅 Picked up Mon 5 May</div>
                <div style="font-size:12px;color:var(--text-3);">Return Sun 11 May</div>
              </div>
              <!-- Countdown bar -->
              <div style="margin-bottom:10px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                  <span style="font-size:11px;font-weight:600;color:var(--text);">⏱ 2 days remaining</span>
                  <span style="font-size:11px;color:var(--text-3);">Day 5 of 7</span>
                </div>
                <div style="background:var(--bg);border-radius:4px;height:6px;overflow:hidden;">
                  <div style="width:71%;height:100%;background:var(--green);border-radius:4px;"></div>
                </div>
              </div>
              <div style="font-size:11px;color:var(--text-3);margin-bottom:10px;">$45/day · $315 total · $150 deposit held</div>
              <div style="display:flex;gap:8px;">
                <button onclick="goTo('s-handover-wizard')" style="flex:1;background:var(--green);color:white;border:none;border-radius:10px;padding:9px;font-size:12px;font-weight:600;cursor:pointer;">Start Return</button>
                <button onclick="goTo('s-team-chat')" style="flex:1;background:none;border:1.5px solid var(--border);color:var(--text-2);border-radius:10px;padding:9px;font-size:12px;font-weight:600;cursor:pointer;">Contact Owner</button>
              </div>
            </div>
          </div>

          <!-- Past rentals -->
          <div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.07em;padding:2px 0 8px;">Past</div>

          <div style="background:var(--surface);border-radius:14px;border:1px solid var(--border);margin-bottom:8px;padding:12px 14px;display:flex;gap:10px;align-items:center;">
            <div style="width:44px;height:44px;background:linear-gradient(135deg,#01579b,#0288d1);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:22px;">💦</div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:600;color:var(--text);">Karcher K5 Pressure Washer</div>
              <div style="font-size:11px;color:var(--text-3);">1 day · $55 · 22 Apr 2026</div>
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
              <div style="font-size:11px;color:var(--text-3);">2 days · $80 · 10 Apr 2026</div>
            </div>
            <div style="flex-shrink:0;text-align:right;">
              <div style="background:var(--green-pale);color:var(--green);font-size:9px;font-weight:700;padding:2px 8px;border-radius:6px;">Returned ✓</div>
              <div style="font-size:10px;color:var(--text-3);margin-top:3px;">Deposit refunded</div>
            </div>
          </div>

        </div>
      </div>`;

// ─── JS IIFE (injected into both apps before </body>) ─────────────────────────

const RENTAL_JS = `
<!-- ═══════════════════════════════════════════════════════════════════════════
     EQUIPMENT RENTALS — JavaScript
     ═══════════════════════════════════════════════════════════════════════════ -->
<script>
(function(){
  'use strict';

  var RC_CATS = [
    { id:'all',      label:'All',              icon:'🏷️', subs:[] },
    { id:'lawn',     label:'Lawn & Garden',    icon:'🌿', subs:['Mowers','Ride-Ons','Trimmers','Blowers','Edgers','Aerators'] },
    { id:'pressure', label:'Pressure Washing', icon:'💦', subs:['Electric','Petrol','Hot Water','Commercial'] },
    { id:'tools',    label:'Power Tools',      icon:'🔧', subs:['Drills','Grinders','Sanders','Saws','Compressors'] },
    { id:'trailers', label:'Trailers',         icon:'🚛', subs:['Box Trailer','Car Trailer','Tipper','Enclosed'] },
    { id:'concrete', label:'Concrete & Digging',icon:'⛏️',subs:['Mixers','Jackhammers','Post Hole','Compactors'] },
    { id:'access',   label:'Access & Lifting', icon:'🪜', subs:['Ladders','Scaffolding','Platform'] },
    { id:'cleaning', label:'Cleaning',         icon:'🧹', subs:['Carpet','Floor Polish','Industrial Vac'] }
  ];

  var RC_ITEMS = [
    { id:'r1',  name:'Honda HRX Mower',          sub2:'Self-propelled · 21" cut · Mulch/Bag',    cat:'lawn',     sub:'Mowers',     ph:28, pd:45,  pw:189, dep:150, owner:'Green Thumb Co.',  dist:'2.1km', cond:'excellent', condLbl:'Excellent', avail:true,  delivery:true,  rented:47, badges:[{i:'⛽',t:'Petrol'},{i:'📏',t:'21" Cut'},{i:'⚖️',t:'35 kg'}],        thumb:{bg:'linear-gradient(135deg,#2d6a4f,#52b788)',em:'🌿',sz:'58px'} },
    { id:'r2',  name:'Stihl FS 240 Trimmer',     sub2:'Petrol · Bi-directional · Pro-grade',     cat:'lawn',     sub:'Trimmers',   ph:16, pd:30,  pw:120, dep:80,  owner:'LawnKing',         dist:'4.2km', cond:'good',      condLbl:'Good',      avail:true,  delivery:false, rented:29, badges:[{i:'⛽',t:'Petrol'},{i:'🔄',t:'2-Stroke'},{i:'⚖️',t:'7 kg'}],         thumb:{bg:'linear-gradient(135deg,#1b5e20,#43a047)',em:'✂️',sz:'54px'} },
    { id:'r3',  name:'Husqvarna Ride-On Mower',  sub2:'42" deck · Hydrostatic · 18.5 HP',        cat:'lawn',     sub:'Ride-Ons',   ph:55, pd:95,  pw:380, dep:300, owner:'Green Thumb Co.',  dist:'2.1km', cond:'excellent', condLbl:'Excellent', avail:false, delivery:true,  rented:12, badges:[{i:'⛽',t:'Petrol'},{i:'📏',t:'42" Deck'},{i:'💪',t:'18.5 HP'}],      thumb:{bg:'linear-gradient(135deg,#4a148c,#7b1fa2)',em:'🚜',sz:'58px'} },
    { id:'r4',  name:'Karcher K5 Pressure Washer',sub2:'145 bar · 500L/hr · Patio kit incl.',    cat:'pressure', sub:'Electric',   ph:28, pd:55,  pw:220, dep:120, owner:'QuickFix Repairs', dist:'5.1km', cond:'excellent', condLbl:'Excellent', avail:true,  delivery:false, rented:38, badges:[{i:'⚡',t:'Electric'},{i:'💧',t:'145 Bar'},{i:'📦',t:'Kit Incl.'}],  thumb:{bg:'linear-gradient(135deg,#01579b,#0288d1)',em:'💦',sz:'56px'} },
    { id:'r5',  name:'Petrol Pressure Washer',   sub2:'3000 PSI · Honda engine · 15m hose',      cat:'pressure', sub:'Petrol',     ph:38, pd:70,  pw:270, dep:180, owner:'ProClean NT',      dist:'6.8km', cond:'good',      condLbl:'Good',      avail:true,  delivery:true,  rented:21, badges:[{i:'⛽',t:'Petrol'},{i:'💧',t:'3000 PSI'},{i:'📏',t:'15m Hose'}],  thumb:{bg:'linear-gradient(135deg,#0d47a1,#1565c0)',em:'🌊',sz:'54px'} },
    { id:'r6',  name:'Makita 18V Drill Combo',   sub2:'2× 5Ah batteries · Charger · 4-piece',   cat:'tools',    sub:'Drills',     ph:18, pd:28,  pw:98,  dep:60,  owner:'ToolMate NT',      dist:'3.4km', cond:'excellent', condLbl:'Excellent', avail:true,  delivery:false, rented:53, badges:[{i:'🔋',t:'18V Li-ion'},{i:'🔩',t:'4-Piece'},{i:'⚖️',t:'3.2 kg'}],  thumb:{bg:'linear-gradient(135deg,#bf360c,#e64a19)',em:'🔧',sz:'56px'} },
    { id:'r7',  name:'Angle Grinder 9"',         sub2:'2400W · Paddle switch · Disc included',   cat:'tools',    sub:'Grinders',   ph:15, pd:25,  pw:85,  dep:50,  owner:'ToolMate NT',      dist:'3.4km', cond:'good',      condLbl:'Good',      avail:true,  delivery:false, rented:18, badges:[{i:'⚡',t:'2400W'},{i:'📏',t:'9" Disc'},{i:'⚖️',t:'5.1 kg'}],      thumb:{bg:'linear-gradient(135deg,#37474f,#546e7a)',em:'⚙️',sz:'54px'} },
    { id:'r8',  name:'7×4 Box Trailer',          sub2:'Cage sides · Jockey wheel · Ball hitch',  cat:'trailers', sub:'Box Trailer', ph:25, pd:40, pw:160, dep:200, owner:'TrailerHire NT',   dist:'7.2km', cond:'good',      condLbl:'Good',      avail:true,  delivery:false, rented:34, badges:[{i:'📐',t:'7×4 ft'},{i:'⚖️',t:'750 kg ATM'},{i:'🔒',t:'Lockable'}], thumb:{bg:'linear-gradient(135deg,#e65100,#f57c00)',em:'🚛',sz:'58px'} },
    { id:'r9',  name:'Petrol Cement Mixer 100L', sub2:'4HP engine · Steel drum · Stand incl.',   cat:'concrete', sub:'Mixers',     ph:35, pd:60,  pw:240, dep:150, owner:'BuildBase NT',     dist:'8.5km', cond:'good',      condLbl:'Good',      avail:true,  delivery:true,  rented:16, badges:[{i:'⛽',t:'Petrol'},{i:'🪣',t:'100L Drum'},{i:'💪',t:'4 HP'}],      thumb:{bg:'linear-gradient(135deg,#4e342e,#6d4c41)',em:'🏗️',sz:'56px'} },
    { id:'r10', name:'Demolition Jack Hammer',   sub2:'1500W · 45J impact · SDS-Max chisel',     cat:'concrete', sub:'Jackhammers', ph:45, pd:75, pw:280, dep:200, owner:'BuildBase NT',    dist:'8.5km', cond:'excellent', condLbl:'Excellent', avail:false, delivery:true,  rented:9,  badges:[{i:'⚡',t:'1500W'},{i:'💥',t:'45J Impact'},{i:'⚖️',t:'12 kg'}],    thumb:{bg:'linear-gradient(135deg,#263238,#37474f)',em:'⛏️',sz:'56px'} },
    { id:'r11', name:'Platform Ladder 3.0m',     sub2:'Fibreglass · 150kg rated · Dual access',  cat:'access',   sub:'Ladders',    ph:18, pd:30,  pw:95,  dep:50,  owner:'SafeWork NT',      dist:'4.9km', cond:'excellent', condLbl:'Excellent', avail:true,  delivery:false, rented:41, badges:[{i:'🏗️',t:'3.0m High'},{i:'⚖️',t:'150 kg Rated'},{i:'🛡️',t:'AS/NZS'}],thumb:{bg:'linear-gradient(135deg,#006064,#00838f)',em:'🪜',sz:'56px'} },
    { id:'r12', name:'Carpet Cleaner Extractor', sub2:'Upright · 45L tank · Hose & wand kit',    cat:'cleaning', sub:'Carpet',     ph:35, pd:55,  pw:200, dep:100, owner:'CleanPro NT',      dist:'5.6km', cond:'good',      condLbl:'Good',      avail:true,  delivery:true,  rented:26, badges:[{i:'💧',t:'45L Tank'},{i:'⚡',t:'1200W'},{i:'📦',t:'Kit Incl.'}],   thumb:{bg:'linear-gradient(135deg,#1a237e,#283593)',em:'🧹',sz:'56px'} }
  ];

  var rcCurCat = 'all';
  var rcCurSub = null;
  var rcCurQ   = '';
  var rcDetail_item = null;

  // ── Public API ──────────────────────────────────────────────────────────────

  window.rcInit = function() {
    rcCurCat = 'all'; rcCurSub = null; rcCurQ = '';
    var si = document.getElementById('rc-search');
    if (si) si.value = '';
    _renderCats();
    _renderSubs();
    _renderItems(_filtered());
  };

  window.rcSetCat = function(id) {
    rcCurCat = id; rcCurSub = null;
    _renderCats();
    _renderSubs();
    _renderItems(_filtered());
  };

  window.rcSetSub = function(sub) {
    rcCurSub = (rcCurSub === sub) ? null : sub;
    _renderSubs();
    _renderItems(_filtered());
  };

  window.rcSearch = function(q) {
    rcCurQ = (q || '').toLowerCase().trim();
    _renderItems(_filtered());
  };

  window.rcDetail = function(id) {
    var item = null;
    for (var i = 0; i < RC_ITEMS.length; i++) { if (RC_ITEMS[i].id === id) { item = RC_ITEMS[i]; break; } }
    if (!item) return;
    rcDetail_item = item;

    // Populate hero
    var hero = document.getElementById('rd-hero');
    if (hero) hero.style.background = item.thumb.bg;
    var em = document.getElementById('rd-hero-em');
    if (em) { em.textContent = item.thumb.em; em.style.fontSize = item.thumb.sz; }

    // Availability badge
    var ab = document.getElementById('rd-avail-badge');
    if (ab) {
      ab.textContent = item.avail ? 'Available' : 'Unavailable';
      ab.style.background = item.avail ? '#00796b' : '#757575';
    }

    // Delivery badge
    var db = document.getElementById('rd-del-badge');
    if (db) db.style.display = item.delivery ? '' : 'none';

    // Text fields
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

    // Badges
    var br = document.getElementById('rd-badges-row');
    if (br) {
      var bHtml = '';
      for (var j = 0; j < item.badges.length; j++) {
        bHtml += '<span style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:4px 9px;font-size:11px;font-weight:600;color:var(--text-2);">' + item.badges[j].i + ' ' + item.badges[j].t + '</span>';
      }
      br.innerHTML = bHtml;
    }

    // Reserve button
    var rb = document.getElementById('rd-reserve-btn');
    if (rb) {
      if (item.avail) {
        rb.textContent = 'Reserve · $' + item.pd + '/day + $' + item.dep + ' deposit';
        rb.disabled = false;
        rb.style.background = 'var(--green)';
        rb.style.cursor = 'pointer';
      } else {
        rb.textContent = 'Currently Unavailable';
        rb.disabled = true;
        rb.style.background = '#bdbdbd';
        rb.style.cursor = 'not-allowed';
      }
    }

    if (typeof goTo === 'function') goTo('s-rental-detail');
  };

  window.rcReserve = function(id) {
    var item = id ? null : rcDetail_item;
    if (id) { for (var i = 0; i < RC_ITEMS.length; i++) { if (RC_ITEMS[i].id === id) { item = RC_ITEMS[i]; break; } } }
    if (!item) { showToast('⚠️','No item selected'); return; }
    if (!item.avail) { showToast('⚠️','This item is currently unavailable'); return; }
    showToast('✅', item.name + ' reserved! Check My Rentals for details.');
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
    for (var s = 1; s <= 3; s++) {
      var pane = document.getElementById('hw-pane-' + s);
      var step = document.getElementById('hw-step-' + s);
      if (pane) pane.style.display = (s === n) ? '' : 'none';
      if (step) {
        step.style.borderBottomColor = (s === n) ? 'var(--green)' : 'var(--border)';
        var lbl = step.querySelector('div:last-child');
        if (lbl) { lbl.style.color = (s === n) ? 'var(--green)' : 'var(--text-3)'; lbl.style.fontWeight = (s === n) ? '700' : '600'; }
      }
    }
  };

  window.hwRate = function(n) {
    var labels = ['Poor','Fair','Good','Exc.'];
    showToast('⭐', 'Condition rated: ' + (labels[n-1] || n));
  };

  // ── Private helpers ─────────────────────────────────────────────────────────

  function _filtered() {
    return RC_ITEMS.filter(function(item) {
      if (rcCurCat !== 'all' && item.cat !== rcCurCat) return false;
      if (rcCurSub && item.sub !== rcCurSub) return false;
      if (rcCurQ && item.name.toLowerCase().indexOf(rcCurQ) === -1 && item.sub2.toLowerCase().indexOf(rcCurQ) === -1) return false;
      return true;
    });
  }

  function _renderCats() {
    var el = document.getElementById('rc-cats');
    if (!el) return;
    var html = '';
    for (var i = 0; i < RC_CATS.length; i++) {
      var c = RC_CATS[i];
      var active = (c.id === rcCurCat);
      var borderCol = active ? 'var(--green)' : 'transparent';
      var txtCol    = active ? 'var(--green)'  : 'var(--text-3)';
      var fw        = active ? '700' : '600';
      html += '<button onclick="rcSetCat(\'' + c.id + '\')" style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 10px;border:none;border-bottom:2px solid ' + borderCol + ';background:none;cursor:pointer;white-space:nowrap;flex-shrink:0;transition:all .15s;">'
            + '<span style="font-size:18px;">' + c.icon + '</span>'
            + '<span style="font-size:10px;font-weight:' + fw + ';color:' + txtCol + ';">' + c.label + '</span>'
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
      var sub = cat.subs[j];
      var active = (sub === rcCurSub);
      var bg  = active ? 'var(--green)'      : 'var(--surface)';
      var col = active ? '#fff'              : 'var(--text-2)';
      var bdr = active ? 'var(--green)'      : 'var(--border)';
      html += '<button onclick="rcSetSub(\'' + sub + '\')" style="flex-shrink:0;padding:5px 12px;border-radius:20px;border:1.5px solid ' + bdr + ';background:' + bg + ';color:' + col + ';font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;">' + sub + '</button>';
    }
    el.innerHTML = html;
  }

  function _card(item) {
    var avBg  = item.avail ? '#00796b' : '#757575';
    var avTxt = item.avail ? 'Available' : 'Unavailable';
    var rsvBg = item.avail ? 'var(--green)' : '#bdbdbd';
    var rsvCursor = item.avail ? 'pointer' : 'not-allowed';
    var rsvClick = item.avail
      ? 'event.stopPropagation();rcReserve(\'' + item.id + '\')'
      : 'event.stopPropagation();showToast(\'⚠️\',\'Currently unavailable\')';
    var badgeHtml = '';
    for (var b = 0; b < item.badges.length; b++) {
      badgeHtml += '<span style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:3px 8px;font-size:10px;font-weight:600;color:var(--text-2);white-space:nowrap;">' + item.badges[b].i + ' ' + item.badges[b].t + '</span>';
    }
    var delHtml = item.delivery
      ? '<span style="position:absolute;bottom:7px;left:8px;background:rgba(0,0,0,0.55);color:#fff;font-size:9px;font-weight:700;padding:2px 7px;border-radius:6px;">🚚 Delivery</span>'
      : '';
    return '<div onclick="rcDetail(\'' + item.id + '\')" style="background:var(--surface);border-radius:16px;margin-bottom:10px;border:1px solid var(--border);overflow:hidden;cursor:pointer;">'
      + '<div style="height:140px;background:' + item.thumb.bg + ';position:relative;display:flex;align-items:center;justify-content:center;">'
      + '<span style="font-size:' + item.thumb.sz + ';user-select:none;">' + item.thumb.em + '</span>'
      + '<span style="position:absolute;top:8px;left:8px;background:' + avBg + ';color:#fff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:6px;">' + avTxt + '</span>'
      + '<span style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.48);color:#fff;font-size:9px;font-weight:600;padding:2px 8px;border-radius:6px;">⭐ ' + item.condLbl + '</span>'
      + delHtml
      + '</div>'
      + '<div style="padding:10px 12px;">'
      + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">'
      + '<div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + item.name + '</div>'
      + '<div style="font-size:11px;color:var(--text-3);margin-top:1px;">' + item.sub2 + '</div></div>'
      + '<div style="text-align:right;flex-shrink:0;margin-left:8px;"><div style="font-size:17px;font-weight:700;color:var(--green);">$' + item.pd + '</div><div style="font-size:9px;color:var(--text-3);">/day</div></div>'
      + '</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">' + badgeHtml + '</div>'
      + '<div style="font-size:11px;color:var(--text-3);margin-bottom:9px;">👤 ' + item.owner + ' · 📍 ' + item.dist + ' · 🔥 ' + item.rented + ' rentals</div>'
      + '<div style="display:flex;gap:8px;">'
      + '<button onclick="' + rsvClick + '" style="flex:1;background:' + rsvBg + ';color:white;border:none;border-radius:10px;padding:9px;font-size:12px;font-weight:600;cursor:' + rsvCursor + ';">Reserve</button>'
      + '<button onclick="event.stopPropagation();rcDetail(\'' + item.id + '\')" style="flex:1;background:none;border:1.5px solid var(--green);color:var(--green);border-radius:10px;padding:9px;font-size:12px;font-weight:600;cursor:pointer;">Details</button>'
      + '</div>'
      + '</div>'
      + '</div>';
  }

  function _renderItems(items) {
    var el = document.getElementById('rc-list');
    if (!el) return;
    if (items.length === 0) {
      el.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--text-3);">'
        + '<div style="font-size:36px;margin-bottom:8px;">🔍</div>'
        + '<div style="font-size:14px;font-weight:600;">No equipment found</div>'
        + '<div style="font-size:12px;margin-top:4px;">Try a different category or search term</div></div>';
      return;
    }
    var html = '';
    for (var i = 0; i < items.length; i++) html += _card(items[i]);
    el.innerHTML = html;
  }

  // ── Auto-init & goTo patch ───────────────────────────────────────────────────

  function _patchGoTo() {
    if (window._rcPatched) return;
    window._rcPatched = true;
    var orig = window.goTo;
    if (typeof orig !== 'function') return;
    window.goTo = function(id) {
      orig.call(this, id);
      if (id === 's-rentals') {
        setTimeout(function() { window.rcInit && window.rcInit(); }, 30);
      }
    };
  }

  function _autoInit() {
    _patchGoTo();
    // Pre-populate if screen already visible
    var el = document.getElementById('rc-list');
    if (el && !el.innerHTML.trim()) { rcInit(); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _autoInit);
  } else {
    _autoInit();
  }

})();
</script>`;

// ─── Main ─────────────────────────────────────────────────────────────────────

const FILES = [
  { name: 'Crew_App_Customer_Role.html', isCrew: false },
  { name: 'Crew_App_Crew_Member.html',   isCrew: true  },
];

const CREW_PHONE_END   = '      <!-- /phone-screen -->';
const CUST_PHONE_END   = '</div><!-- /phone-screen -->';

for (const { name, isCrew } of FILES) {
  const filePath = path.join(ROOT, name);
  let html = fs.readFileSync(filePath, 'utf8');

  // ── 1. Replace s-rentals ──────────────────────────────────────────────────
  const newRentals = isCrew ? CREW_S_RENTALS : CUSTOMER_S_RENTALS;
  const replaced = replaceScreen(html, 's-rentals', newRentals);
  if (!replaced) { console.log('  ' + name + ': ⚠ s-rentals not found — skipped'); continue; }
  html = replaced;
  console.log('  ' + name + ': ✓ s-rentals replaced');

  // ── 2. Insert new screens before phone-screen end ─────────────────────────
  const phoneMarker = isCrew ? CREW_PHONE_END : CUST_PHONE_END;
  const newScreens = S_RENTAL_DETAIL + S_HANDOVER_WIZARD + (isCrew ? '' : S_MY_RENTALS);

  const withScreens = insertBefore(html, phoneMarker, newScreens);
  if (!withScreens) { console.log('  ' + name + ': ⚠ phone-screen end marker not found — new screens not inserted'); }
  else { html = withScreens; console.log('  ' + name + ': ✓ new screens inserted (s-rental-detail, s-handover-wizard' + (isCrew ? ')' : ', s-my-rentals)')); }

  // ── 3. Insert JS IIFE before </body> ─────────────────────────────────────
  const withJS = insertBefore(html, '</body>', RENTAL_JS);
  if (!withJS) { console.log('  ' + name + ': ⚠ </body> not found — JS not inserted'); }
  else { html = withJS; console.log('  ' + name + ': ✓ rental JS IIFE inserted'); }

  fs.writeFileSync(filePath, html, 'utf8');
  console.log('  ' + name + ': ✓ saved\n');
}

console.log('Done.');
