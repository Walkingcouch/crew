#!/usr/bin/env node
/**
 * scripts/check-links.mjs
 *
 * Scans every root-level HTML file for internal href/src references
 * (excluding external http(s):// and mailto:/tel: links) and confirms each
 * one resolves to a real file on disk or a route vercel.json actually
 * rewrites. Run: node scripts/check-links.mjs
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const vercelConfig = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
const rewritePaths = new Set((vercelConfig.rewrites || []).map(r => r.source.split('(')[0].split(':')[0]));
const redirectPaths = new Set((vercelConfig.redirects || []).map(r => r.source.split('(')[0].split(':')[0]));

const htmlFiles = readdirSync(ROOT).filter(f => f.endsWith('.html'));

const LINK_RE = /(?:href|src)="([^"]+)"/g;

let totalLinks = 0;
let brokenCount = 0;
const broken = [];

function resolvable(link, sourceFile) {
  if (/^(https?:)?\/\//.test(link)) return true; // external
  if (link.startsWith('mailto:') || link.startsWith('tel:')) return true;
  if (link.startsWith('data:') || link.startsWith('blob:') || link.startsWith('javascript:')) return true;
  if (link === '#' || link.startsWith('#')) return true; // in-page anchor
  if (/^'\s*\+|\+\s*'$/.test(link) || /' \+ [a-zA-Z_$][\w.]* \+ '/.test(link)) return true; // JS template concatenation, not a literal attribute

  const clean = link.split('#')[0].split('?')[0];
  if (!clean) return true;

  // Clean URL routes (no extension): check against vercel.json rewrites/redirects.
  if (!clean.includes('.') || clean.endsWith('/')) {
    if (rewritePaths.has(clean) || redirectPaths.has(clean)) return true;
    if (clean === '/') return true;
    // Fall through: might still be a real route not literally listed (rare), flag it.
    return false;
  }

  const filePath = join(ROOT, clean.startsWith('/') ? clean.slice(1) : clean);
  return existsSync(filePath);
}

for (const file of htmlFiles) {
  const content = readFileSync(join(ROOT, file), 'utf8');
  let match;
  while ((match = LINK_RE.exec(content)) !== null) {
    const link = match[1];
    totalLinks++;
    if (!resolvable(link, file)) {
      brokenCount++;
      broken.push(`${file}: ${link}`);
    }
  }
}

console.log(`Checked ${totalLinks} internal href/src links across ${htmlFiles.length} HTML files.`);
if (broken.length) {
  console.log(`\n${brokenCount} possibly broken link(s):`);
  for (const b of broken) console.log(`  - ${b}`);
  process.exit(1);
} else {
  console.log('No broken links found.');
}
