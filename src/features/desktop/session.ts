import { isActiveState } from "@/features/executions/execution";
import type { Execution } from "@/lib/types";

export function liveExecutions(executions: Execution[]): Execution[] {
  return executions.filter((execution) => isActiveState(execution.state));
}

/** Newest first, because the most recent run is the one being asked about. */
export function finishedExecutions(executions: Execution[]): Execution[] {
  return executions
    .filter((execution) => !isActiveState(execution.state))
    .sort((left, right) => (right.endedAt ?? 0) - (left.endedAt ?? 0));
}

export function failures(executions: Execution[]): Execution[] {
  return executions.filter((execution) => execution.state === "failed");
}

export function openPorts(executions: Execution[]): number[] {
  const ports = new Set<number>();

  for (const execution of liveExecutions(executions)) {
    for (const port of execution.ports) ports.add(port.port);
  }

  return [...ports].sort((left, right) => left - right);
}

export type ExitBadge = {
  text: string;
  /** `ok`, `bad` or `none`, which is what the row styles itself with. */
  tone: "ok" | "bad" | "none";
};

export function exitBadge(execution: Execution): ExitBadge {
  if (isActiveState(execution.state)) {
    return { text: "—", tone: "none" };
  }
  if (execution.exitCode === null) {
    return { text: "·", tone: "bad" };
  }

  return {
    text: String(execution.exitCode),
    tone: execution.exitCode === 0 ? "ok" : "bad",
  };
}

/** Longest first, which is the one worth stopping when something is stuck. */
export function byUptime(executions: Execution[]): Execution[] {
  return [...liveExecutions(executions)].sort(
    (left, right) => left.startedAt - right.startedAt,
  );
}

export function lastRun(
  executions: Execution[],
  projectId: number,
  commandId: string,
): Execution | undefined {
  let found: Execution | undefined;

  for (const execution of executions) {
    if (
      execution.projectId === projectId &&
      execution.commandId === commandId &&
      (!found || execution.startedAt > found.startedAt)
    ) {
      found = execution;
    }
  }

  return found;
}

/** The last few runs of one project, newest first, for the inspector. */
export function recentRuns(
  executions: Execution[],
  projectId: number,
  limit = 4,
): Execution[] {
  return executions
    .filter((execution) => execution.projectId === projectId)
    .sort((left, right) => right.startedAt - left.startedAt)
    .slice(0, limit);
}
