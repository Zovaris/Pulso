import type { ReactNode } from "react";

type FavoritesSectionProps = {
  title: string;
  children: ReactNode;
};

export function FavoritesSection({ title, children }: FavoritesSectionProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col px-4 py-3">
      <p className="mb-2 text-[11px] font-medium text-faint">{title}</p>
      {children}
    </section>
  );
}
