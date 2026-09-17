import { describe, expect, it } from "vitest";
import {
  formatCpu,
  formatMemory,
  HISTORY,
  memoryRatio,
  pushSample,
  sparkline,
  totalCpu,
  totalMemory,
} from "@/features/desktop/metrics";

describe("formatCpu", () => {
  it("shows a decimal only where it means something", () => {
    expect(formatCpu(14.24)).toBe("14%");
    expect(formatCpu(3.8)).toBe("3.8%");
  });

  it("calls a hair above zero zero", () => {
    expect(formatCpu(0)).toBe("0%");
    expect(formatCpu(0.01)).toBe("0%");
  });

  it("lets a group past one core read above one hundred", () => {
    expect(formatCpu(187.4)).toBe("187%");
  });

  it("refuses to print nonsense", () => {
    expect(formatCpu(Number.NaN)).toBe("—");
    expect(formatCpu(-4)).toBe("—");
  });
});

describe("formatMemory", () => {
  it("picks the unit that keeps the number readable", () => {
    expect(formatMemory(260_046_848)).toBe("248 MB");
    expect(formatMemory(1_610_612_736)).toBe("1.5 GB");
    expect(formatMemory(12_582_912)).toBe("12.0 MB");
    expect(formatMemory(4096)).toBe("4 KB");
  });

  it("never shows less than a whole megabyte as a fraction", () => {
    expect(formatMemory(120 * 1024 * 1024)).toBe("120 MB");
  });

  it("treats nothing as nothing", () => {
    expect(formatMemory(0)).toBe("0 MB");
    expect(formatMemory(-1)).toBe("0 MB");
  });
});

describe("memoryRatio", () => {
  it("sits between nothing and full", () => {
    expect(memoryRatio(0)).toBe(0);
    expect(memoryRatio(512 * 1024 * 1024)).toBeCloseTo(0.5, 3);
  });

  it("never overflows the bar", () => {
    expect(memoryRatio(8 * 1024 * 1024 * 1024)).toBe(1);
  });
});

describe("pushSample", () => {
  it("keeps the window at its limit", () => {
    let history: number[] = [];
    for (let index = 0; index < HISTORY + 10; index += 1) {
      history = pushSample(history, index);
    }

    expect(history).toHaveLength(HISTORY);
    expect(history[0]).toBe(10);
  });

  it("does not touch the array it was given", () => {
    const history = [1, 2];
    pushSample(history, 3);

    expect(history).toEqual([1, 2]);
  });
});

describe("sparkline", () => {
  it("needs two readings to draw a line", () => {
    expect(sparkline([])).toBe("");
    expect(sparkline([5])).toBe("");
  });

  it("spans the whole box from the first to the last reading", () => {
    const points = sparkline([0, 10], 100, 20).split(" ");

    expect(points[0]).toBe("0.0,20.0");
    expect(points[1]).toBe("100.0,0.0");
  });

  it("draws a flat series down the middle", () => {
    expect(sparkline([7, 7, 7], 100, 20)).toBe("0.0,10.0 50.0,10.0 100.0,10.0");
  });

  it("puts the highest reading at the top", () => {
    const [, middle] = sparkline([1, 9, 1], 100, 20).split(" ");

    expect(middle).toBe("50.0,0.0");
  });
});

describe("totals", () => {
  it("adds up what every sample costs", () => {
    const samples = [
      { cpu: 1.5, memory: 100 },
      { cpu: 2.5, memory: 200 },
    ];

    expect(totalCpu(samples)).toBe(4);
    expect(totalMemory(samples)).toBe(300);
  });

  it("adds up to nothing when nothing is running", () => {
    expect(totalCpu([])).toBe(0);
    expect(totalMemory([])).toBe(0);
  });
});
