import { describe, expect, it } from "vitest";
import { badgeLabel, renderBadge } from "@/features/executions/trayBadge";

describe("badgeLabel", () => {
  it("shows nothing when nothing is running", () => {
    expect(badgeLabel(0)).toBeNull();
    expect(badgeLabel(-1)).toBeNull();
  });

  it("counts one and up", () => {
    expect(badgeLabel(1)).toBe("1");
    expect(badgeLabel(9)).toBe("9");
    expect(badgeLabel(42)).toBe("42");
  });

  it("stops growing before the number stops fitting", () => {
    expect(badgeLabel(99)).toBe("99");
    expect(badgeLabel(100)).toBe("99+");
    expect(badgeLabel(4000)).toBe("99+");
  });
});

describe("renderBadge", () => {
  it("draws nothing when there is nothing to say", async () => {
    expect(await renderBadge(0)).toBeNull();
  });
});
