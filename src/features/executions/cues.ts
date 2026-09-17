import { play } from "cuelume";
import type { Execution, ExecutionState } from "@/lib/types";

export type Cue = "pulse" | "success" | "error";

const VOLUME: Record<Cue, number> = {
  pulse: 0.35,
  success: 0.5,
  error: 0.55,
};

export function cueForTransition(
  previous: ExecutionState | undefined,
  next: Execution,
): Cue | null {
  switch (next.state) {
    case "starting":
      return previous === undefined ? "pulse" : null;
    case "failed":
      return "error";
    case "exited":
      return previous === "stopping" ? null : "success";
    default:
      return null;
  }
}

export function createCueTracker() {
  const seen = new Map<number, ExecutionState>();

  return {
    observe(execution: Execution): Cue | null {
      const previous = seen.get(execution.id);
      seen.set(execution.id, execution.state);

      if (previous === execution.state) return null;

      return cueForTransition(previous, execution);
    },
  };
}

export function playCue(cue: Cue) {
  play(cue, { volume: VOLUME[cue] });
}
