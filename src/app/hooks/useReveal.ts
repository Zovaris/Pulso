import { useEffect, useRef } from "react";
import {
  prefersReducedMotion,
  SETTLE_EASE,
  settleDuration,
} from "@/lib/motion";

export function useReveal<T extends HTMLElement>(open: boolean) {
  const box = useRef<T>(null);

  useEffect(() => {
    const element = box.current;
    if (!element) return;

    const from = element.getBoundingClientRect().height;
    element.dataset.open = String(open);
    const to = element.getBoundingClientRect().height;

    if (from === to || prefersReducedMotion()) return;

    element.animate(
      [
        { height: `${from}px`, opacity: from > 0 ? 1 : 0 },
        { height: `${to}px`, opacity: to > 0 ? 1 : 0 },
      ],
      {
        duration: settleDuration(Math.abs(to - from)),
        easing: SETTLE_EASE,
      },
    );
  }, [open]);

  return box;
}
