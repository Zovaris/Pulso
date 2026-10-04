import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "@/app/store";
import { SettingsSection } from "./SettingsSection";

const updatePreferences = vi.fn();

beforeEach(() => {
  updatePreferences.mockClear();
  useStore.setState({
    locale: "en",
    confirmStop: false,
    data: null,
    editors: [],
    loadDataStatus: vi.fn(async () => {}),
    loadEditors: vi.fn(async () => {}),
    updatePreferences,
  });
});

describe("SettingsSection", () => {
  it("shows one category at a time, starting with General", () => {
    render(<SettingsSection />);

    expect(screen.getByText("Language")).toBeTruthy();
    expect(screen.queryByText("Theme")).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "Appearance" }));
    expect(screen.getByText("Theme")).toBeTruthy();
    expect(screen.queryByText("Language")).toBeNull();
  });

  it("saves a preference from its own switch", () => {
    render(<SettingsSection />);
    fireEvent.click(screen.getByRole("radio", { name: "Running" }));

    fireEvent.click(
      screen.getByRole("switch", { name: "Ask before stopping" }),
    );

    expect(updatePreferences).toHaveBeenCalledWith({ confirmStop: true });
  });

  it("picks the theme from icons that still carry their names", () => {
    useStore.setState({ themePref: "dark" });
    render(<SettingsSection />);
    fireEvent.click(screen.getByRole("radio", { name: "Appearance" }));

    expect(
      screen.getByRole("radio", { name: "Dark" }).getAttribute("aria-checked"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: "Light" }));

    expect(updatePreferences).toHaveBeenCalledWith({ theme: "light" });
  });

  it("lists the shortcuts the window actually answers to", () => {
    render(<SettingsSection />);
    fireEvent.click(screen.getByRole("radio", { name: "Shortcuts" }));

    expect(screen.getByText("Open Settings")).toBeTruthy();
    expect(screen.getByText("Show or hide the sidebar")).toBeTruthy();
  });
});
