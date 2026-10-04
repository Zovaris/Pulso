import { type OrbState, ThinkingOrb } from "thinking-orbs";
import { useEffect, useState } from "react";

/** Inline in a 36px row the stock dots read faint, so they get heavier there. */
const INLINE_DOTS = 1.4;

/** The live green of the mark, a shade darker on light backgrounds. */
const INK = { dark: "#6fa77b", light: "#4f7658" } as const;

function useRootTheme(): "dark" | "light" {
  const read = (): "dark" | "light" =>
    document.documentElement.dataset.theme === "light" ? "light" : "dark";
  const [theme, setTheme] = useState(read);

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(read()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return theme;
}

/**
 * Something on its way: a process starting or stopping, a server not yet
 * listening, a project being read. It stands still under Reduce motion and
 * stops drawing while it is off screen or the window is hidden.
 */
export function Orb({
  state,
  size = 20,
  label,
}: {
  state: OrbState;
  size?: 20 | 32 | 64;
  label?: string;
}) {
  const theme = useRootTheme();
  return (
    <span
      className="pulso-orb"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ width: size, height: size }}
    >
      <ThinkingOrb
        state={state}
        size={size}
        theme={theme}
        color={INK[theme]}
        dotSize={size === 20 ? INLINE_DOTS : 1}
      />
    </span>
  );
}
