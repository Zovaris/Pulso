import type { Icon } from "@phosphor-icons/react";
import { IconButton } from "@zovaris/sephiro";

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
    <IconButton
      size="sm"
      variant={active ? "outline" : "ghost"}
      label={label}
      title={label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      onClick={onClick}
      icon={<Icon size={size} />}
      style={{ width: 26, height: 26 }}
    />
  );
}
