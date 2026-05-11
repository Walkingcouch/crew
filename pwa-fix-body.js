const fs = require('fs');

const SW_SCRIPT = `<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js').catch(function() {});
  });
}
</script>`;

const files = ['Crew_App_Customer_Role.html', 'Crew_App_Crew_Member.html'];

for (const file of files) {
  let html = fs.readFileSync(file, 'utf8');

  // Strip any incorrectly placed SW script (was injected inside a JS string)
  html = html.replace(SW_SCRIPT + '\n', '');

  // Insert before the LAST </body> (the real HTML closing tag)
  const lastBody = html.lastIndexOf('</body>');
  if (lastBody === -1) { console.log('SKIP (no </body>):', file); continue; }
  html = html.slice(0, lastBody) + SW_SCRIPT + '\n</body>' + html.slice(lastBody + 7);

  fs.writeFileSync(file, html, 'utf8');
  console.log('fixed:', file);
}
