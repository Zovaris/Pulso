import { useEffect } from "react";
import { setReducedMotion } from "@/lib/tauri";

export function useMotionSync() {
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const report = () => void setReducedMotion(query.matches);

    report();
    query.addEventListener("change", report);

    return () => query.removeEventListener("change", report);
  }, []);
}
