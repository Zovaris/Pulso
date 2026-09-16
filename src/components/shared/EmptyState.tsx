import type { ReactNode } from "react";

type EmptyStateProps = {
  children: ReactNode;
};

/** Bloque centrado para estados vacíos dentro de una sección de altura flexible. */
export function EmptyState({ children }: EmptyStateProps) {
  return (
    <div className="flex flex-1 items-center justify-center rounded-xl bg-fill px-6 text-center">
      <p className="max-w-[16rem] text-[12.5px] leading-5 text-mist">
        {children}
      </p>
    </div>
  );
}
