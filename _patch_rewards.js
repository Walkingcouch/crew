const fs = require('fs');
let c = fs.readFileSync('rewards.html', 'utf8');

// ── 1. Replace the entire phone screen content ────────────────────────────────
const OLD_SCREEN = `<!-- Status bar -->
            <div class="phone-status">
              <span>9:41</span><span style="letter-spacing:2px">●●● 🔋</span>
            </div>
            <!-- Header — flat #1a4d33, layout matches actual app -->
            <div class="phone-hdr">
              <div class="phone-greeting">CREWPOINTS</div>
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-top:4px">
                <div>
                  <div class="phone-pts-val">840</div>
                  <div style="font-size:10px;color:rgba(255,255,255,.55);margin-top:3px;line-height:1.4">points balance · expires after 3 months inactive</div>
                </div>
                <div class="phone-bucks-block">
                  <div class="phone-bucks-label">Crew Bucks</div>
                  <div class="phone-bucks-val">$4.50</div>
                </div>
              </div>
              <!-- Member badge row -->
              <div class="phone-tier-row" style="margin-top:12px">
                <span class="phone-tier-badge">⭐ CrewPoints Member</span>
                <span style="font-size:10px;font-weight:600;color:rgba(255,255,255,.85);margin-left:auto">View rewards ›</span>
              </div>
              <!-- Streak card -->
              <div class="phone-streak" style="margin-top:10px">
                <div class="phone-streak-ico">🔥</div>
                <div class="phone-streak-text">3-week streak — book this week for +500 bonus pts!</div>
                <div class="phone-streak-cta">Track ›</div>
              </div>
            </div>
            <!-- White body -->
            <div class="phone-body">
              <!-- 2x2 quick actions grid -->
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px 14px 8px">
                <div style="background:#fff;border:1px solid #e8e3da;border-radius:12px;padding:12px 10px;text-align:center">
                  <div style="font-size:20px;margin-bottom:5px">🎁</div>
                  <div style="font-size:11px;font-weight:700;color:#231f1a">Redeem Points</div>
                  <div style="font-size:9px;color:#7d7870;margin-top:2px">Contractor add-ons</div>
                </div>
                <div style="background:#f2faf5;border:1px solid #d9f2e3;border-radius:12px;padding:12px 10px;text-align:center">
                  <div style="font-size:20px;margin-bottom:5px">💵</div>
                  <div style="font-size:11px;font-weight:700;color:#1a4d33">Crew Bucks</div>
                  <div style="font-size:9px;color:#2d8055;margin-top:2px">$4.50 ready to use</div>
                </div>
                <div style="background:#fff;border:1px solid #e8e3da;border-radius:12px;padding:12px 10px;text-align:center">
                  <div style="font-size:20px;margin-bottom:5px">👥</div>
                  <div style="font-size:11px;font-weight:700;color:#231f1a">Refer a Friend</div>
                  <div style="font-size:9px;color:#7d7870;margin-top:2px">Give $5, Get $5</div>
                </div>
                <div style="background:#fff;border:1px solid #e8e3da;border-radius:12px;padding:12px 10px;text-align:center">
                  <div style="font-size:20px;margin-bottom:5px">🌿</div>
                  <div style="font-size:11px;font-weight:700;color:#231f1a">Refer a Contractor</div>
                  <div style="font-size:9px;color:#7d7870;margin-top:2px">Earn $15 Crew Bucks</div>
                </div>
              </div>
              <!-- Active challenges -->
              <div style="padding:4px 14px 0">
                <div style="font-size:9px;font-weight:700;color:#a8a39a;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">Active Challenges</div>
                <!-- Streak challenge -->
                <div style="background:#fff;border:1px solid #e8e3da;border-radius:12px;padding:10px 12px;margin-bottom:6px">
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <div style="font-size:11px;font-weight:700;color:#231f1a">🔥 4-Week Streak</div>
                    <div style="font-size:9px;font-weight:700;color:#1a4d33;background:#f2faf5;border:1px solid #d9f2e3;border-radius:100px;padding:2px 7px">+500 pts</div>
                  </div>
                  <div style="display:flex;gap:3px;margin-top:6px">
                    <div style="height:3px;flex:1;background:#4db37c;border-radius:2px"></div>
                    <div style="height:3px;flex:1;background:#4db37c;border-radius:2px"></div>
                    <div style="height:3px;flex:1;background:#4db37c;border-radius:2px"></div>
                    <div style="height:3px;flex:1;background:#e8e3da;border-radius:2px"></div>
                  </div>`;

// Find the old screen start and end
const screenStart = c.indexOf('<!-- Status bar -->');
const screenEnd = c.indexOf('</div>\n            <!-- White body -->', screenStart);

// Find the end of the phone-body div
const bodyStart = c.indexOf('<div class="phone-body">', screenStart);

