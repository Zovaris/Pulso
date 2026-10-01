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
}: {
  icon: Icon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  mirrored?: boolean;
  size?: number;
}) {
  return (
    <IconButton
      size="sm"
      variant={active ? "outline" : "ghost"}
      label={label}
      title={label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      onClick={onClick}
      icon={
        <Icon size={size} className={mirrored ? "-scale-x-100" : undefined} />
      }
      style={{ width: 26, height: 26 }}
    />
  );
}
