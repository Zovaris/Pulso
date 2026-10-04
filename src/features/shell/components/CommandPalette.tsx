import {
  ArrowSquareOutIcon,
  ArrowsClockwiseIcon,
  ClockCounterClockwiseIcon,
  FolderSimpleIcon,
  FolderSimplePlusIcon,
  PlayIcon,
  StackIcon,
  StarIcon,
  StopIcon,
  TextAlignLeftIcon,
} from "@phosphor-icons/react";
import {
  type CommandItem,
  CommandPalette as SephiroPalette,
} from "@zovaris/sephiro";
import { useCallback, useMemo, useRef, useState } from "react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import type { SectionId } from "@/app/stores/types";
import { type PaletteRow, rankAll, rowsFrom } from "@/features/desktop/palette";
import {
  isActiveState,
  latestExecution,
} from "@/features/executions/execution";
import { catalogRows } from "@/features/desktop/catalog";
import { groupStatus } from "@/features/desktop/groups";
import { activity } from "@/features/popover/menubar/MenubarMenu";
import { useAddProject } from "@/features/projects/useAddProject";
import { SECTIONS, shortcutOf } from "@/features/shell/sections";
import type { Execution } from "@/lib/types";

const RECENT = 5;

/** Where an item may appear: the empty box, a query, or both. */
type Reach = { home: boolean; search: string | null };

const rowKey = (projectId: number, commandId: string) =>
  `${projectId}:${commandId}`;

