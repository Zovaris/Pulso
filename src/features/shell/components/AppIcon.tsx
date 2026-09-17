import { useStore } from "@/app/store";

/** Up to two letters, which is all a 16-point chip can carry honestly. */
export function initials(name: string): string {
  const words = name
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((word) => word !== "");

  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

/**
 * The icon the system draws for the app the user has installed. The fallback is
 * only there while the icon is being fetched, or if AppKit had nothing to give.
 */
export function AppIcon({ id, name }: { id: string; name: string }) {
  const icon = useStore((state) => state.icons[id]);

  if (icon) {
    return <img src={icon} alt="" className="pulso-app" draggable={false} />;
  }

  return (
    <span className="pulso-app-fallback" aria-hidden="true">
      {initials(name)}
    </span>
  );
}
