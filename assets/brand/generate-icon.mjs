import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const SIZE = 1024;
const BG = "#111111";
const ACCENT = "#D71921";
const ACCENT_LIGHT = "#E23B42";

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

function boundsOf(pts) {
  return [
    Math.min(...pts.map((p) => p[0])),
    Math.max(...pts.map((p) => p[0])),
    Math.min(...pts.map((p) => p[1])),
    Math.max(...pts.map((p) => p[1])),
  ];
}

function fitGroup(groups, size, padRatio) {
  const all = groups.flat();
  const [minX, maxX, minY, maxY] = boundsOf(all);
  const pad = size * padRatio;
  const s = Math.min(
    (size - pad * 2) / (maxX - minX),
    (size - pad * 2) / (maxY - minY),
  );
  const ox = (size - (maxX - minX) * s) / 2 - minX * s;
  const oy = (size - (maxY - minY) * s) / 2 - minY * s;
  return groups.map((pts) => pts.map(([x, y]) => [x * s + ox, y * s + oy]));
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1]];
}
function add(a, b) {
  return [a[0] + b[0], a[1] + b[1]];
}
function mul(v, s) {
  return [v[0] * s, v[1] * s];
}
function len(v) {
  return Math.hypot(v[0], v[1]);
}
function norm(v) {
  const l = len(v) || 1;
  return [v[0] / l, v[1] / l];
}

function roundPoly(pts, r) {
  const n = pts.length;
  let d = "";
  for (let i = 0; i < n; i++) {
    const prev = pts[(i + n - 1) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];
    const v1 = sub(curr, prev);
    const v2 = sub(next, curr);
    const r1 = Math.min(r, len(v1) * 0.48);
    const r2 = Math.min(r, len(v2) * 0.48);
    const p1 = add(curr, mul(norm(v1), -r1));
    const p2 = add(curr, mul(norm(v2), r2));
    if (i === 0) d += `M ${p1[0].toFixed(2)} ${p1[1].toFixed(2)}`;
    else d += ` L ${p1[0].toFixed(2)} ${p1[1].toFixed(2)}`;
    d += ` Q ${curr[0].toFixed(2)} ${curr[1].toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return `${d} Z`;
}

function pointInPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0];
    const yi = pts[i][1];
    const xj = pts[j][0];
    const yj = pts[j][1];
    const hit =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.00001) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

const left = [
  [40, 500],
  [460, 140],
  [460, 860],
];
const right = [
  [540, 140],
  [960, 500],
  [540, 860],
];

const [iconL, iconR] = fitGroup([left, right], SIZE, 0.2);
const [markL, markR] = fitGroup([left, right], 24, 0.08);
const [tray32L, tray32R] = fitGroup([left, right], 32, 0.1);
const [tray64L, tray64R] = fitGroup([left, right], 64, 0.1);

const iconRRound =
  Math.min(
    boundsOf(iconL)[1] - boundsOf(iconL)[0],
    boundsOf(iconL)[3] - boundsOf(iconL)[2],
  ) * 0.2;

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
    <path d="${roundPoly(iconL, iconRRound)}" fill="${ACCENT}"/>
    <path d="${roundPoly(iconR, iconRRound)}" fill="${ACCENT_LIGHT}"/>
  </g>
</svg>
`;

const markSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" role="img">
  <title>Soffy</title>
  <path fill="${ACCENT}" d="${roundPoly(markL, 2.4)}"/>
  <path fill="${ACCENT_LIGHT}" d="${roundPoly(markR, 2.4)}"/>
</svg>
`;

const traySvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
  <path fill="#000000" d="${roundPoly(tray32L, 3.2)}"/>
  <path fill="#000000" d="${roundPoly(tray32R, 3.2)}"/>
</svg>
`;

const dir = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(dir, "soffy-icon.svg"), appSvg);
writeFileSync(join(dir, "soffy-mark.svg"), markSvg);
writeFileSync(join(dir, "soffy-tray.svg"), traySvg);
writeFileSync(join(dir, "soffy-tray.png"), trayPng(64, [tray64L, tray64R]));
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

function trayPng(size, polys) {
  const pixels = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    pixels[row] = 0;
    for (let x = 0; x < size; x++) {
      const i = row + 1 + x * 4;
      const on = polys.some((pts) => pointInPoly(x + 0.5, y + 0.5, pts));
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
