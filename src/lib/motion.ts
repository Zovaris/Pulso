export const SETTLE_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

export const REVEAL_DURATION = 180;
export const REVEAL_EASE = SETTLE_EASE;

const REVEAL_SPEED = 0.6;
const REVEAL_MIN = 140;
const REVEAL_MAX = 320;

export function settleDuration(distance: number): number {
  return Math.round(
    Math.min(REVEAL_MAX, Math.max(REVEAL_MIN, distance / REVEAL_SPEED)),
  );
}

type Listener = () => void;

const listeners = new Set<Listener>();

export function onPopoverEntrance(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function playPopoverEntrance(): void {
  for (const listener of listeners) listener();
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
