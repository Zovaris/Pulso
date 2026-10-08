import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "@/app/store";
import type { EditorTarget } from "@/lib/types";
import { AppPicker } from "./AppPicker";

const updatePreferences = vi.fn();

const editors: EditorTarget[] = [
  {
    id: "vscode",
    name: "Visual Studio Code",
    bundleId: "com.microsoft.VSCode",
    path: "/Applications/Visual Studio Code.app",
  },
  {
    id: "zed",
    name: "Zed Preview",
    bundleId: "dev.zed.Zed-Preview",
    path: "/Applications/Zed Preview.app",
  },
];

beforeEach(() => {
  updatePreferences.mockClear();
  useStore.setState({
    locale: "en",
    editors,
    editor: null,
    icons: {},
    updatePreferences,
  });
});

describe("AppPicker", () => {
  it("shows the editor in use on its trigger", () => {
    render(<AppPicker />);

    expect(
      screen.getByRole("button", { name: /Visual Studio Code/ }),
    ).toBeTruthy();
    expect(screen.queryByRole("menuitem")).toBeNull();
  });

  it("opens the editors and saves the chosen one", () => {
    render(<AppPicker />);
    fireEvent.click(screen.getByRole("button", { name: /Visual Studio Code/ }));

    expect(screen.getByRole("menuitem", { name: /Zed Preview/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: /Zed Preview/ }));

    expect(updatePreferences).toHaveBeenCalledWith({ editor: "zed" });
    expect(screen.queryByRole("menuitem")).toBeNull();
  });

  it("shows the preferred editor on the trigger, marked as the default", () => {
    useStore.setState({ editor: "zed" });
    render(<AppPicker />);
    fireEvent.click(screen.getByRole("button", { name: /Zed Preview/ }));

    const marked = screen.getByRole("menuitem", { name: /Zed Preview/ });
    expect(marked.textContent).toContain("default");
    expect(
      screen.getByRole("menuitem", { name: /Visual Studio Code/ }).textContent,
    ).not.toContain("default");
  });

  it("says so when this Mac has no editor to offer", () => {
    useStore.setState({ editors: [] });
    render(<AppPicker />);

    expect(screen.getByText("No editor was found on this Mac.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
