/**
 * fix-chat.js — Rebuild all chat/messaging screens across the Crew platform
 * Implements WhatsApp/Messenger-style: chat list → individual thread in every app.
 * Usage: node fix-chat.js
 */

const fs   = require('fs');
const path = require('path');
const ROOT = __dirname;

// ── Helper: find a screen <div> by id and replace its entire content ──────────
function replaceScreen(html, screenId, newHtml) {
  const marker = `id="${screenId}"`;
  const idx = html.indexOf(marker);
  if (idx === -1) return null; // not found

  let tagOpen = idx;
  while (tagOpen > 0 && html[tagOpen] !== '<') tagOpen--;

  let depth = 0, pos = tagOpen;
  while (pos < html.length) {
    if (html.startsWith('<div', pos))  { depth++; pos += 4; }
    else if (html.startsWith('</div>', pos)) { depth--; pos += 6; if (depth === 0) break; }
    else pos++;
  }
  return html.slice(0, tagOpen) + newHtml + html.slice(pos);
}

// ── Helper: insert HTML just before </body> ───────────────────────────────────
function insertBeforeBody(html, newHtml) {
  const idx = html.lastIndexOf('</body>');
  if (idx === -1) return html + newHtml;
  return html.slice(0, idx) + newHtml + '\n' + html.slice(idx);
}

// ── Helper: apply edit with logging ──────────────────────────────────────────
function applyEdit(html, screenId, newHtml, filePath) {
  const result = replaceScreen(html, screenId, newHtml);
  if (!result) {
    console.log(`  SKIP  ${screenId} — not found in ${path.basename(filePath)}`);
    return html;
  }
  console.log(`  ✓  replaced  ${screenId}`);
  return result;
}

// ════════════════════════════════════════════════════════════════════════════
// SHARED HTML FRAGMENTS
// ════════════════════════════════════════════════════════════════════════════

// ── WhatsApp-style chat list row (inline style, no external CSS) ─────────────
function chatRow({ initials, bg, online, name, badge, preview, time, unread, tag }) {
  const unreadBadge = unread
    ? `<div style="background:var(--green);color:white;font-size:10px;font-weight:700;min-width:19px;height:19px;border-radius:10px;display:flex;align-items:center;justify-content:center;padding:0 5px;flex-shrink:0;">${unread}</div>`
    : '';
  const onlineDot = online
    ? `<div style="position:absolute;bottom:1px;right:1px;width:13px;height:13px;background:#25d366;border-radius:50%;border:2.5px solid var(--bg);"></div>`
    : '';
  const tagHtml = tag
    ? ` <span style="background:${tag.bg};color:${tag.color};font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;">${tag.label}</span>`
    : '';
  const timeColor = unread ? 'color:var(--green);font-weight:600;' : 'color:var(--text-3);';
  const nameWeight = unread ? 'font-weight:700;' : 'font-weight:600;';
  const previewWeight = unread ? 'font-weight:600;color:var(--text-2);' : 'color:var(--text-3);';
  return `<div style="position:relative;flex-shrink:0;">
        <div style="width:50px;height:50px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-size:${initials.length > 2 ? '20px' : '17px'};font-weight:700;color:white;">${initials}</div>
        ${onlineDot}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px;">
          <div style="font-size:15px;${nameWeight}color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}${tagHtml}</div>
          <div style="font-size:11px;${timeColor}flex-shrink:0;margin-left:6px;">${time}</div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
          <div style="font-size:13px;${previewWeight}white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${preview}</div>
          ${unreadBadge}
        </div>
      </div>`;
}

// ── Generic nav bar ───────────────────────────────────────────────────────────
const NAV_CUSTOMER = `
  <div class="nav">
    <button class="nav-i" onclick="goTo('s-home')"><div class="nav-ico">🏠</div><div>Home</div></button>
    <button class="nav-i" onclick="goTo('s-browse')"><div class="nav-ico">🔍</div><div>Browse</div></button>
    <button class="nav-i" onclick="goTo('s-rewards')"><div class="nav-ico">⭐</div><div>Rewards</div></button>
    <button class="nav-i on"><div class="nav-ico">💬</div><div>Messages</div></button>
  </div>`;

const NAV_CONTRACTOR = `
  <div class="nav">
    <button class="nav-i" onclick="goTo('s-cdash')"><div class="nav-ico">📋</div><div>Jobs</div></button>
    <button class="nav-i" onclick="goTo('s-cactivejob')"><div class="nav-ico">📍</div><div>Active</div></button>
    <button class="nav-i" onclick="goTo('s-cearnings')"><div class="nav-ico">💰</div><div>Earnings</div></button>
    <button class="nav-i on"><div class="nav-ico">💬</div><div>Messages</div></button>
  </div>`;

const NAV_SUPERVISOR = `
  <nav class="nav" style="display:flex;">
    <button class="nav-item" onclick="goTo('s-home')" style="flex:1;"><span class="nav-ico">🏛️</span><span style="font-size:9px;display:block;margin-top:2px;">Command</span></button>
    <button class="nav-item" onclick="goTo('s-work-orders')" style="flex:1;"><span class="nav-ico">📋</span><span style="font-size:9px;display:block;margin-top:2px;">Work Orders</span></button>
    <button class="nav-item" onclick="goTo('s-team')" style="flex:1;"><span class="nav-ico">👥</span><span style="font-size:9px;display:block;margin-top:2px;">Team</span></button>
    <button class="nav-item" onclick="goTo('s-safety')" style="flex:1;"><span class="nav-ico">🦺</span><span style="font-size:9px;display:block;margin-top:2px;">Safety</span></button>
    <button class="nav-item active" onclick="goTo('s-messages')" style="flex:1;"><span class="nav-ico">💬</span><span style="font-size:9px;display:block;margin-top:2px;">Messages</span></button>
  </nav>`;

// ── Thread input bar ──────────────────────────────────────────────────────────
const THREAD_INPUT = `
  <div style="position:absolute;bottom:0;left:0;right:0;background:var(--surface);border-top:1px solid var(--border);padding:8px 12px;display:flex;align-items:center;gap:8px;">
    <button onclick="showToast('📎','Attach photo, file or location')" style="width:36px;height:36px;background:var(--elevated);border:none;border-radius:50%;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--text-3);line-height:1;">+</button>
    <button onclick="showToast('📷','Camera opened')" style="width:36px;height:36px;background:var(--elevated);border:none;border-radius:50%;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;">📷</button>
    <input type="text" placeholder="Message…" style="flex:1;background:var(--elevated);border:none;border-radius:22px;padding:10px 16px;font-family:var(--ff);font-size:14px;color:var(--text);outline:none;" onkeydown="if(event.key==='Enter'){showToast('✉️','Message sent!')}">
    <button onclick="showToast('✉️','Message sent!')" style="width:38px;height:38px;background:var(--green);border:none;border-radius:50%;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:white;flex-shrink:0;">➤</button>
  </div>`;

const THREAD_INPUT_NAVY = `
  <div style="position:absolute;bottom:0;left:0;right:0;background:var(--surface);border-top:1px solid var(--border);padding:8px 12px;display:flex;align-items:center;gap:8px;">
    <button onclick="showToast('📎','Attach photo, file or location')" style="width:36px;height:36px;background:var(--elevated);border:none;border-radius:50%;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--text-3);line-height:1;">+</button>
    <button onclick="showToast('📷','Camera opened')" style="width:36px;height:36px;background:var(--elevated);border:none;border-radius:50%;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;">📷</button>
    <input type="text" placeholder="Message…" style="flex:1;background:var(--elevated);border:none;border-radius:22px;padding:10px 16px;font-family:var(--ff);font-size:14px;color:var(--text);outline:none;" onkeydown="if(event.key==='Enter'){showToast('✉️','Message sent!')}">
    <button onclick="showToast('✉️','Message sent!')" style="width:38px;height:38px;background:#162878;border:none;border-radius:50%;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:white;flex-shrink:0;">➤</button>
  </div>`;

