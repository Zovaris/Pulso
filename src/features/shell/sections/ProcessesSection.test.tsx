import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "@/app/store";
import type { Execution } from "@/lib/types";
import { ProcessesSection } from "./ProcessesSection";

const stopExecution = vi.fn(async () => {});

const run = (overrides: Partial<Execution>): Execution => ({
  id: 1,
  projectId: 1,
  commandId: "package_json:dev",
  label: "dev",
  program: "bun",
  args: ["run", "dev"],
  cwd: "/p",
  state: "running",
  pid: 10,
  startedAt: 1_000,
  endedAt: null,
  exitCode: null,
  detail: null,
  restartedFrom: null,
  ports: [],
  ...overrides,
});

beforeEach(() => {
  stopExecution.mockClear();
  useStore.setState({
    locale: "en",
    projects: [
      { id: 1, name: "api", path: "/p/api", availability: "available" },
    ],
    executions: [
      run({ id: 1 }),
      run({ id: 2, label: "worker", commandId: "package_json:worker" }),
      run({
        id: 3,
        label: "test",
        commandId: "package_json:test",
        state: "failed",
        endedAt: 5_000,
        exitCode: 1,
      }),
    ],
    metrics: {},
    confirmStop: false,
    stopExecution,
  });
});

describe("ProcessesSection", () => {
  it("shows a server waiting for its port, and only a server", () => {
    const command = (id: string, longRunning: boolean) => ({
      id,
      label: id,
      program: "bun",
      args: [],
      cwd: "/p",
      source: "package.json",
      detector: "package_json",
      category: "dev" as const,
      longRunning,
    });
    useStore.setState({
      executions: [
        run({ id: 1, startedAt: Date.now() }),
        run({
          id: 2,
          label: "worker",
          commandId: "package_json:worker",
          startedAt: Date.now(),
        }),
      ],
      scans: {
        "1": {
          projectId: 1,
          status: "detected",
          detail: null,
          commands: [
            command("package_json:dev", true),
            command("package_json:worker", false),
          ],
          flags: {},
        },
      },
    });
    render(<ProcessesSection />);

    const [, dev, worker] = screen.getAllByRole("row");
    expect(within(dev).getByText("Waiting for a port")).toBeTruthy();
    expect(within(worker).queryByText("Waiting for a port")).toBeNull();
  });

  it("opens on what is running and keeps finished runs one filter away", () => {
    render(<ProcessesSection />);

    expect(screen.getAllByRole("row")).toHaveLength(3);
    fireEvent.click(screen.getByRole("radio", { name: /^Finished/ }));
    const failed = screen.getAllByRole("row")[1];
    expect(within(failed).getByText("test")).toBeTruthy();
    expect(within(failed).getByText(/code 1/)).toBeTruthy();
  });

  it("asks before stopping everything when stops need confirmation", () => {
    useStore.setState({ confirmStop: true });
    render(<ProcessesSection />);

    fireEvent.click(screen.getByRole("button", { name: "Stop everything" }));
    expect(stopExecution).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Stop everything",
      }),
    );

    expect(stopExecution).toHaveBeenCalledTimes(2);
  });

  it("stops everything at once when stops need no confirmation", () => {
    render(<ProcessesSection />);

    fireEvent.click(screen.getByRole("button", { name: "Stop everything" }));

    expect(stopExecution).toHaveBeenCalledTimes(2);
  });
});
