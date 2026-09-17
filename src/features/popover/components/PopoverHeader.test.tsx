import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "@/app/store";
import { PopoverHeader } from "@/features/popover/components/PopoverHeader";

beforeEach(() => {
  useStore.setState({ locale: "en" });
});

function header(
  overrides: { runningCount?: number; rescanning?: boolean } = {},
) {
  const onRescan = vi.fn();

  render(
    <PopoverHeader
      title="Pulso"
      runningCount={overrides.runningCount ?? 0}
      rescanning={overrides.rescanning ?? false}
      onRescan={onRescan}
    />,
  );

  return onRescan;
}

describe("PopoverHeader", () => {
  it("counts what is running and lights up for it", () => {
    header({ runningCount: 2 });

    expect(screen.getByText("2 processes running")).toBeTruthy();
    expect(
      document.querySelector(".pulso-status")?.getAttribute("data-active"),
    ).toBe("true");
  });

  it("says nothing is running when nothing is", () => {
    header();

    expect(screen.getByText("No processes running")).toBeTruthy();
    expect(
      document.querySelector(".pulso-status")?.getAttribute("data-active"),
    ).toBe("false");
  });

  it("asks for a rescan when it is clicked", () => {
    const onRescan = header();

    fireEvent.click(screen.getByRole("button", { name: "Rescan projects" }));

    expect(onRescan).toHaveBeenCalledTimes(1);
  });

  it("cannot be asked twice while it is already reading", () => {
    header({ rescanning: true });

    const button = screen.getByRole<HTMLButtonElement>("button", {
      name: "Rescan projects",
    });

    expect(button.disabled).toBe(true);
    expect(button.getAttribute("data-busy")).toBe("true");
    expect(button.getAttribute("title")).toBe(
      "Reads every project file again.",
    );
  });
});
