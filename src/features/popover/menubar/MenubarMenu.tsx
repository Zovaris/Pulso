import {
  ArrowClockwiseIcon,
  MagnifyingGlassIcon,
  PlayIcon,
  StopIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef } from "react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { ErrorNote } from "@/components/shared/ErrorNote";
import { catalogRows } from "@/features/desktop/catalog";
import { groupStatus } from "@/features/desktop/groups";
import {
  customDetected,
  menubarFavourites,
} from "@/features/desktop/customCommands";
import { rowsFrom } from "@/features/desktop/palette";
import {
  isActiveState,
  latestExecution,
  useElapsed,
} from "@/features/executions/execution";
import {
  MenuBack,
  MenuHeading,
  MenuItem,
  MenuNote,
  MenuSeparator,
} from "@/features/popover/menubar/MenuParts";
import type { PopoverActions } from "@/features/popover/usePopoverActions";
import type { CommandGroup, DetectedCommand, Execution } from "@/lib/types";

export type MenuView =
  | { kind: "home" }
  | { kind: "projects" }
  | { kind: "project"; projectId: number }
  | { kind: "favorites" }
  | { kind: "group"; groupId: number }
  | { kind: "execution"; executionId: number }
  | { kind: "search" };

const FAVORITES_ON_HOME = 5;
const LOG_TAIL = 8;
const NO_LOGS: never[] = [];

type Navigate = (view: MenuView) => void;

/** What the top of the menu reports: everything running, and failures not yet seen. */
export function activity(executions: Execution[], seenAt: number): Execution[] {
  const latest = executions.filter(
    (execution) =>
      latestExecution(executions, execution.projectId, execution.commandId)
        ?.id === execution.id,
  );
  const running = latest
    .filter((execution) => isActiveState(execution.state))
    .sort((left, right) => left.startedAt - right.startedAt);
  const failed = latest.filter(
    (execution) =>
      execution.state === "failed" && (execution.endedAt ?? 0) > seenAt,
  );
  return [...running, ...failed];
}

function useProjectName() {
  const { t } = useI18n();
  const projects = useStore((state) => state.projects);
  return (id: number) =>
    projects.find((project) => project.id === id)?.name ??
    t("personalCommands");
}

function StatusLead({ execution }: { execution?: Execution }) {
  if (!execution)
    return <PlayIcon size={9} weight="fill" className="pulso-menu__glyph" />;
  if (execution.state === "failed")
    return (
      <WarningCircleIcon
        size={13}
        weight="fill"
        className="pulso-menu__glyph"
        data-tone="alarm"
      />
    );
  if (isActiveState(execution.state))
    return <span className="pulso-menu__dot" data-state={execution.state} />;
  return <PlayIcon size={9} weight="fill" className="pulso-menu__glyph" />;
}

function useStop(navigate: Navigate) {
  const stopExecution = useStore((state) => state.stopExecution);
  const confirmStop = useStore((state) => state.confirmStop);
  return (execution: Execution) =>
    confirmStop
      ? navigate({ kind: "execution", executionId: execution.id })
      : void stopExecution(execution.id);
}

function ExecutionItem({
  execution,
  navigate,
  showProject = true,
}: {
  execution: Execution;
  navigate: Navigate;
  showProject?: boolean;
}) {
  const { t } = useI18n();
  const projectName = useProjectName();
  const restartExecution = useStore((state) => state.restartExecution);
  const stop = useStop(navigate);
  const active = isActiveState(execution.state);
  const elapsed = useElapsed(execution.startedAt, active);
  const ports = execution.ports.map((port) => `:${port.port}`).join(" ");
  const meta =
    execution.state === "starting"
      ? t("menuStarting")
      : execution.state === "stopping"
        ? t("menuStopping")
        : active
          ? [ports, elapsed].filter(Boolean).join("  ")
          : t("menuExited", { code: execution.exitCode ?? "·" });
  return (
    <MenuItem
      lead={<StatusLead execution={execution} />}
      label={execution.label}
      detail={showProject ? projectName(execution.projectId) : undefined}
      meta={meta}
      submenu
      onSelect={() =>
        navigate({ kind: "execution", executionId: execution.id })
      }
      action={
        active
          ? {
              label: t("menuStop"),
              icon: <StopIcon size={10} weight="fill" />,
              disabled: execution.state === "stopping",
              stops: true,
              onSelect: () => stop(execution),
            }
          : {
              label: t("menuRetry"),
              icon: <ArrowClockwiseIcon size={12} weight="bold" />,
              onSelect: () => void restartExecution(execution.id),
            }
      }
    />
  );
}

