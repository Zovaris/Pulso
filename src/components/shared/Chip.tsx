import type { Icon } from "@phosphor-icons/react";

export function Chip({
  label,
  count,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  icon?: Icon;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-[26px] items-center gap-1.5 rounded-[7px] border px-2.5 text-[11.5px] transition-colors duration-[120ms] ${
        active
          ? "border-transparent bg-accent text-paper"
          : "border-line text-mist hover:bg-hover hover:text-paper"
      }`}
    >
      {Icon ? <Icon size={12} /> : null}
      {label}
      {count === undefined ? null : (
        <span className={active ? "opacity-80" : "text-faint"}>{count}</span>
      )}
    </button>
  );
}
