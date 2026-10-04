import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "@/app/store";
import type { ListeningPort } from "@/lib/types";
import { isTauri } from "@/lib/tauri";
import { getCurrentWindow } from "@tauri-apps/api/window";
import * as api from "@/services/api/ports";
import { PortsSection } from "./PortsSection";

vi.mock("@/lib/tauri", () => ({ isTauri: vi.fn(() => true) }));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({
    isVisible: vi.fn().mockResolvedValue(true),
    isMinimized: vi.fn().mockResolvedValue(false),
  })),
}));
vi.mock("@/services/api/ports", () => ({
  listListeningPorts: vi.fn(),
  stopPortProcess: vi.fn(),
  openListeningPort: vi.fn(),
}));

const external: ListeningPort = {
  pid: 42,
  port: 3000,
  address: "127.0.0.1:3000",
  process: "node",
  startedAt: "123:456",
  executionId: null,
  canStop: true,
};
const managed: ListeningPort = {
  ...external,
  pid: 43,
  port: 5432,
  address: "*:5432",
  process: "postgres",
  executionId: 7,
};
const list = vi.mocked(api.listListeningPorts);
const stop = vi.mocked(api.stopPortProcess);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isTauri).mockReturnValue(true);
  list.mockResolvedValue([external, managed]);
  stop.mockResolvedValue();
  vi.mocked(api.openListeningPort).mockResolvedValue();
  useStore.setState({
    locale: "en",
    section: "ports",
    executions: [],
    projects: [],
  });
});
afterEach(() => vi.useRealTimers());

async function ready() {
  render(<PortsSection />);
  await screen.findByText("node");
}
function lastButton(name: string) {
  const buttons = screen.getAllByRole("button", { name });
  return buttons[buttons.length - 1];
}
function row(process: string) {
  return within(screen.getByText(process).closest("tr")!);
}

