#!/usr/bin/env node
/**
 * scripts/check-copy.mjs
 *
 * Final copy sweep: em dashes (banned everywhere user-facing, in code
 * comments, and in markdown docs), a short list of AI-tell words/phrases,
 * and a few common US spellings, across every HTML file plus the root
 * markdown docs. Flags candidate lines for human review rather than
 * auto-fixing, CSS custom properties, class names, and JS/Web API spec
 * keys are legitimate false positives this can't fully distinguish from
 * real prose, so treat matches as a checklist, not an automatic failure.
 *
 * Run: node scripts/check-copy.mjs
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const EM_DASH_RE = /[—–]/;

const AI_TELL_WORDS = [
  'delve', 'seamless', 'seamlessly', 'leverage', 'unlock', 'empower',
  'elevate', 'supercharge', "whether you're", 'whether you are',
];

// US spelling -> AU spelling reminders (word-boundary, case-insensitive).
// Deliberately excludes anything that's also a valid code identifier/CSS
// property (color, center) since those are correct in that context.
const US_SPELLING_WORDS = [
  'organization', 'organizations', 'organized', 'organizing',
  'customize', 'customized', 'customizable',
  'personalize', 'personalized',
  'optimize', 'optimizing', 'optimization',
  'recognize', 'recognized',
  'analyze', 'analyzed', 'analyzing',
  'favorite', 'favorites',
  'canceled', // AU/UK: cancelled
];

// Lines matching any of these are code, not prose, and are excluded from
// every check: CSS custom properties (var(--elevated), --elevated: ...),
// class/id names, and inline style attributes are the recurring source of
// false positives here (see DECISIONS.md Phase 1: a blind word-list regex
// over this codebase is ~95% false positives without this kind of filter).
const CODE_LINE_RE = /var\(--|--[\w-]+:\s|class="|id="|style="/;

function scanFile(file, content, lines) {
  const results = { emDash: [], aiTell: [], usSpelling: [] };
  lines.forEach((line, i) => {
    const isCodeLine = CODE_LINE_RE.test(line);

    if (EM_DASH_RE.test(line)) results.emDash.push({ line: i + 1, text: line.trim().slice(0, 100) });

    if (!isCodeLine) {
      const lower = line.toLowerCase();
      for (const word of AI_TELL_WORDS) {
        // Word-boundary match, and skip "unlocked"/"elevated" as bare past-
        // tense adjectives (a literal gate/door being unlocked, a raised
        // deck) which are legitimate AU English, not the AI-tell verb form.
        const re = new RegExp(`\\b${word}(?!ed\\b)`, 'i');
        if (re.test(lower)) results.aiTell.push({ line: i + 1, word, text: line.trim().slice(0, 100) });
      }
      for (const word of US_SPELLING_WORDS) {
        const re = new RegExp(`\\b${word}\\b`, 'i');
        if (re.test(line)) results.usSpelling.push({ line: i + 1, word, text: line.trim().slice(0, 100) });
      }
    }
  });
  return results;
}

const targets = [
  ...readdirSync(ROOT).filter(f => f.endsWith('.html')),
  ...readdirSync(ROOT).filter(f => f.endsWith('.md')),
];

let totalIssues = 0;
const report = [];

for (const file of targets) {
  const content = readFileSync(join(ROOT, file), 'utf8');
  const lines = content.split('\n');
  const { emDash, aiTell, usSpelling } = scanFile(file, content, lines);
  const count = emDash.length + aiTell.length + usSpelling.length;
  if (count > 0) {
    totalIssues += count;
    report.push({ file, emDash, aiTell, usSpelling });
  }
}

console.log(`Scanned ${targets.length} files (HTML + markdown).`);
if (report.length === 0) {
  console.log('No em dashes, AI-tell words, or flagged US spellings found.');
} else {
  console.log(`\n${totalIssues} candidate issue(s) across ${report.length} file(s):\n`);
  for (const { file, emDash, aiTell, usSpelling } of report) {
    console.log(`-- ${file} --`);
    for (const m of emDash) console.log(`  [em dash]   L${m.line}: ${m.text}`);
    for (const m of aiTell) console.log(`  [ai-tell:${m.word}] L${m.line}: ${m.text}`);
    for (const m of usSpelling) console.log(`  [us-spelling:${m.word}] L${m.line}: ${m.text}`);
  }
  process.exitCode = 1;
}