// ════════════════════════════════════════════════════════════════════════════
// SCREEN DEFINITIONS
// ════════════════════════════════════════════════════════════════════════════

// ── s-team-chat: Customer chat list ──────────────────────────────────────────
const S_TEAM_CHAT_CUSTOMER = `<div class="screen hidden" id="s-team-chat">
  <div class="sb lt"><div class="sb-time">9:41</div><div class="sb-icons">📶 📡 🔋</div></div>
  <div style="background:var(--surface);border-bottom:1px solid var(--border);padding:50px 16px 12px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <div style="font-size:26px;font-weight:800;color:var(--text);">Messages</div>
      <button onclick="showToast('✏️','Start a new conversation')" style="width:34px;height:34px;background:var(--green-pale);border:none;border-radius:50%;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--green);flex-shrink:0;">✏️</button>
    </div>
    <div style="position:relative;">
      <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:14px;color:var(--text-3);pointer-events:none;">🔍</span>
      <input type="search" placeholder="Search messages…" style="width:100%;background:var(--elevated);border:none;border-radius:12px;padding:9px 14px 9px 36px;font-family:var(--ff);font-size:13px;color:var(--text);outline:none;box-sizing:border-box;">
    </div>
  </div>
  <div style="overflow-y:auto;flex:1;padding-bottom:72px;">
    <div style="font-size:11px;font-weight:700;color:var(--text-3);letter-spacing:.07em;text-transform:uppercase;padding:10px 16px 3px;">📌 Pinned</div>
    <div onclick="goTo('s-chat-room')" style="display:flex;align-items:center;gap:12px;padding:11px 16px;cursor:pointer;">
      ${chatRow({initials:'GT',bg:'var(--green)',online:true,name:'[DEMO] Green Thumb Co.',tag:{bg:'#d1fae5',color:'#059669',label:'Active job'},preview:'Mike: Running 10 min late — on my way now',time:'2m',unread:'3'})}
    </div>
    <div style="height:1px;background:var(--border);margin:0 16px;"></div>
    <div style="font-size:11px;font-weight:700;color:var(--text-3);letter-spacing:.07em;text-transform:uppercase;padding:10px 16px 3px;">Unread</div>
    <div onclick="goTo('s-chat-room')" style="display:flex;align-items:center;gap:12px;padding:11px 16px;cursor:pointer;">
      ${chatRow({initials:'SM',bg:'#2748cc',online:true,name:'[DEMO] Sarah Mitchell',preview:'Can you send me the before photos?',time:'15m',unread:'2'})}
    </div>
    <div style="height:1px;background:var(--border);margin:0 16px;"></div>
    <div style="font-size:11px;font-weight:700;color:var(--text-3);letter-spacing:.07em;text-transform:uppercase;padding:10px 16px 3px;">Recent</div>
    <div onclick="goTo('s-chat-room')" style="display:flex;align-items:center;gap:12px;padding:11px 16px;cursor:pointer;">
      ${chatRow({initials:'JC',bg:'#e67e22',online:false,name:'[DEMO] James Cooper',preview:'✓✓ Perfect! See you Thursday at 9 AM',time:'1h'})}
    </div>
    <div style="height:1px;background:var(--border);margin:0 16px;"></div>
    <div onclick="goTo('s-chat-room')" style="display:flex;align-items:center;gap:12px;padding:11px 16px;cursor:pointer;">
      ${chatRow({initials:'🏢',bg:'var(--amber)',online:false,name:'Oak St. Project',tag:{bg:'#fef3c7',color:'#d97706',label:'Job'},preview:'✓✓ Equipment all ready for tomorrow',time:'3h'})}
    </div>
    <div style="height:1px;background:var(--border);margin:0 16px;"></div>
    <div onclick="goTo('s-chat-room')" style="display:flex;align-items:center;gap:12px;padding:11px 16px;cursor:pointer;">
      ${chatRow({initials:'GS',bg:'#16a085',online:false,name:'[DEMO] Green Spaces Co.',preview:'✓✓ Thanks for the quick turnaround!',time:'Yesterday'})}
    </div>
    <div style="height:1px;background:var(--border);margin:0 16px;"></div>
    <div onclick="goTo('s-chat-room')" style="display:flex;align-items:center;gap:12px;padding:11px 16px;cursor:pointer;">
      ${chatRow({initials:'PC',bg:'#8e44ad',online:false,name:'[DEMO] PawPatrol Pet Care',preview:'🔇 You: Sounds great, see you next week!',time:'Mon'})}
    </div>
    <div style="text-align:center;padding:20px 16px;"><div style="font-size:11px;color:var(--text-3);">🔒 End-to-end encrypted</div></div>
  </div>
  ${NAV_CUSTOMER}
</div>`;

