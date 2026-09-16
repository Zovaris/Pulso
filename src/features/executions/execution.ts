import { useEffect, useState } from "react";
import type { Execution, ExecutionState } from "@/lib/types";

const ACTIVE: ExecutionState[] = ["starting", "running", "stopping"];

export function isActiveState(state: ExecutionState): boolean {
  return ACTIVE.includes(state);
}

export function commandKey(projectId: number, commandId: string): string {
  return `${projectId}:${commandId}`;
}

export function formatLogTime(at: number): string {
  const date = new Date(at);
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function latestExecution(
  executions: Execution[],
  projectId: number,
  commandId: string,
): Execution | undefined {
  let found: Execution | undefined;

  for (const execution of executions) {
    if (
      execution.projectId === projectId &&
      execution.commandId === commandId
    ) {
      found = execution;
    }
  }

  return found;
}

export function formatDuration(milliseconds: number): string {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const seconds = total % 60;
  const minutes = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);
  const pad = (value: number) => String(value).padStart(2, "0");

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}

/** The elapsed label of a running execution, ticking once a second. */
export function useElapsed(
  startedAt: number | undefined,
  active: boolean,
): string {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;

    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  if (!active || startedAt === undefined) return "";

  return formatDuration(now - startedAt);
}
