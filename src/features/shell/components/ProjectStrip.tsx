import { useI18n } from "@/app/hooks/useI18n";
import type { CommandScan, Project } from "@/lib/types";

/**
 * One project at a time, because the filters and the inspector both talk about
 * "this project" and having two of them on screen would make that a lie.
 */
export function ProjectStrip({
  projects,
  scans,
  selectedId,
  onSelect,
}: {
  projects: Project[];
  scans: Record<string, CommandScan>;
  selectedId: number;
  onSelect: (projectId: number) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {projects.map((project) => {
        const scan = scans[String(project.id)];
        const active = project.id === selectedId;

        return (
          <button
            key={project.id}
            type="button"
            aria-current={active ? "true" : undefined}
            onClick={() => onSelect(project.id)}
            className={`flex h-[26px] items-center gap-1.5 rounded-[7px] border px-2.5 text-[11.5px] transition-colors duration-[120ms] ${
              active
                ? "border-transparent bg-fill text-paper"
                : "border-line text-mist hover:bg-hover hover:text-paper"
            }`}
          >
            {project.availability === "missing" ? (
              <i className="pulso-dot" data-s="failed" />
            ) : null}
            <span className="max-w-[160px] truncate">{project.name}</span>
            <span className="text-faint tabular-nums">
              {scan ? scan.commands.length : t("readingShort")}
            </span>
          </button>
        );
      })}
    </div>
  );
}
