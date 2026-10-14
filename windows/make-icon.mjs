/**
 * Generates windows/pos.ico - a 32x32 Windows icon (dark rounded square + cyan
 * droplet) so the desktop shortcut has a proper icon instead of a .bat glyph.
 *
 * Run once:  node windows/make-icon.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pos.ico');

const W = 32;
const H = 32;
const BG = [26, 27, 38]; // #1a1b26
const DROP = [125, 207, 255]; // #7dcfff

function inRoundedRect(x, y, radius) {
  const minX = radius;
  const maxX = W - 1 - radius;
  const minY = radius;
  const maxY = H - 1 - radius;
  const cx = Math.min(Math.max(x, minX), maxX);
  const cy = Math.min(Math.max(y, minY), maxY);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function inDroplet(x, y) {
  const cx = 15.5;
  const cy = 19;
  const r = 7;
  const apexY = 4.5;

  const dx = x - cx;
  const dy = y - cy;
  if (dx * dx + dy * dy <= r * r) return true;

  if (y >= apexY && y <= cy) {
    const t = (y - apexY) / (cy - apexY);
    if (Math.abs(dx) <= t * r) return true;
  }
  return false;
}

// Top-down RGBA first, then flipped to bottom-up BGRA for the ICO.
const pixels = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y += 1) {
  for (let x = 0; x < W; x += 1) {
    const i = (y * W + x) * 4;
    if (inDroplet(x, y)) {
      pixels[i] = DROP[0];
      pixels[i + 1] = DROP[1];
      pixels[i + 2] = DROP[2];
      pixels[i + 3] = 255;
    } else if (inRoundedRect(x, y, 7)) {
      pixels[i] = BG[0];
      pixels[i + 1] = BG[1];
      pixels[i + 2] = BG[2];
      pixels[i + 3] = 255;
    }
  }
}

const xor = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y += 1) {
  const src = (H - 1 - y) * W * 4;
  pixels.copy(xor, y * W * 4, src, src + W * 4);
}
for (let i = 0; i < xor.length; i += 4) {
  const r = xor[i];
  const g = xor[i + 1];
  const b = xor[i + 2];
  const a = xor[i + 3];
  xor[i] = b;
  xor[i + 1] = g;
  xor[i + 2] = r;
  xor[i + 3] = a;
}

const AND_MASK = Buffer.alloc((W * H) / 8); // all zero = fully opaque

const header = Buffer.alloc(40);
header.writeUInt32LE(40, 0); // biSize
header.writeInt32LE(W, 4); // biWidth
header.writeInt32LE(H * 2, 8); // biHeight (XOR + AND)
header.writeUInt16LE(1, 12); // biPlanes
header.writeUInt16LE(32, 14); // biBitCount
header.writeUInt32LE(0, 16); // biCompression
header.writeUInt32LE(xor.length, 20); // biSizeImage

const image = Buffer.concat([header, xor, AND_MASK]);

const dir = Buffer.alloc(6);
dir.writeUInt16LE(0, 0);
dir.writeUInt16LE(1, 2); // ICO
dir.writeUInt16LE(1, 4); // one image

const entry = Buffer.alloc(16);
entry.writeUInt8(W, 0);
entry.writeUInt8(H, 1);
entry.writeUInt8(0, 2);
entry.writeUInt8(0, 3);
entry.writeUInt16LE(1, 4);
entry.writeUInt16LE(32, 6);
entry.writeUInt32LE(image.length, 8);
entry.writeUInt32LE(6 + 16, 12);

fs.writeFileSync(OUT, Buffer.concat([dir, entry, image]));
console.log(`wrote ${OUT} (${6 + 16 + image.length} bytes)`);
