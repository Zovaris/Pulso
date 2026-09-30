import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { ErrorNote } from "@/components/shared/ErrorNote";
import {
  customDetected,
  menubarCommands,
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
  const favorites = menubarCommands(commands, executions);
  const hasProjects = projects.length > 0;

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-auto px-4 py-3">
      {favorites.length > 0 ? (
        <div className="mb-4">
          <p className="mb-2 text-[11px] font-medium text-mist">
            {t("filterFavorites")}
          </p>
          {favorites.map((command) => (
            <CommandRow
              key={command.id}
              projectId={command.projectId ?? 0}
              command={customDetected(command)}
            />
          ))}
        </div>
      ) : null}
      {hasProjects ? (
        <p className="mb-2 text-[11px] font-medium text-mist">
          {t("projects")}
        </p>
      ) : null}
      {hasProjects ? (
        <ProjectList projects={projects} />
      ) : favorites.length === 0 ? (
        <PopoverEmptyState onAddProject={onAddProject} />
      ) : null}
      {error ? (
        <ErrorNote error={error} onDismiss={dismissProjectError} />
      ) : null}
    </section>
  );
}
