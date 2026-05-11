const fs = require('fs');
const path = require('path');

const PWA_HEAD = `<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#2d8055">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Crew">
<link rel="apple-touch-icon" href="/icons/icon.svg">`;

const SW_SCRIPT = `<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js').catch(function() {});
  });
}
</script>`;

const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));
let patched = 0, skipped = 0;

for (const file of files) {
  let html = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Add PWA head block after charset meta if not already present
  if (!html.includes('rel="manifest"')) {
    html = html.replace(
      /(<meta\s+charset=["']UTF-8["'][^>]*>)/i,
      `$1\n${PWA_HEAD}`
    );
    changed = true;
  }

  // Add SW registration before </body> if not already present
  if (!html.includes('serviceWorker')) {
    html = html.replace('</body>', `${SW_SCRIPT}\n</body>`);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, html, 'utf8');
    console.log('✓ patched:', file);
    patched++;
  } else {
    skipped++;
  }
}

console.log(`\nDone. ${patched} patched, ${skipped} already complete.`);
