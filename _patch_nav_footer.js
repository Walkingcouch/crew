const fs = require('fs');

// ── CANONICAL COMPONENTS ──────────────────────────────────────────────────────

const LOGO_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
const LOGO_SVG_SM = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;

const NAV_CSS_BASE = `.nav{position:fixed;top:0;left:0;right:0;z-index:200;background:rgba(250,250,248,.88);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border-bottom:1px solid transparent;transition:border-color .3s,box-shadow .3s}
.nav.scrolled{border-color:var(--rule);box-shadow:0 2px 20px rgba(0,0,0,.06)}
.nav-inner{height:68px;display:flex;align-items:center;justify-content:space-between;gap:24px}
.nav-logo{display:flex;align-items:center;gap:10px}
.nav-logo-mark{width:34px;height:34px;background:var(--green);border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.nav-logo-text{font-size:17px;font-weight:700;letter-spacing:-.02em;color:var(--ink)}
.nav-links{display:flex;align-items:center;gap:24px;flex:1;justify-content:center}
.nav-links a{font-size:14px;font-weight:500;color:var(--ink-2);transition:color .2s;padding:6px 0}
.nav-links a:hover,.nav-links a.active{color:var(--green)}
.nav-actions{display:flex;align-items:center;gap:10px}
.nav-sign-in{font-size:14px;font-weight:500;color:var(--ink-2);transition:color .2s;padding:8px 16px;border-radius:100px}
.nav-sign-in:hover{color:var(--green)}
.nav-hamburger{display:none;flex-direction:column;justify-content:space-between;width:28px;height:20px;background:none;border:none;cursor:pointer;padding:0;margin-left:8px}
.nav-hamburger span{display:block;width:100%;height:2px;background:var(--ink);border-radius:2px;transition:all .25s}
.mobile-menu{display:none;flex-direction:column;gap:4px;padding:12px 24px 20px;border-top:1px solid var(--rule);background:rgba(250,250,248,.97);backdrop-filter:blur(24px)}
.mobile-menu.open{display:flex}
.mobile-menu a{font-size:16px;font-weight:500;color:var(--ink-2);padding:11px 0;border-bottom:1px solid var(--rule);transition:color .2s}
.mobile-menu a:last-child{border:none}
.mobile-menu a:hover{color:var(--green)}
.mobile-menu-divider{height:1px;background:var(--rule);margin:4px 0}
.mobile-menu .mobile-menu-cta{display:inline-flex;align-items:center;justify-content:center;background:var(--green);color:white;border-radius:12px;padding:13px 24px;font-size:15px;font-weight:600;margin-top:8px;border:none}
@media(max-width:960px){.nav-hamburger{display:flex}.nav-sign-in{display:none}.nav-actions .btn-primary{display:none}}`;

const NAV_CSS_DROPDOWN = `
.nav-dropdown{position:relative;display:flex;align-items:center}
.nav-dropdown-trigger{display:flex;align-items:center;gap:4px;background:none;border:none;font-family:inherit;font-size:14px;font-weight:500;color:var(--ink-2,#3a3630);cursor:pointer;padding:6px 0;transition:color .2s;line-height:1;white-space:nowrap}
.nav-dropdown-trigger:hover,.nav-dropdown.open .nav-dropdown-trigger{color:var(--green,#1a4d33)}
.nav-dropdown-trigger svg{transition:transform .22s;flex-shrink:0}
.nav-dropdown.open .nav-dropdown-trigger svg{transform:rotate(180deg)}
.nav-dropdown-menu{position:absolute;top:calc(100% + 10px);left:50%;transform:translateX(-50%) translateY(-6px);background:#fff;border:1.5px solid var(--rule,#e0ddd7);border-radius:14px;padding:6px;min-width:220px;box-shadow:0 8px 32px rgba(0,0,0,.10);opacity:0;pointer-events:none;transition:opacity .18s,transform .18s;z-index:200}
.nav-dropdown.open .nav-dropdown-menu{opacity:1;pointer-events:auto;transform:translateX(-50%) translateY(0)}
.nav-dropdown-menu a{display:block;padding:10px 14px;border-radius:9px;font-size:13px;font-weight:500;color:var(--ink-2,#3a3630);white-space:nowrap;transition:background .15s,color .15s}
.nav-dropdown-menu a:hover{background:var(--green-pale,#d9f2e3);color:var(--green,#1a4d33)}
.mobile-menu-section-label{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3,#7d7870);padding:10px 0 2px}`;

