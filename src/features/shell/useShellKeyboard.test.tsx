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

  it("opens and closes the palette with the command key", () => {
    render(<Harness />);

    press("k", { metaKey: true });
    expect(useStore.getState().paletteOpen).toBe(true);

    press("k", { metaKey: true });
    expect(useStore.getState().paletteOpen).toBe(false);
  });

  it("closes the palette with escape", () => {
    render(<Harness />);

    press("k", { metaKey: true });
    press("Escape");

    expect(useStore.getState().paletteOpen).toBe(false);
  });

  it("rescans the projects with the command key", () => {
    render(<Harness />);

    let rescanned = false;
    useStore.setState({
      rescanProjects: () => {
        rescanned = true;
        return Promise.resolve();
      },
    });

    press("r", { metaKey: true });

    expect(rescanned).toBe(true);
  });

  it("opens the selected project with the command key", () => {
    render(<Harness />);

    const opened: (number | string | null)[] = [];
    useStore.setState({
      projects: [
        { id: 4, name: "Apex", path: "/tmp/apex", availability: "available" },
      ],
      selectedProjectId: 4,
      editor: "cursor",
      openProjectIn: (projectId, editorId) => {
        opened.push(projectId, editorId);
        return Promise.resolve();
      },
    });

    press("o", { metaKey: true });

    expect(opened).toEqual([4, "cursor"]);
  });

  it("leaves a plain slash to the field it was typed into", () => {
    render(<Harness />);

    const input = document.createElement("input");
    document.body.append(input);
    fireEvent.keyDown(input, { key: "/" });

    expect(useStore.getState().paletteOpen).toBe(false);
    input.remove();
  });
});
