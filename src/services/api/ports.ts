import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/tauri";
import type { ListeningPort, PortTarget } from "@/lib/types";

export function listListeningPorts(): Promise<ListeningPort[]> {
  if (!isTauri()) return Promise.resolve([]);
  return invoke("list_listening_ports");
}

function targetOf(port: ListeningPort): PortTarget {
  return {
    pid: port.pid,
    port: port.port,
    address: port.address,
    startedAt: port.startedAt,
  };
}

export function stopPortProcess(port: ListeningPort): Promise<void> {
  return invoke("stop_port_process", { target: targetOf(port) });
}

/** An explicit HTTP attempt; listening alone does not imply a web server. */
export function openListeningPort(port: ListeningPort): Promise<void> {
  return invoke("open_listening_port", { target: targetOf(port) });
}
