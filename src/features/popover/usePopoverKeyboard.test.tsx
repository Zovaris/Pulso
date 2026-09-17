import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "@/app/store";
import { commandRowKey, projectRowKey } from "@/features/popover/cursor";
import { usePopoverKeyboard } from "@/features/popover/usePopoverKeyboard";
import type { CommandScan, DetectedCommand, Project } from "@/lib/types";

vi.mock("@/lib/tauri", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tauri")>()),
  closePopover: vi.fn(),
}));

const { closePopover } = vi.mocked(await import("@/lib/tauri"));

const project: Project = {
  id: 1,
  name: "project",
  path: "/tmp/project",
  availability: "available",
};

const dev: DetectedCommand = {
  id: "dev",
  label: "dev",
  program: "bun",
  args: ["run", "dev"],
  cwd: "/tmp/project",
  source: "/tmp/package.json",
  detector: "package_json",
  category: "build",
  longRunning: true,
};

const scan: CommandScan = {
  projectId: 1,
  commands: [dev],
  status: "detected",
  detail: null,
  flags: {},
};

function Harness() {
  usePopoverKeyboard();
  return null;
}

function press(key: string, init: KeyboardEventInit = {}) {
  fireEvent.keyDown(window, { key, ...init });
}

beforeEach(() => {
  vi.clearAllMocks();
  useStore.setState({
    projects: [project],
    scans: { "1": scan },
    expandedProjectId: null,
    executions: [],
    cursor: null,
    projectError: null,
  });
});

describe("usePopoverKeyboard", () => {
  it("walks the rows with the arrows", () => {
    render(<Harness />);

    press("ArrowDown");
    expect(useStore.getState().cursor).toBe(projectRowKey(1));

    press("ArrowUp");
    expect(useStore.getState().cursor).toBe(projectRowKey(1));
  });

  it("opens and runs with the horizontal keys and Enter", () => {
    render(<Harness />);

    press("ArrowDown");
    press("ArrowRight");
    expect(useStore.getState().expandedProjectId).toBe(1);

    press("ArrowDown");
    expect(useStore.getState().cursor).toBe(commandRowKey(1, "dev"));

    press("ArrowLeft");
    expect(useStore.getState().cursor).toBe(projectRowKey(1));
  });

  it("closes the popover with Escape", () => {
    render(<Harness />);

    press("Escape");

    expect(closePopover).toHaveBeenCalledTimes(1);
  });

  it("leaves a modifier combination to the system", () => {
    render(<Harness />);

    press("ArrowDown", { metaKey: true });
    press("ArrowDown", { shiftKey: true });

    expect(useStore.getState().cursor).toBeNull();
  });
});
