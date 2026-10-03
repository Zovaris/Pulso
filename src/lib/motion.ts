import { flushSync } from "react-dom";

export const SETTLE_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

export const REVEAL_DURATION = 180;
export const REVEAL_EASE = SETTLE_EASE;

/**
 * Runs a view change as a View Transition where the webview supports one and
 * the user has not asked for less motion. The update is flushed synchronously
 * so the browser captures the new view, not the old one twice.
 */
export function transitionView(update: () => void) {
  const reduce = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (
    reduce ||
    document.hidden ||
    typeof document.startViewTransition !== "function"
  ) {
    update();
    return;
  }
  const transition = document.startViewTransition(() => flushSync(update));
  transition.ready.catch(() => undefined);
  transition.finished.catch(() => undefined);
}