const BTN_CSS = `.btn{display:inline-flex;align-items:center;gap:8px;font-family:var(--sans);font-size:14px;font-weight:600;padding:12px 24px;border-radius:12px;cursor:pointer;border:none;transition:all .2s;white-space:nowrap}
.btn-primary{background:var(--green);color:#fff}
.btn-primary:hover{background:var(--green-mid);transform:translateY(-1px)}
.btn-ghost{background:transparent;border:1.5px solid var(--rule);color:var(--ink-2)}
.btn-ghost:hover{border-color:var(--green);color:var(--green)}`;

const NAV_HTML = `<header class="nav" id="nav">
  <div class="wrap">
    <div class="nav-inner">
      <a href="index.html" class="nav-logo">
        <div class="nav-logo-mark">${LOGO_SVG}</div>
        <span class="nav-logo-text">Crew</span>
      </a>
      <nav class="nav-links">
        <div class="nav-dropdown" id="platform-dropdown">
          <button class="nav-dropdown-trigger" aria-expanded="false" aria-haspopup="true">
            Platform
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1.5 3.5 5.5 7.5 9.5 3.5"/></svg>
          </button>
          <div class="nav-dropdown-menu" role="menu">
            <a href="index.html#how" role="menuitem">How it Works</a>
            <a href="enterprise.html" role="menuitem">Enterprise Solutions</a>
            <a href="rewards.html" role="menuitem">Rewards</a>
          </div>
        </div>
        <a href="contractors.html">Contractors</a>
        <a href="index.html#pricing">Pricing</a>
        <a href="help.html">Support</a>
      </nav>
      <div class="nav-actions">
        <a href="auth.html" class="nav-sign-in">Sign in</a>
        <a href="get-started.html" class="btn btn-primary">Get started</a>
        <button class="nav-hamburger" id="hamburger" onclick="toggleMobileMenu()" aria-label="Menu"><span></span><span></span><span></span></button>
      </div>
    </div>
  </div>
  <div class="mobile-menu" id="mobile-menu">
    <a href="index.html#platform" onclick="closeMobileMenu()">Platform</a>
    <a href="index.html#how" onclick="closeMobileMenu()">How it works</a>
    <a href="index.html#services" onclick="closeMobileMenu()">Services</a>
    <a href="contractors.html" onclick="closeMobileMenu()">Contractors</a>
    <a href="enterprise.html" onclick="closeMobileMenu()">Enterprise</a>
    <a href="index.html#pricing" onclick="closeMobileMenu()">Pricing</a>
    <a href="help.html" onclick="closeMobileMenu()">Help</a>
    <div class="mobile-menu-divider"></div>
    <a href="auth.html">Sign in</a>
    <a href="auth.html" class="mobile-menu-cta">Get started →</a>
  </div>
</header>`;

const NAV_JS = `var nav=document.getElementById('nav');window.addEventListener('scroll',function(){nav.classList.toggle('scrolled',window.scrollY>20)},{passive:true});
function toggleMobileMenu(){document.getElementById('mobile-menu').classList.toggle('open');document.getElementById('hamburger').classList.toggle('open')}
function closeMobileMenu(){document.getElementById('mobile-menu').classList.remove('open');document.getElementById('hamburger').classList.remove('open')}
window.addEventListener('scroll',closeMobileMenu,{passive:true});
(function(){var dd=document.getElementById('platform-dropdown');if(!dd)return;var btn=dd.querySelector('.nav-dropdown-trigger');function open(){dd.classList.add('open');btn.setAttribute('aria-expanded','true')}function close(){dd.classList.remove('open');btn.setAttribute('aria-expanded','false')}btn.addEventListener('click',function(e){e.stopPropagation();dd.classList.contains('open')?close():open()});document.addEventListener('click',function(e){if(!dd.contains(e.target))close()});document.addEventListener('keydown',function(e){if(e.key==='Escape')close()})})();`;

