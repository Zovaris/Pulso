import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("brand", () => {
  it("ships the mark the generator draws as the favicon", () => {
    expect(readFileSync("public/mark.svg", "utf8")).toBe(
      readFileSync("assets/brand/pulso-mark.svg", "utf8"),
    );
  });
});
