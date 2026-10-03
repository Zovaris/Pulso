import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "@/app/store";
import { CommandsSection } from "@/features/shell/sections/CommandsSection";
import type { CommandScan, Execution } from "@/lib/types";

const saveCommandGroup = vi.fn(async () => true);
const startGroup = vi.fn(async () => {});
const stopGroup = vi.fn(async () => {});

const scan = (projectId: number): CommandScan => ({
  projectId,
  status: "detected",
  detail: null,
  commands: ["dev", "test"].map((label) => ({
    id: `package_json:${label}`,
    label,
    program: "bun",
    args: ["run", label],
    cwd: "/p",
    source: "package.json",
    detector: "package_json",
    category: "dev" as const,
    longRunning: false,
  })),
  flags: {},
});
const running = (projectId: number): Execution => ({
  id: projectId,
  projectId,
  commandId: "package_json:dev",
  label: "dev",
  program: "bun",
  args: [],
  cwd: "/p",
  state: "running",
  pid: 1,
  startedAt: 1,
  endedAt: null,
  exitCode: null,
  detail: null,
  restartedFrom: null,
  ports: [],
});
const stack = {
  id: 1,
  label: "Stack",
  members: [
    { projectId: 1, commandId: "package_json:dev" },
    { projectId: 2, commandId: "package_json:dev" },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  useStore.setState({
    locale: "en",
    projects: [
      { id: 1, name: "api", path: "/p/api", availability: "available" },
      { id: 2, name: "web", path: "/p/web", availability: "available" },
    ],
    scans: { "1": scan(1), "2": scan(2) },
    customCommands: [],
    commandGroups: [stack],
    executions: [],
    confirmStop: false,
    saveCommandGroup,
    startGroup,
    stopGroup,
  });
});

const groupRow = () =>
  within(screen.getByRole("list", { name: "Groups" })).getAllByRole(
    "listitem",
  )[0];

describe("command groups", () => {
  it("runs a stopped group from its row", () => {
    render(<CommandsSection />);

    expect(within(groupRow()).getByText("2 commands")).toBeTruthy();
    fireEvent.click(within(groupRow()).getByRole("button", { name: "Run" }));

    expect(startGroup).toHaveBeenCalledWith(stack);
  });

  it("offers to start the rest of a half-running group and asks before stopping it when told to", () => {
    useStore.setState({ executions: [running(1)], confirmStop: true });
    render(<CommandsSection />);

    expect(within(groupRow()).getByText("1 of 2 running")).toBeTruthy();
    fireEvent.click(
      within(groupRow()).getByRole("button", {
        name: "Start the ones not running",
      }),
    );
    expect(startGroup).toHaveBeenCalledWith(stack);

    fireEvent.click(within(groupRow()).getByRole("button", { name: "Stop" }));
    expect(stopGroup).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Stop group",
      }),
    );
    expect(stopGroup).toHaveBeenCalledWith(stack);
  });

  it("saves a new group with the commands in the order they were picked", async () => {
    render(<CommandsSection />);
    fireEvent.click(screen.getByRole("button", { name: "New group" }));
    fireEvent.change(screen.getByLabelText("Group name"), {
      target: { value: "Tests" },
    });
    const picker = within(
      screen.getByRole("list", { name: "Commands in the group" }),
    );
    const boxes = picker.getAllByRole("checkbox");
    fireEvent.click(boxes[3]);
    fireEvent.click(boxes[1]);
    fireEvent.click(screen.getByRole("button", { name: "Save group" }));

    await waitFor(() =>
      expect(saveCommandGroup).toHaveBeenCalledWith({
        id: null,
        label: "Tests",
        members: [
          { projectId: 2, commandId: "package_json:test" },
          { projectId: 1, commandId: "package_json:test" },
        ],
      }),
    );
  });
});
