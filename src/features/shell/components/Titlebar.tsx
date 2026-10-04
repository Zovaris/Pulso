import {
  ArrowsClockwiseIcon,
  MagnifyingGlassIcon,
  SidebarSimpleIcon,
} from "@phosphor-icons/react";
import { Breadcrumb, Button, IconButton, Kbd, Toolbar } from "@zovaris/sephiro";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { SECTIONS } from "@/features/shell/sections";

export function Titlebar() {
  const { t } = useI18n();
  const section = useStore((state) => state.section);
  const projects = useStore((state) => state.projects);
  const selectedId = useStore((state) => state.selectedProjectId);
  const rescanning = useStore((state) => state.rescanning);
  const rescanProjects = useStore((state) => state.rescanProjects);
  const openPalette = useStore((state) => state.openPalette);
  const sidebarOpen = useStore((state) => state.sidebarOpen);
  const toggleSidebar = useStore((state) => state.toggleSidebar);
  const inspectorOpen = useStore((state) => state.inspectorOpen);
  const toggleInspector = useStore((state) => state.toggleInspector);
  const project =
    projects.find((entry) => entry.id === selectedId) ?? projects[0];
  const hasInspector =
    section === "overview" || (section === "projects" && Boolean(project));
  const label = t(SECTIONS.find((entry) => entry.id === section)!.labelKey);

  return (
    <header
      data-tauri-drag-region
      className="pulso-titlebar flex h-10 flex-none items-center pr-3 pl-[80px]"
    >
      <Toolbar
        label={t("appName")}
        className="pulso-titlebar-tools"
        start={
          <>
            <IconButton
              density="compact"
              variant="ghost"
              icon={<SidebarSimpleIcon size={17} />}
              label={t(sidebarOpen ? "hideSidebar" : "showSidebar")}
              title={t(sidebarOpen ? "hideSidebar" : "showSidebar")}
              aria-pressed={sidebarOpen}
              onClick={toggleSidebar}
            />
            <Breadcrumb
              label={t("navLocation")}
              items={[
                { label },
                ...(section === "projects" && project
                  ? [{ label: project.name }]
                  : []),
              ]}
            />
          </>
        }
        end={
          <>
            <Button
              size="sm"
              density="compact"
              motion="none"
              variant="secondary"
              onClick={openPalette}
              className="pulso-search-trigger"
            >
              <MagnifyingGlassIcon size={15} />
              <span className="truncate text-faint">
                {t("palettePlaceholder")}
              </span>
              <Kbd keys="⌘K" className="ml-auto flex-none" />
            </Button>
            <IconButton
              density="compact"
              variant="ghost"
              icon={<ArrowsClockwiseIcon size={16} />}
              label={t("rescan")}
              title={t("rescan")}
              disabled={rescanning}
              loading={rescanning}
              onClick={() => void rescanProjects()}
            />
            {hasInspector ? (
              <IconButton
                density="compact"
                variant="ghost"
                className="pulso-inspector-toggle"
                icon={<SidebarSimpleIcon size={17} className="-scale-x-100" />}
                label={t(inspectorOpen ? "hideInspector" : "showInspector")}
                title={t(inspectorOpen ? "hideInspector" : "showInspector")}
                aria-pressed={inspectorOpen}
                onClick={toggleInspector}
              />
            ) : null}
          </>
        }
      />
    </header>
  );
}
