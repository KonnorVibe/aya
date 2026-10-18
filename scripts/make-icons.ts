// Renders the aya app icons as PNGs with no dependencies (rasterised here, encoded with zlib).
// Motif: the aya mark, a braided ring (two strands r = R ± A·sin(6t), alternating over and under),
// in linen on indigo. Deliberately neutral: nothing on the Home Screen hints at a period tracker.
// Run: node scripts/make-icons.ts
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

type RGB = [number, number, number];
const GROUND: RGB = [0x28, 0x3c, 0x8c];
const LINEN: RGB = [0xee, 0xec, 0xe4];
const SS = 4; // supersampling per axis

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size: number, rgb: Uint8Array): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // truecolour RGB
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    Buffer.from(rgb.buffer, y * size * 3, size * 3).copy(raw, y * (size * 3 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Braid geometry in unit coordinates, matching src/ui/graphics/braid.ts at 0.68 of the icon.
const RADIUS = 0.204;
const AMPLITUDE = 0.042;
const WAVES = 6;
const HALF_STROKE = 0.0143;
const GAP = 0.1;

function isUnder(s: number, t: number): boolean {
  for (let j = 0; j < 2 * WAVES; j++) {
    if (j % 2 !== (s === 0 ? 1 : 0)) continue;
    const u = (Math.PI * j) / WAVES;
    const d = Math.min(Math.abs(t - u), 2 * Math.PI - Math.abs(t - u));
    if (d < GAP) return true;
  }
  return false;
}

/** Colour at a point in unit coordinates (0..1), content scaled by `scale` around the centre. */
function shade(u: number, v: number, scale: number): RGB {
  const x = (u - 0.5) / scale;
  const y = (v - 0.5) / scale;
  const rho = Math.hypot(x, y);
  // Only the ring band can hold a strand; near the centre the slope correction breaks down.
  if (Math.abs(rho - RADIUS) > AMPLITUDE + 3 * HALF_STROKE) return GROUND;
  let t = Math.atan2(x, -y); // 0 at 12 o'clock, clockwise
  if (t < 0) t += 2 * Math.PI;
  for (let s = 0; s < 2; s++) {
    const sign = s === 0 ? 1 : -1;
    const r = RADIUS + sign * AMPLITUDE * Math.sin(WAVES * t);
    const dr = sign * AMPLITUDE * WAVES * Math.cos(WAVES * t);
    // Distance to the polar curve, corrected for its slope.
    const d = Math.abs(rho - r) / Math.sqrt(1 + (dr / rho) ** 2);
    if (d < HALF_STROKE && !isUnder(s, t)) return LINEN;
  }
  return GROUND;
}

function render(size: number, scale: number): Uint8Array {
  const out = new Uint8Array(size * size * 3);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = shade((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size, scale);
          acc[0]! += c[0];
          acc[1]! += c[1];
          acc[2]! += c[2];
        }
      }
      const o = (py * size + px) * 3;
      for (let k = 0; k < 3; k++) out[o + k] = Math.round(acc[k]! / (SS * SS));
    }
  }
  return out;
}

const targets: [string, number, number][] = [
  ['public/icon-192.png', 192, 1],
  ['public/icon-512.png', 512, 1],
  ['public/icon-maskable-512.png', 512, 0.8], // keeps the motif inside the maskable safe zone
  ['public/apple-touch-icon.png', 180, 1],
  ['public/favicon-32.png', 32, 1.3],
];
for (const [path, size, scale] of targets) {
  writeFileSync(path, png(size, render(size, scale)));
  console.log(`wrote ${path}`);
}
