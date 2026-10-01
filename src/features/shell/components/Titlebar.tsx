import {
  ArrowsClockwiseIcon,
  MagnifyingGlassIcon,
  SidebarSimpleIcon,
} from "@phosphor-icons/react";
import { Button, Kbd } from "@zovaris/sephiro";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { IconTool } from "@/components/shared/IconTool";

export function Titlebar() {
  const { t } = useI18n();
  const rescanning = useStore((state) => state.rescanning);
  const rescanProjects = useStore((state) => state.rescanProjects);
  const openPalette = useStore((state) => state.openPalette);
  const inspectorOpen = useStore((state) => state.inspectorOpen);
  const toggleInspector = useStore((state) => state.toggleInspector);

  return (
    <header
      data-tauri-drag-region
      className="flex h-[46px] flex-none items-center gap-3 border-b border-line bg-night pr-3 pl-[80px]"
    >
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={openPalette}
        className="pulso-search-trigger ml-auto w-[260px] flex-none"
      >
        <MagnifyingGlassIcon size={12} />
        <span className="truncate text-faint">{t("palettePlaceholder")}</span>
        <Kbd keys="⌘K" className="ml-auto flex-none" />
      </Button>

      <IconTool
        icon={ArrowsClockwiseIcon}
        label={t("rescan")}
        active={rescanning}
        onClick={() => void rescanProjects()}
      />

      <IconTool
        icon={SidebarSimpleIcon}
        label={t(inspectorOpen ? "hideInspector" : "showInspector")}
        active={inspectorOpen}
        onClick={toggleInspector}
      />
    </header>
  );
}
