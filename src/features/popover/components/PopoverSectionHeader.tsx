import { CaretRightIcon } from "@phosphor-icons/react";
import type { PopoverSection } from "@/features/popover/sections";

export function PopoverSectionHeader({
  section,
  label,
  collapsed,
  count,
  onToggle,
}: {
  section: PopoverSection;
  label: string;
  collapsed: boolean;
  count?: number;
  onToggle: (section: PopoverSection) => void;
}) {
  return (
    <div className="pulso-source">
      <button
        type="button"
        className="pulso-source__name"
        aria-expanded={!collapsed}
        aria-label={label}
        onClick={() => onToggle(section)}
      >
        <CaretRightIcon
          size={9}
          weight="bold"
          className="pulso-section__caret"
          aria-hidden="true"
        />
        {label}
        {count === undefined ? null : (
          <span className="pulso-section__count tabular-nums">{count}</span>
        )}
      </button>
      <span className="pulso-source__rule" />
    </div>
  );
}