// ── s-chat-room: WhatsApp-style thread (green theme) ─────────────────────────
const S_CHAT_ROOM = `<div class="screen hidden" id="s-chat-room">
  <div class="sb lt"><div class="sb-time">9:41</div><div class="sb-icons">📶 📡 🔋</div></div>
  <div style="background:var(--surface);border-bottom:1px solid var(--border);padding:50px 12px 10px;display:flex;align-items:center;gap:10px;">
    <button onclick="goTo('s-team-chat')" style="background:none;border:none;font-size:26px;cursor:pointer;color:var(--green);padding:0 4px;line-height:1;flex-shrink:0;">‹</button>
    <div style="position:relative;flex-shrink:0;">
      <div style="width:40px;height:40px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:white;">GT</div>
      <div style="position:absolute;bottom:0;right:0;width:12px;height:12px;background:#25d366;border-radius:50%;border:2px solid var(--bg);"></div>
    </div>
    <div style="flex:1;min-width:0;">
      <div style="font-size:16px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">[DEMO] Green Thumb Co.</div>
      <div style="font-size:12px;color:#25d366;font-weight:500;">● Active now</div>
    </div>
    <div style="display:flex;gap:6px;flex-shrink:0;">
      <button onclick="showToast('📞','Calling [DEMO] Green Thumb Co.…')" style="width:34px;height:34px;background:var(--elevated);border:none;border-radius:50%;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;">📞</button>
      <button onclick="showToast('🎥','Video call started')" style="width:34px;height:34px;background:var(--elevated);border:none;border-radius:50%;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;">🎥</button>
    </div>
  </div>
  <div style="flex:1;overflow-y:auto;padding:12px 14px 80px;display:flex;flex-direction:column;gap:6px;background:var(--bg);">
    <div style="text-align:center;font-size:11px;color:var(--text-3);font-weight:600;padding:4px 10px;background:var(--elevated);border-radius:20px;align-self:center;">Today</div>
    <div style="display:flex;gap:8px;align-items:flex-end;max-width:82%;">
      <div style="width:28px;height:28px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:white;flex-shrink:0;">GT</div>
      <div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:18px 18px 18px 4px;padding:10px 14px;">
          <div style="font-size:14px;color:var(--text);line-height:1.45;">Hi Sarah! I'll be there Monday at 10am. Is the side gate unlocked?</div>
        </div>
        <div style="font-size:10px;color:var(--text-3);margin-top:3px;margin-left:4px;">9:32 AM</div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;max-width:82%;align-self:flex-end;">
      <div style="background:var(--green);border-radius:18px 18px 4px 18px;padding:10px 14px;">
        <div style="font-size:14px;color:white;line-height:1.45;">Yes! Code is 1234. Dog will be inside 🐕</div>
      </div>
      <div style="font-size:10px;color:var(--text-3);margin-top:3px;display:flex;align-items:center;gap:3px;">9:35 AM <span style="color:#25d366;font-size:12px;">✓✓</span></div>
    </div>
    <div style="display:flex;gap:8px;align-items:flex-end;max-width:82%;">
      <div style="width:28px;height:28px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:white;flex-shrink:0;">GT</div>
      <div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:18px 18px 18px 4px;padding:10px 14px;">
          <div style="font-size:14px;color:var(--text);line-height:1.45;">Perfect. Here's the area I'll focus on:</div>
        </div>
        <div style="font-size:10px;color:var(--text-3);margin-top:3px;margin-left:4px;">9:36 AM</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;align-items:flex-end;max-width:82%;">
      <div style="width:28px;height:28px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:white;flex-shrink:0;">GT</div>
      <div>
        <div onclick="showToast('📸','Photo expanded')" style="background:#c8e6c9;border-radius:14px;height:140px;width:180px;display:flex;align-items:center;justify-content:center;font-size:42px;cursor:pointer;">🌿</div>
        <div style="font-size:10px;color:var(--text-3);margin-top:3px;margin-left:4px;">9:37 AM</div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;max-width:82%;align-self:flex-end;">
      <div style="background:var(--green);border-radius:18px 18px 4px 18px;padding:10px 14px;">
        <div style="font-size:14px;color:white;line-height:1.45;">Looks perfect! See you Monday 👍</div>
      </div>
      <div style="font-size:10px;color:var(--text-3);margin-top:3px;display:flex;align-items:center;gap:3px;">9:38 AM <span style="color:#25d366;font-size:12px;">✓✓</span></div>
    </div>
    <div style="display:flex;gap:8px;align-items:flex-end;max-width:82%;">
      <div style="width:28px;height:28px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:white;flex-shrink:0;">GT</div>
      <div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:18px 18px 18px 4px;padding:10px 14px;">
          <div style="font-size:14px;color:var(--text);line-height:1.45;">Running about 10 minutes late — traffic on Punt Rd. On my way now!</div>
        </div>
        <div style="font-size:10px;color:var(--text-3);margin-top:3px;margin-left:4px;">9:48 AM</div>
      </div>
    </div>
    <div style="text-align:center;font-size:10px;color:var(--text-3);padding:6px 0;">🔒 Messages are end-to-end encrypted</div>
  </div>
  ${THREAD_INPUT}
</div>`;

// ── s-messages: customer direct thread (improved with back-to-list link) ──────
const S_MESSAGES_CUSTOMER = `<div class="screen hidden" id="s-messages">
  <div style="background:var(--surface);border-bottom:1px solid var(--border);">
    <div class="sb lt"><span class="sb-time">9:41</span><div class="sb-icons">📶 📡 🔋</div></div>
    <div style="display:flex;align-items:center;gap:10px;padding:0 12px 12px;">
      <button onclick="goTo('s-team-chat')" style="background:none;border:none;font-size:26px;cursor:pointer;color:var(--green);padding:0 4px;line-height:1;flex-shrink:0;">‹</button>
      <div style="position:relative;flex-shrink:0;">
        <div style="width:40px;height:40px;background:var(--green-light);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;">🌿</div>
        <div style="position:absolute;bottom:0;right:0;width:12px;height:12px;background:#25d366;border-radius:50%;border:2px solid var(--bg);"></div>
      </div>
      <div style="flex:1;">
        <div style="font-size:16px;font-weight:700;color:var(--text);">Green Thumb Co.</div>
        <div style="font-size:12px;color:#25d366;">● Online</div>
      </div>
      <div style="display:flex;gap:6px;">
        <button onclick="showToast('📞','Calling…')" style="width:34px;height:34px;background:var(--elevated);border:none;border-radius:50%;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;">📞</button>
      </div>
    </div>
  </div>
  <div style="flex:1;overflow-y:auto;padding:14px 14px 90px;display:flex;flex-direction:column;gap:6px;background:var(--bg);">
    <div style="text-align:center;font-size:11px;color:var(--text-3);font-weight:600;padding:4px 12px;background:var(--elevated);border-radius:20px;align-self:center;">Today</div>
    <div style="display:flex;gap:8px;align-items:flex-end;max-width:82%;">
      <div style="width:28px;height:28px;background:var(--green-light);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">🌿</div>
      <div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:18px 18px 18px 4px;padding:10px 14px;">
          <div style="font-size:14px;color:var(--text);line-height:1.45;">Hi Sarah! Confirming I'll be there Monday 10am. Just a heads up — your back gate was a little stiff last time, I'll bring some WD-40.</div>
        </div>
        <div style="font-size:10px;color:var(--text-3);margin-top:3px;margin-left:4px;">9:12 AM</div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;max-width:82%;align-self:flex-end;">
      <div style="background:var(--green);border-radius:18px 18px 4px 18px;padding:10px 14px;">
        <div style="font-size:14px;color:white;line-height:1.45;">Thanks! The dog will be inside. Side gate is unlocked from 9:30am.</div>
      </div>
      <div style="font-size:10px;color:var(--text-3);margin-top:3px;display:flex;align-items:center;gap:3px;">9:34 AM <span style="color:#25d366;font-size:12px;">✓✓</span></div>
    </div>
    <div style="display:flex;gap:8px;align-items:flex-end;max-width:82%;">
      <div style="width:28px;height:28px;background:var(--green-light);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">🌿</div>
      <div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:18px 18px 18px 4px;padding:10px 14px;">
          <div style="font-size:14px;color:var(--text);line-height:1.45;">Perfect, see you then! 👍</div>
        </div>
        <div style="font-size:10px;color:var(--text-3);margin-top:3px;margin-left:4px;">9:35 AM</div>
      </div>
    </div>
    <div style="text-align:center;font-size:10px;color:var(--text-3);padding:6px 0;">🔒 Visible to Crew admin only if a dispute is raised</div>
  </div>
  ${THREAD_INPUT}
</div>`;

