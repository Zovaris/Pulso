import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "@/app/store";
import { Sidebar } from "@/features/shell/components/Sidebar";

beforeEach(() => {
  useStore.setState({
    locale: "en",
    section: "overview",
    sidebarOpen: true,
    projects: [],
    executions: [],
    metrics: {},
    seenFailuresAt: 0,
  });
});

describe("Sidebar", () => {
  it("switches the section in view", () => {
    render(<Sidebar />);

    fireEvent.click(screen.getByRole("button", { name: "Logs" }));

    expect(useStore.getState().section).toBe("logs");
  });

  it("marks the section the window is showing", () => {
    render(<Sidebar />);

    expect(
      screen
        .getByRole("button", { name: "Overview" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen
        .getByRole("button", { name: "Projects" })
        .getAttribute("aria-current"),
    ).toBeNull();
  });

  it("folds into an icon rail that keeps every section reachable", () => {
    useStore.setState({ sidebarOpen: false });

    render(<Sidebar />);

    expect(screen.getAllByRole("button")).toHaveLength(7);
    expect(
      screen.getByRole("button", { name: "Commands" }).getAttribute("title"),
    ).toBe("Commands");
  });
});
