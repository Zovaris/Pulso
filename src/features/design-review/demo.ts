import { useStore } from "@/app/store";
import { flagsFor } from "@/features/desktop/commands";
import type { AppStore } from "@/app/stores/types";
import type {
  CommandFlags,
  CommandScan,
  DetectedCommand,
  Execution,
  Project,
} from "@/lib/types";

export function installDesignDemo() {
  const projects: Project[] = [
    {
      id: 1,
      name: "Pulso",
      path: "/demo/projects/pulso",
      availability: "available",
    },
    {
      id: 2,
      name: "Sephiro",
      path: "/demo/projects/sephiro",
      availability: "available",
    },
    {
      id: 3,
      name: "Asterism",
      path: "/demo/projects/asterism",
      availability: "available",
    },
    {
      id: 4,
      name: "Archivo de proyectos",
      path: "/demo/archive",
      availability: "missing",
    },
  ];
  const command = (
    project: Project,
    label: string,
    category: DetectedCommand["category"],
  ): DetectedCommand => ({
    id: `package_json:${label}`,
    label,
    program: "bun",
    args: ["run", label],
    cwd: project.path,
    source: "package.json",
    detector: "package_json",
    category,
    longRunning: label === "dev",
  });
  const scans: Record<string, CommandScan> = Object.fromEntries(
    projects.map((project) => [
      String(project.id),
      {
        projectId: project.id,
        status: project.availability === "missing" ? "unavailable" : "detected",
        detail: null,
        commands:
          project.availability === "missing"
            ? []
            : [
                command(project, "dev", "dev"),
                command(project, "build", "build"),
                command(project, "test", "test"),
                command(project, "lint", "lint"),
                command(project, "typecheck", "lint"),
                command(project, "preview", "dev"),
              ],
        flags: {
          "package_json:dev": { favorite: true, hidden: false },
          "package_json:test": { favorite: true, hidden: false },
          ...(project.id === 1
            ? { "package_json:lint": { favorite: true, hidden: false } }
            : {}),
        },
      } satisfies CommandScan,
    ]),
  );
  const now = Date.now();
  const execution = (
    id: number,
    projectId: number,
    label: string,
    state: Execution["state"],
    port?: number,
  ): Execution => ({
    id,
    projectId,
    commandId: `package_json:${label}`,
    label,
    program: "bun",
    args: ["run", label],
    cwd: projects[projectId - 1].path,
    state,
    pid: state === "running" ? 4100 + id : null,
    startedAt: now - id * 65000,
    endedAt: state === "running" ? null : now - 30000,
    exitCode: state === "failed" ? 1 : state === "exited" ? 0 : null,
    detail:
      state === "failed"
        ? "Demo: expected an accessible label on the save button."
        : null,
    restartedFrom: null,
    ports: port
      ? [{ id: `demo:${port}`, port, url: `http://localhost:${port}` }]
      : [],
  });
  const executions = [
    execution(1, 1, "dev", "running", 1420),
    execution(2, 2, "dev", "running", 3000),
    execution(3, 1, "test", "failed"),
    execution(4, 3, "build", "exited"),
  ];
  const note = (action: string) =>
    useStore
      .getState()
      .note(useStore.getState().t("designReviewAction", { action }));
  const noop = async () => {};
  const patches: Partial<AppStore> = {
    locale: "es",
    themePref: "dark",
    seenFailuresAt: 0,
    transparency: false,
    section: "projects",
    surface: "app",
    projects,
    scans,
    executions,
    selectedProjectId: 1,
    selectedExecutionId: 1,
    sidebarOpen: true,
    inspectorOpen: true,
    paletteOpen: false,
    argsFor: null,
    pendingCommandId: null,
    projectError: null,
    notice: null,
    commandGroups: [
      {
        id: 1,
        label: "Stack Pulso",
        members: [
          { projectId: 1, commandId: "package_json:dev" },
          { projectId: 2, commandId: "package_json:dev" },
          { projectId: 3, commandId: "package_json:dev" },
        ],
      },
    ],
    customCommands: [
      {
        id: 1,
        projectId: null,
        label: "Actualizar herramientas",
        command: "brew update",
        cwd: "/demo",
        favorite: true,
      },
    ],
    metrics: {
      1: { executionId: 1, cpu: 2.4, memory: 128 * 1024 * 1024, processes: 3 },
      2: { executionId: 2, cpu: 0.8, memory: 84 * 1024 * 1024, processes: 2 },
    },
    histories: { 1: [1, 2, 1.5, 2.4], 2: [0.5, 0.8] },
    history: [],
    historyProject: 1,
    historyLog: null,
    data: null,
    environment: null,
    environmentFor: null,
    logs: Object.fromEntries(
      executions.map((entry) => [
        entry.id,
        [
          {
            seq: 1,
            at: entry.startedAt,
            stream: "stdout",
            text: `$ bun run ${entry.label}`,
          },
          {
            seq: 2,
            at: entry.startedAt + 200,
            stream: entry.state === "failed" ? "stderr" : "stdout",
            text:
              entry.detail ??
              (entry.ports.length
                ? `Demo server ready at ${entry.ports[0].url}`
                : "Demo: build completed."),
          },
        ],
      ]),
    ),
    editors: [
      {
        id: "demo-editor",
        name: "Editor de ejemplo",
        bundleId: "demo.editor",
        path: "/demo/editor",
      },
    ],
    icons: {},
    editor: "demo-editor",
    loadProjects: noop,
    loadCommands: noop,
    loadCustomCommands: noop,
    loadCommandGroups: noop,
    loadExecutions: noop,
    hydratePreferences: noop,
    loadEditors: noop,
    loadDataStatus: noop,
    loadLogs: noop,
    rescanProjects: async () => {
      note("rescan");
    },
    rescanProject: async () => {
      note("rescan");
    },
    addProject: async () => {
      note("add project");
      return null;
    },
    removeProject: async () => {
      note("remove project");
    },
    startCommand: async (projectId, commandId) => {
      const state = useStore.getState();
      const detected = state.scans[String(projectId)]?.commands.find(
        (entry) => entry.id === commandId,
      );
      if (!detected) {
        note(commandId);
        return;
      }
      const next: Execution = {
        ...executions[0],
        id: Math.max(...state.executions.map((entry) => entry.id)) + 1,
        projectId,
        commandId,
        label: detected.label,
        cwd: detected.cwd,
        args: detected.args,
        state: "running",
        ports: [],
        startedAt: Date.now(),
        endedAt: null,
        exitCode: null,
      };
      useStore.setState({ executions: [...state.executions, next] });
      note(`${state.t("runCommand")} ${detected.label}`);
    },
    stopExecution: async (id) => {
      useStore.setState((state) => ({
        executions: state.executions.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                state: "exited",
                endedAt: Date.now(),
                exitCode: 0,
                ports: [],
              }
            : entry,
        ),
      }));
      note("stop");
    },
    restartExecution: async () => {
      note("restart");
    },
    clearFinished: async () => {
      useStore.setState((state) => ({
        executions: state.executions.filter(
          (entry) => entry.state === "running",
        ),
      }));
    },
    setCommandFlag: async (id, commandId, patch) => {
      useStore.setState((state) => {
        const scan = state.scans[String(id)];
        return {
          scans: {
            ...state.scans,
            [String(id)]: {
              ...scan,
              flags: {
                ...scan.flags,
                [commandId]: {
                  ...flagsFor(scan.flags, commandId),
                  ...patch,
                } satisfies CommandFlags,
              },
            },
          },
        };
      });
    },
    saveCommandGroup: async (group) => {
      useStore.setState((state) => ({
        commandGroups:
          group.id === null
            ? [
                ...state.commandGroups,
                {
                  ...group,
                  id:
                    Math.max(
                      0,
                      ...state.commandGroups.map((entry) => entry.id ?? 0),
                    ) + 1,
                },
              ]
            : state.commandGroups.map((entry) =>
                entry.id === group.id ? group : entry,
              ),
      }));
      return true;
    },
    deleteCommandGroup: async (id) => {
      useStore.setState((state) => ({
        commandGroups: state.commandGroups.filter((entry) => entry.id !== id),
      }));
      return true;
    },
    saveCustomCommand: async () => {
      note("save command");
      return false;
    },
    deleteCustomCommand: async () => {
      note("delete command");
      return false;
    },
    openProjectIn: async () => {
      note("open editor");
    },
    openUrl: async () => {
      note("open URL");
    },
    loadHistory: noop,
    toggleHistoryLog: noop,
    loadEnvironment: async () => {
      note("check environment");
    },
    clearHistory: noop,
    exportProjects: noop,
    importProjects: noop,
    revealDataFolder: noop,
    makeDiagnosticBundle: noop,
    saveLog: noop,
    updatePreferences: ({ theme, ...rest }) => {
      useStore.setState({ ...rest, ...(theme ? { themePref: theme } : {}) });
    },
    setThemePref: (themePref) => useStore.setState({ themePref }),
    setLocale: (locale) => useStore.setState({ locale }),
    setSound: (sound) => useStore.setState({ sound }),
    setTransparency: (transparency) => useStore.setState({ transparency }),
  };
  useStore.setState(patches);
}
