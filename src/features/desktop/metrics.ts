/** How many two-second readings a sparkline keeps: two minutes of history. */
export const HISTORY = 60;

const KILOBYTE = 1024;
const MEGABYTE = KILOBYTE * 1024;
const GIGABYTE = MEGABYTE * 1024;

/** Percent of one core, so a busy group can read above 100 and we say so. */
export function formatCpu(cpu: number): string {
  if (!Number.isFinite(cpu) || cpu < 0) return "—";
  if (cpu < 0.05) return "0%";
  if (cpu < 10) return `${cpu.toFixed(1)}%`;

  return `${Math.round(cpu)}%`;
}

export function formatMemory(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  if (bytes >= GIGABYTE) return `${(bytes / GIGABYTE).toFixed(1)} GB`;
  if (bytes >= 100 * MEGABYTE) return `${Math.round(bytes / MEGABYTE)} MB`;
  if (bytes >= MEGABYTE) return `${(bytes / MEGABYTE).toFixed(1)} MB`;

  return `${Math.max(1, Math.round(bytes / KILOBYTE))} KB`;
}

/** Memory in bytes as a 0…1 share of a gigabyte, which is what the bar draws. */
export function memoryRatio(bytes: number, ceiling = GIGABYTE): number {
  if (!Number.isFinite(bytes) || bytes <= 0) return 0;

  return Math.min(1, bytes / ceiling);
}

export function pushSample(
  history: number[],
  value: number,
  limit = HISTORY,
): number[] {
  const next = [...history, value];

  return next.length > limit ? next.slice(-limit) : next;
}

/**
 * A polyline for a sparkline, normalised between the lowest and highest reading.
 * A flat series draws down the middle rather than collapsing onto the floor.
 */
export function sparkline(values: number[], width = 100, height = 22): string {
  if (values.length < 2) return "";

  const lowest = Math.min(...values);
  const highest = Math.max(...values);
  const span = highest - lowest;
  const step = width / (values.length - 1);

  return values
    .map((value, index) => {
      const share = span === 0 ? 0.5 : (value - lowest) / span;

      return `${(index * step).toFixed(1)},${(height - share * height).toFixed(1)}`;
    })
    .join(" ");
}

export function totalMemory(samples: { memory: number }[]): number {
  return samples.reduce((total, sample) => total + sample.memory, 0);
}

export function totalCpu(samples: { cpu: number }[]): number {
  return samples.reduce((total, sample) => total + sample.cpu, 0);
}
