import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "@/app/store";
import { useShellKeyboard } from "@/features/shell/useShellKeyboard";

function Harness() {
  useShellKeyboard();
  return null;
}

beforeEach(() => {
  useStore.setState({ section: "overview" });
});

function press(key: string, init: KeyboardEventInit = {}) {
  fireEvent.keyDown(window, { key, ...init });
}

describe("useShellKeyboard", () => {
  it("walks the sections with the number row", () => {
    render(<Harness />);

    press("3", { metaKey: true });
    expect(useStore.getState().section).toBe("processes");

    press("1", { metaKey: true });
    expect(useStore.getState().section).toBe("overview");
  });

  it("ignores a number typed without the command key", () => {
    render(<Harness />);

    press("2");
    press("2", { ctrlKey: true });
    press("2", { metaKey: true, shiftKey: true });

    expect(useStore.getState().section).toBe("overview");
  });

  it("stops at the last section instead of inventing one", () => {
    render(<Harness />);

    press("9", { metaKey: true });

    expect(useStore.getState().section).toBe("overview");
  });
});
