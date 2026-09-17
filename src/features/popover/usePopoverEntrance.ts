import { useEffect, useRef } from "react";
import {
  onPopoverClosing,
  onPopoverPrepare,
  onPopoverShown,
} from "@/lib/events";
import { onPopoverEntrance, prefersReducedMotion } from "@/lib/motion";
import { isTauri } from "@/lib/tauri";

const FRAME: Keyframe = {
  opacity: 0,
  transform: "translateY(-6px) scale(0.985)",
};

const VISIBLE: Keyframe = { opacity: 1, transform: "none" };

const ENTER: KeyframeAnimationOptions = {
  duration: 160,
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
};

const EXIT: KeyframeAnimationOptions = {
  duration: 120,
  easing: "cubic-bezier(0.4, 0, 1, 1)",
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

      const animation = element.animate([FRAME, VISIBLE], ENTER);
      animation.addEventListener("finish", unframe);
      animation.addEventListener("cancel", unframe);
    };

    const leave = () => {
      frame();

      if (!prefersReducedMotion()) {
        element.animate([VISIBLE, FRAME], EXIT);
      }
    };

    if (!isTauri()) {
      unframe();
      return;
    }

    frame();

    const stopEntrance = onPopoverEntrance(enter);
    const subscriptions = [
      onPopoverPrepare(frame),
      onPopoverShown(enter),
      onPopoverClosing(leave),
    ];

    return () => {
      stopEntrance();
      for (const subscription of subscriptions) {
        void subscription.then((unlisten) => unlisten());
      }
    };
  }, []);

  return shell;
}