// ── s-chat: customer direct thread (improved) ────────────────────────────────
const S_CHAT_CUSTOMER = `<div class="screen hidden" id="s-chat">
  <div style="background:var(--surface);border-bottom:1px solid var(--border);">
    <div class="sb lt"><span class="sb-time">9:41</span><div class="sb-icons">📶 📡 🔋</div></div>
    <div style="display:flex;align-items:center;gap:10px;padding:0 12px 12px;">
      <button onclick="goTo('s-team-chat')" style="background:none;border:none;font-size:26px;cursor:pointer;color:var(--green);padding:0 4px;line-height:1;flex-shrink:0;">‹</button>
      <div style="position:relative;flex-shrink:0;">
        <div style="width:40px;height:40px;background:var(--green);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:white;">GT</div>
        <div style="position:absolute;bottom:0;right:0;width:12px;height:12px;background:#25d366;border-radius:50%;border:2px solid var(--bg);"></div>
      </div>
      <div style="flex:1;">
        <div style="font-size:16px;font-weight:700;color:var(--text);">[DEMO] Green Thumb Co.</div>
        <div style="font-size:12px;color:#25d366;">● Online · Crew Yard Specialist</div>
      </div>
      <button onclick="showToast('📞','Calling…')" style="width:34px;height:34px;background:var(--elevated);border:none;border-radius:50%;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;">📞</button>
    </div>
  </div>
  <div style="flex:1;overflow-y:auto;padding:14px 14px 90px;display:flex;flex-direction:column;gap:6px;background:var(--bg);">
    <div style="text-align:center;font-size:11px;color:var(--text-3);font-weight:600;padding:4px 12px;background:var(--elevated);border-radius:20px;align-self:center;">Today</div>
    <div style="display:flex;gap:8px;align-items:flex-end;max-width:82%;">
      <div style="width:28px;height:28px;background:var(--green);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:white;flex-shrink:0;">GT</div>
      <div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:18px 18px 18px 4px;padding:10px 14px;">
          <div style="font-size:14px;color:var(--text);line-height:1.45;">Hi Sarah! I'll be there Monday at 10am. Just confirming — is the side gate unlocked?</div>
        </div>
        <div style="font-size:10px;color:var(--text-3);margin-top:3px;margin-left:4px;">9:32 AM</div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;max-width:82%;align-self:flex-end;">
      <div style="background:var(--green);border-radius:18px 18px 4px 18px;padding:10px 14px;">
        <div style="font-size:14px;color:white;line-height:1.45;">Yes! Code is 1234. Dog will be inside 🐕</div>
      </div>
      <div style="font-size:10px;color:var(--text-3);margin-top:3px;display:flex;align-items:center;gap:3px;">9:35 AM <span style="color:#25d366;font-size:12px;">✓✓</span></div>
    </div>
    <div style="display:flex;gap:8px;align-items:flex-end;max-width:82%;">
      <div style="width:28px;height:28px;background:var(--green);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:white;flex-shrink:0;">GT</div>
      <div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:18px 18px 18px 4px;padding:10px 14px;">
          <div style="font-size:14px;color:var(--text);line-height:1.45;">Perfect. Here's the area I'll focus on today:</div>
        </div>
        <div style="font-size:10px;color:var(--text-3);margin-top:3px;margin-left:4px;">9:36 AM</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;align-items:flex-end;max-width:82%;">
      <div style="width:28px;height:28px;background:var(--green);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:white;flex-shrink:0;">GT</div>
      <div>
        <div onclick="showToast('📸','Photo expanded')" style="background:#c8e6c9;border-radius:14px;height:120px;width:160px;display:flex;align-items:center;justify-content:center;font-size:36px;cursor:pointer;">🌿</div>
        <div style="font-size:10px;color:var(--text-3);margin-top:3px;margin-left:4px;">📸 Photo shared · 9:37 AM</div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;max-width:82%;align-self:flex-end;">
      <div style="background:var(--green);border-radius:18px 18px 4px 18px;padding:10px 14px;">
        <div style="font-size:14px;color:white;line-height:1.45;">Looks great! See you Monday 👍</div>
      </div>
      <div style="font-size:10px;color:var(--text-3);margin-top:3px;display:flex;align-items:center;gap:3px;">9:38 AM <span style="color:#25d366;font-size:12px;">✓✓</span></div>
    </div>
    <div style="text-align:center;font-size:10px;color:var(--text-3);padding:6px 0;">🔒 Visible to Crew admin only if a dispute is raised</div>
  </div>
  ${THREAD_INPUT}
</div>`;

// ── s-cmessages: Contractor chat list (contractor mode) ───────────────────────
const S_CMESSAGES_CONTRACTOR = `<div class="screen hidden" id="s-cmessages">
  <div class="sb lt"><div class="sb-time">9:41</div><div class="sb-icons">📶 📡 🔋</div></div>
  <div style="background:var(--surface);border-bottom:1px solid var(--border);padding:50px 16px 12px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <div style="font-size:26px;font-weight:800;color:var(--text);">Messages</div>
      <button onclick="showToast('✏️','New conversation')" style="width:34px;height:34px;background:var(--green-pale);border:none;border-radius:50%;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--green);flex-shrink:0;">✏️</button>
    </div>
    <div style="position:relative;">
      <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:14px;color:var(--text-3);pointer-events:none;">🔍</span>
      <input type="search" placeholder="Search messages…" style="width:100%;background:var(--elevated);border:none;border-radius:12px;padding:9px 14px 9px 36px;font-family:var(--ff);font-size:13px;color:var(--text);outline:none;box-sizing:border-box;">
    </div>
  </div>
  <div style="overflow-y:auto;flex:1;padding-bottom:72px;">
    <div style="font-size:11px;font-weight:700;color:var(--text-3);letter-spacing:.07em;text-transform:uppercase;padding:10px 16px 3px;">📌 Active Jobs</div>
    <div onclick="goTo('s-cmessages-room')" style="display:flex;align-items:center;gap:12px;padding:11px 16px;cursor:pointer;">
      ${chatRow({initials:'SM',bg:'#2748cc',online:true,name:'[DEMO] Sarah M. — Oak St.',tag:{bg:'#d1fae5',color:'#059669',label:'Today 10am'},preview:'Sarah: Side gate code is 1234, dog inside',time:'8m',unread:'2'})}
    </div>
    <div style="height:1px;background:var(--border);margin:0 16px;"></div>
    <div onclick="goTo('s-cmessages-room')" style="display:flex;align-items:center;gap:12px;padding:11px 16px;cursor:pointer;">
      ${chatRow({initials:'TR',bg:'#e67e22',online:true,name:'[DEMO] Tom R. — Fitzroy',tag:{bg:'#fef3c7',color:'#d97706',label:'Thu 2pm'},preview:'Tom: Just confirming I can park out front?',time:'1h',unread:'1'})}
    </div>
    <div style="height:1px;background:var(--border);margin:0 16px;"></div>
    <div style="font-size:11px;font-weight:700;color:var(--text-3);letter-spacing:.07em;text-transform:uppercase;padding:10px 16px 3px;">Team</div>
    <div onclick="goTo('s-cmessages-room')" style="display:flex;align-items:center;gap:12px;padding:11px 16px;cursor:pointer;">
      ${chatRow({initials:'JM',bg:'var(--green)',online:true,name:'[DEMO] James (Owner)',preview:"Don't forget to upload the before photos",time:'30m'})}
    </div>
    <div style="height:1px;background:var(--border);margin:0 16px;"></div>
    <div onclick="goTo('s-cmessages-room')" style="display:flex;align-items:center;gap:12px;padding:11px 16px;cursor:pointer;">
      ${chatRow({initials:'🏢',bg:'#475569',online:false,name:'Crew Support',preview:'✓✓ Your payout of $247 has been processed',time:'Yesterday'})}
    </div>
    <div style="height:1px;background:var(--border);margin:0 16px;"></div>
    <div style="font-size:11px;font-weight:700;color:var(--text-3);letter-spacing:.07em;text-transform:uppercase;padding:10px 16px 3px;">Recent</div>
    <div onclick="goTo('s-cmessages-room')" style="display:flex;align-items:center;gap:12px;padding:11px 16px;cursor:pointer;">
      ${chatRow({initials:'LB',bg:'#be185d',online:false,name:'[DEMO] Lisa B.',preview:'✓✓ 5 stars — amazing job as always!',time:'Mon'})}
    </div>
    <div style="height:1px;background:var(--border);margin:0 16px;"></div>
    <div onclick="goTo('s-cmessages-room')" style="display:flex;align-items:center;gap:12px;padding:11px 16px;cursor:pointer;">
      ${chatRow({initials:'DC',bg:'#0891b2',online:false,name:'[DEMO] David C.',preview:'✓✓ Great, see you next fortnight',time:'Last week'})}
    </div>
    <div style="text-align:center;padding:20px 16px;"><div style="font-size:11px;color:var(--text-3);">🔒 End-to-end encrypted</div></div>
  </div>
  ${NAV_CONTRACTOR}
</div>`;

