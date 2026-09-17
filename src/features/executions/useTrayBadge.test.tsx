import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "@/app/store";
import { renderBadge } from "@/features/executions/trayBadge";
import { useTrayBadge } from "@/features/executions/useTrayBadge";
import type { Execution, ExecutionState } from "@/lib/types";
import { setTrayBadge } from "@/services/api/tray";

vi.mock("@/features/executions/trayBadge", () => ({ renderBadge: vi.fn() }));
vi.mock("@/services/api/tray", () => ({ setTrayBadge: vi.fn() }));

const badge = vi.mocked(renderBadge);
const set = vi.mocked(setTrayBadge);

function execution(id: number, state: ExecutionState): Execution {
  return {
    id,
    projectId: 1,
    commandId: "package.json:dev",
    label: "dev",
    program: "bun",
    args: ["run", "dev"],
    cwd: "/tmp/project",
    state,
    pid: 100 + id,
    startedAt: 1_000,
    endedAt: null,
    exitCode: null,
    detail: null,
    restartedFrom: null,
    ports: [],
  };
}

beforeEach(() => {
  badge.mockReset();
  set.mockReset();
  set.mockResolvedValue(undefined);
  useStore.setState({ executions: [] });
});

describe("useTrayBadge", () => {
  it("paints the count while a command is alive", async () => {
    badge.mockResolvedValue([1, 2, 3]);
    useStore.setState({ executions: [execution(1, "running")] });

    renderHook(() => useTrayBadge());

    await waitFor(() => expect(set).toHaveBeenCalledWith([1, 2, 3]));
    expect(badge).toHaveBeenCalledWith(1);
  });

  it("takes the badge away when nothing is running", async () => {
    badge.mockResolvedValue(null);

    renderHook(() => useTrayBadge());

    await waitFor(() => expect(set).toHaveBeenCalledWith(null));
    expect(badge).toHaveBeenCalledWith(0);
  });

  it("counts the alive ones only", async () => {
    badge.mockResolvedValue([1]);
    useStore.setState({
      executions: [execution(1, "exited"), execution(2, "running")],
    });

    renderHook(() => useTrayBadge());

    await waitFor(() => expect(set).toHaveBeenCalledWith([1]));
    expect(badge).toHaveBeenCalledWith(1);
  });

  it("follows the count when it changes", async () => {
    badge.mockResolvedValue([1]);
    const { rerender } = renderHook(() => useTrayBadge());

    await waitFor(() => expect(badge).toHaveBeenCalledWith(0));

    act(() => {
      useStore.setState({ executions: [execution(1, "starting")] });
    });
    rerender();

    await waitFor(() => expect(badge).toHaveBeenCalledWith(1));
  });
});