function CommandItem({
  projectId,
  command,
  detail,
  navigate,
}: {
  projectId: number;
  command: DetectedCommand;
  detail?: string;
  navigate: Navigate;
}) {
  const { t } = useI18n();
  const execution = useStore((state) =>
    latestExecution(state.executions, projectId, command.id),
  );
  const pending = useStore((state) => state.pendingCommandId === command.id);
  const startCommand = useStore((state) => state.startCommand);
  if (execution && isActiveState(execution.state))
    return (
      <ExecutionItem
        execution={execution}
        navigate={navigate}
        showProject={detail !== undefined}
      />
    );
  return (
    <MenuItem
      lead={
        <StatusLead
          execution={execution?.state === "failed" ? execution : undefined}
        />
      }
      label={command.label}
      detail={detail}
      meta={pending ? t("menuStarting") : undefined}
      disabled={pending}
      onSelect={() => void startCommand(projectId, command.id)}
    />
  );
}

function Header() {
  const { t } = useI18n();
  const running = useStore(
    (state) =>
      state.executions.filter((execution) => isActiveState(execution.state))
        .length,
  );
  return (
    <header className="pulso-menu__header">
      <h1>{t("appName")}</h1>
      <p>
        <span
          className="pulso-menu__dot"
          data-state={running ? "running" : "idle"}
        />
        {running
          ? t("menuActive", { count: running })
          : t("menuNothingRunning")}
      </p>
    </header>
  );
}

function AppItems({ actions }: { actions: PopoverActions }) {
  const { t } = useI18n();
  return (
    <>
      <MenuItem
        label={t("menuOpenApp")}
        shortcut="⌘O"
        onSelect={actions.openApp}
      />
      <MenuItem
        label={t("menuSettings")}
        shortcut="⌘,"
        onSelect={actions.openSettings}
      />
      <MenuItem label={t("menuQuit")} shortcut="⌘Q" onSelect={actions.quit} />
    </>
  );
}

function useGroupStatus(group: CommandGroup) {
  const { t } = useI18n();
  const projects = useStore((state) => state.projects);
  const scans = useStore((state) => state.scans);
  const custom = useStore((state) => state.customCommands);
  const executions = useStore((state) => state.executions);
  const rows = catalogRows(projects, scans, custom, t("personalCommands"));
  return groupStatus(group, rows, executions);
}

function GroupItem({
  group,
  navigate,
}: {
  group: CommandGroup;
  navigate: Navigate;
}) {
  const { t } = useI18n();
  const startGroup = useStore((state) => state.startGroup);
  const stopGroup = useStore((state) => state.stopGroup);
  const confirmStop = useStore((state) => state.confirmStop);
  const status = useGroupStatus(group);
  const active = status.running > 0;
  const open = () => navigate({ kind: "group", groupId: group.id ?? 0 });
  return (
    <MenuItem
      lead={
        active ? (
          <span className="pulso-menu__dot" data-state="running" />
        ) : (
          <PlayIcon size={9} weight="fill" className="pulso-menu__glyph" />
        )
      }
      label={group.label}
      meta={active ? `${status.running}/${status.total}` : String(status.total)}
      submenu={active}
      disabled={status.total === 0}
      onSelect={() => (active ? open() : void startGroup(group))}
      action={
        active
          ? {
              label: t("stopGroup"),
              icon: <StopIcon size={10} weight="fill" />,
              stops: true,
              onSelect: () => (confirmStop ? open() : void stopGroup(group)),
            }
          : undefined
      }
    />
  );
}