// ── s-cmessages-room: Contractor thread ───────────────────────────────────────
const S_CMESSAGES_ROOM = `<div class="screen hidden" id="s-cmessages-room">
  <div class="sb lt"><div class="sb-time">9:41</div><div class="sb-icons">📶 📡 🔋</div></div>
  <div style="background:var(--surface);border-bottom:1px solid var(--border);padding:50px 12px 10px;display:flex;align-items:center;gap:10px;">
    <button onclick="goTo('s-cmessages')" style="background:none;border:none;font-size:26px;cursor:pointer;color:var(--green);padding:0 4px;line-height:1;flex-shrink:0;">‹</button>
    <div style="position:relative;flex-shrink:0;">
      <div style="width:40px;height:40px;border-radius:50%;background:#2748cc;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:white;">SM</div>
      <div style="position:absolute;bottom:0;right:0;width:12px;height:12px;background:#25d366;border-radius:50%;border:2px solid var(--bg);"></div>
    </div>
    <div style="flex:1;min-width:0;">
      <div style="font-size:16px;font-weight:700;color:var(--text);">[DEMO] Sarah M.</div>
      <div style="font-size:12px;color:#25d366;">● Active now · Standard Mow · Mon 10am</div>
    </div>
    <div style="display:flex;gap:6px;flex-shrink:0;">
      <button onclick="showToast('📞','Calling Sarah…')" style="width:34px;height:34px;background:var(--elevated);border:none;border-radius:50%;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;">📞</button>
    </div>
  </div>
  <div style="flex:1;overflow-y:auto;padding:12px 14px 80px;display:flex;flex-direction:column;gap:6px;background:var(--bg);">
    <div style="text-align:center;font-size:11px;color:var(--text-3);font-weight:600;padding:4px 12px;background:var(--elevated);border-radius:20px;align-self:center;">Today</div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;max-width:82%;align-self:flex-end;">
      <div style="background:var(--green);border-radius:18px 18px 4px 18px;padding:10px 14px;">
        <div style="font-size:14px;color:white;line-height:1.45;">Hi Sarah! Confirming I'll be there Monday 10am. Just a heads up — your back gate was a little stiff last time, I'll bring some WD-40.</div>
      </div>
      <div style="font-size:10px;color:var(--text-3);margin-top:3px;display:flex;align-items:center;gap:3px;">9:12 AM <span style="color:#aaa;font-size:12px;">✓✓</span></div>
    </div>
    <div style="display:flex;gap:8px;align-items:flex-end;max-width:82%;">
      <div style="width:28px;height:28px;border-radius:50%;background:#2748cc;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:white;flex-shrink:0;">SM</div>
      <div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:18px 18px 18px 4px;padding:10px 14px;">
          <div style="font-size:14px;color:var(--text);line-height:1.45;">Thanks! The dog will be inside. Side gate is unlocked from 9:30am. Code is 1234.</div>
        </div>
        <div style="font-size:10px;color:var(--text-3);margin-top:3px;margin-left:4px;">9:34 AM</div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;max-width:82%;align-self:flex-end;">
      <div style="background:var(--green);border-radius:18px 18px 4px 18px;padding:10px 14px;">
        <div style="font-size:14px;color:white;line-height:1.45;">Perfect, see you then! 👍</div>
      </div>
      <div style="font-size:10px;color:var(--text-3);margin-top:3px;display:flex;align-items:center;gap:3px;">9:35 AM <span style="color:#25d366;font-size:12px;">✓✓</span></div>
    </div>
    <div style="text-align:center;font-size:10px;color:var(--text-3);padding:6px 0;">🔒 Visible to Crew admin only if a dispute is raised</div>
  </div>
  ${THREAD_INPUT}
</div>`;

// ── s-messages: Field Worker WhatsApp-style chat list (navy theme) ────────────
const S_MESSAGES_FIELD = `<div class="screen hidden" id="s-messages">
  <div style="background:linear-gradient(135deg,#1e3a5f,#162878);padding:50px 16px 12px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <div style="color:white;font-size:26px;font-weight:800;">Messages</div>
      <button onclick="showToast('✏️','New message')" style="width:34px;height:34px;background:rgba(255,255,255,.15);border:none;border-radius:50%;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:white;flex-shrink:0;">✏️</button>
    </div>
    <div style="position:relative;">
      <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:14px;color:rgba(255,255,255,.5);pointer-events:none;">🔍</span>
      <input type="search" placeholder="Search messages…" style="width:100%;background:rgba(255,255,255,.15);border:none;border-radius:12px;padding:9px 14px 9px 36px;font-family:inherit;font-size:13px;color:white;outline:none;box-sizing:border-box;" style="color:white">
    </div>
  </div>
  <div style="overflow-y:auto;flex:1;padding-bottom:72px;background:var(--bg);">
    <div style="font-size:11px;font-weight:700;color:var(--text-3);letter-spacing:.07em;text-transform:uppercase;padding:10px 16px 3px;">Supervisor</div>
    <div onclick="goTo('s-fw-thread')" style="display:flex;align-items:center;gap:12px;padding:11px 16px;cursor:pointer;background:var(--surface);">
      ${chatRow({initials:'JS',bg:'#162878',online:true,name:'[DEMO] Jennifer Shaw (Supervisor)',preview:'Make sure sector 3B is done before 2pm',time:'5m',unread:'2'})}
    </div>
    <div style="height:1px;background:var(--border);margin:0 16px;"></div>
    <div style="font-size:11px;font-weight:700;color:var(--text-3);letter-spacing:.07em;text-transform:uppercase;padding:10px 16px 3px;">Team Chat</div>
    <div onclick="goTo('s-fw-thread')" style="display:flex;align-items:center;gap:12px;padding:11px 16px;cursor:pointer;background:var(--surface);">
      ${chatRow({initials:'👥',bg:'#0891b2',online:true,name:'Parks Crew — Morning Shift',tag:{bg:'#dbeafe',color:'#1d4ed8',label:'8 members'},preview:'MR: Heading to sector 3A now',time:'2m',unread:'4'})}
    </div>
    <div style="height:1px;background:var(--border);margin:0 16px;"></div>
    <div onclick="goTo('s-fw-thread')" style="display:flex;align-items:center;gap:12px;padding:11px 16px;cursor:pointer;background:var(--surface);">
      ${chatRow({initials:'MR',bg:'#7c3aed',online:true,name:'[DEMO] Mike Rodriguez',preview:'Found a broken sprinkler — logging it',time:'12m'})}
    </div>
    <div style="height:1px;background:var(--border);margin:0 16px;"></div>
    <div onclick="goTo('s-fw-thread')" style="display:flex;align-items:center;gap:12px;padding:11px 16px;cursor:pointer;background:var(--surface);">
      ${chatRow({initials:'SC',bg:'#be185d',online:false,name:'[DEMO] Sarah Chen',preview:'✓✓ On my way to WO-0424 now',time:'1h'})}
    </div>
    <div style="height:1px;background:var(--border);margin:0 16px;"></div>
    <div style="font-size:11px;font-weight:700;color:var(--text-3);letter-spacing:.07em;text-transform:uppercase;padding:10px 16px 3px;">System</div>
    <div onclick="goTo('s-fw-thread')" style="display:flex;align-items:center;gap:12px;padding:11px 16px;cursor:pointer;background:var(--surface);">
      ${chatRow({initials:'🤖',bg:'#475569',online:false,name:'CrewBase System',preview:'Work order WO-0421 assigned to you',time:'8:00 AM'})}
    </div>
    <div style="text-align:center;padding:20px 16px;"><div style="font-size:11px;color:var(--text-3);">🔒 End-to-end encrypted</div></div>
  </div>
  <nav class="nav" style="display:flex;">
    <button class="nav-item" onclick="goTo('s-home')" style="flex:1;"><span class="nav-ico">🏠</span><span style="font-size:9px;display:block;margin-top:2px;">Home</span></button>
    <button class="nav-item" onclick="goTo('s-orders')" style="flex:1;"><span class="nav-ico">📋</span><span style="font-size:9px;display:block;margin-top:2px;">Orders</span></button>
    <button class="nav-item" onclick="goTo('s-clockin')" style="flex:1;"><span class="nav-ico">📍</span><span style="font-size:9px;display:block;margin-top:2px;">Clock In</span></button>
    <button class="nav-item active" onclick="goTo('s-messages')" style="flex:1;"><span class="nav-ico">💬</span><span style="font-size:9px;display:block;margin-top:2px;">Messages</span></button>
  </nav>
</div>`;

