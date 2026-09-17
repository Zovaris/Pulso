import { useAutoAnimate } from "@formkit/auto-animate/react";
import {
  EyeIcon,
  EyeSlashIcon,
  FolderSimplePlusIcon,
  PlayIcon,
  StarIcon,
  StopIcon,
  TextboxIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { Card, CardEmpty } from "@/components/shared/Card";
import { Chip } from "@/components/shared/Chip";
import { IconTool } from "@/components/shared/IconTool";
import {
  type CommandFilter,
  categoryKey,
  filterCommands,
  filterCount,
  flagsFor,
  invocationOf,
  scanGroups,
} from "@/features/desktop/commands";
import { latestExecution } from "@/features/executions/execution";
import { scanMessage } from "@/features/projects/scanMessage";
import { useAddProject } from "@/features/projects/useAddProject";
import { EditorSplit } from "@/features/shell/components/EditorSplit";
import { ProjectInspector } from "@/features/shell/components/Inspector";
import { ProjectStrip } from "@/features/shell/components/ProjectStrip";
import { REVEAL_DURATION, REVEAL_EASE } from "@/lib/motion";
import type { DetectedCommand } from "@/lib/types";

const FILTER_ICONS: Partial<Record<CommandFilter, typeof StarIcon>> = {
  favorites: StarIcon,
  dev: PlayIcon,
  hidden: EyeSlashIcon,
};

function CommandRow({
  projectId,
  command,
}: {
  projectId: number;
  command: DetectedCommand;
}) {
  const { t } = useI18n();
  const scan = useStore((state) => state.scans[String(projectId)]);
  const executions = useStore((state) => state.executions);
  const pendingCommandId = useStore((state) => state.pendingCommandId);
  const argsFor = useStore((state) => state.argsFor);
  const setArgsFor = useStore((state) => state.setArgsFor);
  const startCommand = useStore((state) => state.startCommand);
  const stopExecution = useStore((state) => state.stopExecution);
  const setCommandFlag = useStore((state) => state.setCommandFlag);
  const [draft, setDraft] = useState("");

  const flags = flagsFor(scan?.flags, command.id);
  const key = `${projectId}:${command.id}`;
  const open = argsFor === key;
  const execution = latestExecution(executions, projectId, command.id);
  const active =
    execution?.state === "running" || execution?.state === "starting";
  const invocation = invocationOf(command);

  return (
    <>
      <div
        className="pulso-cmd pulso-row pulso-row-cmd px-2 py-1.5"
        data-hidden={flags.hidden}
      >
        <button
          type="button"
          aria-pressed={flags.favorite}
          title={t("favorite")}
          onClick={() =>
            void setCommandFlag(projectId, command.id, {
              favorite: !flags.favorite,
            })
          }
          className={`flex h-[20px] w-[20px] items-center justify-center rounded-[5px] transition-colors duration-[120ms] ${
            flags.favorite ? "text-accent-strong" : "text-faint hover:text-mist"
          }`}
        >
          <StarIcon size={12} weight={flags.favorite ? "fill" : "regular"} />
        </button>

        <span className="pulso-cmd__name min-w-0 truncate text-[12.5px]">
          {command.label}
        </span>

        <span
          className="pulso-cmd__invocation min-w-0 truncate font-mono text-[11.5px] text-faint"
          title={invocation}
        >
          {invocation}
        </span>

        <span className="truncate text-[11px] text-faint">
          {t(categoryKey(command.category))}
          {command.longRunning ? ` · ${t("longRunningHint")}` : ""}
        </span>

        <span className="flex items-center justify-end gap-0.5">
          <IconTool
            icon={TextboxIcon}
            size={12}
            label={t("runWithArgs")}
            onClick={() => setArgsFor(open ? null : key)}
          />
          <IconTool
            icon={flags.hidden ? EyeIcon : EyeSlashIcon}
            size={12}
            label={flags.hidden ? t("showInPopover") : t("hideInPopover")}
            onClick={() =>
              void setCommandFlag(projectId, command.id, {
                hidden: !flags.hidden,
              })
            }
          />
          <IconTool
            icon={active ? StopIcon : PlayIcon}
            size={12}
            label={active ? t("stopCommand") : t("runCommand")}
            disabled={pendingCommandId === command.id}
            onClick={() => {
              if (active && execution) {
                void stopExecution(execution.id);
                return;
              }

              void startCommand(projectId, command.id);
            }}
          />
        </span>
      </div>

      {open ? (
        <form
          className="flex items-center gap-2 bg-hover px-2 py-2"
          onSubmit={(event) => {
            event.preventDefault();
            void startCommand(
              projectId,
              command.id,
              draft.split(/\s+/).filter((part) => part !== ""),
            );
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("argumentsPlaceholder")}
            className="h-[26px] min-w-0 flex-1 rounded-[6px] border border-line bg-void px-2 font-mono text-[11.5px] outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="h-[26px] flex-none rounded-[6px] bg-accent px-2.5 text-[11.5px] text-white transition-colors duration-[120ms] hover:bg-accent-hover"
          >
            {t("runCommand")}
          </button>
          <button
            type="button"
            onClick={() => setArgsFor(null)}
            className="h-[26px] flex-none rounded-[6px] border border-line px-2.5 text-[11.5px] text-mist transition-colors duration-[120ms] hover:bg-hover hover:text-paper"
          >
            {t("cancel")}
          </button>
        </form>
      ) : null}
    </>
  );
}

export function ProjectsSection() {
  const { t } = useI18n();
  const projects = useStore((state) => state.projects);
  const scans = useStore((state) => state.scans);
  const selectedProjectId = useStore((state) => state.selectedProjectId);
  const selectProject = useStore((state) => state.selectProject);
  const filter = useStore((state) => state.commandFilter);
  const setCommandFilter = useStore((state) => state.setCommandFilter);
  const error = useStore((state) => state.projectError);
  const dismissProjectError = useStore((state) => state.dismissProjectError);
  const addProject = useAddProject();
  const [commands] = useAutoAnimate<HTMLDivElement>({
    duration: REVEAL_DURATION,
    easing: REVEAL_EASE,
  });

  const project =
    projects.find((entry) => entry.id === selectedProjectId) ?? projects[0];
  const scan = project ? scans[String(project.id)] : undefined;
  const message = scan ? scanMessage(scan) : null;
  const groups = scan ? scanGroups(scan, filter) : [];
  const shown = scan ? filterCommands(scan, filter).length : 0;

  if (!project) {
    return (
      <div className="pulso-pane flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="text-[12.5px] text-mist">{t("emptyProjects")}</p>
        <button
          type="button"
          onClick={() => void addProject()}
          className="flex h-[28px] items-center gap-1.5 rounded-[7px] bg-accent px-3 text-[12px] text-white transition-colors duration-[120ms] hover:bg-accent-hover"
        >
          <FolderSimplePlusIcon size={13} />
          {t("addProject")}
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="pulso-pane flex min-w-0 flex-1 flex-col overflow-auto px-6 py-5">
        <header className="flex items-start gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-[16px] font-semibold tracking-[-0.015em]">
              {project.name}
            </h1>
            <p className="mt-0.5 truncate font-mono text-[11.5px] text-faint">
              {project.path}
            </p>
          </div>
          <div className="ml-auto flex flex-none items-center gap-1.5">
            <EditorSplit projectId={project.id} />
            <button
              type="button"
              onClick={() => void addProject()}
              className="flex h-[28px] items-center gap-1.5 rounded-[7px] bg-accent px-3 text-[12px] text-white transition-colors duration-[120ms] hover:bg-accent-hover"
            >
              <FolderSimplePlusIcon size={13} />
              {t("addProject")}
            </button>
          </div>
        </header>

        <div className="mt-4">
          <ProjectStrip
            projects={projects}
            scans={scans}
            selectedId={project.id}
            onSelect={selectProject}
          />
        </div>

        {scan && scan.commands.length > 0 ? (
          <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
            {(
              [
                "all",
                "favorites",
                "dev",
                "test",
                "lint",
                "hidden",
              ] as CommandFilter[]
            ).map((entry) => (
              <Chip
                key={entry}
                label={t(`filter${entry[0].toUpperCase()}${entry.slice(1)}`)}
                count={filterCount(scan, entry)}
                icon={FILTER_ICONS[entry]}
                active={filter === entry}
                onClick={() => setCommandFilter(entry)}
              />
            ))}
          </div>
        ) : null}

        <div ref={commands} className="mt-3.5 flex flex-col gap-3">
          {scan === undefined ? (
            <Card>
              <CardEmpty note={t("readingManifest")} />
            </Card>
          ) : scan.commands.length === 0 ? (
            <Card>
              <CardEmpty
                note={
                  message
                    ? `${t(message.key)} ${message.detail ?? ""}`.trim()
                    : t("noCommands")
                }
              />
            </Card>
          ) : shown === 0 ? (
            <Card>
              <CardEmpty note={t("nothingInFilter")} />
            </Card>
          ) : (
            <Card>
              {groups.map((group) => (
                <div key={group.source}>
                  <p className="flex items-center gap-2.5 border-b border-hairline px-2 py-1.5">
                    <span className="font-mono text-[11px] text-faint">
                      {group.label}
                    </span>
                    <span className="h-px flex-1 bg-hairline" />
                    <span className="text-[11px] text-faint tabular-nums">
                      {group.commands.length}
                    </span>
                  </p>
                  {group.commands.map((command) => (
                    <CommandRow
                      key={command.id}
                      projectId={project.id}
                      command={command}
                    />
                  ))}
                </div>
              ))}
            </Card>
          )}
        </div>

        {error ? (
          <div className="mt-3.5 flex items-center gap-2.5 rounded-[9px] border border-line bg-panel px-3 py-2">
            <p className="min-w-0 flex-1 text-[11.5px] text-mist">
              {error.message}
            </p>
            <button
              type="button"
              onClick={dismissProjectError}
              className="h-[24px] rounded-[6px] border border-line px-2 text-[11.5px] text-mist transition-colors duration-[120ms] hover:bg-hover hover:text-paper"
            >
              {t("dismiss")}
            </button>
          </div>
        ) : null}
      </div>

      <ProjectInspector project={project} />
    </>
  );
}
