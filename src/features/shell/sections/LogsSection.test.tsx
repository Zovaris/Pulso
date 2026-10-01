import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "@/app/store";
import { LogsSection } from "@/features/shell/sections/LogsSection";
import type { Execution, LogLine } from "@/lib/types";

vi.mock("@/services/api/executions", () => ({
  getLogSnapshot: vi.fn().mockResolvedValue({ executionId: 500, lines: [] }),
}));

const execution: Execution = {
  id: 500,
  projectId: 1,
  commandId: "test:dev",
  label: "dev",
  program: "bun",
  args: ["run", "dev"],
  cwd: "/tmp",
  state: "running",
  pid: 100,
  startedAt: 1,
  endedAt: null,
  exitCode: null,
  detail: null,
  restartedFrom: null,
  ports: [],
};

function line(
  seq: number,
  text: string,
  stream: LogLine["stream"] = "stdout",
): LogLine {
  return { seq, text, stream, at: seq };
}

beforeEach(() => {
  useStore.setState({
    locale: "en",
    projects: [],
    scans: {},
    executions: [execution],
    selectedExecutionId: execution.id,
    logs: {
      500: [line(1, "normal output"), line(2, "error output", "stderr")],
    },
    logFilter: { query: "", stream: "all" },
    logLines: 500,
    logAutoscroll: true,
  });
});

describe("LogsSection", () => {
  it("renders and copies the same stream filter", async () => {
    const copy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: copy },
    });
    render(<LogsSection />);
    fireEvent.click(screen.getByRole("radio", { name: "stderr" }));
    expect(screen.queryByText("normal output")).toBeNull();
    expect(screen.getByText("error output")).toBeTruthy();
    await act(async () =>
      fireEvent.click(
        screen.getByRole("button", { name: "Copy the visible log" }),
      ),
    );
    expect(copy.mock.calls[0][0]).toContain("error output");
    expect(copy.mock.calls[0][0]).not.toContain("normal output");
  });

  it("keeps following when the number of retained lines stays constant", () => {
    const { container } = render(<LogsSection />);
    const stream = container.querySelector(
      "div.pulso-stream",
    ) as HTMLDivElement;
    Object.defineProperty(stream, "scrollHeight", {
      configurable: true,
      value: 900,
    });
    act(() =>
      useStore.setState({
        logs: { 500: [line(2, "second"), line(3, "third")] },
      }),
    );
    expect(stream.scrollTop).toBe(900);
  });

  it("attaches scroll handling when output first becomes available", () => {
    useStore.setState({ logs: { 500: [] } });
    const { container } = render(<LogsSection />);
    act(() => useStore.setState({ logs: { 500: [line(1, "first")] } }));
    const stream = container.querySelector(
      "div.pulso-stream",
    ) as HTMLDivElement;
    Object.defineProperty(stream, "scrollHeight", {
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(stream, "clientHeight", {
      configurable: true,
      value: 100,
    });
    fireEvent.scroll(stream);
    expect(useStore.getState().logAutoscroll).toBe(false);
  });
});