function GroupDetail({
  groupId,
  navigate,
  actions,
}: {
  groupId: number;
  navigate: Navigate;
  actions: PopoverActions;
}) {
  const { t } = useI18n();
  const group = useStore((state) =>
    state.commandGroups.find((entry) => entry.id === groupId),
  );
  if (!group) {
    return (
      <MenuBack
        label={t("menuBack")}
        onBack={() => navigate({ kind: "home" })}
      />
    );
  }
  return <GroupMembers group={group} navigate={navigate} actions={actions} />;
}

function GroupMembers({
  group,
  navigate,
  actions,
}: {
  group: CommandGroup;
  navigate: Navigate;
  actions: PopoverActions;
}) {
  const { t } = useI18n();
  const startGroup = useStore((state) => state.startGroup);
  const stopGroup = useStore((state) => state.stopGroup);
  const status = useGroupStatus(group);
  return (
    <>
      <MenuBack label={group.label} onBack={() => navigate({ kind: "home" })} />
      <MenuSeparator />
      {status.rows.map((row) => (
        <CommandItem
          key={row.key}
          projectId={row.projectId}
          command={row.command}
          detail={row.projectName}
          navigate={navigate}
        />
      ))}
      <MenuSeparator />
      {status.running < status.total ? (
        <MenuItem
          label={status.running ? t("startMissing") : t("runGroup")}
          onSelect={() => void startGroup(group)}
        />
      ) : null}
      {status.running ? (
        <MenuItem
          label={t("stopGroup")}
          shortcut="⌘⌫"
          onSelect={() => void stopGroup(group)}
        />
      ) : null}
      <MenuItem
        label={t("menuShowInApp")}
        shortcut="⌘O"
        onSelect={() => actions.openSection("commands")}
      />
    </>
  );
}

function Home({
  navigate,
  actions,
}: {
  navigate: Navigate;
  actions: PopoverActions;
}) {
  const { t } = useI18n();
  const projectName = useProjectName();
  const executions = useStore((state) => state.executions);
  const seenAt = useStore((state) => state.seenFailuresAt);
  const projects = useStore((state) => state.projects);
  const scans = useStore((state) => state.scans);
  const custom = useStore((state) => state.customCommands);
  const groups = useStore((state) => state.commandGroups);
  const now = activity(executions, seenAt);
  const shown = new Set(
    now.map((execution) => `${execution.projectId}:${execution.commandId}`),
  );
  const favorites = menubarFavourites(
    scans,
    projects,
    custom,
    executions,
  ).filter((entry) => !shown.has(`${entry.projectId}:${entry.command.id}`));
  return (
    <>
      <Header />
      {now.length ? (
        <>
          <MenuSeparator />
          {now.map((execution) => (
            <ExecutionItem
              key={execution.id}
              execution={execution}
              navigate={navigate}
            />
          ))}
        </>
      ) : null}
      {groups.length ? (
        <>
          <MenuSeparator />
          <MenuHeading>{t("groupsTitle")}</MenuHeading>
          {groups.map((group) => (
            <GroupItem key={group.id} group={group} navigate={navigate} />
          ))}
        </>
      ) : null}
      {favorites.length ? (
        <>
          <MenuSeparator />
          <MenuHeading>{t("menuFavorites")}</MenuHeading>
          {favorites.slice(0, FAVORITES_ON_HOME).map((entry) => (
            <CommandItem
              key={`${entry.projectId}:${entry.command.id}`}
              projectId={entry.projectId}
              command={entry.command}
              detail={projectName(entry.projectId)}
              navigate={navigate}
            />
          ))}
          {favorites.length > FAVORITES_ON_HOME ? (
            <MenuItem
              label={t("menuMoreFavorites")}
              meta={String(favorites.length - FAVORITES_ON_HOME)}
              submenu
              onSelect={() => navigate({ kind: "favorites" })}
            />
          ) : null}
        </>
      ) : null}
      <MenuSeparator />
      {projects.length === 0 ? (
        <>
          <MenuNote>{t("menuNoProjects")}</MenuNote>
          <MenuItem
            label={t("menuAddProject")}
            shortcut="⌘N"
            onSelect={actions.addProject}
          />
        </>
      ) : (
        <>
          <MenuItem
            label={t("menuProjects")}
            meta={String(projects.length)}
            submenu
            onSelect={() => navigate({ kind: "projects" })}
          />
          <MenuItem
            label={t("menuSearch")}
            shortcut="⌘K"
            onSelect={() => navigate({ kind: "search" })}
          />
        </>
      )}
      <MenuSeparator />
      <AppItems actions={actions} />
    </>
  );
}