const FOOTER_HTML = `<footer>
  <div class="wrap">
    <div class="footer-inner">
      <div class="footer-brand">
        <div class="footer-logo">
          <div class="footer-logo-mark">${LOGO_SVG_SM}</div>
          <span class="footer-logo-text">Crew</span>
        </div>
        <p class="footer-desc">Australia's smart home services marketplace. Connecting customers with verified contractors since 2024.</p>
        <div class="footer-contact"><a href="mailto:hello@getcrew.com.au">hello@getcrew.com.au</a></div>
      </div>
      <div class="footer-col">
        <div class="footer-col-head">Company</div>
        <a href="about.html">About Us</a>
        <a href="mailto:hello@getcrew.com.au">Contact</a>
        <a href="privacy.html">Privacy Policy</a>
        <a href="terms.html">Terms &amp; Conditions</a>
      </div>
      <div class="footer-col">
        <div class="footer-col-head">Platform</div>
        <a href="index.html#how">How it Works</a>
        <a href="index.html#pricing">Pricing</a>
        <a href="rewards.html">Rewards</a>
        <a href="contractors.html">Contractors</a>
        <a href="help.html">Support</a>
      </div>
      <div class="footer-col">
        <div class="footer-col-head">Apps</div>
        <span class="footer-app-label">Customer App</span>
        <a href="get-started.html">App Store (iOS)</a>
        <a href="Crew_App_Customer_Role.html">Google Play</a>
        <span class="footer-app-label">Contractor App</span>
        <a href="get-started.html">App Store (iOS)</a>
        <a href="/downloads">Google Play (APK)</a>
      </div>
      <div class="footer-col">
        <div class="footer-col-head">Business</div>
        <a href="Command_Center_Desktop.html">Command Centre</a>
        <a href="CrewBase_Dashboard.html">CrewBase</a>
        <a href="enterprise.html">Enterprise</a>
        <a href="mailto:hello@getcrew.com.au">Talk to Sales</a>
      </div>
    </div>
    <div class="footer-bottom">
      <span class="footer-copy">&copy; 2026 Crew Pty Ltd &middot; ABN &mdash; &middot; All rights reserved</span>
      <div class="footer-badges"><span class="footer-badge">🇦🇺 Australian owned</span><span class="footer-badge">🔒 256-bit SSL</span></div>
    </div>
  </div>
</footer>`;

const FOOTER_CSS = `footer{background:var(--ink);padding:72px 0 40px}
.footer-inner{display:grid;grid-template-columns:1.5fr 1fr 1fr 1fr 1fr;gap:40px;margin-bottom:56px}
.footer-brand{}
.footer-logo{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.footer-logo-mark{width:32px;height:32px;background:var(--green-mid,#2d8055);border-radius:8px;display:flex;align-items:center;justify-content:center}
.footer-logo-text{font-size:16px;font-weight:700;color:white;letter-spacing:-.01em}
.footer-desc{font-size:13px;color:rgba(255,255,255,.4);line-height:1.7;max-width:220px;margin-bottom:20px}
.footer-contact{font-size:13px;color:rgba(255,255,255,.35)}.footer-contact a{color:rgba(255,255,255,.45);transition:color .2s}
.footer-contact a:hover{color:var(--green-lt,#4db37c)}
.footer-col-head{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.3);margin-bottom:18px}
.footer-col a{display:block;font-size:13px;color:rgba(255,255,255,.45);margin-bottom:11px;transition:color .2s}
.footer-col a:hover{color:rgba(255,255,255,.85)}
.footer-app-label{font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.2);display:block;margin-top:14px;margin-bottom:5px}
.footer-col-head+.footer-app-label,.footer-col>.footer-app-label:first-of-type{margin-top:0}
.footer-bottom{border-top:1px solid rgba(255,255,255,.07);padding-top:28px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px}
.footer-copy{font-size:13px;color:rgba(255,255,255,.25)}
.footer-badges{display:flex;gap:12px}
.footer-badge{font-size:11px;font-weight:500;color:rgba(255,255,255,.25);display:flex;align-items:center;gap:5px}
@media(max-width:900px){.footer-inner{grid-template-columns:1fr 1fr 1fr}}
@media(max-width:580px){.footer-inner{grid-template-columns:1fr 1fr}}`;

// ── HELPER: replace header block (with or without <header> tag) ───────────────
function replaceHeader(c, newHeader) {
  // Try <header> first
  const hStart = c.indexOf('<header');
  if (hStart !== -1) {
    const hEnd = c.indexOf('</header>', hStart) + 9;
    return c.slice(0, hStart) + newHeader + c.slice(hEnd);
  }
  // Fall back to <nav class="nav"> with depth counter
  const nStart = c.indexOf('<nav class="nav">');
  if (nStart !== -1) {
    let depth = 0, i = nStart;
    while (i < c.length) {
      if (c.slice(i, i+4) === '<nav') depth++;
      else if (c.slice(i, i+6) === '</nav>') { depth--; if (depth === 0) { i += 6; break; } }
      i++;
    }
    return c.slice(0, nStart) + newHeader + c.slice(i);
  }
  console.log('  WARNING: could not find header/nav block');
  return c;
}

