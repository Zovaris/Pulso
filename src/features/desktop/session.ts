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
