import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/tauri";
import type { ListeningPort } from "@/lib/types";
import {
  listListeningPorts,
  openListeningPort,
  stopPortProcess,
} from "./ports";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@/lib/tauri", () => ({ isTauri: vi.fn() }));

const port: ListeningPort = {
  pid: 42,
  port: 3000,
  address: "*:3000",
  startedAt: "123:456",
  process: "node",
  executionId: null,
  canStop: true,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isTauri).mockReturnValue(true);
  vi.mocked(invoke).mockResolvedValue(undefined);
});

describe("ports IPC", () => {
  it("lists real sockets in desktop and avoids IPC in web preview", async () => {
    vi.mocked(invoke).mockResolvedValueOnce([port]);
    expect(await listListeningPorts()).toEqual([port]);
    expect(invoke).toHaveBeenCalledWith("list_listening_ports");
    vi.mocked(isTauri).mockReturnValue(false);
    expect(await listListeningPorts()).toEqual([]);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it.each([
    [stopPortProcess, "stop_port_process"],
    [openListeningPort, "open_listening_port"],
  ] as const)("forwards exact identity for %s", async (action, command) => {
    await action(port);
    expect(invoke).toHaveBeenCalledExactlyOnceWith(command, {
      target: { pid: 42, port: 3000, address: "*:3000", startedAt: "123:456" },
    });
  });
});
