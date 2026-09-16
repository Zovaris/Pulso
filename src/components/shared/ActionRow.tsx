import { Button } from "@zovaris/sephiro";
import type { ReactNode } from "react";

type ActionRowProps = {
  icon: ReactNode;
  label: string;
  onClick: () => void;
};

export function ActionRow({ icon, label, onClick }: ActionRowProps) {
  return (
    <Button variant="quiet" size="sm" className="soffy-row" onClick={onClick}>
      <span className="soffy-row__icon">{icon}</span>
      {label}
    </Button>
  );
}
