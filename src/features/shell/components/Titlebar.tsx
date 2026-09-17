import {
  ArrowsClockwiseIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { IconTool } from "@/components/shared/IconTool";

export function Titlebar() {
  const { t } = useI18n();
  const rescanning = useStore((state) => state.rescanning);
  const rescanProjects = useStore((state) => state.rescanProjects);
  const openPalette = useStore((state) => state.openPalette);

  return (
    <header
      data-tauri-drag-region
      className="flex h-[46px] flex-none items-center gap-3 border-b border-line bg-night pr-3 pl-[80px]"
    >
      <button
        type="button"
        onClick={openPalette}
        className="ml-auto flex h-[26px] w-[260px] flex-none items-center gap-2 rounded-[7px] border border-line px-2 text-left text-[12px] text-faint transition-colors duration-[120ms] hover:bg-hover hover:text-mist"
      >
        <MagnifyingGlassIcon size={12} />
        <span className="truncate">{t("palettePlaceholder")}</span>
        <kbd className="ml-auto flex-none font-mono text-[10.5px]">⌘K</kbd>
      </button>

      <IconTool
        icon={ArrowsClockwiseIcon}
        label={t("rescan")}
        active={rescanning}
        onClick={() => void rescanProjects()}
      />
    </header>
  );
}