// ── s-fw-thread: Field Worker individual thread ───────────────────────────────
const S_FW_THREAD = `<div class="screen hidden" id="s-fw-thread">
  <div style="background:linear-gradient(135deg,#1e3a5f,#162878);padding:50px 12px 10px;display:flex;align-items:center;gap:10px;">
    <button onclick="goTo('s-messages')" style="background:none;border:none;font-size:26px;cursor:pointer;color:rgba(255,255,255,.85);padding:0 4px;line-height:1;flex-shrink:0;">‹</button>
    <div style="position:relative;flex-shrink:0;">
      <div style="width:40px;height:40px;border-radius:50%;background:#162878;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:white;border:2px solid rgba(255,255,255,.3);">JS</div>
      <div style="position:absolute;bottom:0;right:0;width:12px;height:12px;background:#25d366;border-radius:50%;border:2px solid #162878;"></div>
    </div>
    <div style="flex:1;min-width:0;">
      <div style="font-size:16px;font-weight:700;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">[DEMO] Jennifer Shaw</div>
      <div style="font-size:12px;color:#25d366;">● Active now · Supervisor</div>
    </div>
    <div style="display:flex;gap:6px;flex-shrink:0;">
      <button onclick="showToast('📞','Calling supervisor…')" style="width:34px;height:34px;background:rgba(255,255,255,.15);border:none;border-radius:50%;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;">📞</button>
    </div>
  </div>
  <div style="flex:1;overflow-y:auto;padding:12px 14px 80px;display:flex;flex-direction:column;gap:6px;background:var(--bg);">
    <div style="text-align:center;font-size:11px;color:var(--text-3);font-weight:600;padding:4px 12px;background:var(--elevated);border-radius:20px;align-self:center;">Today</div>
    <div style="display:flex;gap:8px;align-items:flex-end;max-width:82%;">
      <div style="width:28px;height:28px;border-radius:50%;background:#162878;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:white;flex-shrink:0;">JS</div>
      <div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:18px 18px 18px 4px;padding:10px 14px;">
          <div style="font-size:14px;color:var(--text);line-height:1.45;">Morning! Sector 3A needs to be done before 11am today. Weather looks clear.</div>
        </div>
        <div style="font-size:10px;color:var(--text-3);margin-top:3px;margin-left:4px;">7:45 AM</div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;max-width:82%;align-self:flex-end;">
      <div style="background:#162878;border-radius:18px 18px 4px 18px;padding:10px 14px;">
        <div style="font-size:14px;color:white;line-height:1.45;">Got it. On my way to 3A now. ETA 8:15am.</div>
      </div>
      <div style="font-size:10px;color:var(--text-3);margin-top:3px;display:flex;align-items:center;gap:3px;">8:02 AM <span style="color:#25d366;font-size:12px;">✓✓</span></div>
    </div>
    <div style="display:flex;gap:8px;align-items:flex-end;max-width:82%;">
      <div style="width:28px;height:28px;border-radius:50%;background:#162878;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:white;flex-shrink:0;">JS</div>
      <div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:18px 18px 18px 4px;padding:10px 14px;">
          <div style="font-size:14px;color:var(--text);line-height:1.45;">Good. Make sure sector 3B is done before 2pm too. Tom is off sick today.</div>
        </div>
        <div style="font-size:10px;color:var(--text-3);margin-top:3px;margin-left:4px;">9:22 AM</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;align-items:flex-end;max-width:82%;">
      <div style="width:28px;height:28px;border-radius:50%;background:#162878;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:white;flex-shrink:0;">JS</div>
      <div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:18px 18px 18px 4px;padding:10px 14px;">
          <div style="font-size:14px;color:var(--text);line-height:1.45;">Make sure sector 3B is done before 2pm</div>
        </div>
        <div style="font-size:10px;color:var(--text-3);margin-top:3px;margin-left:4px;">9:48 AM</div>
      </div>
    </div>
    <div style="text-align:center;font-size:10px;color:var(--text-3);padding:6px 0;">🔒 End-to-end encrypted</div>
  </div>
  ${THREAD_INPUT_NAVY}
</div>`;