function Projects({
  navigate,
  actions,
}: {
  navigate: Navigate;
  actions: PopoverActions;
}) {
  const { t } = useI18n();
  const projects = useStore((state) => state.projects);
  const scans = useStore((state) => state.scans);
  const custom = useStore((state) => state.customCommands);
  const executions = useStore((state) => state.executions);
  const rescanning = useStore((state) => state.rescanning);
  const rescanProjects = useStore((state) => state.rescanProjects);
  const visible = catalogRows(
    projects,
    scans,
    custom,
    t("personalCommands"),
  ).filter((row) => !row.hidden);
  const personal = custom.filter((command) => command.projectId === null);
  const runningIn = (id: number) =>
    executions.some(
      (execution) =>
        execution.projectId === id && isActiveState(execution.state),
    );
  return (
    <>
      <MenuBack
        label={t("menuProjects")}
        onBack={() => navigate({ kind: "home" })}
      />
      <MenuSeparator />
      {projects.map((project) => {
        const missing = project.availability !== "available";
        const count = visible.filter(
          (row) => row.projectId === project.id,
        ).length;
        return (
          <MenuItem
            key={project.id}
            lead={
              runningIn(project.id) ? (
                <span className="pulso-menu__dot" data-state="running" />
              ) : null
            }
            label={project.name}
            meta={missing ? t("menuUnavailable") : String(count)}
            disabled={missing}
            submenu={!missing}
            onSelect={() =>
              navigate({ kind: "project", projectId: project.id })
            }
          />
        );
      })}
      {personal.length ? (
        <MenuItem
          lead={
            runningIn(0) ? (
              <span className="pulso-menu__dot" data-state="running" />
            ) : null
          }
          label={t("personalCommands")}
          meta={String(personal.length)}
          submenu
          onSelect={() => navigate({ kind: "project", projectId: 0 })}
        />
      ) : null}
      <MenuSeparator />
      <MenuItem
        label={t("menuAddProject")}
        shortcut="⌘N"
        onSelect={actions.addProject}
      />
      <MenuItem
        label={t("menuRescan")}
        shortcut="⌘R"
        disabled={rescanning}
        onSelect={() => void rescanProjects()}
      />
    </>
  );
}

function Project({
  projectId,
  navigate,
  actions,
}: {
  projectId: number;
  navigate: Navigate;
  actions: PopoverActions;
}) {
  const { t } = useI18n();
  const projectName = useProjectName();
  const projects = useStore((state) => state.projects);
  const scans = useStore((state) => state.scans);
  const custom = useStore((state) => state.customCommands);
  const commands = catalogRows(projects, scans, custom, t("personalCommands"))
    .filter((row) => row.projectId === projectId && !row.hidden)
    .map((row) => row.command);
  return (
    <>
      <MenuBack
        label={projectName(projectId)}
        onBack={() => navigate({ kind: "projects" })}
      />
      <MenuSeparator />
      {commands.length ? (
        commands.map((command) => (
          <CommandItem
            key={command.id}
            projectId={projectId}
            command={command}
            navigate={navigate}
          />
        ))
      ) : (
        <MenuNote>{t("menuNoCommands")}</MenuNote>
      )}
      {projectId ? (
        <>
          <MenuSeparator />
          <MenuItem
            label={t("menuShowProject")}
            shortcut="⌘O"
            onSelect={() => actions.openSection("projects")}
          />
        </>
      ) : null}
    </>
  );
}