describe("PortsSection", () => {
  it("explains that a web preview cannot inspect local ports", async () => {
    vi.mocked(isTauri).mockReturnValue(false);
    list.mockResolvedValue([]);
    render(<PortsSection />);
    await screen.findByText(
      "Open Pulso desktop to inspect real ports on this Mac.",
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Refresh ports",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("renders the manager and its confirmation in Spanish", async () => {
    useStore.setState({ locale: "es" });
    await ready();
    expect(screen.getByRole("heading", { name: "Puertos" })).toBeTruthy();
    expect(screen.getByText("Externo")).toBeTruthy();
    fireEvent.click(
      row("node").getByRole("button", { name: "Detener proceso" }),
    );
    expect(screen.getByText(/¿Enviar SIGTERM a node \(PID 42\)/)).toBeTruthy();
  });

  it("shows verified listeners and filters by PID, address and process", async () => {
    await ready();
    expect(row("node").getByText("External")).toBeTruthy();
    expect(screen.getByText("127.0.0.1:3000")).toBeTruthy();
    const search = screen.getByRole("searchbox");
    fireEvent.change(search, { target: { value: "43" } });
    expect(screen.queryByText("node")).toBeNull();
    expect(screen.getByText("postgres")).toBeTruthy();
    fireEvent.change(search, { target: { value: "127.0.0.1" } });
    expect(screen.getByText("node")).toBeTruthy();
    fireEvent.change(search, { target: { value: "POSTGRES" } });
    expect(screen.getByText("postgres")).toBeTruthy();
    fireEvent.change(search, { target: { value: "missing" } });
    expect(screen.getByText("No ports match that search.")).toBeTruthy();
  });

  it("keeps a long list in its own keyboard-accessible scroll region", async () => {
    list.mockResolvedValue(
      Array.from({ length: 80 }, (_, index) => ({
        ...external,
        pid: 40000 + index,
        port: 3000 + index,
        address: `127.0.0.1:${3000 + index}`,
        process: `server-${index}`,
      })),
    );
    const { container } = render(<PortsSection />);
    const region = await screen.findByRole("region", {
      name: "Listening TCP ports",
    });
    expect(region.tabIndex).toBe(0);
    expect(region.classList.contains("overflow-auto")).toBe(true);
    expect(region.classList.contains("min-h-0")).toBe(true);
    expect(region.classList.contains("overscroll-contain")).toBe(true);
    expect(region.classList.contains("flex-1")).toBe(true);
    expect(
      container.firstElementChild?.classList.contains("overflow-hidden"),
    ).toBe(true);
    expect(within(region).getAllByRole("row")).toHaveLength(81);
    expect(within(region).getByText("server-79")).toBeTruthy();
    expect(region.querySelector("table")?.dataset.stickyHeader).toBe("true");
    expect(region.contains(screen.getByRole("searchbox"))).toBe(false);
    expect(
      region.contains(screen.getByRole("button", { name: "Refresh ports" })),
    ).toBe(false);
  });

  it("does not stop an external process without explicit confirmation", async () => {
    await ready();
    fireEvent.click(row("node").getByRole("button", { name: "Stop process" }));
    expect(stop).not.toHaveBeenCalled();
    expect(screen.getByText(/Send SIGTERM to node \(PID 42\)/)).toBeTruthy();
    fireEvent.click(lastButton("Cancel"));
    expect(stop).not.toHaveBeenCalled();
    fireEvent.click(row("node").getByRole("button", { name: "Stop process" }));
    fireEvent.click(lastButton("Stop process"));
    await waitFor(() => expect(stop).toHaveBeenCalledExactlyOnceWith(external));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toMatch(/still listening/),
    );
    list.mockResolvedValue([managed]);
    fireEvent.click(screen.getByRole("button", { name: "Refresh ports" }));
    await waitFor(() => expect(screen.queryByText("node")).toBeNull());
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("explains group cleanup for managed commands and navigates to the execution", async () => {
    await ready();
    fireEvent.click(row("postgres").getByRole("button", { name: "Pulso" }));
    expect(useStore.getState().section).toBe("processes");
    expect(useStore.getState().selectedExecutionId).toBe(7);
    fireEvent.click(
      row("postgres").getByRole("button", { name: "Stop process" }),
    );
    expect(screen.getByText(/whole process group will stop/)).toBeTruthy();
  });

  it("opens HTTP explicitly and disables protected process stops", async () => {
    list.mockResolvedValue([{ ...external, canStop: false }]);
    await ready();
    expect(
      (
        row("node").getByRole("button", {
          name: "Stop process",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(row("node").getByRole("button", { name: "Open HTTP" }));
    expect(api.openListeningPort).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ pid: 42 }),
    );
  });

  it("shows stale identity errors instead of claiming the port was released", async () => {
    stop.mockRejectedValue({
      kind: "notFound",
      message: "That listening socket changed or disappeared.",
      path: null,
    });
    await ready();
    fireEvent.click(row("node").getByRole("button", { name: "Stop process" }));
    fireEvent.click(lastButton("Stop process"));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(
        /changed or disappeared/,
      ),
    );
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("retains the last snapshot on scan failure and allows retry", async () => {
    await ready();
    list.mockRejectedValueOnce(new Error("lsof failed"));
    fireEvent.click(screen.getByRole("button", { name: "Refresh ports" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("lsof failed"),
    );
    expect(screen.getByText("node")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Refresh ports" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("polls only while visible, without overlapping scans, and cleans up", async () => {
    vi.useFakeTimers();
    const { unmount } = render(<PortsSection />);
    await act(async () => {});
    expect(list).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(list).toHaveBeenCalledTimes(2);
    const hidden = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("hidden");
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(list).toHaveBeenCalledTimes(2);
    hidden.mockReturnValue("visible");
    list.mockReturnValue(new Promise(() => {}));
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(list).toHaveBeenCalledTimes(3);
    unmount();
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(list).toHaveBeenCalledTimes(3);
  });

  it("does not scan a desktop window that is hidden or minimized", async () => {
    vi.mocked(getCurrentWindow).mockReturnValueOnce({
      isVisible: vi.fn().mockResolvedValue(false),
      isMinimized: vi.fn().mockResolvedValue(false),
    } as unknown as ReturnType<typeof getCurrentWindow>);
    const { unmount } = render(<PortsSection />);
    await act(async () => {});
    expect(list).not.toHaveBeenCalled();
    unmount();
    vi.mocked(getCurrentWindow).mockReturnValueOnce({
      isVisible: vi.fn().mockResolvedValue(true),
      isMinimized: vi.fn().mockResolvedValue(true),
    } as unknown as ReturnType<typeof getCurrentWindow>);
    render(<PortsSection />);
    await act(async () => {});
    expect(list).not.toHaveBeenCalled();
  });

  it("ignores a scan that finishes after stop began", async () => {
    await ready();
    let resolveScan!: (ports: ListeningPort[]) => void;
    list.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveScan = resolve;
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh ports" }));
    fireEvent.click(row("node").getByRole("button", { name: "Stop process" }));
    list.mockResolvedValue([]);
    fireEvent.click(lastButton("Stop process"));
    await waitFor(() => expect(screen.queryByText("node")).toBeNull());
    await act(async () => {
      resolveScan([external]);
    });
    expect(screen.queryByText("node")).toBeNull();
  });
});
