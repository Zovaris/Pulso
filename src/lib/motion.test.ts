import { describe, expect, it } from "vitest";
import { prefersReducedMotion, settleDuration } from "@/lib/motion";

describe("settleDuration", () => {
  it("scales with the distance travelled", () => {
    expect(settleDuration(120)).toBe(200);
    expect(settleDuration(180)).toBe(300);
  });

  it("keeps a floor so a small change is still perceptible", () => {
    expect(settleDuration(0)).toBe(140);
    expect(settleDuration(12)).toBe(140);
  });

  it("caps the long ones instead of crawling", () => {
    expect(settleDuration(600)).toBe(320);
    expect(settleDuration(5000)).toBe(320);
  });
});

describe("prefersReducedMotion", () => {
  it("reads the media query", () => {
    expect(prefersReducedMotion()).toBe(false);
  });
});