// ── HELPER: replace footer block ─────────────────────────────────────────────
function replaceFooter(c, newFooter) {
  const fStart = c.lastIndexOf('<footer');
  const fEnd = c.indexOf('</footer>', fStart) + 9;
  if (fStart === -1) { console.log('  WARNING: no footer found'); return c; }
  return c.slice(0, fStart) + newFooter + c.slice(fEnd);
}

// ── HELPER: replace CSS block between start and end markers ──────────────────
function replaceCSSBlock(c, oldStart, oldEnd, newCSS) {
  const si = c.indexOf(oldStart);
  if (si === -1) { console.log('  WARNING: CSS start not found: ' + oldStart.substring(0,40)); return c; }
  const ei = c.indexOf(oldEnd, si);
  if (ei === -1) { console.log('  WARNING: CSS end not found: ' + oldEnd.substring(0,40)); return c; }
  return c.slice(0, si) + newCSS + c.slice(ei + oldEnd.length);
}

// ── HELPER: inject nav JS before existing JS or before </body> ────────────────
function injectNavJS(c, newJS) {
  // Remove old toggleMenu function and add new nav JS
  // Replace the first <script> block that contains toggleMenu or toggleMobileMenu
  const oldToggleMenu = c.indexOf('function toggleMenu(');
  const oldToggleMobileMenu = c.indexOf('function toggleMobileMenu(');
  const oldIdx = oldToggleMenu !== -1 ? oldToggleMenu : (oldToggleMobileMenu !== -1 ? oldToggleMobileMenu : -1);

  if (oldIdx !== -1) {
    // Find the <script> block containing this function
    const scriptStart = c.lastIndexOf('<script>', oldIdx);
    const scriptEnd = c.indexOf('</script>', scriptStart) + 9;
    const scriptContent = c.slice(scriptStart + 8, scriptEnd - 9);
    // Remove toggleMenu/closeMobileMenu/toggleMobileMenu from this block and add scrolled handler
    let newScript = scriptContent
      .replace(/function toggleMenu\(\)\s*\{[^}]*\}/g, '')
      .replace(/function toggleMobileMenu\(\)\s*\{[^}]*\}/g, '')
      .replace(/function closeMobileMenu\(\)\s*\{[^}]*\}/g, '')
      .replace(/window\.addEventListener\('scroll',closeMobileMenu[^)]*\)/g, '')
      .replace(/var nav=document[^;]+;window\.addEventListener[^;]+;/g, '')
      .trim();
    const newScriptBlock = '<script>\n' + newJS + (newScript ? '\n' + newScript : '') + '\n</script>';
    return c.slice(0, scriptStart) + newScriptBlock + c.slice(scriptEnd);
  }

  // No old JS found — inject before </body>
  return c.replace('</body>', '<script>\n' + newJS + '\n</script>\n</body>');
}

let results = {};

// ════════════════════════════════════════════════════════════════════════════
// 1. blog.html — wrong wrapper, old CSS, old JS; correct footer
// ════════════════════════════════════════════════════════════════════════════
{
  let c = fs.readFileSync('blog.html', 'utf8');
  const OLD_NAV_CSS_START = '.nav{position:sticky;top:0;z-index:100;background:rgba(250,250,248,.95);backdrop-filter:blur(12px);border-bottom:1px solid var(--rule);padding:0 24px}';
  const OLD_NAV_CSS_END = '.mobile-menu.open{display:flex}';
  // Keep .btn CSS since blog uses it; include it before canonical nav CSS
  const newNavCSS = BTN_CSS + '\n' + NAV_CSS_BASE;
  c = replaceCSSBlock(c, OLD_NAV_CSS_START, OLD_NAV_CSS_END, newNavCSS);
  c = replaceHeader(c, NAV_HTML);
  c = injectNavJS(c, NAV_JS);
  fs.writeFileSync('blog.html', c, 'utf8');
  results['blog.html'] = {
    navCSS: c.includes('.nav{position:fixed'),
    header: c.includes('<header class="nav" id="nav">'),
    hamburger: c.includes('toggleMobileMenu'),
    scrolled: c.includes('.nav.scrolled'),
    footer: c.includes('.footer-inner{display:grid')
  };
  console.log('blog.html:', results['blog.html']);
}

