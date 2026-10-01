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
import { ProjectList } from "@/features/popover/components/ProjectList";
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
  const favorites = menubarFavourites(scans, projects, commands, executions);
  const groups = groupCustomCommands(commands);
  const hasProjects = projects.length > 0;
  const empty = hasProjects
    ? favorites.length === 0 && groups.length === 0
    : true;

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-auto px-4 py-3">
      {favorites.length > 0 ? (
        <div className="mb-4">
          <p className="mb-2 text-[11px] font-medium text-mist">
            {t("filterFavorites")}
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
        <>
          <p className="mb-2 text-[11px] font-medium text-mist">
            {t("projects")}
          </p>
          <ProjectList projects={projects} />
        </>
      ) : null}

      {groups.length > 0 ? (
        <div className={hasProjects ? "mt-4" : ""}>
          <p className="mb-2 text-[11px] font-medium text-mist">
            {t("sectionCommands")}
          </p>
          <div className="flex flex-col gap-2">
            {groups.map((group) => (
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
            ))}
          </div>
        </div>
      ) : null}

      {empty ? <PopoverEmptyState onAddProject={onAddProject} /> : null}

      {error ? (
        <ErrorNote error={error} onDismiss={dismissProjectError} />
      ) : null}
    </section>
  );
}