function Favorites({ navigate }: { navigate: Navigate }) {
  const { t } = useI18n();
  const projectName = useProjectName();
  const projects = useStore((state) => state.projects);
  const scans = useStore((state) => state.scans);
  const custom = useStore((state) => state.customCommands);
  const executions = useStore((state) => state.executions);
  return (
    <>
      <MenuBack
        label={t("menuFavorites")}
        onBack={() => navigate({ kind: "home" })}
      />
      <MenuSeparator />
      {menubarFavourites(scans, projects, custom, executions).map((entry) => (
        <CommandItem
          key={`${entry.projectId}:${entry.command.id}`}
          projectId={entry.projectId}
          command={entry.command}
          detail={projectName(entry.projectId)}
          navigate={navigate}
        />
      ))}
    </>
  );
}

function ExecutionDetail({
  executionId,
  navigate,
  actions,
}: {
  executionId: number;
  navigate: Navigate;
  actions: PopoverActions;
}) {
  const { t } = useI18n();
  const projectName = useProjectName();
  const execution = useStore((state) =>
    state.executions.find((entry) => entry.id === executionId),
  );
  const lines = useStore((state) => state.logs[executionId] ?? NO_LOGS);
  const loadLogs = useStore((state) => state.loadLogs);
  const stopExecution = useStore((state) => state.stopExecution);
  const restartExecution = useStore((state) => state.restartExecution);
  const openUrl = useStore((state) => state.openUrl);
  const active = execution ? isActiveState(execution.state) : false;
  const elapsed = useElapsed(execution?.startedAt, active);
  useEffect(() => {
    void loadLogs(executionId);
  }, [executionId, loadLogs]);
  if (!execution)
    return (
      <MenuBack
        label={t("menuBack")}
        onBack={() => navigate({ kind: "home" })}
      />
    );
  const status = active
    ? t("menuRunningFor", { time: elapsed })
    : execution.state === "failed"
      ? t("menuFailedWith", { code: execution.exitCode ?? "·" })
      : execution.state === "interrupted"
        ? t("menuInterrupted")
        : t("menuExited", { code: execution.exitCode ?? 0 });
  const tail = lines.slice(-LOG_TAIL);
  return (
    <>
      <MenuBack
        label={`${execution.label} · ${projectName(execution.projectId)}`}
        onBack={() => navigate({ kind: "home" })}
      />
      <MenuNote>{status}</MenuNote>
      <pre className="pulso-menu__log" aria-label={t("sectionLogs")}>
        {tail.length ? (
          tail.map((line) => (
            <span key={line.seq} data-stream={line.stream}>
              {line.text}
              {"\n"}
            </span>
          ))
        ) : (
          <span data-stream="none">{t("menuNoOutput")}</span>
        )}
      </pre>
      <MenuSeparator />
      {active ? (
        <>
          <MenuItem
            label={t("menuStop")}
            shortcut="⌘⌫"
            disabled={execution.state === "stopping"}
            onSelect={() => void stopExecution(execution.id)}
          />
          <MenuItem
            label={t("menuRestart")}
            shortcut="⌘R"
            onSelect={() => void restartExecution(execution.id)}
          />
          {execution.ports.map((port) => (
            <MenuItem
              key={port.id}
              label={t("menuOpenPort", { port: String(port.port) })}
              onSelect={() => void openUrl(execution.id, port.id)}
            />
          ))}
        </>
      ) : (
        <MenuItem
          label={t("menuRetry")}
          shortcut="⌘R"
          onSelect={() => void restartExecution(execution.id)}
        />
      )}
      <MenuSeparator />
      <MenuItem
        label={t("menuShowInApp")}
        shortcut="⌘O"
        onSelect={() => actions.openSection("logs")}
      />
    </>
  );
}