// Just find the whole phone-screen content by looking for its wrapper boundaries
const phoneScreenStart = c.indexOf('<div class="hero-phone-screen">');
const phoneScreenEnd = c.indexOf('</div>\n          </div>\n        </div>',phoneScreenStart); // end of phone-screen, phone, phone-wrap

if (phoneScreenStart === -1) {
  console.log('ERROR: phone-screen not found');
  process.exit(1);
}

const newPhoneScreen = `<div class="hero-phone-screen">
            <!-- Status bar -->
            <div class="phone-status">
              <span>9:41</span><span style="letter-spacing:2px">●●● 🔋</span>
            </div>
            <!-- Header — matches actual Membership & Rewards screen -->
            <div class="phone-hdr">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                <span style="font-size:12px;color:rgba(255,255,255,.6)">←</span>
                <span style="font-size:13px;font-weight:700;color:#fff;letter-spacing:-.01em">Membership &amp; Rewards</span>
              </div>
              <div style="font-size:10px;color:rgba(255,255,255,.5)">840 pts · $340 spent · 8 bookings</div>
              <!-- Tier badge card -->
              <div style="display:flex;align-items:center;gap:10px;margin-top:10px;background:rgba(255,255,255,.1);border-radius:12px;padding:10px 12px">
                <div style="font-size:22px;line-height:1">⭐</div>
                <div>
                  <div style="font-size:12px;font-weight:700;color:#fff;margin-bottom:2px">CrewPoints Member</div>
                  <div style="font-size:9px;color:rgba(255,255,255,.6);line-height:1.4">Earn 10 pts per $1 · Redeem for add-ons &amp; Crew Bucks</div>
                </div>
              </div>
              <!-- 3-stat row -->
              <div style="display:flex;gap:6px;margin-top:8px">
                <div style="flex:1;background:rgba(255,255,255,.08);border-radius:10px;padding:8px 4px;text-align:center">
                  <div style="font-size:16px;font-weight:800;color:#fff;letter-spacing:-.02em">840</div>
                  <div style="font-size:8px;color:rgba(255,255,255,.5);margin-top:2px">Points</div>
                </div>
                <div style="flex:1;background:rgba(255,255,255,.08);border-radius:10px;padding:8px 4px;text-align:center">
                  <div style="font-size:16px;font-weight:800;color:#4db37c;letter-spacing:-.02em">$4.50</div>
                  <div style="font-size:8px;color:rgba(255,255,255,.5);margin-top:2px">Crew Bucks</div>
                </div>
                <div style="flex:1;background:rgba(255,255,255,.08);border-radius:10px;padding:8px 4px;text-align:center">
                  <div style="font-size:16px;font-weight:800;color:#fff;letter-spacing:-.02em">8</div>
                  <div style="font-size:8px;color:rgba(255,255,255,.5);margin-top:2px">Bookings</div>
                </div>
              </div>
            </div>
            <!-- White body -->
            <div class="phone-body">
              <div style="padding:10px 12px 0">
                <!-- Benefits -->
                <div style="font-size:8px;font-weight:700;color:#a8a39a;text-transform:uppercase;letter-spacing:.07em;margin-bottom:7px">Your member benefits</div>
                <div style="background:#fff;border:1px solid #e8e3da;border-radius:12px;padding:9px 11px;margin-bottom:8px">
                  <div style="font-size:10px;color:#3a3630;line-height:1.7">
                    <div>🏷️ <strong style="color:#231f1a">5% loyalty discount</strong> on every booking</div>
                    <div>📅 Early access to peak-season booking slots</div>
                    <div>⚡ Priority matching with Local Legend crew</div>
                    <div>🎁 Redeem points for contractor add-ons</div>
                  </div>
                </div>
                <!-- Boosts -->
                <div style="font-size:8px;font-weight:700;color:#a8a39a;text-transform:uppercase;letter-spacing:.07em;margin-bottom:7px">Boost your points</div>
                <!-- Streak challenge -->
                <div style="background:#fff;border:1px solid #e8e3da;border-radius:12px;padding:9px 11px;margin-bottom:6px">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
                    <div style="font-size:11px;font-weight:700;color:#231f1a">🔥 4-Week Streak</div>
                    <div style="font-size:9px;font-weight:700;color:#1a4d33;background:#f2faf5;border:1px solid #d9f2e3;border-radius:100px;padding:2px 7px">+500 pts</div>
                  </div>
                  <div style="display:flex;gap:3px;margin-bottom:4px">
                    <div style="height:3px;flex:1;background:#4db37c;border-radius:2px"></div>
                    <div style="height:3px;flex:1;background:#4db37c;border-radius:2px"></div>
                    <div style="height:3px;flex:1;background:#4db37c;border-radius:2px"></div>
                    <div style="height:3px;flex:1;background:#e8e3da;border-radius:2px"></div>
                  </div>
                  <div style="font-size:9px;color:#7d7870">3 of 4 weeks · book this week to finish!</div>
                </div>
                <!-- Stamp card -->
                <div style="background:#fff;border:1px solid #e8e3da;border-radius:12px;padding:9px 11px;margin-bottom:6px">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
                    <div style="font-size:11px;font-weight:700;color:#231f1a">🎫 Crew Stamp Card</div>
                    <div style="font-size:9px;font-weight:700;color:#1a4d33;background:#f2faf5;border:1px solid #d9f2e3;border-radius:100px;padding:2px 7px">6th free</div>
                  </div>
                  <div style="display:flex;gap:5px;margin-bottom:4px">
                    <span style="font-size:14px">🌿</span><span style="font-size:14px">🌿</span><span style="font-size:14px">🌿</span>
                    <span style="font-size:14px;opacity:.28">⭕</span><span style="font-size:14px;opacity:.28">⭕</span>
                  </div>
                  <div style="font-size:9px;color:#7d7870">3 of 5 stamps · 2 more bookings to go</div>
                </div>
                <!-- Refer row -->
                <div style="display:flex;gap:6px">
                  <div style="flex:1;background:#fff;border:1px solid #e8e3da;border-radius:12px;padding:9px 6px;text-align:center">
                    <div style="font-size:16px;margin-bottom:3px">👥</div>
                    <div style="font-size:10px;font-weight:700;color:#231f1a">Refer a Friend</div>
                    <div style="font-size:8px;color:#7d7870;margin-top:1px">$5 each</div>
                  </div>
                  <div style="flex:1;background:#fff;border:1px solid #e8e3da;border-radius:12px;padding:9px 6px;text-align:center">
                    <div style="font-size:16px;margin-bottom:3px">🌿</div>
                    <div style="font-size:10px;font-weight:700;color:#231f1a">Refer Contractor</div>
                    <div style="font-size:8px;color:#7d7870;margin-top:1px">$15 Bucks</div>
                  </div>
                </div>
                <!-- Expiry note -->
                <div style="margin-top:8px;font-size:8.5px;color:#a8a39a;line-height:1.5;text-align:center">Points expire after 6 months of inactivity.</div>
              </div>
            </div>
          </div>`;

