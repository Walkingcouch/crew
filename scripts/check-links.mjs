#!/usr/bin/env node
/**
 * scripts/check-links.mjs
 *
 * Ported for the Next.js rebuild: the legacy version scanned root-level
 * HTML files and checked links against vercel.json rewrites. There are no
 * more root HTML files or vercel.json rewrites (routing is the App
 * Router's own file structure now), so this instead: (1) derives the set
 * of real routes by walking src/app for page.tsx/route.ts files, mapping
 * route groups like (marketing) to nothing and dynamic segments
 * ([id], [...path], [[...path]]) to wildcards, (2) adds next.config.ts's
 * redirect sources, (3) scans every .tsx file under src/ for href="..."
 * attributes and checks each internal one resolves.
 *
 * Run: node scripts/check-links.mjs
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, extname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP_DIR = join(ROOT, 'src', 'app');
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'legacy', 'crew-app']);

function walk(dir, filter, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, filter, out);
    } else if (filter(entry)) {
      out.push(full);
    }
  }
  return out;
}

// Converts an app/ directory path (e.g. src/app/customer/bookings/[id])
// into a route pattern (e.g. /customer/bookings/:id), dropping route
// groups like (marketing) which contribute nothing to the URL.
function toRoutePattern(pageFile) {
  const rel = relative(APP_DIR, dirname(pageFile));
  const segments = rel === '.' ? [] : rel.split(sep);
  const pattern = segments
    .filter((seg) => !(seg.startsWith('(') && seg.endsWith(')')))
    .map((seg) => {
      if (seg.startsWith('[[...') || seg.startsWith('[...')) return '*';
      if (seg.startsWith('[') && seg.endsWith(']')) return ':param';
      return seg;
    });
  return '/' + pattern.join('/');
}

const pageFiles = walk(APP_DIR, (name) => name === 'page.tsx' || name === 'route.ts');
const routePatterns = new Set(pageFiles.map(toRoutePattern).map((p) => (p === '' ? '/' : p)));

// next.config.ts redirect sources are valid link targets too (they resolve
// somewhere real, just via a 301/307 instead of a direct route match).
const nextConfigSrc = readFileSync(join(ROOT, 'next.config.ts'), 'utf8');
const redirectSourceRe = /source:\s*"([^"]+)"/g;
let redirectMatch;
while ((redirectMatch = redirectSourceRe.exec(nextConfigSrc)) !== null) {
  routePatterns.add(redirectMatch[1].replace(/:path\*$/, '*'));
}

function routeMatches(path) {
  const segments = path.split('/').filter(Boolean);
  for (const pattern of routePatterns) {
    const patternSegments = pattern.split('/').filter(Boolean);
    let matched = true;
    for (let i = 0; i < Math.max(segments.length, patternSegments.length); i++) {
      const patternSeg = patternSegments[i];
      const seg = segments[i];
      if (patternSeg === '*') { matched = true; break; }
      if (patternSeg === ':param') { if (seg === undefined) { matched = false; break; } continue; }
      if (patternSeg !== seg) { matched = false; break; }
    }
    if (matched) return true;
  }
  return path === '/';
}

function resolvable(link) {
  if (/^(https?:)?\/\//.test(link)) return true; // external
  if (link.startsWith('mailto:') || link.startsWith('tel:')) return true;
  if (link.startsWith('data:') || link.startsWith('blob:') || link.startsWith('javascript:')) return true;
  if (link === '#' || link.startsWith('#')) return true; // in-page anchor
  if (!link.startsWith('/')) return true; // relative/template-expression links, not worth resolving here

  const clean = link.split('#')[0].split('?')[0];
  if (!clean || clean === '/') return true;

  // Static assets (anything with a file extension) resolve by checking
  // public/ directly; clean routes (no extension) go through routeMatches.
  if (clean.includes('.')) {
    return existsSync(join(ROOT, 'public', clean.slice(1)));
  }

  return routeMatches(clean);
}

const targetFiles = walk(join(ROOT, 'src'), (name) => extname(name) === '.tsx');
const LINK_RE = /href="([^"]+)"/g;

let totalLinks = 0;
const broken = [];

for (const file of targetFiles) {
  const content = readFileSync(file, 'utf8');
  let match;
  while ((match = LINK_RE.exec(content)) !== null) {
    const link = match[1];
    totalLinks++;
    if (!resolvable(link)) {
      broken.push(`${relative(ROOT, file)}: ${link}`);
    }
  }
}

console.log(`Checked ${totalLinks} internal href links across ${targetFiles.length} .tsx files, against ${routePatterns.size} known routes.`);
if (broken.length) {
  console.log(`\n${broken.length} possibly broken link(s):`);
  for (const b of broken) console.log(`  - ${b}`);
  process.exit(1);
} else {
  console.log('No broken links found.');
}
