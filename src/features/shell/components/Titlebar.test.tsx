import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "@/app/store";
import { Titlebar } from "@/features/shell/components/Titlebar";
import en from "@/lib/i18n/locales/en/common.json";

beforeEach(() => {
  useStore.setState({ locale: "en", inspectorOpen: true });
});

describe("Titlebar", () => {
  it("closes the details panel and brings it back", () => {
    render(<Titlebar />);

    const toggle = screen.getByTitle(en.hideInspector);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(toggle);
    expect(useStore.getState().inspectorOpen).toBe(false);

    fireEvent.click(screen.getByTitle(en.showInspector));
    expect(useStore.getState().inspectorOpen).toBe(true);
  });
});