// ── s-messages: Supervisor WhatsApp-style chat list ───────────────────────────
const S_MESSAGES_SUPERVISOR = `<div class="screen hidden" id="s-messages">
  <div style="background:linear-gradient(135deg,#0c2340,#162878);padding:50px 16px 12px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      <div style="color:white;font-size:26px;font-weight:800;">Messages</div>
      <button onclick="showToast('✏️','New message')" style="width:34px;height:34px;background:rgba(255,255,255,.15);border:none;border-radius:50%;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:white;flex-shrink:0;">✏️</button>
    </div>
    <div style="position:relative;margin-bottom:10px;">
      <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:14px;color:rgba(255,255,255,.5);pointer-events:none;">🔍</span>
      <input type="search" placeholder="Search messages…" style="width:100%;background:rgba(255,255,255,.15);border:none;border-radius:12px;padding:9px 14px 9px 36px;font-family:inherit;font-size:13px;color:white;outline:none;box-sizing:border-box;">
    </div>
    <div style="display:flex;gap:6px;">
      <button id="tab-chat" onclick="showMsgTab('chat')" style="flex:1;padding:7px;background:white;border:none;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;color:#0c2340;">💬 Chat</button>
      <button id="tab-alerts" onclick="showMsgTab('alerts')" style="flex:1;padding:7px;background:rgba(255,255,255,.15);border:none;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;color:rgba(255,255,255,.8);">🔔 Alerts <span style="background:#ef4444;color:white;font-size:9px;padding:1px 5px;border-radius:8px;margin-left:2px;">5</span></button>
    </div>
  </div>
  <div id="msg-tab-chat" style="overflow-y:auto;flex:1;padding-bottom:72px;background:var(--bg);">
    <div style="font-size:11px;font-weight:700;color:var(--text-3);letter-spacing:.07em;text-transform:uppercase;padding:10px 16px 3px;">Field Workers</div>
    <div onclick="goTo('s-sup-thread')" style="display:flex;align-items:center;gap:12px;padding:11px 16px;cursor:pointer;background:var(--surface);">
      ${chatRow({initials:'MR',bg:'#162878',online:true,name:'[DEMO] Mike Rodriguez',preview:'Sector 3A done. Moving to 3B now. Found broken sprinkler.',time:'9:48 AM',unread:'1'})}
    </div>
    <div style="height:1px;background:var(--border);margin:0 16px;"></div>
    <div onclick="goTo('s-sup-thread')" style="display:flex;align-items:center;gap:12px;padding:11px 16px;cursor:pointer;background:var(--surface);">
      ${chatRow({initials:'SC',bg:'#7c3aed',online:true,name:'[DEMO] Sarah Chen',preview:'En route ETA 9:55. Traffic on Church St.',time:'9:22 AM',unread:'1'})}
    </div>
    <div style="height:1px;background:var(--border);margin:0 16px;"></div>
    <div onclick="goTo('s-sup-thread')" style="display:flex;align-items:center;gap:12px;padding:11px 16px;cursor:pointer;background:var(--surface);">
      ${chatRow({initials:'TR',bg:'#6b7280',online:false,name:'[DEMO] Tom Riley',preview:'Leave request 21–28 Apr. Family commitment.',time:'8:45 AM'})}
    </div>
    <div style="height:1px;background:var(--border);margin:0 16px;"></div>
    <div onclick="goTo('s-sup-thread')" style="display:flex;align-items:center;gap:12px;padding:11px 16px;cursor:pointer;background:var(--surface);">
      ${chatRow({initials:'DC',bg:'#0891b2',online:false,name:'[DEMO] Dave Chen',preview:'✓✓ Graffiti removed. Photos uploaded to WO-0423.',time:'Yesterday'})}
    </div>
    <div style="height:1px;background:var(--border);margin:0 16px;"></div>
    <div onclick="goTo('s-sup-thread')" style="display:flex;align-items:center;gap:12px;padding:11px 16px;cursor:pointer;background:var(--surface);">
      ${chatRow({initials:'EW',bg:'#be185d',online:false,name:'[DEMO] Emma Wilson',preview:'✓✓ Playground inspection complete. All passed.',time:'Yesterday'})}
    </div>
    <div style="height:1px;background:var(--border);margin:0 16px;"></div>
    <div style="font-size:11px;font-weight:700;color:var(--text-3);letter-spacing:.07em;text-transform:uppercase;padding:10px 16px 3px;">Broadcast</div>
    <div style="margin:0 16px 10px;background:var(--surface);border-radius:14px;padding:14px;box-shadow:var(--sh-sm);">
      <div style="font-size:12px;font-weight:700;margin-bottom:8px;color:var(--text);">📢 Send to all workers on shift</div>
      <textarea id="broadcast-msg" placeholder="Type a broadcast message…" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-size:12px;font-family:inherit;outline:none;height:60px;resize:none;background:var(--bg);color:var(--text);box-sizing:border-box;"></textarea>
      <button onclick="broadcastMessage()" style="margin-top:8px;width:100%;padding:10px;background:#162878;color:white;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">Send to All (8 workers)</button>
    </div>
    <div style="text-align:center;padding:12px 16px;"><div style="font-size:11px;color:var(--text-3);">🔒 End-to-end encrypted</div></div>
  </div>
  <div id="msg-tab-alerts" style="display:none;overflow-y:auto;flex:1;padding-bottom:72px;background:var(--bg);">
    <div style="font-size:11px;font-weight:700;color:var(--text-3);letter-spacing:.07em;text-transform:uppercase;padding:10px 16px 3px;">Unread (5)</div>
    <div style="margin:0 16px 6px;background:var(--surface);border-radius:14px;overflow:hidden;box-shadow:var(--sh-sm);">
      <div onclick="showToast('📋','Opening work order WO-0421')" style="display:flex;gap:10px;padding:12px 14px;border-bottom:1px solid var(--border);cursor:pointer;background:#fafbff;">
        <div style="width:36px;height:36px;border-radius:50%;background:#162878;display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;color:white;font-weight:700;">MR</div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;justify-content:space-between;margin-bottom:2px;"><div style="font-size:13px;font-weight:700;">[DEMO] Mike Rodriguez</div><div style="font-size:10px;color:var(--text-3);">9:48am</div></div>
          <div style="font-size:12px;color:var(--text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Sector 3A done. Moving to 3B now. Found broken sprinkler head — should I log it?</div>
          <div style="font-size:10px;color:var(--text-3);margin-top:2px;">Field message · [DEMO] WO-0421</div>
        </div>
        <div style="width:8px;height:8px;border-radius:50%;background:#2748cc;flex-shrink:0;margin-top:4px;"></div>
      </div>
      <div onclick="showToast('📍','Opening community report CRM-2026-05012')" style="display:flex;gap:10px;padding:12px 14px;border-bottom:1px solid var(--border);cursor:pointer;background:#fafbff;">
        <div style="width:36px;height:36px;border-radius:50%;background:#f59e0b;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">📍</div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;justify-content:space-between;margin-bottom:2px;"><div style="font-size:13px;font-weight:700;">Community Report</div><div style="font-size:10px;color:var(--text-3);">9:31am</div></div>
          <div style="font-size:12px;color:var(--text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Pothole [DEMO] CRM-2026-05012 — 12 Grey St Fitzroy. Moderate severity.</div>
          <div style="font-size:10px;color:var(--text-3);margin-top:2px;">Auto-routed · needs WO</div>
        </div>
        <div style="width:8px;height:8px;border-radius:50%;background:#2748cc;flex-shrink:0;margin-top:4px;"></div>
      </div>
      <div onclick="showToast('⚠️','Opening compliance alert for Alex Lopez')" style="display:flex;gap:10px;padding:12px 14px;cursor:pointer;background:#fafbff;">
        <div style="width:36px;height:36px;border-radius:50%;background:#ef4444;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">⚠️</div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;justify-content:space-between;margin-bottom:2px;"><div style="font-size:13px;font-weight:700;">System Alert</div><div style="font-size:10px;color:var(--text-3);">8:30am</div></div>
          <div style="font-size:12px;color:var(--text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Cert expiry: [DEMO] Alex Lopez — White Card expires in 23 days.</div>
          <div style="font-size:10px;color:var(--text-3);margin-top:2px;">Compliance alert</div>
        </div>
        <div style="width:8px;height:8px;border-radius:50%;background:#2748cc;flex-shrink:0;margin-top:4px;"></div>
      </div>
    </div>
  </div>
  <script>
  function showMsgTab(t){
    document.getElementById('msg-tab-chat').style.display=t==='chat'?'block':'none';
    document.getElementById('msg-tab-alerts').style.display=t==='alerts'?'block':'none';
    document.getElementById('tab-chat').style.background=t==='chat'?'white':'rgba(255,255,255,.15)';
    document.getElementById('tab-chat').style.color=t==='chat'?'#0c2340':'rgba(255,255,255,.8)';
    document.getElementById('tab-alerts').style.background=t==='alerts'?'white':'rgba(255,255,255,.15)';
    document.getElementById('tab-alerts').style.color=t==='alerts'?'#0c2340':'rgba(255,255,255,.8)';
  }
  </script>
  ${NAV_SUPERVISOR}
</div>`;