// ════════════════════════════════════════════════════════════════════════════
// 2. trust.html — wrong wrapper, old CSS, old JS, WRONG footer
// ════════════════════════════════════════════════════════════════════════════
{
  let c = fs.readFileSync('trust.html', 'utf8');
  // Old nav CSS start/end
  const OLD_NAV_CSS_START = '.nav{position:sticky;top:0;z-index:100;background:rgba(250,250,248,.95);backdrop-filter:blur(12px);border-bottom:1px solid var(--rule);padding:0 24px}';
  const OLD_NAV_CSS_END = '.mobile-menu.open{display:flex}';
  const newNavCSS = BTN_CSS + '\n' + NAV_CSS_BASE;
  c = replaceCSSBlock(c, OLD_NAV_CSS_START, OLD_NAV_CSS_END, newNavCSS);

  // Replace old footer CSS
  const OLD_FOOTER_CSS_START = 'footer{background:var(--ink);color:rgba(255,255,255,.6);padding:64px 24px 40px}';
  const OLD_FOOTER_CSS_END_MARKER = '.footer-legal a:hover{color:v';
  const fCSSEnd = c.indexOf(OLD_FOOTER_CSS_END_MARKER);
  if (fCSSEnd !== -1) {
    const afterEnd = c.indexOf('\n', fCSSEnd + OLD_FOOTER_CSS_END_MARKER.length) + 1;
    const fCSSStart = c.indexOf(OLD_FOOTER_CSS_START);
    c = c.slice(0, fCSSStart) + FOOTER_CSS + c.slice(afterEnd);
  }

  c = replaceHeader(c, NAV_HTML);
  c = replaceFooter(c, FOOTER_HTML);
  c = injectNavJS(c, NAV_JS);
  fs.writeFileSync('trust.html', c, 'utf8');
  results['trust.html'] = {
    navCSS: c.includes('.nav{position:fixed'),
    header: c.includes('<header class="nav" id="nav">'),
    footer: c.includes('footer-col-head">Company'),
    scrolled: c.includes('.nav.scrolled')
  };
  console.log('trust.html:', results['trust.html']);
}

// ════════════════════════════════════════════════════════════════════════════
// 3. case-studies.html — same as trust.html
// ════════════════════════════════════════════════════════════════════════════
{
  let c = fs.readFileSync('case-studies.html', 'utf8');
  const OLD_NAV_CSS_START = '.nav{position:sticky;top:0;z-index:100;background:rgba(250,250,248,.95);backdrop-filter:blur(12px);border-bottom:1px solid var(--rule);padding:0 24px}';
  const OLD_NAV_CSS_END = '.mobile-menu.open{display:flex}';
  const newNavCSS = BTN_CSS + '\n' + NAV_CSS_BASE;
  c = replaceCSSBlock(c, OLD_NAV_CSS_START, OLD_NAV_CSS_END, newNavCSS);

  const OLD_FOOTER_CSS_START = 'footer{background:var(--ink);color:rgba(255,255,255,.6);padding:64px 24px 40px}';
  const OLD_FOOTER_CSS_END_MARKER = '.footer-legal a:hover{color:v';
  const fCSSEnd = c.indexOf(OLD_FOOTER_CSS_END_MARKER);
  if (fCSSEnd !== -1) {
    const afterEnd = c.indexOf('\n', fCSSEnd + OLD_FOOTER_CSS_END_MARKER.length) + 1;
    const fCSSStart = c.indexOf(OLD_FOOTER_CSS_START);
    c = c.slice(0, fCSSStart) + FOOTER_CSS + c.slice(afterEnd);
  }

  c = replaceHeader(c, NAV_HTML);
  c = replaceFooter(c, FOOTER_HTML);
  c = injectNavJS(c, NAV_JS);
  fs.writeFileSync('case-studies.html', c, 'utf8');
  results['case-studies.html'] = {
    navCSS: c.includes('.nav{position:fixed'),
    header: c.includes('<header class="nav" id="nav">'),
    footer: c.includes('footer-col-head">Company'),
    scrolled: c.includes('.nav.scrolled')
  };
  console.log('case-studies.html:', results['case-studies.html']);
}

