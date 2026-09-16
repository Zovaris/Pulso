import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/tauri";
import type { Execution } from "@/lib/types";

export function listExecutions(): Promise<Execution[]> {
  if (!isTauri()) return Promise.resolve([]);
  return invoke("list_executions");
}

export function startCommand(
  projectId: number,
  commandId: string,
): Promise<Execution> {
  return invoke("start_command", { projectId, commandId });
}

export function stopExecution(executionId: number): Promise<Execution> {
  return invoke("stop_execution", { executionId });
}
