import { useEffect, useRef } from "react";
import { onPopoverPrepare, onPopoverShown } from "@/lib/events";
import { onPopoverEntrance, prefersReducedMotion } from "@/lib/motion";
import { isTauri } from "@/lib/tauri";

const HIDDEN: Keyframe = { opacity: 0 };

const VISIBLE: Keyframe = { opacity: 1 };

const FADE: KeyframeAnimationOptions = {
  duration: 100,
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
};

export function usePopoverEntrance<T extends HTMLElement>() {
  const shell = useRef<T>(null);

  useEffect(() => {
    const element = shell.current;
    if (!element) return;

    const frame = () => {
      element.dataset.frame = "true";
    };

    const unframe = () => {
      element.dataset.frame = "false";
    };

    const enter = () => {
      if (prefersReducedMotion()) {
        unframe();
        return;
      }

      const animation = element.animate([HIDDEN, VISIBLE], FADE);
      animation.addEventListener("finish", unframe);
      animation.addEventListener("cancel", unframe);
    };

    if (!isTauri()) {
      unframe();
      return;
    }

    frame();

    const stopEntrance = onPopoverEntrance(enter);
    const subscriptions = [onPopoverPrepare(frame), onPopoverShown(enter)];

    return () => {
      stopEntrance();
      for (const subscription of subscriptions) {
        void subscription.then((unlisten) => unlisten());
      }
    };
  }, []);

  return shell;
}
