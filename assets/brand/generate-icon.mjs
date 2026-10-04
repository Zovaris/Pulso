import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const SIZE = 1024;
const PLATE = "#141a16";
const LIVE = "#6fa77b";

/**
 * The live dot: a solid core with the rings it sends out. Every length is in
 * a 100-unit box centred on 50, so one shape scales to every size.
 */
const APP_SHAPE = {
  dot: 11,
  rings: [
    { radius: 22, width: 5, alpha: 0.55 },
    { radius: 33, width: 5, alpha: 0.25 },
  ],
};

/** The menu bar keeps one ring, thicker, so it holds at 18 points. */
const TRAY_SHAPE = {
  dot: 17,
  rings: [{ radius: 38, width: 12, alpha: 1 }],
};

/** 18 points at 2x, the height macOS gives a menu bar item. */
const TRAY_PX = 36;

/**
 * The dot that sits on the menu bar icon while a failure waits to be seen.
 * It is drawn in the system red rather than tinted, so it reads on any bar.
 */
const ATTENTION_SHAPE = { dot: 46, rings: [] };
const ATTENTION_PX = 14;
const ATTENTION_INK = [0xff, 0x3b, 0x30];

function squirclePath(size, n = 5, samples = 128) {
  const half = size / 2;
  const points = [];
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    points.push([
      half + half * Math.sign(c) * Math.abs(c) ** (2 / n),
      half + half * Math.sign(s) * Math.abs(s) ** (2 / n),
    ]);
  }
  return `${points
    .map(([x, y], i) => `${i ? "L" : "M"} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ")} Z`;
}

/** Draws the shape centred in a box of `size`, `reach` units from centre to edge. */
function shapeSvg(shape, size, color, reach = 50, indent = "  ") {
  const scale = size / 2 / reach;
  const at = (value) => (value * scale).toFixed(2);
  const centre = (size / 2).toFixed(2);
  const rings = shape.rings
    .map(
      (ring) =>
        `<circle cx="${centre}" cy="${centre}" r="${at(ring.radius)}" stroke="${color}" stroke-width="${at(ring.width)}"${ring.alpha < 1 ? ` stroke-opacity="${ring.alpha}"` : ""}/>`,
    )
    .join(`\n${indent}`);
  return `${rings}\n${indent}<circle cx="${centre}" cy="${centre}" r="${at(shape.dot)}" fill="${color}"/>`;
}

/** How far the outermost ring reaches, so a small mark can fill its box. */
function reachOf(shape) {
  return Math.max(
    shape.dot,
    ...shape.rings.map((ring) => ring.radius + ring.width / 2),
  );
}

/**
 * The plate runs to the edge on purpose: macOS 26 and later clip an opaque
 * icon to their own shape, and frame one with see-through edges in grey.
 */
function appSvg(clip) {
  const indent = clip ? "    " : "  ";
  const plate = `<rect width="${SIZE}" height="${SIZE}" fill="${PLATE}"/>
${indent}<rect width="${SIZE}" height="${SIZE}" fill="url(#glow)"/>
${indent}${shapeSvg(APP_SHAPE, SIZE, LIVE, 50, indent)}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" fill="none">
  <defs>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.42">
      <stop offset="0" stop-color="${LIVE}" stop-opacity="0.16"/>
      <stop offset="1" stop-color="${LIVE}" stop-opacity="0"/>
    </radialGradient>${
      clip
        ? `
    <clipPath id="plate">
      <path d="${squirclePath(SIZE)}"/>
    </clipPath>`
        : ""
    }
  </defs>
  ${clip ? `<g clip-path="url(#plate)">\n    ${plate}\n  </g>` : plate}
</svg>
`;
}

const markSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" role="img">
  <title>Pulso</title>
  ${shapeSvg(APP_SHAPE, 24, LIVE, reachOf(APP_SHAPE) + 1)}
</svg>
`;

const traySvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${TRAY_PX}" height="${TRAY_PX}" viewBox="0 0 ${TRAY_PX} ${TRAY_PX}" fill="none">
  ${shapeSvg(TRAY_SHAPE, TRAY_PX, "#000000")}
</svg>
`;

/** How much of a pixel the shape covers, from a 5×5 grid of samples. */
function coverage(shape, size, x, y) {
  const SAMPLES = 5;
  const unit = 100 / size;
  let total = 0;
  for (let sy = 0; sy < SAMPLES; sy++) {
    for (let sx = 0; sx < SAMPLES; sx++) {
      const px = (x + (sx + 0.5) / SAMPLES) * unit - 50;
      const py = (y + (sy + 0.5) / SAMPLES) * unit - 50;
      const distance = Math.hypot(px, py);
      let alpha = distance <= shape.dot ? 1 : 0;
      for (const ring of shape.rings) {
        if (Math.abs(distance - ring.radius) <= ring.width / 2)
          alpha = Math.max(alpha, ring.alpha);
      }
      total += alpha;
    }
  }
  return total / (SAMPLES * SAMPLES);
}

function crc32(buffer) {
  let c = ~0;
  for (const byte of buffer) {
    c ^= byte;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

/**
 * A PNG of the shape in one ink. Black on clear is a template image, which
 * macOS tints for a light or dark menu bar; any other ink stays as drawn.
 */
function shapePng(shape, size, ink = [0, 0, 0]) {
  const stride = size * 4 + 1;
  const pixels = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const at = y * stride + 1 + x * 4;
      pixels.set(ink, at);
      pixels[at + 3] = Math.round(coverage(shape, size, x, y) * 255);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const dir = dirname(fileURLToPath(import.meta.url));
const files = {
  "pulso-icon.svg": appSvg(false),
  "pulso-icon-rounded.svg": appSvg(true),
  "pulso-mark.svg": markSvg,
  "pulso-tray.svg": traySvg,
  "pulso-tray.png": shapePng(TRAY_SHAPE, TRAY_PX),
  "pulso-attention.png": shapePng(ATTENTION_SHAPE, ATTENTION_PX, ATTENTION_INK),
};
for (const [name, body] of Object.entries(files)) {
  writeFileSync(join(dir, name), body);
  console.log(`wrote ${join(dir, name)}`);
}