// ── s-sup-thread: Supervisor individual thread ────────────────────────────────
const S_SUP_THREAD = `<div class="screen hidden" id="s-sup-thread">
  <div style="background:linear-gradient(135deg,#0c2340,#162878);padding:50px 12px 10px;display:flex;align-items:center;gap:10px;">
    <button onclick="goTo('s-messages')" style="background:none;border:none;font-size:26px;cursor:pointer;color:rgba(255,255,255,.85);padding:0 4px;line-height:1;flex-shrink:0;">‹</button>
    <div style="position:relative;flex-shrink:0;">
      <div style="width:40px;height:40px;border-radius:50%;background:#162878;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:white;border:2px solid rgba(255,255,255,.3);">MR</div>
      <div style="position:absolute;bottom:0;right:0;width:12px;height:12px;background:#25d366;border-radius:50%;border:2px solid #162878;"></div>
    </div>
    <div style="flex:1;min-width:0;">
      <div style="font-size:16px;font-weight:700;color:white;">[DEMO] Mike Rodriguez</div>
      <div style="font-size:12px;color:#25d366;">● Active now · Field Worker · WO-0421</div>
    </div>
    <div style="display:flex;gap:6px;flex-shrink:0;">
      <button onclick="showToast('📞','Calling Mike…')" style="width:34px;height:34px;background:rgba(255,255,255,.15);border:none;border-radius:50%;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;">📞</button>
      <button onclick="showToast('📋','Opening WO-0421')" style="width:34px;height:34px;background:rgba(255,255,255,.15);border:none;border-radius:50%;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;">📋</button>
    </div>
  </div>
  <div style="flex:1;overflow-y:auto;padding:12px 14px 80px;display:flex;flex-direction:column;gap:6px;background:var(--bg);">
    <div style="text-align:center;font-size:11px;color:var(--text-3);font-weight:600;padding:4px 12px;background:var(--elevated);border-radius:20px;align-self:center;">Today</div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;max-width:82%;align-self:flex-end;">
      <div style="background:#162878;border-radius:18px 18px 4px 18px;padding:10px 14px;">
        <div style="font-size:14px;color:white;line-height:1.45;">Mike, sector 3A needs to be completed before 11am. Tom is off sick today so 3B is yours too.</div>
      </div>
      <div style="font-size:10px;color:var(--text-3);margin-top:3px;display:flex;align-items:center;gap:3px;">7:45 AM <span style="color:#25d366;font-size:12px;">✓✓</span></div>
    </div>
    <div style="display:flex;gap:8px;align-items:flex-end;max-width:82%;">
      <div style="width:28px;height:28px;border-radius:50%;background:#162878;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:white;flex-shrink:0;">MR</div>
      <div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:18px 18px 18px 4px;padding:10px 14px;">
          <div style="font-size:14px;color:var(--text);line-height:1.45;">Got it. On my way to 3A now. ETA 8:15am.</div>
        </div>
        <div style="font-size:10px;color:var(--text-3);margin-top:3px;margin-left:4px;">8:02 AM</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;align-items:flex-end;max-width:82%;">
      <div style="width:28px;height:28px;border-radius:50%;background:#162878;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:white;flex-shrink:0;">MR</div>
      <div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:18px 18px 18px 4px;padding:10px 14px;">
          <div style="font-size:14px;color:var(--text);line-height:1.45;">Sector 3A done. Moving to 3B now. Found broken sprinkler head at the corner of Oak and Park — should I log it?</div>
        </div>
        <div style="font-size:10px;color:var(--text-3);margin-top:3px;margin-left:4px;">9:48 AM</div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;max-width:82%;align-self:flex-end;">
      <div style="background:#162878;border-radius:18px 18px 4px 18px;padding:10px 14px;">
        <div style="font-size:14px;color:white;line-height:1.45;">Yes log it as a hazard under WO-0421. Photo evidence too please 📷</div>
      </div>
      <div style="font-size:10px;color:var(--text-3);margin-top:3px;display:flex;align-items:center;gap:3px;">9:51 AM <span style="color:#aaa;font-size:12px;">✓</span></div>
    </div>
    <div style="text-align:center;font-size:10px;color:var(--text-3);padding:6px 0;">🔒 End-to-end encrypted</div>
  </div>
  ${THREAD_INPUT_NAVY}
</div>`;

// ════════════════════════════════════════════════════════════════════════════
// APPLY CHANGES
// ════════════════════════════════════════════════════════════════════════════

const FILES = {
  customer:   path.join(ROOT, 'Crew_App_Customer_Role.html'),
  contractor: path.join(ROOT, 'Crew_App_Crew_Member.html'),
  field:      path.join(ROOT, 'CrewBase_Field_Worker_App.html'),
  supervisor: path.join(ROOT, 'CrewBase_Supervisor_App.html'),
};

function process(key, editFn) {
  const fp = FILES[key];
  console.log(`\n── ${path.basename(fp)} ──`);
  let html = fs.readFileSync(fp, 'utf8');
  html = editFn(html, fp);
  fs.writeFileSync(fp, html, 'utf8');
  console.log(`  → saved (${(fs.statSync(fp).size / 1024).toFixed(0)} KB)`);
}

// Customer App ────────────────────────────────────────────────────────────────
process('customer', (html, fp) => {
  html = applyEdit(html, 's-team-chat', S_TEAM_CHAT_CUSTOMER, fp);
  html = applyEdit(html, 's-chat-room', S_CHAT_ROOM, fp);
  html = applyEdit(html, 's-messages',  S_MESSAGES_CUSTOMER, fp);
  html = applyEdit(html, 's-chat',      S_CHAT_CUSTOMER, fp);
  return html;
});

// Contractor App ──────────────────────────────────────────────────────────────
process('contractor', (html, fp) => {
  // Same chat list and room for user mode
  html = applyEdit(html, 's-team-chat',    S_TEAM_CHAT_CUSTOMER, fp);
  html = applyEdit(html, 's-chat-room',    S_CHAT_ROOM, fp);
  html = applyEdit(html, 's-messages',     S_MESSAGES_CUSTOMER, fp);
  html = applyEdit(html, 's-chat',         S_CHAT_CUSTOMER, fp);
  // Contractor mode: replace cmessages with chat list, add thread
  html = applyEdit(html, 's-cmessages',    S_CMESSAGES_CONTRACTOR, fp);
  // Add s-cmessages-room if not present
  if (html.indexOf('id="s-cmessages-room"') === -1) {
    html = insertBeforeBody(html, S_CMESSAGES_ROOM);
    console.log('  ✓  inserted  s-cmessages-room');
  } else {
    html = applyEdit(html, 's-cmessages-room', S_CMESSAGES_ROOM, fp);
  }
  return html;
});

// Field Worker App ────────────────────────────────────────────────────────────
process('field', (html, fp) => {
  if (html.indexOf('id="s-messages"') !== -1) {
    html = applyEdit(html, 's-messages', S_MESSAGES_FIELD, fp);
  } else {
    html = insertBeforeBody(html, S_MESSAGES_FIELD);
    console.log('  ✓  inserted  s-messages');
  }
  if (html.indexOf('id="s-fw-thread"') !== -1) {
    html = applyEdit(html, 's-fw-thread', S_FW_THREAD, fp);
  } else {
    html = insertBeforeBody(html, S_FW_THREAD);
    console.log('  ✓  inserted  s-fw-thread');
  }
  return html;
});

// Supervisor App ──────────────────────────────────────────────────────────────
process('supervisor', (html, fp) => {
  html = applyEdit(html, 's-messages', S_MESSAGES_SUPERVISOR, fp);
  if (html.indexOf('id="s-sup-thread"') !== -1) {
    html = applyEdit(html, 's-sup-thread', S_SUP_THREAD, fp);
  } else {
    html = insertBeforeBody(html, S_SUP_THREAD);
    console.log('  ✓  inserted  s-sup-thread');
  }
  return html;
});

console.log('\n✅ All chat screens rebuilt.');
