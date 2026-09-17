import type { Icon } from "@phosphor-icons/react";

/** A tool that is an icon: 26 points square, with the label in the tooltip. */
export function IconTool({
  icon: Icon,
  label,
  onClick,
  disabled,
  active,
  size = 14,
}: {
  icon: Icon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  size?: number;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-[26px] w-[26px] flex-none items-center justify-center rounded-[7px] border transition-colors duration-[120ms] ${
        active
          ? "border-line bg-fill text-paper"
          : "border-transparent text-mist hover:border-line hover:bg-hover hover:text-paper"
      } disabled:cursor-default disabled:opacity-40 disabled:hover:border-transparent disabled:hover:bg-transparent`}
    >
      <Icon size={size} />
    </button>
  );
}
