type PopoverHeaderProps = {
  title: string;
  status: string;
};

export function PopoverHeader({ title, status }: PopoverHeaderProps) {
  return (
    <>
      <header className="flex items-baseline justify-between px-4 pt-3.5 pb-2">
        <h1 className="text-[15px] font-semibold tracking-tight">{title}</h1>
        <p className="text-[11px] text-mist">{status}</p>
      </header>
      <div className="mx-4 h-px bg-line" />
    </>
  );
}
