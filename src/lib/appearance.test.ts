import { describe, expect, it, vi } from "vitest";
import { applyWindowChrome } from "@/lib/appearance";

const native = vi.hoisted(() => ({
  setTheme: vi.fn(),
  setBackgroundColor: vi.fn(),
  setEffects: vi.fn(),
  clearEffects: vi.fn(),
  webviewBackground: vi.fn(),
}));

vi.mock("@tauri-apps/api/window", () => ({
  Effect: {
    Menu: "menu",
    HudWindow: "hud",
    HeaderView: "header",
    ContentBackground: "content",
  },
  EffectState: { Active: "active" },
  getCurrentWindow: () => ({
    label: "main",
    setTheme: native.setTheme,
    setBackgroundColor: native.setBackgroundColor,
    setEffects: native.setEffects,
    clearEffects: native.clearEffects,
  }),
}));

vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({ setBackgroundColor: native.webviewBackground }),
}));

describe("window chrome", () => {
  it("leaves the appearance to macOS when the preference is system", async () => {
    await applyWindowChrome("system", "light", false);
    expect(native.setTheme).toHaveBeenCalledWith(null);
  });

  it("pins the window to the resolved theme when the preference is explicit", async () => {
    await applyWindowChrome("dark", "dark", false);
    expect(native.setTheme).toHaveBeenLastCalledWith("dark");

    await applyWindowChrome("light", "light", false);
    expect(native.setTheme).toHaveBeenLastCalledWith("light");
  });

  it("drops the material when transparency is off and asks for it when on", async () => {
    await applyWindowChrome("dark", "dark", false);
    expect(native.clearEffects).toHaveBeenCalled();

    await applyWindowChrome("dark", "dark", true);
    expect(native.setEffects).toHaveBeenLastCalledWith(
      expect.objectContaining({ effects: ["hud"] }),
    );
  });
});
