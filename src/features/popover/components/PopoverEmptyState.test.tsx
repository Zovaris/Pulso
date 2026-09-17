import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "@/app/store";
import { PopoverEmptyState } from "@/features/popover/components/PopoverEmptyState";

beforeEach(() => {
  useStore.setState({ locale: "en" });
});

describe("PopoverEmptyState", () => {
  it("explains itself and offers the way out", () => {
    const onAddProject = vi.fn();
    render(<PopoverEmptyState onAddProject={onAddProject} />);

    expect(screen.getByText("No projects yet")).toBeTruthy();
    expect(screen.getByText(/Add a folder/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Add Project" }));
    expect(onAddProject).toHaveBeenCalledTimes(1);
  });
});
