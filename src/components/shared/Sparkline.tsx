import { sparkline } from "@/features/desktop/metrics";

export function Sparkline({
  values,
  tone = "accent",
}: {
  values: number[];
  tone?: "accent" | "alarm";
}) {
  const points = sparkline(values);
  if (points === "") return <span className="block h-[22px]" />;

  return (
    <svg
      viewBox="0 0 100 22"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="block h-[22px] w-full"
    >
      <polyline
        points={points}
        fill="none"
        stroke={tone === "alarm" ? "var(--alarm)" : "var(--accent-strong)"}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
