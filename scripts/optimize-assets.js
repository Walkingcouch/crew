#!/usr/bin/env node
/**
 * Asset optimiser — converts PNG icons to WebP and updates manifest.json.
 * Run: npm run optimize
 * Requires: npm install --save-dev sharp
 */

const fs   = require('fs');
const path = require('path');

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.error('sharp not installed — run: npm install --save-dev sharp');
    process.exit(1);
  }

  const iconsDir = path.join(__dirname, 'icons');
  const pngs = fs.readdirSync(iconsDir).filter(f => f.endsWith('.png'));

  const webpIcons = [];

  for (const file of pngs) {
    const src  = path.join(iconsDir, file);
    const dest = path.join(iconsDir, file.replace('.png', '.webp'));

    await sharp(src).webp({ quality: 85 }).toFile(dest);

    const meta = await sharp(src).metadata();
    const size = `${meta.width}x${meta.height}`;

    webpIcons.push({
      src:     `/icons/${file.replace('.png', '.webp')}`,
      sizes:   size,
      type:    'image/webp',
      purpose: file.includes('512') ? 'maskable' : 'any',
    });

    console.log(`  ${file} → ${path.basename(dest)} (${size})`);
  }

  // Merge WebP icons into manifest.json (no duplicates)
  const manifestPath = path.join(__dirname, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  const existingWebp = new Set(manifest.icons.filter(i => i.type === 'image/webp').map(i => i.src));
  for (const icon of webpIcons) {
    if (!existingWebp.has(icon.src)) {
      manifest.icons.push(icon);
    }
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\nmanifest.json updated — ${webpIcons.length} WebP icon(s) added.`);
}

main().catch(err => { console.error(err); process.exit(1); });
