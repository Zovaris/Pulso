import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/motion";

export function useIntoView<T extends HTMLElement>(focused: boolean) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!focused) return;

    ref.current?.scrollIntoView({
      block: "nearest",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, [focused]);

  return ref;
}