// ════════════════════════════════════════════════════════════════════════════
// 4. downloads.html — no header wrapper, inline styles, no hamburger
// ════════════════════════════════════════════════════════════════════════════
{
  let c = fs.readFileSync('downloads.html', 'utf8');
  const OLD_NAV_CSS_START = '.nav{position:sticky;top:0;z-index:100;background:rgba(250,250,249,.96);backdrop-filter:blur(12px);border-bottom:1px solid var(--rule);padding:0 32px;height:60px;display:flex;align-items:center;justify-content:space-between}';
  const OLD_NAV_CSS_END_MARKER = '/* ── HERO ── */';
  const nCSSStart = c.indexOf(OLD_NAV_CSS_START);
  const nCSSEnd = c.indexOf(OLD_NAV_CSS_END_MARKER, nCSSStart);
  if (nCSSStart !== -1 && nCSSEnd !== -1) {
    c = c.slice(0, nCSSStart) + NAV_CSS_BASE + NAV_CSS_DROPDOWN + '\n\n' + c.slice(nCSSEnd);
  }
  c = replaceHeader(c, NAV_HTML);
  // Replace old platform-dropdown JS
  const oldDDJS = c.indexOf('(function(){');
  // Replace in last script block
  const OLD_DD_JS_START = `(function(){\n  var btn=document.querySelector('#platform-dropdown .nav-dropdown-trigger');\n  var menu=document.getElementById('dl-platform-menu');`;
  const oldDDStart = c.indexOf(OLD_DD_JS_START);
  if (oldDDStart !== -1) {
    const closingScript = c.indexOf('})();\n</script>', oldDDStart);
    if (closingScript !== -1) {
      c = c.slice(0, oldDDStart) + c.slice(closingScript + 7 + 9); // remove from IIFE to </script>
    }
  }
  // Inject nav JS before service worker script
  c = c.replace('<script>\nif (\'serviceWorker\' in navigator)', '<script>\n' + NAV_JS + '\n</script>\n<script>\nif (\'serviceWorker\' in navigator)');
  fs.writeFileSync('downloads.html', c, 'utf8');
  results['downloads.html'] = {
    navCSS: c.includes('.nav{position:fixed'),
    header: c.includes('<header class="nav" id="nav">'),
    hamburger: c.includes('toggleMobileMenu'),
    scrolled: c.includes('.nav.scrolled')
  };
  console.log('downloads.html:', results['downloads.html']);
}

// ════════════════════════════════════════════════════════════════════════════
// 5. get-started.html — no header wrapper, text logo, no hamburger
// ════════════════════════════════════════════════════════════════════════════
{
  let c = fs.readFileSync('get-started.html', 'utf8');
  // Old nav CSS runs from .nav{ to just before /* ── HERO ── */
  const OLD_NAV_CSS_START = '.nav{position:sticky;top:0;z-index:100;background:rgba(250,250,249,.96);backdrop-filter:blur(12px);border-bottom:1px solid var(--rule);padding:0 32px;height:60px;display:flex;align-items:center;justify-content:space-between}';
  const HERO_MARKER = '/* ── HERO ── */';
  const nCSSStart = c.indexOf(OLD_NAV_CSS_START);
  const heroCSSIdx = c.indexOf(HERO_MARKER, nCSSStart);
  if (nCSSStart !== -1 && heroCSSIdx !== -1) {
    c = c.slice(0, nCSSStart) + NAV_CSS_BASE + NAV_CSS_DROPDOWN + '\n\n' + c.slice(heroCSSIdx);
  }
  c = replaceHeader(c, NAV_HTML);
  // Replace old platform dropdown IIFE
  const OLD_PD = '// Platform dropdown\n(function(){';
  const pdIdx = c.indexOf(OLD_PD);
  if (pdIdx !== -1) {
    const pdEnd = c.indexOf('})();\n</script>', pdIdx) + 7 + 9;
    c = c.slice(0, pdIdx) + c.slice(pdEnd);
  }
  // Also remove old individual dropdown IIFE
  const OLD_PD2 = '(function(){\n  var dd = document.getElementById(\'platform-dropdown\');\n  if (!dd) return;\n  var trigger = dd.querySelector(\'.nav-dropdown-trigger\');';
  const pd2Idx = c.indexOf(OLD_PD2);
  if (pd2Idx !== -1) {
    const pd2ScriptStart = c.lastIndexOf('<script>', pd2Idx);
    const pd2ScriptEnd = c.indexOf('</script>', pd2Idx) + 9;
    const scriptContent = c.slice(pd2ScriptStart + 8, pd2ScriptEnd - 9).replace(OLD_PD2, '').trim();
    if (scriptContent.length < 10) {
      c = c.slice(0, pd2ScriptStart) + c.slice(pd2ScriptEnd);
    }
  }
  // Inject nav JS before service worker script
  if (!c.includes('toggleMobileMenu')) {
    c = c.replace('<script>\nif (\'serviceWorker\' in navigator)', '<script>\n' + NAV_JS + '\n</script>\n<script>\nif (\'serviceWorker\' in navigator)');
  }
  fs.writeFileSync('get-started.html', c, 'utf8');
  results['get-started.html'] = {
    navCSS: c.includes('.nav{position:fixed'),
    header: c.includes('<header class="nav" id="nav">'),
    hamburger: c.includes('toggleMobileMenu'),
    scrolled: c.includes('.nav.scrolled')
  };
  console.log('get-started.html:', results['get-started.html']);
}

