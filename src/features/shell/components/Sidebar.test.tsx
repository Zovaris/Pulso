import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "@/app/store";
import { Sidebar } from "@/features/shell/components/Sidebar";

beforeEach(() => {
  useStore.setState({
    locale: "en",
    section: "overview",
    sidebarOpen: true,
    projects: [
      { id: 1, name: "api", path: "/p/api", availability: "available" },
      { id: 2, name: "web", path: "/p/web", availability: "available" },
    ],
    selectedProjectId: null,
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
      screen.getByRole("button", { name: "web" }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("lists the projects in the sidebar and opens the one chosen", () => {
    render(<Sidebar />);

    fireEvent.click(screen.getByRole("button", { name: "web" }));

    expect(useStore.getState().section).toBe("projects");
    expect(useStore.getState().selectedProjectId).toBe(2);
    expect(
      screen.getByRole("button", { name: "web" }).getAttribute("aria-current"),
    ).toBe("page");
  });

  it("folds into an icon rail that keeps every section reachable", () => {
    useStore.setState({ sidebarOpen: false });

    render(<Sidebar />);

    expect(screen.getAllByRole("button")).toHaveLength(7);
    expect(screen.queryByRole("button", { name: "web" })).toBeNull();
    expect(screen.getByRole("button", { name: "Projects" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Commands" }).getAttribute("title"),
    ).toBe("Commands");
  });
});
