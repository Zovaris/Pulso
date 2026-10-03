import { afterEach, describe, expect, it, vi } from "vitest";
import { transitionView } from "@/lib/motion";

const settled = () => ({
  ready: Promise.resolve(),
  finished: Promise.resolve(),
});

afterEach(() => {
  Reflect.deleteProperty(document, "startViewTransition");
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
});

describe("transitionView", () => {
  it("just applies the change where view transitions do not exist", () => {
    const update = vi.fn();

    transitionView(update);

    expect(update).toHaveBeenCalledOnce();
  });

  it("hands the change to a view transition when one is available", () => {
    const update = vi.fn();
    const start = vi.fn((callback: () => void) => {
      callback();
      return settled();
    });
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: start,
    });

    transitionView(update);

    expect(start).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledOnce();
  });

  it("skips the transition while the window is hidden", () => {
    const update = vi.fn();
    const start = vi.fn(() => settled());
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: start,
    });
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });

    transitionView(update);

    expect(start).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledOnce();
  });
});