// ════════════════════════════════════════════════════════════════════════════
// 6. rewards.html — nav class, base64 logo in both header and footer
// ════════════════════════════════════════════════════════════════════════════
{
  let c = fs.readFileSync('rewards.html', 'utf8');

  // Old nav CSS — find it and replace to hero section
  const OLD_NAV_CSS_START = '.nav{\n  position:fixed;top:0;left:0;right:0;z-index:100;\n  height:64px;display:flex;align-items:center;';
  const nCSSStart = c.indexOf(OLD_NAV_CSS_START);
  // Find end of nav CSS — look for HERO section
  const HERO_MARKER_R = '.hero{';
  const heroCSSIdx = c.indexOf(HERO_MARKER_R, nCSSStart);
  if (nCSSStart !== -1 && heroCSSIdx !== -1) {
    c = c.slice(0, nCSSStart) + NAV_CSS_BASE + NAV_CSS_DROPDOWN + '\n\n' + c.slice(heroCSSIdx);
  } else {
    console.log('rewards.html: could not find nav CSS boundaries');
  }

  // Replace header (depth-counted nav block)
  c = replaceHeader(c, NAV_HTML);

  // Fix footer: replace the entire footer with canonical
  // The current footer has a base64 logo and missing footer-brand class
  c = replaceFooter(c, FOOTER_HTML);

  // Inject nav JS
  const navJSExists = c.includes('toggleMobileMenu');
  if (!navJSExists) {
    c = c.replace('<script>\nif (\'serviceWorker\' in navigator)', '<script>\n' + NAV_JS + '\n</script>\n<script>\nif (\'serviceWorker\' in navigator)');
    if (!c.includes('toggleMobileMenu')) {
      // Try different pattern
      const lastScript = c.lastIndexOf('</script>');
      c = c.slice(0, lastScript + 9) + '\n<script>\n' + NAV_JS + '\n</script>';
    }
  }

  fs.writeFileSync('rewards.html', c, 'utf8');
  results['rewards.html'] = {
    navCSS: c.includes('.nav{position:fixed'),
    header: c.includes('<header class="nav" id="nav">'),
    footer: c.includes('footer-col-head">Company'),
    hamburger: c.includes('toggleMobileMenu')
  };
  console.log('rewards.html:', results['rewards.html']);
}

// ════════════════════════════════════════════════════════════════════════════
// 7. privacy.html — simplified nav, footer-mini
// ════════════════════════════════════════════════════════════════════════════
{
  let c = fs.readFileSync('privacy.html', 'utf8');

  // Replace old simplified nav CSS block
  const OLD_PRIV_NAV_CSS = '.nav{position:fixed;top:0;left:0;right:0;z-index:200;background:rgba(250,250,248,.92);backdrop-filter:blur(24px);border-bottom:1px solid var(--rule)}';
  const CONTENT_MARKER = '/* CONTENT */';
  const nCSSStart = c.indexOf(OLD_PRIV_NAV_CSS);
  const contentIdx = c.indexOf(CONTENT_MARKER, nCSSStart);
  if (nCSSStart !== -1 && contentIdx !== -1) {
    c = c.slice(0, nCSSStart) + NAV_CSS_BASE + NAV_CSS_DROPDOWN + '\n\n' + c.slice(contentIdx);
  }

  // Replace old simplified header with canonical
  const OLD_PRIV_HEADER_START = '<header class="nav">';
  const hStart = c.indexOf(OLD_PRIV_HEADER_START);
  if (hStart !== -1) {
    const hEnd = c.indexOf('</header>', hStart) + 9;
    c = c.slice(0, hStart) + NAV_HTML + c.slice(hEnd);
  }

  // Add id="nav" if missing (in case header was already replaced)
  c = c.replace('<header class="nav">', '<header class="nav" id="nav">');

  // Replace footer-mini with canonical footer
  const OLD_FOOTER_CSS = '.footer-mini{';
  const footerCSSStart = c.indexOf(OLD_FOOTER_CSS);
  if (footerCSSStart !== -1) {
    // Replace up to the next section (privacy notice or end of style)
    const fCSSEnd = c.indexOf('\n</style>', footerCSSStart);
    c = c.slice(0, footerCSSStart) + FOOTER_CSS + c.slice(fCSSEnd);
  }

  c = replaceFooter(c, FOOTER_HTML);

  // Inject nav JS if missing
  if (!c.includes('toggleMobileMenu')) {
    c = c.replace('</body>', '<script>\n' + NAV_JS + '\n</script>\n</body>');
  }

  fs.writeFileSync('privacy.html', c, 'utf8');
  results['privacy.html'] = {
    navCSS: c.includes('.nav{position:fixed'),
    header: c.includes('<header class="nav" id="nav">'),
    navLinks: c.includes('class="nav-links"'),
    footer: c.includes('footer-col-head">Company'),
    hamburger: c.includes('toggleMobileMenu')
  };
  console.log('privacy.html:', results['privacy.html']);
}

