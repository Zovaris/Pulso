import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/tauri";
import type { HistoryEntry, LogSnapshot } from "@/lib/types";

export function listExecutionHistory(
  projectId: number | null = null,
  limit?: number,
): Promise<HistoryEntry[]> {
  if (!isTauri()) return Promise.resolve([]);
  return invoke("list_execution_history", { projectId, limit: limit ?? null });
}

export function readExecutionLog(
  executionId: number,
  limit?: number,
): Promise<LogSnapshot> {
  if (!isTauri()) return Promise.resolve({ executionId, lines: [] });
  return invoke("read_execution_log", { executionId, limit: limit ?? null });
}

export function clearExecutionHistory(): Promise<number> {
  if (!isTauri()) return Promise.resolve(0);
  return invoke("clear_execution_history");
}
