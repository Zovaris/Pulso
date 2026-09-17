import { FolderSimplePlusIcon } from "@phosphor-icons/react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { ActionRow } from "@/components/shared/ActionRow";
import { ErrorNote } from "@/components/shared/ErrorNote";
import { scanMessage } from "@/features/projects/scanMessage";
import { useAddProject } from "@/features/projects/useAddProject";
import type { Project } from "@/lib/types";

function ProjectSummary({ project }: { project: Project }) {
  const { t } = useI18n();
  const scan = useStore((state) => state.scans[String(project.id)]);
  const message = scan ? scanMessage(scan) : null;

  const summary = !scan
    ? t("readingManifest")
    : message
      ? t(message.key)
      : t("commandCount", { count: scan.commands.length });

  return (
    <li>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[13px] font-medium">{project.name}</p>
        <p
          className="min-w-0 truncate text-[11.5px] text-faint"
          title={project.path}
        >
          {project.path}
        </p>
      </div>
      <p className="mt-1 text-[11.5px] text-mist">{summary}</p>
    </li>
  );
}

export function ProjectsSection() {
  const { t } = useI18n();
  const addProject = useAddProject();
  const projects = useStore((state) => state.projects);
  const error = useStore((state) => state.projectError);
  const dismissProjectError = useStore((state) => state.dismissProjectError);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-none items-center gap-4 border-b border-hairline px-9 py-4">
        <div>
          <h1 className="text-[17px] font-semibold tracking-[-0.015em]">
            {t("sectionProjects")}
          </h1>
          <p className="mt-1 text-[12.5px] text-mist">{t("projectsLede")}</p>
        </div>
        <div className="ml-auto">
          <ActionRow
            icon={<FolderSimplePlusIcon size={15} />}
            label={t("addProject")}
            onClick={() => {
              void addProject();
            }}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-9 py-7">
        {projects.length === 0 ? (
          <p className="text-[13px] leading-6 text-mist">
            {t("emptyProjects")}
          </p>
        ) : (
          <ul className="flex flex-col gap-5">
            {projects.map((project) => (
              <ProjectSummary key={project.id} project={project} />
            ))}
          </ul>
        )}

        {error ? (
          <ErrorNote error={error} onDismiss={dismissProjectError} />
        ) : null}
      </div>
    </div>
  );
}
