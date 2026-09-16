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
