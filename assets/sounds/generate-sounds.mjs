import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RATE = 44_100;

/**
 * One struck note: a soft attack, then an exponential fade. `partials` are
 * [multiple of the pitch, level], which is what gives each sound its timbre.
 */
function note(frequency, at, { decay, partials, level }) {
  return { frequency, at, decay, partials, level };
}

/**
 * Pulso's own cues, kept short and quiet so they inform without startling.
 * `done` rises a fourth, like something settling into place; `failed` falls
 * a minor third, lower and rounder, so the two are told apart without looking.
 */
const SOUNDS = {
  done: {
    length: 0.62,
    peak: 0.32,
    notes: [
      note(1318.5, 0, {
        decay: 0.16,
        level: 0.8,
        partials: [
          [1, 1],
          [2, 0.22],
          [3, 0.06],
        ],
      }),
      note(1760, 0.085, {
        decay: 0.2,
        level: 1,
        partials: [
          [1, 1],
          [2, 0.22],
          [3, 0.06],
        ],
      }),
    ],
  },
  failed: {
    length: 0.7,
    peak: 0.38,
    notes: [
      note(587.3, 0, {
        decay: 0.18,
        level: 1,
        partials: [
          [1, 1],
          [3, 0.12],
          [5, 0.03],
        ],
      }),
      note(493.9, 0.11, {
        decay: 0.24,
        level: 0.95,
        partials: [
          [1, 1],
          [3, 0.12],
          [5, 0.03],
        ],
      }),
    ],
  },
};

const ATTACK = 0.004;

function render({ length, peak, notes }) {
  const samples = new Float64Array(Math.round(length * RATE));
  for (const { frequency, at, decay, partials, level } of notes) {
    const start = Math.round(at * RATE);
    for (let i = start; i < samples.length; i++) {
      const t = (i - start) / RATE;
      const envelope = Math.min(1, t / ATTACK) * Math.exp(-t / decay);
      let value = 0;
      for (const [multiple, amount] of partials)
        value += amount * Math.sin(2 * Math.PI * frequency * multiple * t);
      samples[i] += level * envelope * value;
    }
  }

  const fade = Math.round(0.03 * RATE);
  for (let i = 0; i < fade; i++) samples[samples.length - 1 - i] *= i / fade;

  const loudest = samples.reduce(
    (max, value) => Math.max(max, Math.abs(value)),
    0,
  );
  return samples.map((value) => (value / loudest) * peak);
}

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((value, i) =>
    data.writeInt16LE(
      Math.round(Math.max(-1, Math.min(1, value)) * 32_767),
      i * 2,
    ),
  );
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const out = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../src-tauri/sounds",
);
mkdirSync(out, { recursive: true });
for (const [name, sound] of Object.entries(SOUNDS)) {
  writeFileSync(join(out, `${name}.wav`), wav(render(sound)));
  console.log(`wrote ${join(out, `${name}.wav`)}`);
}
