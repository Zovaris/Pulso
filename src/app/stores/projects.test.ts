import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "@/app/store";
import type { CommandScan, DetectedCommand } from "@/lib/types";
import * as projectsApi from "@/services/api/projects";

vi.mock("@/services/api/projects", () => ({
  listProjects: vi.fn(),
  addProject: vi.fn(),
  removeProject: vi.fn(),
  listCommands: vi.fn(),
  rescanProjects: vi.fn(),
}));

const api = vi.mocked(projectsApi);

const command: DetectedCommand = {
  id: "cargo_toml:test",
  label: "test",
  program: "cargo",
  args: ["test"],
  cwd: "/tmp/project",
  source: "/tmp/project/Cargo.toml",
  detector: "cargo_toml",
  category: "test",
  longRunning: false,
};

const scan: CommandScan = {
  projectId: 1,
  commands: [command],
  status: "detected",
  detail: null,
};

beforeEach(() => {
  useStore.setState({
    projects: [],
    scans: {},
    scanningProjectId: null,
    rescanning: false,
    expandedProjectId: null,
    projectError: null,
  });
});

describe("rescanProjects", () => {
  it("is busy only while the backend is reading", async () => {
    let finish = () => {};
    api.rescanProjects.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );

    const inFlight = useStore.getState().rescanProjects();
    expect(useStore.getState().rescanning).toBe(true);

    finish();
    await inFlight;

    expect(useStore.getState().rescanning).toBe(false);
  });

  it("takes the scans the backend pushes while it works", async () => {
    api.rescanProjects.mockImplementation(async () => {
      useStore.getState().applyScan(scan);
    });

    await useStore.getState().rescanProjects();

    expect(useStore.getState().scans["1"].commands).toHaveLength(1);
  });

  it("clears a note it was carrying before asking again", async () => {
    useStore.setState({
      projectError: { kind: "internal", message: "stale", path: null },
    });
    api.rescanProjects.mockResolvedValue();

    await useStore.getState().rescanProjects();

    expect(useStore.getState().projectError).toBeNull();
  });

  it("stops being busy and reports a scan that failed", async () => {
    api.rescanProjects.mockRejectedValue({
      kind: "storage",
      message: "disk",
      path: null,
    });

    await useStore.getState().rescanProjects();

    expect(useStore.getState().rescanning).toBe(false);
    expect(useStore.getState().projectError?.kind).toBe("storage");
  });
});
