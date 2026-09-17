import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "@/app/store";
import { PortBadge } from "@/features/executions/PortBadge";

beforeEach(() => {
  useStore.setState({ locale: "en" });
});

describe("PortBadge", () => {
  it("is a button that opens the announced url", () => {
    const onOpen = vi.fn();
    render(
      <PortBadge
        port={{ id: "log:4321", port: 4321, url: "http://localhost:4321/en/" }}
        onOpen={onOpen}
      />,
    );

    const chip = screen.getByRole("button", {
      name: "Open http://localhost:4321/en/",
    });
    expect(chip.textContent).toBe(":4321");

    fireEvent.click(chip);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("stays a label when nothing announced a url", () => {
    const onOpen = vi.fn();
    render(
      <PortBadge
        port={{ id: "log:24678", port: 24678, url: null }}
        onOpen={onOpen}
      />,
    );

    expect(screen.queryByRole("button")).toBeNull();
    const chip = screen.getByText(":24678");
    expect(chip.getAttribute("title")).toContain("24678");
    expect(chip.dataset.passive).toBe("true");
  });
});
