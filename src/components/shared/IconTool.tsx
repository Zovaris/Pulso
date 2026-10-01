import type { Icon } from "@phosphor-icons/react";
import { IconButton } from "@zovaris/sephiro";

export function IconTool({
  icon: Icon,
  label,
  onClick,
  disabled,
  active,
  mirrored,
  size = 14,
  className = "size-6",
}: {
  icon: Icon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  mirrored?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <IconButton
      size="sm"
      className={className}
      variant={active ? "outline" : "ghost"}
      label={label}
      title={label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      onClick={onClick}
      icon={
        <Icon size={size} className={mirrored ? "-scale-x-100" : undefined} />
      }
    />
  );
}
