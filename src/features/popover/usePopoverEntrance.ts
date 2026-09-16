import { useEffect, useRef } from "react";
import { onPopoverShown } from "@/lib/events";
import { onPopoverEntrance, prefersReducedMotion } from "@/lib/motion";

const SETTLE = {
  duration: 220,
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
} satisfies KeyframeAnimationOptions;

export function usePopoverEntrance<T extends HTMLElement>() {
  const shell = useRef<T>(null);

  useEffect(() => {
    const play = () => {
      const element = shell.current;
      if (!element || prefersReducedMotion()) return;

      element.animate(
        [
          {
            opacity: 0,
            transform: "translateY(-7px) scale(0.985)",
            filter: "blur(5px)",
          },
          { opacity: 1, transform: "none", filter: "blur(0px)" },
        ],
        SETTLE,
      );
    };

    const stopListening = onPopoverEntrance(play);
    const firstPaint = window.requestAnimationFrame(play);
    let stopWatching: (() => void) | undefined;
    void onPopoverShown(play).then((unlisten) => {
      stopWatching = unlisten;
    });

    return () => {
      stopListening();
      stopWatching?.();
      window.cancelAnimationFrame(firstPaint);
    };
  }, []);

  return shell;
}
