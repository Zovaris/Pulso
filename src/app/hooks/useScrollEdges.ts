import { useEffect, useRef, useState } from "react";

export type ScrollEdges = "none" | "top" | "bottom" | "both";

export function useScrollEdges<T extends HTMLElement>() {
  const box = useRef<T>(null);
  const [edges, setEdges] = useState<ScrollEdges>("none");

  useEffect(() => {
    const element = box.current;
    if (!element) return;

    const size = new ResizeObserver(() => sync());

    const sync = () => {
      const frame = element.getBoundingClientRect();
      const last = element.lastElementChild;
      const above = element.scrollTop > 1;
      const below = last
        ? last.getBoundingClientRect().bottom - frame.bottom > 1
        : false;

      setEdges(
        above && below ? "both" : above ? "top" : below ? "bottom" : "none",
      );
    };

    const watch = () => {
      size.disconnect();
      size.observe(element);
      for (const child of element.children) size.observe(child);
      sync();
    };

    const content = new MutationObserver(watch);
    content.observe(element, { childList: true });
    watch();
    element.addEventListener("scroll", sync, { passive: true });

    return () => {
      size.disconnect();
      content.disconnect();
      element.removeEventListener("scroll", sync);
    };
  }, []);

  return { box, edges };
}
