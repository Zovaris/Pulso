import { Button } from "@zovaris/sephiro";
import type { ReactNode } from "react";

type ActionRowProps = {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  emphasis?: "primary";
};

export function ActionRow({ icon, label, onClick, emphasis }: ActionRowProps) {
  return (
    <Button
      variant="quiet"
      size="sm"
      className={emphasis ? `pulso-row pulso-row--${emphasis}` : "pulso-row"}
      onClick={onClick}
    >
      <span className="pulso-row__icon">{icon}</span>
      {label}
    </Button>
  );
}
