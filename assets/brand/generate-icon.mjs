import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const SIZE = 1024;
const BG = "#111111";
const ACCENT = "#D71921";

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

function sMarkPath(size) {
  const u = size / 1024;
  const p = (xs) =>
    `${xs
      .map(
        ([x, y], i) =>
          `${i === 0 ? "M" : "L"} ${(x * u).toFixed(2)} ${(y * u).toFixed(2)}`,
      )
      .join(" ")} Z`;
  const upper = p([
    [290, 188],
    [790, 188],
    [638, 428],
    [138, 428],
  ]);
  const lower = p([
    [386, 596],
    [886, 596],
    [734, 836],
    [234, 836],
  ]);
  return `${upper} ${lower}`;
}

const maskPath = squirclePath(SIZE, 5);
const mark = sMarkPath(SIZE);

const appSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" fill="none">
  <defs>
    <clipPath id="plate">
      <path d="${maskPath}"/>
    </clipPath>
  </defs>
  <g clip-path="url(#plate)">
    <rect width="${SIZE}" height="${SIZE}" fill="${BG}"/>
    <path d="${mark}" fill="${ACCENT}"/>
  </g>
</svg>
`;

const markSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" role="img">
  <title>Soffy</title>
  <path fill="${ACCENT}" d="M6.8 4.4h11.7L14.9 10H3.2L6.8 4.4zm2.2 9.6h11.7L16.9 19.6H5.2L9 14z"/>
</svg>
`;

const traySvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
  <path fill="#000000" d="M9 6h15.6L19.9 14.8H4.2L9 6zm3 12h15.6L22.9 26.8H7.2L12 18z"/>
</svg>
`;

const dir = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(dir, "soffy-icon.svg"), appSvg);
writeFileSync(join(dir, "soffy-mark.svg"), markSvg);
writeFileSync(join(dir, "soffy-tray.svg"), traySvg);
writeFileSync(join(dir, "soffy-tray.png"), trayPng(32));
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

function trayPng(size) {
  const pixels = Buffer.alloc(size * (size * 4 + 1));
  const inS = (x, y) => {
    const nx = x / size;
    const ny = y / size;
    const inUpper =
      ny >= 0.18 &&
      ny <= 0.42 &&
      nx >= 0.12 + (0.42 - ny) * 0.3 &&
      nx <= 0.78 - (ny - 0.18) * 0.75;
    const inLower =
      ny >= 0.58 &&
      ny <= 0.82 &&
      nx >= 0.22 + (0.82 - ny) * 0.3 &&
      nx <= 0.88 - (ny - 0.58) * 0.75;
    return inUpper || inLower;
  };
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    pixels[row] = 0;
    for (let x = 0; x < size; x++) {
      const i = row + 1 + x * 4;
      const on = inS(x + 0.5, y + 0.5);
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
