import { useAutoAnimate } from "@formkit/auto-animate/react";
import {
  CaretRightIcon,
  FolderSimpleIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useI18n } from "@/app/hooks/useI18n";
import { useReveal } from "@/app/hooks/useReveal";
import { useStore } from "@/app/store";
import { CommandRow } from "@/features/popover/components/CommandRow";
import { scanMessage } from "@/features/projects/scanMessage";
import { REVEAL_DURATION, REVEAL_EASE } from "@/lib/motion";
import type { Project } from "@/lib/types";

export function ProjectRow({ project }: { project: Project }) {
  const { t } = useI18n();
  const scan = useStore((state) => state.scans[String(project.id)]);
  const expanded = useStore((state) => state.expandedProjectId === project.id);
  const scanning = useStore((state) => state.scanningProjectId === project.id);
  const toggleProject = useStore((state) => state.toggleProject);
  const removeProject = useStore((state) => state.removeProject);

  const scanBox = useReveal<HTMLDivElement>(expanded);
  const [commands] = useAutoAnimate<HTMLUListElement>({
    duration: REVEAL_DURATION,
    easing: REVEAL_EASE,
  });

  const count = scan?.commands.length ?? 0;
  const message = scan ? scanMessage(scan) : null;

  return (
    <div className="soffy-project-row">
      <div className="soffy-project">
        <button
          type="button"
          className="soffy-project__open"
          aria-expanded={expanded}
          onClick={() => toggleProject(project.id)}
        >
          <FolderSimpleIcon size={14} className="soffy-project__icon" />
          <span className="soffy-project__text">
            <span className="soffy-project__head">
              <span className="truncate text-[12.5px] font-medium">
                {project.name}
              </span>
              {count > 0 ? (
                <span className="soffy-project__count">{count}</span>
              ) : null}
            </span>
            <span className="soffy-project__path" title={project.path}>
              {project.availability === "missing"
                ? t("projectMissing")
                : project.path}
            </span>
          </span>
        </button>

        <CaretRightIcon size={12} className="soffy-project__chevron" />
        <button
          type="button"
          className="soffy-project__forget"
          aria-label={t("forgetProject")}
          title={t("forgetHint")}
          onClick={() => void removeProject(project.id)}
        >
          <TrashIcon size={13} />
        </button>
      </div>

      <div className="soffy-scan" ref={scanBox} inert={!expanded}>
        <div className="soffy-scan__body">
          {scanning && !scan ? (
            <p className="soffy-scan__note">{t("readingManifest")}</p>
          ) : null}

          {count > 0 ? (
            <ul ref={commands} className="flex flex-col">
              {scan?.commands.map((command) => (
                <li key={command.id}>
                  <CommandRow projectId={project.id} command={command} />
                </li>
              ))}
            </ul>
          ) : null}

          {message ? (
            <p className="soffy-scan__note">
              {t(message.key)}
              {message.detail ? (
                <span className="soffy-scan__detail">{message.detail}</span>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
