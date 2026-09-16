import type { BackendError, BackendErrorKind } from "@/lib/types";

const KINDS: readonly BackendErrorKind[] = [
  "notFound",
  "notADirectory",
  "unreadable",
  "invalidInput",
  "storage",
  "internal",
];

/**
 * Every rejection from a command arrives as a `BackendError`. Anything else is
 * a bug on our side or a call made outside Tauri, and it is worth surfacing
 * rather than swallowing.
 */
export function toBackendError(cause: unknown): BackendError {
  if (cause && typeof cause === "object") {
    const candidate = cause as Partial<BackendError>;
    const kind = KINDS.find((known) => known === candidate.kind);
    if (kind && typeof candidate.message === "string") {
      return { kind, message: candidate.message, path: candidate.path ?? null };
    }
  }

  return {
    kind: "internal",
    message: cause instanceof Error ? cause.message : String(cause),
    path: null,
  };
}