// Find and replace the old phone-screen div
const oldPhoneScreenEnd = c.indexOf('</div>\n          </div>\n        </div>', phoneScreenStart);
if (oldPhoneScreenEnd === -1) {
  // Try alternate ending
  const alt = c.indexOf('</div>\n        </div>\n      </div>', phoneScreenStart);
  console.log('Alt end at:', alt);
}

// Use a more reliable approach: find by unique signature
const OLD_PHONE_BLOCK_START = '<div class="hero-phone-screen">';
const OLD_PHONE_BLOCK_END_MARKER = '</div>\n          </div>\n        </div>\n      </div>'; // end of phone-screen + hero-phone + hero-phone-wrap + hero-inner column

// Simple approach: find the next hero-phone-wrap closing
const idx1 = c.indexOf('<div class="hero-phone-screen">');
// Find closing by counting divs
let depth = 0;
let i = idx1;
while (i < c.length) {
  if (c.slice(i, i + 4) === '<div') depth++;
  else if (c.slice(i, i + 6) === '</div>') {
    depth--;
    if (depth === 0) { i += 6; break; }
  }
  i++;
}
const oldBlock = c.slice(idx1, i);
console.log('Old phone-screen block length:', oldBlock.length);
console.log('Block ends with:', oldBlock.slice(-60));

c = c.replace(oldBlock, newPhoneScreen);
console.log('Phone screen replaced:', c.includes('Membership &amp; Rewards'));

// ── 2. Fix hero stat — earn rate ──────────────────────────────────────────────
// Page says "100pts" per $1, app says "10 pts" per $1
c = c.replace(
  '<div class="hero-stat-val">100pts</div>\n            <div class="hero-stat-label">per $1 spent · 10¢ value</div>',
  '<div class="hero-stat-val">10pts</div>\n            <div class="hero-stat-label">per $1 spent · rewards on every job</div>'
);
console.log('Earn rate fixed:', c.includes('<div class="hero-stat-val">10pts</div>'));

// ── 3. Fix points expiry throughout page ─────────────────────────────────────
// The page body describes tiered expiry (3/6/9 months) but app says 6 months
// Update the hero sub to be consistent
c = c.replace(
  'Every booking earns 100 CrewPoints per $1 spent.',
  'Every booking earns 10 CrewPoints per $1 spent.'
);
console.log('Hero sub earn rate fixed');

fs.writeFileSync('rewards.html', c, 'utf8');
console.log('\nDone. File length:', fs.readFileSync('rewards.html','utf8').length);
