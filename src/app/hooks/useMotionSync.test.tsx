import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMotionSync } from "@/app/hooks/useMotionSync";
import { setReducedMotion } from "@/lib/tauri";

vi.mock("@/lib/tauri", () => ({ setReducedMotion: vi.fn() }));

const report = vi.mocked(setReducedMotion);

function motionQuery() {
  let reduced = false;
  const listeners = new Set<() => void>();

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      get matches() {
        return reduced;
      },
      media: query,
      onchange: null,
      addEventListener: (_event: string, listener: () => void) => {
        listeners.add(listener);
      },
      removeEventListener: (_event: string, listener: () => void) => {
        listeners.delete(listener);
      },
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });

  return {
    turnOn() {
      reduced = true;
      for (const listener of listeners) listener();
    },
    listening() {
      return listeners.size;
    },
  };
}

beforeEach(() => {
  report.mockReset();
  report.mockResolvedValue(undefined);
});

describe("useMotionSync", () => {
  it("tells the backend what the system prefers on the way in", () => {
    renderHook(() => useMotionSync());

    expect(report).toHaveBeenCalledWith(false);
  });

  it("tells it again when the system changes its mind", () => {
    const query = motionQuery();
    renderHook(() => useMotionSync());

    act(() => query.turnOn());

    expect(report).toHaveBeenLastCalledWith(true);
  });

  it("stops listening when the window goes away", () => {
    const query = motionQuery();
    const { unmount } = renderHook(() => useMotionSync());
    expect(query.listening()).toBe(1);

    unmount();

    expect(query.listening()).toBe(0);
  });
});
