/**
 * Generates icon-192.png and icon-512.png using pure Node.js (no external deps).
 * Renders: dark green rounded square with 3 grass blades and "crew" wordmark.
 */
const zlib = require('zlib');
const fs   = require('fs');

// Brand colours
const BG   = [0x1a, 0x4d, 0x33]; // #1a4d33 dark green
const LT   = [0x4d, 0xb3, 0x7c]; // #4db37c accent green
const MID  = [0x2d, 0x80, 0x55]; // #2d8055 mid green
const WHT  = [0xff, 0xff, 0xff]; // white

function renderIcon(size) {
  // Pixel buffer: RGBA
  const pixels = new Uint8Array(size * size * 4);

  const cx = size / 2, cy = size / 2;
  const r  = size * 0.218; // corner radius (~112px at 512)

  function set(x, y, rgb, a = 255) {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    pixels[i]     = rgb[0];
    pixels[i + 1] = rgb[1];
    pixels[i + 2] = rgb[2];
    pixels[i + 3] = a;
  }

  // Rounded rectangle background (anti-alias on edges)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.max(Math.abs(x - cx) - (cx - r), 0);
      const dy = Math.max(Math.abs(y - cy) - (cy - r), 0);
      const dist = Math.sqrt(dx * dx + dy * dy);
      const a = Math.max(0, Math.min(255, (r - dist) * 3 + 200));
      set(x, y, BG, a > 255 ? 255 : a < 0 ? 0 : a);
    }
  }

  // Scale factor
  const s  = size / 512;

  // Grass blades (filled trapezoids)
  function blade(tipX, tipY, baseX, baseW, col) {
    const tx = tipX * s, ty = tipY * s;
    const bx = baseX * s, by = (tipY + 145) * s, bw = baseW * s;
    for (let y = Math.floor(ty); y <= Math.ceil(by); y++) {
      const t = (y - ty) / (by - ty);
      const w = bw * t;
      const cx2 = bx + (tx - bx) * (1 - t);
      for (let x = Math.floor(cx2 - w / 2); x <= Math.ceil(cx2 + w / 2); x++) {
        set(x, y, col);
      }
    }
  }

  blade(172, 185, 155, 28, LT); // left blade
  blade(256, 148, 240, 34, WHT); // centre blade (white)
  blade(336, 178, 320, 28, LT); // right blade

  // Ground bar
  const gY = Math.floor(330 * s), gH = Math.ceil(22 * s);
  const gX1 = Math.floor(118 * s), gX2 = Math.ceil(394 * s);
  for (let y = gY; y < gY + gH; y++) {
    for (let x = gX1; x <= gX2; x++) {
      set(x, y, MID);
    }
  }

  // "crew" wordmark — simple pixel-font approximation at 72px equivalent
  // At 512px: y ≈ 440, font 72px → each char ~40px wide, 52px tall
  // Rendered as filled rectangles per letter (block font)
  const fy = Math.floor(388 * s), fh = Math.ceil(52 * s);
  const fw = Math.ceil(42 * s), sp = Math.ceil(8 * s);
  const word = [0, 1, 2, 3]; // c, r, e, w
  const totalW = word.length * fw + (word.length - 1) * sp;
  const startX = Math.floor(cx - totalW / 2);

  function fillLetter(lx, segments) {
    // segments: array of [relX, relY, relW, relH] in 0..1 units of fw x fh
    for (const [rx, ry, rw, rh] of segments) {
      for (let y = fy + Math.floor(ry * fh); y < fy + Math.ceil((ry + rh) * fh); y++) {
        for (let x = lx + Math.floor(rx * fw); x < lx + Math.ceil((rx + rw) * fw); x++) {
          set(x, y, WHT);
        }
      }
    }
  }

  const letters = [
    // c — open on right
    [[0, 0, 1, 0.15], [0, 0, 0.2, 1], [0, 0.85, 1, 0.15]],
    // r — vertical + top arm
    [[0, 0, 0.2, 1], [0, 0, 1, 0.15], [0, 0.35, 0.65, 0.15], [0.5, 0.35, 0.2, 0.65]],
    // e — three horizontals + left side
    [[0, 0, 1, 0.15], [0, 0, 0.2, 1], [0, 0.425, 0.8, 0.15], [0, 0.85, 1, 0.15]],
    // w — two V shapes (simplified as 5 verticals)
    [[0, 0, 0.12, 1], [0.22, 0.3, 0.12, 0.7], [0.44, 0, 0.12, 1], [0.66, 0.3, 0.12, 0.7], [0.88, 0, 0.12, 1]],
  ];

  letters.forEach((segs, i) => {
    fillLetter(startX + i * (fw + sp), segs);
  });

  return pixels;
}

function writePNG(pixels, size, outPath) {
  // RGBA PNG (color type 6)
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  function u32(n) { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0); return b; }

  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })();

  function crc(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return ((c ^ 0xffffffff) >>> 0);
  }

  function chunk(type, data) {
    const tb = Buffer.from(type, 'ascii');
    return Buffer.concat([u32(data.length), tb, data, u32(crc(Buffer.concat([tb, data])))]);
  }

  // IHDR: width height bitDepth colorType compress filter interlace
  const ihdr = chunk('IHDR', Buffer.concat([u32(size), u32(size), Buffer.from([8, 6, 0, 0, 0])]));

  // Raw image: filter-byte 0x00 per row + RGBA pixels
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 4)] = 0; // None filter
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4;
      const dst = y * (1 + size * 4) + 1 + x * 4;
      raw[dst]     = pixels[src];
      raw[dst + 1] = pixels[src + 1];
      raw[dst + 2] = pixels[src + 2];
      raw[dst + 3] = pixels[src + 3];
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  const idat = chunk('IDAT', compressed);
  const iend = chunk('IEND', Buffer.alloc(0));

  fs.writeFileSync(outPath, Buffer.concat([sig, ihdr, idat, iend]));
  console.log(`wrote ${outPath} (${fs.statSync(outPath).size} bytes)`);
}

writePNG(renderIcon(192), 192, 'icons/icon-192.png');
writePNG(renderIcon(512), 512, 'icons/icon-512.png');
console.log('Done.');
