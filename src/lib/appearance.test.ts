import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyWindowChrome, watchSystemTheme } from "@/lib/appearance";
import { onSystemThemeChanged } from "@/lib/events";

const native = vi.hoisted(() => ({
  setTheme: vi.fn(),
  setBackgroundColor: vi.fn(),
  setEffects: vi.fn(),
  clearEffects: vi.fn(),
  webviewBackground: vi.fn(),
  unlisten: vi.fn(),
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

vi.mock("@/lib/events", () => ({ onSystemThemeChanged: vi.fn() }));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.mocked(onSystemThemeChanged).mockImplementation(() =>
    Promise.resolve(native.unlisten),
  );
});

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

describe("system theme", () => {
  const original = window.matchMedia;

  afterEach(() => {
    window.matchMedia = original;
  });

  it("follows the theme macOS reports, not the media query", async () => {
    const onChange = vi.fn();
    watchSystemTheme(onChange);
    await flush();

    const report = vi.mocked(onSystemThemeChanged).mock.calls[0][0];
    report("dark");

    expect(onChange).toHaveBeenCalledWith("dark");
  });

  it("follows the media query when the webview reports it", async () => {
    const listeners: (() => void)[] = [];
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: () => void) => {
        listeners.push(listener);
      },
      removeEventListener: vi.fn(),
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    const onChange = vi.fn();
    const stop = watchSystemTheme(onChange);
    for (const listener of listeners) listener();

    expect(onChange).toHaveBeenCalledWith("dark");

    stop();
    await flush();
    expect(native.unlisten).toHaveBeenCalled();
  });

  it("unlistens when it stops before the native subscription settles", async () => {
    let finish!: (unlisten: () => void) => void;
    vi.mocked(onSystemThemeChanged).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const stop = watchSystemTheme(vi.fn());
    stop();
    const unlisten = vi.fn();
    finish(unlisten);
    await flush();

    expect(unlisten).toHaveBeenCalled();
  });
});
