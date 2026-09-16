import { Button } from "@zovaris/sephiro";
import type { ReactNode } from "react";

type ActionRowProps = {
  icon: ReactNode;
  label: string;
  onClick: () => void;
};

/**
 * A menu row. The package's quiet button already carries the states (muted
 * label, hover fill, height, radius, focus ring); the host only supplies the
 * full-width left-aligned box through `.soffy-row`.
 */
export function ActionRow({ icon, label, onClick }: ActionRowProps) {
  return (
    <Button variant="quiet" size="sm" className="soffy-row" onClick={onClick}>
      <span className="soffy-row__icon">{icon}</span>
      {label}
    </Button>
  );
}
