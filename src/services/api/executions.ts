import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/tauri";
import type { Execution, LogSnapshot } from "@/lib/types";

export function listExecutions(): Promise<Execution[]> {
  if (!isTauri()) return Promise.resolve([]);
  return invoke("list_executions");
}

export function startCommand(
  projectId: number,
  commandId: string,
  args: string[] | null = null,
): Promise<Execution> {
  return invoke("start_command", { projectId, commandId, args });
}

export function stopExecution(executionId: number): Promise<Execution> {
  return invoke("stop_execution", { executionId });
}

export function clearFinished(): Promise<Execution[]> {
  if (!isTauri()) return Promise.resolve([]);
  return invoke("clear_finished");
}

export function getLogSnapshot(
  executionId: number,
  afterSeq: number | null,
  limit?: number,
): Promise<LogSnapshot> {
  if (!isTauri()) return Promise.resolve({ executionId, lines: [] });
  return invoke("get_log_snapshot", {
    executionId,
    afterSeq,
    limit: limit ?? null,
  });
}

export function openDetectedUrl(
  executionId: number,
  portId: string,
): Promise<void> {
  if (!isTauri()) return Promise.resolve();
  return invoke("open_detected_url", { executionId, portId });
}

/** `null` means the user cancelled the save dialog. */
export function saveLogText(
  text: string,
  name: string,
): Promise<string | null> {
  if (!isTauri()) return Promise.resolve(null);
  return invoke("save_log_text", { text, name });
}
