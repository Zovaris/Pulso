import {
  FolderSimpleDashedIcon,
  FolderSimpleIcon,
  FolderSimplePlusIcon,
  GearSixIcon,
  ListBulletsIcon,
  PlugsConnectedIcon,
  SquaresFourIcon,
  TerminalWindowIcon,
  TextAlignLeftIcon,
} from "@phosphor-icons/react";
import {
  Button,
  IconButton,
  Kbd,
  Sidebar as NavSidebar,
  type SidebarItem,
} from "@zovaris/sephiro";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import type { SectionId } from "@/app/stores/types";
import { failures, liveExecutions } from "@/features/desktop/session";
import { useAddProject } from "@/features/projects/useAddProject";
import { SECTIONS } from "@/features/shell/sections";

const ICONS: Record<SectionId, typeof SquaresFourIcon> = {
  overview: SquaresFourIcon,
  projects: FolderSimpleIcon,
  processes: ListBulletsIcon,
  logs: TextAlignLeftIcon,
  settings: GearSixIcon,
  commands: TerminalWindowIcon,
  ports: PlugsConnectedIcon,
};

export function Sidebar() {
  const { t } = useI18n();
  const section = useStore((state) => state.section);
  const setSection = useStore((state) => state.setSection);
  const projects = useStore((state) => state.projects);
  const executions = useStore((state) => state.executions);
  const seenAt = useStore((state) => state.seenFailuresAt);
  const sidebarOpen = useStore((state) => state.sidebarOpen);
  const selectedProjectId = useStore((state) => state.selectedProjectId);
  const selectProject = useStore((state) => state.selectProject);
  const addProject = useAddProject();
  const live = liveExecutions(executions);
  const unseen = failures(executions).filter(
    (entry) => (entry.endedAt ?? 0) > seenAt,
  ).length;
  const counts: Partial<Record<SectionId, number>> = { processes: live.length };
  const item = (id: SectionId): SidebarItem => {
    const Icon = ICONS[id];
    const definition = SECTIONS.find((entry) => entry.id === id)!;
    return {
      value: id,
      label: t(definition.labelKey),
      icon: <Icon size={16} />,
      badge:
        id === "processes" && unseen > 0 ? (
          <span
            className="pulso-dot"
            data-s="failed"
            title={t("failuresWaiting", { count: unseen })}
          />
        ) : counts[id] ? (
          <span className="tabular-nums">{counts[id]}</span>
        ) : undefined,
    };
  };

  return (
    <NavSidebar
      className="pulso-sidebar"
      ariaLabel={t("appName")}
      sections={[
        {
          items: [
            item("overview"),
            item("commands"),
            item("processes"),
            item("ports"),
            item("logs"),
            ...(sidebarOpen ? [] : [item("projects")]),
          ],
        },
        ...(sidebarOpen
          ? [
              {
                title: t("projects"),
                items: [
                  ...projects.map((project): SidebarItem => ({
                    value: `project:${project.id}`,
                    label: project.name,
                    icon:
                      project.availability === "available" ? (
                        <FolderSimpleIcon size={16} />
                      ) : (
                        <FolderSimpleDashedIcon size={16} />
                      ),
                    badge: live.some(
                      (execution) => execution.projectId === project.id,
                    ) ? (
                      <span
                        className="pulso-dot"
                        data-s="running"
                        title={t("stateRunning")}
                      />
                    ) : undefined,
                  })),
                  {
                    value: "add-project",
                    label: (
                      <span className="text-faint">{t("menuAddProject")}</span>
                    ),
                    icon: (
                      <FolderSimplePlusIcon size={16} className="text-faint" />
                    ),
                  },
                ],
              },
            ]
          : []),
      ]}
      value={
        section === "projects" && selectedProjectId !== null
          ? `project:${selectedProjectId}`
          : section
      }
      onSelect={(value) => {
        if (value === "add-project") void addProject();
        else if (value.startsWith("project:")) {
          selectProject(Number(value.slice("project:".length)));
          setSection("projects");
        } else setSection(value as SectionId);
      }}
      collapsed={!sidebarOpen}
      collapsedMode="rail"
      header={
        <p className="truncate text-sm font-semibold">
          {sidebarOpen ? t("appName") : "P"}
        </p>
      }
      footer={
        sidebarOpen ? (
          <Button
            variant="quiet"
            density="compact"
            motion="none"
            className="pulso-settings-link"
            aria-current={section === "settings" ? "page" : undefined}
            onClick={() => setSection("settings")}
          >
            <GearSixIcon size={16} />
            <span>{t("settings")}</span>
            <span aria-hidden className="ml-auto">
              <Kbd keys="⌘," />
            </span>
          </Button>
        ) : (
          <IconButton
            variant="ghost"
            density="compact"
            icon={<GearSixIcon size={16} />}
            label={t("settings")}
            title={t("settings")}
            aria-current={section === "settings" ? "page" : undefined}
            onClick={() => setSection("settings")}
          />
        )
      }
    />
  );
}
