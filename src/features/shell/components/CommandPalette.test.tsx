import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useStore } from "@/app/store";
import { CommandPalette } from "@/features/shell/components/CommandPalette";
import type { CommandScan, Execution, Project } from "@/lib/types";

const run = (overrides: Partial<Execution>): Execution => ({
  id: 1,
  projectId: 1,
  commandId: "1:dev",
  label: overrides.commandId?.split(":")[1] ?? "dev",
  program: "make",
  args: [],
  cwd: "/p",
  state: "running",
  pid: 1,
  startedAt: 1_000,
  endedAt: null,
  exitCode: null,
  detail: null,
  restartedFrom: null,
  ports: [],
  ...overrides,
});

const project = (id: number, name: string): Project =>
  ({ id, name, path: `/p/${name}`, availability: "available" }) as Project;

const scan = (projectId: number, labels: string[]): CommandScan =>
  ({
    projectId,
    commands: labels.map((label) => ({
      id: `${projectId}:${label}`,
      label,
      program: "make",
      args: [label],
      cwd: `/p/${projectId}`,
      source: "Makefile",
      detector: "makefile",
      category: "dev",
      longRunning: false,
    })),
    status: "detected",
    detail: null,
    flags: {},
  }) as CommandScan;

const PROJECTS = [
  project(1, "justcallmebryan"),
  project(2, "design-atlas"),
  project(3, "Pulso"),
  project(4, "Gigi"),
];

const SCANS: Record<string, CommandScan> = {
  "1": scan(1, [
    "dev",
    "dev:force",
    "preview",
    "test:watch",
    "test",
    "format",
    "lint",
    "lint:fix",
  ]),
  "2": scan(2, ["build", "dev", "preview", "lint", "check", "format"]),
  "3": scan(3, [
    "dev",
    "build",
    "test",
    "lint",
    "typecheck",
    "format",
    "check",
    "preview",
    "bench",
    "e2e",
    "storybook",
    "clean",
    "start",
    "release",
  ]),
  "4": scan(4, ["test", "check", "build", "clean", "help", "icon"]),
};

function open(): HTMLInputElement {
  useStore.setState({
    locale: "en",
    paletteOpen: true,
    projects: PROJECTS,
    scans: SCANS,
    customCommands: [],
    executions: [],
    seenFailuresAt: 0,
  } as never);
  render(<CommandPalette />);
  return screen.getByRole("combobox");
}

const results = () => screen.queryAllByRole("option");

describe("CommandPalette", () => {
  it("offers places and actions until something is typed, not every command", () => {
    open();

    const labels = results().map((option) => option.textContent);
    expect(labels.some((label) => label?.startsWith("Go to Projects"))).toBe(
      true,
    );
    expect(labels.some((label) => label?.startsWith("Add project"))).toBe(true);
    expect(labels.some((label) => label?.startsWith("dev"))).toBe(false);
  });

  it("puts favorites and recent runs in the empty box, once each", () => {
    open();
    act(() =>
      useStore.setState({
        scans: {
          ...SCANS,
          "2": {
            ...SCANS["2"],
            flags: { "2:lint": { favorite: true, hidden: false } },
          },
        },
        executions: [
          run({
            id: 1,
            projectId: 4,
            commandId: "4:test",
            state: "exited",
            exitCode: 0,
          }),
        ],
      }),
    );

    const labels = results().map((option) => option.textContent);
    expect(labels.filter((label) => label?.startsWith("lint"))).toHaveLength(1);
    expect(
      labels.filter((label) => label?.startsWith("testGigi")),
    ).toHaveLength(1);
  });

  it("never stops on Enter: a running command opens its own actions, logs first", () => {
    open();
    act(() =>
      useStore.setState({
        executions: [run({ id: 9, projectId: 3, commandId: "3:dev" })],
      }),
    );

    fireEvent.click(
      results().find((option) =>
        option.textContent?.startsWith("dev · Pulso"),
      )!,
    );

    const actions = results().map((option) => option.textContent);
    expect(actions[0]).toBe("See logs");
    expect(actions).toContain("Stop");
    expect(useStore.getState().paletteOpen).toBe(true);
  });

  it("ranks the closest name first, whatever order the projects came in", async () => {
    const input = open();

    fireEvent.change(input, { target: { value: "lint" } });
    await act(async () => {});

    expect(results()[0].textContent?.startsWith("lint")).toBe(true);
    expect(
      results().findIndex((option) =>
        option.textContent?.startsWith("lint:fix"),
      ),
    ).toBeGreaterThan(0);
  });

  it("searches every project, not only the ones it suggests", () => {
    const input = open();

    fireEvent.change(input, { target: { value: "check" } });

    expect(results()).toHaveLength(4);
  });

  it("finds a command that exists in a single project", () => {
    const input = open();

    fireEvent.change(input, { target: { value: "storybook" } });

    expect(results()).toHaveLength(1);
  });

  it("narrows again as the query gets longer", () => {
    const input = open();

    fireEvent.change(input, { target: { value: "b" } });
    const loose = results().length;
    fireEvent.change(input, { target: { value: "storybook" } });

    expect(loose).toBeGreaterThan(results().length);
  });

  it("runs a stopped group on Enter and opens a running one", () => {
    const startGroup = vi.fn(async () => {});
    const group = {
      id: 1,
      label: "Stack",
      members: [
        { projectId: 3, commandId: "3:dev" },
        { projectId: 4, commandId: "4:test" },
      ],
    };
    open();
    act(() => useStore.setState({ commandGroups: [group], startGroup }));

    fireEvent.click(
      results().find((option) => option.textContent?.startsWith("Stack"))!,
    );
    expect(startGroup).toHaveBeenCalledWith(group);
  });
});
