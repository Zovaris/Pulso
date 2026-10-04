import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

/** Mouse and keyboard share one highlight, as in an NSMenu: hovering focuses. */
function follow(event: React.PointerEvent<HTMLElement>) {
  const item = event.currentTarget
    .closest(".pulso-menu__row")
    ?.querySelector<HTMLButtonElement>(".pulso-menu__item");
  if (item && !item.disabled && document.activeElement !== item)
    item.focus({ preventScroll: true });
}

export type MenuItemProps = {
  label: ReactNode;
  /** Muted text after the label, such as the project a command belongs to. */
  detail?: ReactNode;
  /** Right-aligned muted text, such as a port, an uptime or an exit code. */
  meta?: ReactNode;
  lead?: ReactNode;
  shortcut?: string;
  submenu?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  /** A second target at the trailing edge (stop, run again), reachable by mouse. */
  action?: {
    label: string;
    icon: ReactNode;
    onSelect: () => void;
    disabled?: boolean;
    stops?: boolean;
  };
};

export function MenuItem({
  label,
  detail,
  meta,
  lead,
  shortcut,
  submenu,
  disabled,
  onSelect,
  action,
}: MenuItemProps) {
  return (
    <div
      className="pulso-menu__row"
      data-disabled={disabled || undefined}
      onPointerMove={follow}
    >
      <button
        type="button"
        role="menuitem"
        className="pulso-menu__item"
        data-submenu={submenu || undefined}
        data-has-action={action ? true : undefined}
        disabled={disabled}
        aria-haspopup={submenu || undefined}
        onClick={onSelect}
      >
        <span className="pulso-menu__lead" aria-hidden>
          {lead}
        </span>
        <span className="pulso-menu__label">
          <span className="truncate">{label}</span>
          {detail ? (
            <span className="pulso-menu__detail truncate">{detail}</span>
          ) : null}
        </span>
        {meta ? <span className="pulso-menu__meta">{meta}</span> : null}
        {shortcut ? (
          <kbd className="pulso-menu__shortcut">{shortcut}</kbd>
        ) : null}
        {submenu ? (
          <CaretRightIcon
            size={11}
            weight="bold"
            className="pulso-menu__chevron"
            aria-hidden
          />
        ) : null}
      </button>
      {action ? (
        <button
          type="button"
          tabIndex={-1}
          className="pulso-menu__action"
          data-stops={action.stops || undefined}
          aria-label={action.label}
          title={action.label}
          disabled={action.disabled}
          onClick={(event) => {
            event.stopPropagation();
            action.onSelect();
          }}
        >
          {action.icon}
        </button>
      ) : null}
    </div>
  );
}

export function MenuBack({
  label,
  onBack,
}: {
  label: string;
  onBack: () => void;
}) {
  return (
    <div className="pulso-menu__row" onPointerMove={follow}>
      <button
        type="button"
        role="menuitem"
        className="pulso-menu__item pulso-menu__item--back"
        data-back
        onClick={onBack}
      >
        <span className="pulso-menu__lead" aria-hidden>
          <CaretLeftIcon size={11} weight="bold" />
        </span>
        <span className="pulso-menu__label pulso-menu__label--title">
          <span className="truncate">{label}</span>
        </span>
      </button>
    </div>
  );
}

export function MenuHeading({ children }: { children: ReactNode }) {
  return (
    <p className="pulso-menu__heading" role="presentation">
      {children}
    </p>
  );
}

export function MenuSeparator() {
  return <hr className="pulso-menu__separator" role="separator" />;
}

export function MenuNote({ children }: { children: ReactNode }) {
  return <p className="pulso-menu__note">{children}</p>;
}
