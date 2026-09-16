import { useI18n } from "@/app/hooks/useI18n";
import { PopoverEmptyState } from "@/features/popover/components/PopoverEmptyState";
import { ProjectList } from "@/features/popover/components/ProjectList";
import type { Project } from "@/lib/types";

export function PopoverProjects({ projects }: { projects: Project[] }) {
  const { t } = useI18n();
  const hasProjects = projects.length > 0;

  return (
    <section className="flex min-h-0 flex-1 flex-col px-4 py-3">
      {hasProjects && (
        <p className="mb-2 text-[11px] font-medium text-mist">
          {t("projects")}
        </p>
      )}
      {hasProjects ? (
        <ProjectList projects={projects} />
      ) : (
        <PopoverEmptyState />
      )}
    </section>
  );
}