function words(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/** The most recently started commands that are neither running, failing nor starred. */
export function recentRows(
  rows: PaletteRow[],
  executions: Execution[],
  skip: Set<string>,
): PaletteRow[] {
  const found: PaletteRow[] = [];
  const taken = new Set(skip);
  for (const execution of [...executions].sort(
    (left, right) => right.startedAt - left.startedAt,
  )) {
    const key = rowKey(execution.projectId, execution.commandId);
    if (taken.has(key)) continue;
    taken.add(key);
    const row = rows.find(
      (entry) => rowKey(entry.project.id, entry.commandId) === key,
    );
    if (row && !row.favorite && !row.hidden) found.push(row);
    if (found.length === RECENT) break;
  }
  return found;
}

/**
 * Enter only ever does the safe thing. A stopped command runs; anything that
 * is running or just failed opens its own level, where Logs comes first and
 * Stop or Restart have to be chosen by name. The same rule as the menubar.
 */
export function CommandPalette() {
  const { t } = useI18n();
  const open = useStore((state) => state.paletteOpen);
  const projects = useStore((state) => state.projects);
  const customCommands = useStore((state) => state.customCommands);
  const scans = useStore((state) => state.scans);
  const executions = useStore((state) => state.executions);
  const seenAt = useStore((state) => state.seenFailuresAt);
  const commandGroups = useStore((state) => state.commandGroups);
  const addProject = useAddProject();
  const catalog = useMemo(
    () => catalogRows(projects, scans, customCommands, t("personalCommands")),
    [projects, scans, customCommands, t],
  );
  const rows = useMemo(
    () =>
      rowsFrom(projects, scans, customCommands, t("personalCommands")).filter(
        (row) => !row.hidden,
      ),
    [projects, scans, customCommands, t],
  );

  const [query, setQuery] = useState("");
  const seenQuery = useRef("");

  const { items, reach } = useMemo(() => {
    const reach = new Map<string, Reach>();
    const put = (item: CommandItem, where: Reach) => {
      reach.set(String(item.id), where);
      return item;
    };
    const projectName = (id: number) =>
      projects.find((project) => project.id === id)?.name ??
      t("personalCommands");
    const now = activity(executions, seenAt);
    const busy = new Set(
      now.map((execution) => rowKey(execution.projectId, execution.commandId)),
    );
    const idle = rows.filter(
      (row) => !busy.has(rowKey(row.project.id, row.commandId)),
    );
    const needle = words(query).join(" ");

    const running = now.map((execution) => {
      const active = isActiveState(execution.state);
      const settling =
        execution.state === "starting" || execution.state === "stopping";
      const ports = execution.ports.map((port) => `:${port.port}`).join(" ");
      const children: CommandItem[] = [
        {
          id: `logs:${execution.id}`,
          label: t("seeLogs"),
          icon: <TextAlignLeftIcon size={16} />,
        },
        ...(active
          ? [
              {
                id: `restart:${execution.id}`,
                label: t("restartCommand"),
                disabled: settling,
                icon: <ArrowsClockwiseIcon size={16} />,
              },
              {
                id: `stop:${execution.id}`,
                label: t("stopCommand"),
                disabled: settling,
                icon: <StopIcon size={15} />,
              },
              ...execution.ports.map((port) => ({
                id: `port:${execution.id}:${port.id}`,
                label: t("menuOpenPort", { port: String(port.port) }),
                icon: <ArrowSquareOutIcon size={16} />,
              })),
            ]
          : [
              {
                id: `retry:${execution.id}`,
                label: t("menuRetry"),
                icon: <PlayIcon size={15} />,
              },
            ]),
      ];
      return put(
        {
          id: `exec:${execution.id}`,
          label: [execution.label, projectName(execution.projectId), ports]
            .filter(Boolean)
            .join(" · "),
          badge: t(
            `state${execution.state[0].toUpperCase()}${execution.state.slice(1)}`,
          ),
          icon: <span className="pulso-dot" data-s={execution.state} />,
          group: t("paletteActivity"),
          children,
        },
        {
          home: true,
          search: `${execution.label} ${execution.program} ${execution.args.join(" ")} ${projectName(execution.projectId)}`,
        },
      );
    });

    const command = (
      row: PaletteRow,
      group: string,
      prefix: string,
      where: Reach,
      recent = false,
    ): CommandItem =>
      put(
        {
          id: `${prefix}:${rowKey(row.project.id, row.commandId)}`,
          label: row.label,
          hint: `${row.project.name} · ${row.invocation}`,
          icon: recent ? (
            <ClockCounterClockwiseIcon size={16} />
          ) : row.favorite ? (
            <StarIcon size={16} weight="fill" />
          ) : (
            <PlayIcon size={15} />
          ),
          group,
        },
        where,
      );

    const favorites = idle
      .filter((row) => row.favorite)
      .map((row) =>
        command(row, t("filterFavorites"), "fav", { home: true, search: null }),
      );
    const recent = recentRows(idle, executions, new Set()).map((row) =>
      command(
        row,
        t("paletteRecent"),
        "recent",
        { home: true, search: null },
        true,
      ),
    );
    const ranked = rankAll(idle, needle).map((row) =>
      command(row, t("paletteCommands"), "run", {
        home: false,
        search: `${row.label} ${row.invocation} ${row.project.name}`,
      }),
    );
    const unranked = needle
      ? []
      : idle.map((row) =>
          command(row, t("paletteCommands"), "run", {
            home: false,
            search: `${row.label} ${row.invocation} ${row.project.name}`,
          }),
        );

    const projectItems = projects.map((project) =>
      put(
        {
          id: `project:${project.id}`,
          label: project.name,
          hint: project.path,
          icon: <FolderSimpleIcon size={16} />,
          group: t("projects"),
        },
        { home: false, search: project.name },
      ),
    );
    const sections = SECTIONS.map((section) =>
      put(
        {
          id: `nav:${section.id}`,
          label: t("paletteGoTo", { section: t(section.labelKey) }),
          shortcut: shortcutOf(section.id),
          group: t("paletteNavigation"),
        },
        { home: true, search: t(section.labelKey) },
      ),
    );
    const actions = [
      put(
        {
          id: "act:add-project",
          label: t("menuAddProject"),
          icon: <FolderSimplePlusIcon size={16} />,
          group: t("paletteActions"),
        },
        { home: true, search: t("menuAddProject") },
      ),
      put(
        {
          id: "act:rescan",
          label: t("menuRescan"),
          icon: <ArrowsClockwiseIcon size={16} />,
          shortcut: ["⌘", "R"],
          group: t("paletteActions"),
        },
        { home: true, search: t("menuRescan") },
      ),
    ];

    const groupItems = commandGroups.map((group) => {
      const status = groupStatus(group, catalog, executions);
      const active = status.running > 0;
      const children: CommandItem[] = [
        ...(status.running < status.total
          ? [
              {
                id: `group-start:${group.id}`,
                label: t("startMissing"),
                icon: <PlayIcon size={15} />,
              },
            ]
          : []),
        {
          id: `group-stop:${group.id}`,
          label: t("stopGroup"),
          icon: <StopIcon size={15} />,
        },
        {
          id: `group-show:${group.id}`,
          label: t("showProcesses"),
          icon: <TextAlignLeftIcon size={16} />,
        },
      ];
      return put(
        {
          id: `group:${group.id}`,
          label: active
            ? `${group.label} · ${t("groupRunning", { running: status.running, total: status.total })}`
            : group.label,
          hint: active ? undefined : t("groupIdle", { count: status.total }),
          icon: active ? (
            <span className="pulso-dot" data-s="running" />
          ) : (
            <StackIcon size={16} />
          ),
          group: t("groupsTitle"),
          ...(active ? { children } : {}),
        },
        {
          home: true,
          search: `${group.label} ${status.rows.map((row) => `${row.command.label} ${row.projectName}`).join(" ")}`,
        },
      );
    });

    return {
      items: [
        ...running,
        ...groupItems,
        ...favorites,
        ...recent,
        ...(needle ? ranked : unranked),
        ...projectItems,
        ...sections,
        ...actions,
      ],
      reach,
    };
  }, [rows, catalog, commandGroups, executions, seenAt, projects, query, t]);

  const filter = useCallback(
    (item: CommandItem, typed: string) => {
      if (typed !== seenQuery.current) {
        seenQuery.current = typed;
        queueMicrotask(() => setQuery(typed));
      }
      const where = reach.get(String(item.id));
      if (!where)
        return words(typed).every((word) =>
          String(item.label).toLowerCase().includes(word),
        );
      const needle = words(typed);
      if (needle.length === 0) return where.home;
      if (where.search === null) return false;
      const text = where.search.toLowerCase();
      return needle.every((word) => text.includes(word));
    },
    [reach],
  );

  const select = (item: CommandItem) => {
    const state = useStore.getState();
    const id = String(item.id);
    const [kind, ...rest] = id.split(":");
    const target = rest.join(":");
    const execution = state.executions.find(
      (entry) => entry.id === Number(rest[0]),
    );

    if (kind === "nav") state.setSection(target as SectionId);
    else if (kind === "project") {
      state.selectProject(Number(target));
      state.setSection("projects");
    } else if (kind.startsWith("group")) {
      const group = state.commandGroups.find(
        (entry) => entry.id === Number(target),
      );
      if (!group) return;
      if (kind === "group" || kind === "group-start")
        void state.startGroup(group);
      else if (kind === "group-stop") void state.stopGroup(group);
      else state.setSection("processes");
    } else if (kind === "act") {
      if (target === "add-project") void addProject();
      else if (target === "rescan") void state.rescanProjects();
    } else if (kind === "fav" || kind === "recent" || kind === "run") {
      const separator = target.indexOf(":");
      const projectId = Number(target.slice(0, separator));
      const commandId = target.slice(separator + 1);
      const last = latestExecution(state.executions, projectId, commandId);
      if (last && isActiveState(last.state)) {
        state.select(last.id);
        state.setSection("logs");
      } else void state.startCommand(projectId, commandId);
    } else if (!execution) return;
    else if (kind === "logs") {
      state.select(execution.id);
      state.setSection("logs");
    } else if (kind === "stop" && isActiveState(execution.state)) {
      if (state.confirmStop) state.askStop(execution.id);
      else void state.stopExecution(execution.id);
    } else if (kind === "restart" || kind === "retry")
      void state.restartExecution(execution.id);
    else if (kind === "port")
      void state.openUrl(execution.id, rest.slice(1).join(":"));
  };

  return (
    <SephiroPalette
      className="pulso-command-palette"
      open={open}
      onOpenChange={(next) => {
        const state = useStore.getState();
        if (next) state.openPalette();
        else state.closePalette();
      }}
      items={items}
      filter={filter}
      onSelect={select}
      homeLabel={t("appName")}
      placeholder={t("palettePlaceholder")}
      emptyMessage={t("paletteEmpty")}
      ariaLabel={t("shortcutPalette")}
    />
  );
}