function Search({
  query,
  setQuery,
  navigate,
}: {
  query: string;
  setQuery: (value: string) => void;
  navigate: Navigate;
}) {
  const { t } = useI18n();
  const projects = useStore((state) => state.projects);
  const scans = useStore((state) => state.scans);
  const custom = useStore((state) => state.customCommands);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    field.current?.focus();
  }, []);
  const needle = query.trim().toLowerCase();
  const words = needle.split(/\s+/).filter(Boolean);
  const rows = rowsFrom(projects, scans, custom, t("personalCommands")).filter(
    (row) =>
      !row.hidden &&
      words.every((word) =>
        `${row.label} ${row.invocation} ${row.project.name}`
          .toLowerCase()
          .includes(word),
      ),
  );
  const matchingProjects = needle
    ? projects.filter(
        (project) =>
          project.availability === "available" &&
          project.name.toLowerCase().includes(needle),
      )
    : [];
  return (
    <>
      <div className="pulso-menu__search">
        <MagnifyingGlassIcon size={13} aria-hidden />
        <input
          ref={field}
          type="search"
          aria-label={t("menuSearchField")}
          placeholder={t("menuSearch")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <MenuSeparator />
      {needle ? (
        <>
          {rows.slice(0, 30).map((row) => {
            const command =
              row.scan?.commands.find((entry) => entry.id === row.commandId) ??
              customDetected(
                custom.find((entry) => `custom:${entry.id}` === row.commandId)!,
              );
            return (
              <CommandItem
                key={`${row.project.id}:${row.commandId}`}
                projectId={row.project.id}
                command={command}
                detail={row.project.name}
                navigate={navigate}
              />
            );
          })}
          {matchingProjects.length ? (
            <>
              <MenuHeading>{t("menuProjects")}</MenuHeading>
              {matchingProjects.map((project) => (
                <MenuItem
                  key={project.id}
                  label={project.name}
                  submenu
                  onSelect={() =>
                    navigate({ kind: "project", projectId: project.id })
                  }
                />
              ))}
            </>
          ) : null}
          {rows.length === 0 && matchingProjects.length === 0 ? (
            <MenuNote>{t("menuNoMatch")}</MenuNote>
          ) : null}
        </>
      ) : null}
    </>
  );
}

export function MenubarMenu({
  view,
  navigate,
  query,
  setQuery,
  actions,
}: {
  view: MenuView;
  navigate: Navigate;
  query: string;
  setQuery: (value: string) => void;
  actions: PopoverActions;
}) {
  const error = useStore((state) => state.projectError);
  const dismissProjectError = useStore((state) => state.dismissProjectError);
  return (
    <>
      {view.kind === "home" ? (
        <Home navigate={navigate} actions={actions} />
      ) : null}
      {view.kind === "projects" ? (
        <Projects navigate={navigate} actions={actions} />
      ) : null}
      {view.kind === "project" ? (
        <Project
          projectId={view.projectId}
          navigate={navigate}
          actions={actions}
        />
      ) : null}
      {view.kind === "favorites" ? <Favorites navigate={navigate} /> : null}
      {view.kind === "group" ? (
        <GroupDetail
          groupId={view.groupId}
          navigate={navigate}
          actions={actions}
        />
      ) : null}
      {view.kind === "execution" ? (
        <ExecutionDetail
          executionId={view.executionId}
          navigate={navigate}
          actions={actions}
        />
      ) : null}
      {view.kind === "search" ? (
        <Search query={query} setQuery={setQuery} navigate={navigate} />
      ) : null}
      {error ? (
        <div className="px-2.5 pt-1.5">
          <ErrorNote error={error} onDismiss={dismissProjectError} />
        </div>
      ) : null}
    </>
  );
}
