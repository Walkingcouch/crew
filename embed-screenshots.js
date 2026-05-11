/**
 * embed-screenshots.js
 * Reads base64 JPEG data from ./screenshots/*.json and splices it into
 * the "See it in action" section of index.html, replacing the old screenshots.
 * Usage: node embed-screenshots.js
 */

const fs   = require('fs');
const path = require('path');

const ROOT      = __dirname;
const SS_DIR    = path.join(ROOT, 'screenshots');
const HTML_FILE = path.join(ROOT, 'index.html');

// ── Which captures go to which panel slot ────────────────────────────────────
// Format: 'appId:captureIndex'
const PANEL_MAP = {
  'ss-customer':   ['customer:0', 'customer:1', 'customer:2'],
  'ss-contractor': ['contractor:0', 'contractor:1', 'contractor:2'],
  'ss-command':    ['command:0'],
  'ss-crewbase':   ['crewbase:0'],
  'ss-field':      ['supervisor:0', 'field:0', 'supervisor:2'],
};

// ── Load all screenshot data ──────────────────────────────────────────────────
function loadCaptures() {
  const cache = {};
  for (const file of fs.readdirSync(SS_DIR).filter(f => f.endsWith('.json'))) {
    const data = JSON.parse(fs.readFileSync(path.join(SS_DIR, file), 'utf8'));
    cache[data.id] = data.captures; // array of { b64, label }
  }
  return cache;
}

// ── Replace base64 src values within a panel block ───────────────────────────
function replacePanelImages(panelHtml, newB64Array) {
  let idx = 0;
  // Match every src="data:image/jpeg;base64,..." and replace in order
  return panelHtml.replace(/src="data:image\/jpeg;base64,[^"]*"/g, () => {
    if (idx >= newB64Array.length) return `src="data:image/jpeg;base64,"`;
    return `src="data:image/jpeg;base64,${newB64Array[idx++]}"`;
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
function run() {
  const caps   = loadCaptures();
  let   html   = fs.readFileSync(HTML_FILE, 'utf8');
  let   count  = 0;

  for (const [panelId, slots] of Object.entries(PANEL_MAP)) {
    // Gather the b64 strings for this panel in slot order
    const b64s = slots.map(ref => {
      const [appId, idx] = ref.split(':');
      const cap = caps[appId] && caps[appId][Number(idx)];
      if (!cap) { console.warn(`  WARNING: no capture found for ${ref}`); return ''; }
      return cap.b64;
    });

    // Find the panel div: <div ... id="PANELID" ...> ... </div> (last sibling close)
    // We anchor to the panel's opening tag and capture until the matching close
    // Strategy: extract the chunk between panel open tag and next panel or end of section
    const panelStart = html.indexOf(`id="${panelId}"`);
    if (panelStart === -1) { console.warn(`  WARNING: panel ${panelId} not found`); continue; }

    // Walk backwards to the start of the opening <div tag
    let tagOpen = panelStart;
    while (tagOpen > 0 && html[tagOpen] !== '<') tagOpen--;

    // Walk forward from tagOpen to find the balanced closing </div>
    let depth  = 0;
    let tagEnd = tagOpen;
    while (tagEnd < html.length) {
      if (html.startsWith('<div', tagEnd))       { depth++; tagEnd += 4; continue; }
      if (html.startsWith('</div>', tagEnd))      { depth--; tagEnd += 6; if (depth === 0) break; continue; }
      tagEnd++;
    }

    const panelOriginal = html.slice(tagOpen, tagEnd);
    const panelReplaced = replacePanelImages(panelOriginal, b64s);

    if (panelOriginal === panelReplaced) {
      console.log(`  ${panelId}: no base64 images found — skipped`);
    } else {
      html = html.slice(0, tagOpen) + panelReplaced + html.slice(tagEnd);
      console.log(`  ${panelId}: replaced ${b64s.filter(Boolean).length} image(s)`);
      count++;
    }
  }

  fs.writeFileSync(HTML_FILE, html, 'utf8');
  console.log(`\nDone — updated ${count} panel(s) in index.html`);
  console.log(`File size: ${(fs.statSync(HTML_FILE).size / 1024 / 1024).toFixed(1)} MB`);
}

run();
