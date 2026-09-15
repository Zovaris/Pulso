import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const SIZE = 1024;
const BG = "#111111";
const ACCENT = "#D71921";
const S_D =
  "M 680 300 C 680 220 600 190 512 190 C 390 190 330 250 330 320 C 330 400 420 430 512 460 C 640 500 710 560 710 660 C 710 770 620 830 512 830 C 390 830 320 760 320 690";

function squirclePath(size, n = 5, samples = 128) {
  const a = size / 2;
  const b = size / 2;
  const cx = size / 2;
  const cy = size / 2;
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const x = cx + a * Math.sign(c) * Math.abs(c) ** (2 / n);
    const y = cy + b * Math.sign(s) * Math.abs(s) ** (2 / n);
    pts.push([x, y]);
  }
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i][0].toFixed(2)} ${pts[i][1].toFixed(2)}`;
  }
  return `${d} Z`;
}

const maskPath = squirclePath(SIZE, 5);

const appSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" fill="none">
  <defs>
    <clipPath id="plate">
      <path d="${maskPath}"/>
    </clipPath>
  </defs>
  <g clip-path="url(#plate)">
    <rect width="${SIZE}" height="${SIZE}" fill="${BG}"/>
    <circle cx="512" cy="512" r="340" fill="${ACCENT}"/>
    <path d="${S_D}" stroke="#F6F6F6" stroke-width="92" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>
`;

const markSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" role="img">
  <title>Soffy</title>
  <circle cx="12" cy="12" r="10" fill="${ACCENT}"/>
  <path d="M15.6 8.2c0-1.5-1.4-2.2-3.4-2.2S8.6 7.2 8.6 8.6s1.7 2.2 3.4 2.8 3.8 1.6 3.8 3.6-1.6 3.4-3.8 3.4-4-1.3-4-2.8" stroke="#F6F6F6" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

const traySvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
  <path d="M22 9.2c0-2.1-2-3.1-4.8-3.1S12 7.8 12 9.7s2.4 3.1 4.8 4 5.4 2.3 5.4 5.1-2.3 4.8-5.4 4.8-5.6-1.8-5.6-4" stroke="#000000" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

const dir = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(dir, "soffy-icon.svg"), appSvg);
writeFileSync(join(dir, "soffy-mark.svg"), markSvg);
writeFileSync(join(dir, "soffy-tray.svg"), traySvg);
writeFileSync(join(dir, "soffy-tray.png"), trayPng(64));
console.log(`wrote ${join(dir, "soffy-icon.svg")}`);

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcBuf = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcBuf));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function distToPoly(x, y, pts) {
  let min = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const abx = bx - ax;
    const aby = by - ay;
    const t = Math.max(
      0,
      Math.min(1, ((x - ax) * abx + (y - ay) * aby) / (abx * abx + aby * aby)),
    );
    const dx = x - (ax + abx * t);
    const dy = y - (ay + aby * t);
    min = Math.min(min, Math.hypot(dx, dy));
  }
  return min;
}

function trayPng(size) {
  const pts = [
    [0.7, 0.22],
    [0.52, 0.14],
    [0.34, 0.18],
    [0.3, 0.3],
    [0.38, 0.4],
    [0.55, 0.47],
    [0.7, 0.56],
    [0.72, 0.7],
    [0.62, 0.82],
    [0.42, 0.86],
    [0.28, 0.76],
  ].map(([x, y]) => [x * size, y * size]);
  const thickness = size * 0.09;
  const pixels = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    pixels[row] = 0;
    for (let x = 0; x < size; x++) {
      const i = row + 1 + x * 4;
      const on = distToPoly(x + 0.5, y + 0.5, pts) <= thickness;
      pixels[i] = 0;
      pixels[i + 1] = 0;
      pixels[i + 2] = 0;
      pixels[i + 3] = on ? 255 : 0;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
