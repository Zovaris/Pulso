import { Button } from "@zovaris/sephiro";
import type { ReactNode } from "react";

type ActionButtonProps = {
  icon: ReactNode;
  label: string;
  onClick: () => void;
};

/** Fila de acción de menú: icono tenue y etiqueta alineada a la izquierda. */
export function ActionButton({ icon, label, onClick }: ActionButtonProps) {
  return (
    <Button
      type="button"
      onClick={onClick}
      variant="quiet"
      size="sm"
      className="w-full justify-start gap-2.5 text-left text-[12.5px]"
    >
      <span className="text-mist">{icon}</span>
      {label}
    </Button>
  );
}
