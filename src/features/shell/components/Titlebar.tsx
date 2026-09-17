export function Titlebar({ title }: { title: string }) {
  return (
    <header
      data-tauri-drag-region
      className="flex h-[46px] flex-none items-center justify-center border-b border-line bg-night px-4"
    >
      <p className="pointer-events-none text-[12.5px] font-semibold tracking-[-0.01em]">
        {title}
      </p>
    </header>
  );
}
