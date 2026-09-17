import { useEffect, useRef } from "react";
import {
  onPopoverClosing,
  onPopoverPrepare,
  onPopoverShown,
} from "@/lib/events";
import { onPopoverEntrance, prefersReducedMotion } from "@/lib/motion";
import { isTauri } from "@/lib/tauri";

const PANEL_FRAME: Keyframe = { opacity: 0 };

const PANEL_VISIBLE: Keyframe = { opacity: 1 };

const CONTENT_FRAME: Keyframe = {
  transform: "translateY(-6px) scale(0.985)",
};

const CONTENT_VISIBLE: Keyframe = { transform: "none" };

const ENTER: KeyframeAnimationOptions = {
  duration: 160,
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
};

const EXIT: KeyframeAnimationOptions = {
  duration: 120,
  easing: "cubic-bezier(0.4, 0, 1, 1)",
};

export function usePopoverEntrance<
  TPanel extends HTMLElement,
  TContent extends HTMLElement,
>() {
  const shell = useRef<TPanel>(null);
  const content = useRef<TContent>(null);

  useEffect(() => {
    const panel = shell.current;
    const inner = content.current;
    if (!panel) return;

    const frame = () => {
      panel.dataset.frame = "true";
      if (inner) inner.dataset.frame = "true";
    };

    const unframe = () => {
      panel.dataset.frame = "false";
      if (inner) inner.dataset.frame = "false";
    };

    const enter = () => {
      if (prefersReducedMotion()) {
        unframe();
        return;
      }

      const animation = panel.animate([PANEL_FRAME, PANEL_VISIBLE], ENTER);
      inner?.animate([CONTENT_FRAME, CONTENT_VISIBLE], ENTER);
      animation.addEventListener("finish", unframe);
      animation.addEventListener("cancel", unframe);
    };

    const leave = () => {
      frame();

      if (!prefersReducedMotion()) {
        panel.animate([PANEL_VISIBLE, PANEL_FRAME], EXIT);
        inner?.animate([CONTENT_VISIBLE, CONTENT_FRAME], EXIT);
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

  return { shell, content };
}
