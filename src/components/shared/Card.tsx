export function Card({
  title,
  meta,
  actions,
  children,
  className = "",
}: {
  title?: string;
  meta?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-[10px] border border-line bg-panel ${className}`}
    >
      {title ? (
        <header className="flex items-center gap-3 border-b border-hairline px-3.5 py-2.5">
          <h3 className="text-[12.5px] font-medium">{title}</h3>
          {meta ? <span className="text-[11px] text-faint">{meta}</span> : null}
          {actions ? (
            <span className="ml-auto flex items-center gap-1.5">{actions}</span>
          ) : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function CardEmpty({ note }: { note: string }) {
  return (
    <p className="px-3.5 py-7 text-center text-[12px] text-faint">{note}</p>
  );
}
