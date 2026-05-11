/**
 * fix-new-chat-location.js
 * Moves s-new-chat and s-area-select screen divs from outside the phone frame
 * (they were inserted before </body>) to inside the phone-screen wrapper
 * (before </div><!-- /phone-screen -->).
 * The <script> block stays before </body> — that's fine.
 */

const fs   = require('fs');
const path = require('path');
const ROOT = __dirname;

const FILES = [
  'Crew_App_Customer_Role.html',
  'Crew_App_Crew_Member.html',
];

// Markers we can anchor on (from add-new-chat.js output)
const SCREEN_START = '<!-- ═══════════════════════════════════════════════════════════════════════════\n     NEW MESSAGE SCREEN  (s-new-chat)';
const SCRIPT_START = '<!-- ═══════════════════════════════════════════════════════════════════════════\n     NEW CHAT — JavaScript';

// Find the phone-screen closing comment (used as insertion point)
// Both files use this exact comment
const PHONE_END_MARKERS = [
  '</div><!-- /phone-screen -->',
  '</div><!-- /app -->',
  '</div><!-- phone-screen -->',
];

for (const file of FILES) {
  const filePath = path.join(ROOT, file);
  let html = fs.readFileSync(filePath, 'utf8');

  // ── 1. Find the screen-divs block (SCREEN_START … SCRIPT_START) ────────────
  const screenIdx = html.indexOf(SCREEN_START);
  const scriptIdx = html.indexOf(SCRIPT_START);
  if (screenIdx === -1 || scriptIdx === -1) {
    console.log(`  ${file}: ⚠ markers not found — skipped`);
    continue;
  }

  // The screen HTML is everything from SCREEN_START up to (not including) SCRIPT_START
  const screenBlock = html.slice(screenIdx, scriptIdx);

  // ── 2. Remove the screen block from its current location ───────────────────
  html = html.slice(0, screenIdx) + html.slice(scriptIdx);

  // ── 3. Find the phone-screen closing div ───────────────────────────────────
  let phoneEndIdx = -1;
  let phoneEndMarker = '';
  for (const marker of PHONE_END_MARKERS) {
    const idx = html.indexOf(marker);
    if (idx !== -1) { phoneEndIdx = idx; phoneEndMarker = marker; break; }
  }
  if (phoneEndIdx === -1) {
    console.log(`  ${file}: ⚠ phone-screen end marker not found — reverting`);
    // Re-read to restore
    html = fs.readFileSync(filePath, 'utf8');
    continue;
  }

  // ── 4. Insert screen block just before the closing div ─────────────────────
  html = html.slice(0, phoneEndIdx) + '\n' + screenBlock + html.slice(phoneEndIdx);

  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`  ${file}: ✓ screens moved inside ${phoneEndMarker}`);
}

console.log('Done.');
