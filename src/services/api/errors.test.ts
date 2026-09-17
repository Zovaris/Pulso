import { describe, expect, it } from "vitest";
import { toBackendError } from "@/services/api/errors";

describe("toBackendError", () => {
  it("keeps a well formed backend error", () => {
    const error = toBackendError({
      kind: "notADirectory",
      message: "That is a file, not a folder.",
      path: "/tmp/notes.txt",
    });

    expect(error).toEqual({
      kind: "notADirectory",
      message: "That is a file, not a folder.",
      path: "/tmp/notes.txt",
    });
  });

  it("fills in a missing path", () => {
    expect(
      toBackendError({ kind: "storage", message: "nope" }).path,
    ).toBeNull();
  });

  it("refuses a kind it does not know", () => {
    expect(toBackendError({ kind: "whatever", message: "nope" }).kind).toBe(
      "internal",
    );
  });

  it("wraps anything else as internal", () => {
    expect(toBackendError(new Error("boom"))).toEqual({
      kind: "internal",
      message: "boom",
      path: null,
    });
    expect(toBackendError("boom").kind).toBe("internal");
    expect(toBackendError(undefined).kind).toBe("internal");
  });
});
