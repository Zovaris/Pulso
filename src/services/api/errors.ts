import type { BackendError, BackendErrorKind } from "@/lib/types";

const KINDS: readonly BackendErrorKind[] = [
  "notFound",
  "notADirectory",
  "unreadable",
  "invalidInput",
  "storage",
  "internal",
];

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
