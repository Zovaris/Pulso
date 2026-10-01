import { useEffect } from "react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { ErrorNote } from "@/components/shared/ErrorNote";
import {
  customDetected,
  groupCustomCommands,
  menubarFavourites,
} from "@/features/desktop/customCommands";
import { CommandRow } from "@/features/popover/components/CommandRow";
import { PopoverEmptyState } from "@/features/popover/components/PopoverEmptyState";
import { PopoverSectionHeader } from "@/features/popover/components/PopoverSectionHeader";
import { ProjectList } from "@/features/popover/components/ProjectList";
import { persistCollapsedSections } from "@/features/popover/sections";
import type { Project } from "@/lib/types";

export function PopoverProjects({
  projects,
  onAddProject,
}: {
  projects: Project[];
  onAddProject: () => void;
}) {
  const { t } = useI18n();
  const error = useStore((state) => state.projectError);
  const dismissProjectError = useStore((state) => state.dismissProjectError);
  const commands = useStore((state) => state.customCommands);
  const executions = useStore((state) => state.executions);
  const scans = useStore((state) => state.scans);
  const collapsed = useStore((state) => state.collapsedSections);
  const toggle = useStore((state) => state.toggleSection);

  useEffect(() => {
    persistCollapsedSections(collapsed);
  }, [collapsed]);

  const favorites = menubarFavourites(scans, projects, commands, executions);
  const groups = groupCustomCommands(commands).map((group) => ({
    ...group,
    commands: group.commands.filter((command) => !command.favorite),
  }));
  const hasProjects = projects.length > 0;
  const projectsOpen = !collapsed.includes("projects");
  const commandsOpen = !collapsed.includes("commands");
  const empty =
    hasProjects || favorites.length > 0 || groups.length > 0 ? false : true;

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-auto px-4 py-3">
      {favorites.length > 0 ? (
        <div className="mb-1">
          <p className="pulso-source">
            <span className="pulso-source__name">{t("filterFavorites")}</span>
            <span className="pulso-source__rule" />
          </p>
          {favorites.map((favourite) => (
            <CommandRow
              key={`${favourite.projectId}:${favourite.command.id}`}
              projectId={favourite.projectId}
              command={favourite.command}
            />
          ))}
        </div>
      ) : null}

      {hasProjects ? (
        <div>
          <PopoverSectionHeader
            section="projects"
            label={t("projects")}
            count={projects.length}
            collapsed={!projectsOpen}
            onToggle={toggle}
          />
          {projectsOpen ? <ProjectList projects={projects} /> : null}
        </div>
      ) : null}

      {groups.length > 0 ? (
        <div>
          <PopoverSectionHeader
            section="commands"
            label={t("sectionCommands")}
            count={groups.reduce(
              (total, group) => total + group.commands.length,
              0,
            )}
            collapsed={!commandsOpen}
            onToggle={toggle}
          />
          {commandsOpen
            ? groups.map((group) => (
                <div key={group.key}>
                  <p className="pulso-source">
                    <span className="pulso-source__name">
                      {projects.find((p) => p.id === group.projectId)?.name ??
                        t("personalCommands")}
                    </span>
                    <span className="pulso-source__rule" />
                  </p>
                  {group.commands.map((command) => (
                    <CommandRow
                      key={command.id}
                      projectId={command.projectId ?? 0}
                      command={customDetected(command)}
                    />
                  ))}
                </div>
              ))
            : null}
        </div>
      ) : null}

      {empty ? <PopoverEmptyState onAddProject={onAddProject} /> : null}

      {error ? (
        <ErrorNote error={error} onDismiss={dismissProjectError} />
      ) : null}
    </section>
  );
}
