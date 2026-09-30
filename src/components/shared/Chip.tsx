import type { Icon } from "@phosphor-icons/react";
import { Button } from "@zovaris/sephiro";

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
    <Button
      size="sm"
      variant={active ? "primary" : "secondary"}
      type="button"
      aria-pressed={active}
      onClick={onClick}
    >
      {Icon ? <Icon size={12} /> : null}
      {label}
      {count === undefined ? null : (
        <span className={active ? "opacity-80" : "text-mist"}>{count}</span>
      )}
    </Button>
  );
}