// ════════════════════════════════════════════════════════════════════════════
// 8. terms.html — same as privacy.html
// ════════════════════════════════════════════════════════════════════════════
{
  let c = fs.readFileSync('terms.html', 'utf8');

  const OLD_TERMS_NAV_CSS = '.nav{position:fixed;top:0;left:0;right:0;z-index:200;background:rgba(250,250,248,.92);backdrop-filter:blur(24px);border-bottom:1px solid var(--rule)}';
  const CONTENT_MARKER = '/* CONTENT */';
  const nCSSStart = c.indexOf(OLD_TERMS_NAV_CSS);
  const contentIdx = c.indexOf(CONTENT_MARKER, nCSSStart);
  if (nCSSStart !== -1 && contentIdx !== -1) {
    c = c.slice(0, nCSSStart) + NAV_CSS_BASE + NAV_CSS_DROPDOWN + '\n\n' + c.slice(contentIdx);
  }

  const OLD_TERMS_HEADER_START = '<header class="nav">';
  const hStart = c.indexOf(OLD_TERMS_HEADER_START);
  if (hStart !== -1) {
    const hEnd = c.indexOf('</header>', hStart) + 9;
    c = c.slice(0, hStart) + NAV_HTML + c.slice(hEnd);
  }
  c = c.replace('<header class="nav">', '<header class="nav" id="nav">');

  const OLD_FOOTER_CSS = '.footer-mini{';
  const footerCSSStart = c.indexOf(OLD_FOOTER_CSS);
  if (footerCSSStart !== -1) {
    const fCSSEnd = c.indexOf('\n</style>', footerCSSStart);
    c = c.slice(0, footerCSSStart) + FOOTER_CSS + c.slice(fCSSEnd);
  }

  c = replaceFooter(c, FOOTER_HTML);

  if (!c.includes('toggleMobileMenu')) {
    c = c.replace('</body>', '<script>\n' + NAV_JS + '\n</script>\n</body>');
  }

  fs.writeFileSync('terms.html', c, 'utf8');
  results['terms.html'] = {
    navCSS: c.includes('.nav{position:fixed'),
    header: c.includes('<header class="nav" id="nav">'),
    navLinks: c.includes('class="nav-links"'),
    footer: c.includes('footer-col-head">Company'),
    hamburger: c.includes('toggleMobileMenu')
  };
  console.log('terms.html:', results['terms.html']);
}

// ════════════════════════════════════════════════════════════════════════════
// 9. rewards-tc.html — upgrade footer only; keep back-nav
// ════════════════════════════════════════════════════════════════════════════
{
  let c = fs.readFileSync('rewards-tc.html', 'utf8');

  // Replace old footer CSS
  const OLD_TC_FOOTER_CSS = 'footer{background:var(--ink);padding:40px 32px;text-align:center}';
  const tcFCSSEnd = c.indexOf('footer a:hover{color:rgba(255,255,255,.8)}');
  if (c.indexOf(OLD_TC_FOOTER_CSS) !== -1 && tcFCSSEnd !== -1) {
    const tcFCSSStart = c.indexOf(OLD_TC_FOOTER_CSS);
    const afterEnd = c.indexOf('\n', tcFCSSEnd + 41) + 1;
    c = c.slice(0, tcFCSSStart) + FOOTER_CSS + c.slice(afterEnd);
  }

  c = replaceFooter(c, FOOTER_HTML);

  fs.writeFileSync('rewards-tc.html', c, 'utf8');
  results['rewards-tc.html'] = {
    footer: c.includes('footer-col-head">Company'),
    footerCSS: c.includes('footer-inner{display:grid')
  };
  console.log('rewards-tc.html:', results['rewards-tc.html']);
}

console.log('\n=== SUMMARY ===');
let allOk = true;
Object.entries(results).forEach(([page, checks]) => {
  const failed = Object.entries(checks).filter(([k,v]) => !v).map(([k]) => k);
  if (failed.length > 0) { console.log('❌ ' + page + ': FAILED: ' + failed.join(', ')); allOk = false; }
  else { console.log('✅ ' + page); }
});
if (allOk) console.log('\nAll pages patched successfully!');
