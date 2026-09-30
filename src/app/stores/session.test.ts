import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStore } from "zustand";
import { createSessionSlice } from "@/app/stores/session";
import type { AppStore } from "@/app/stores/types";
import type { Preferences } from "@/lib/types";
import * as settings from "@/services/api/settings";

vi.mock("@/services/api/settings", () => ({
  getPreferences: vi.fn(),
  persistPreferences: vi.fn(),
}));

const preferences: Preferences = {
  theme: "dark",
  transparency: false,
  locale: "en",
  sound: true,
  editor: null,
  openAtLogin: false,
  keepRunning: true,
  confirmStop: false,
  notifyOnFailure: true,
  logLines: 4000,
};

function store() {
  return createStore<AppStore>()(
    (...args) =>
      ({
        ...createSessionSlice(...args),
        logs: {},
        projectError: null,
      }) as AppStore,
  );
}

beforeEach(() => {
  vi.mocked(settings.getPreferences).mockReset();
  vi.mocked(settings.persistPreferences).mockReset();
  vi.mocked(settings.persistPreferences).mockImplementation(
    async (value) => value,
  );
});

describe("preferences", () => {
  it("does not overwrite stored preferences when hydration fails", async () => {
    vi.mocked(settings.getPreferences).mockRejectedValue(
      new Error("disk unavailable"),
    );
    const state = store();
    await state.getState().hydratePreferences();
    expect(settings.persistPreferences).not.toHaveBeenCalled();
    expect(state.getState().projectError?.message).toBe("disk unavailable");
  });

  it("deduplicates hydration", async () => {
    vi.mocked(settings.getPreferences).mockResolvedValue(preferences);
    const state = store();
    await Promise.all([
      state.getState().hydratePreferences(),
      state.getState().hydratePreferences(),
    ]);
    expect(settings.getPreferences).toHaveBeenCalledTimes(1);
  });

  it("serializes writes and does not regress a newer local choice", async () => {
    let finish!: (value: Preferences) => void;
    vi.mocked(settings.persistPreferences).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const state = store();
    state.getState().updatePreferences({ theme: "light" });
    state.getState().updatePreferences({ theme: "dark", sound: false });
    await waitFor(() =>
      expect(settings.persistPreferences).toHaveBeenCalledTimes(1),
    );
    state.getState().applyPreferences({ ...preferences, theme: "light" });
    expect(state.getState().themePref).toBe("dark");
    await act(async () => finish({ ...preferences, theme: "light" }));
    await waitFor(() =>
      expect(settings.persistPreferences).toHaveBeenCalledTimes(2),
    );
    expect(state.getState().themePref).toBe("dark");
    expect(state.getState().sound).toBe(false);
  });

  it("restores the confirmed value and reports a failed write", async () => {
    const state = store();
    state.getState().applyPreferences(preferences);
    vi.mocked(settings.persistPreferences).mockRejectedValue(
      new Error("write failed"),
    );
    state.getState().updatePreferences({ theme: "light" });
    await waitFor(() =>
      expect(state.getState().projectError?.message).toBe("write failed"),
    );
    expect(state.getState().themePref).toBe("dark");
  });

  it("does not replace a user choice with a delayed hydration response", async () => {
    let finish!: (value: Preferences) => void;
    vi.mocked(settings.getPreferences).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const state = store();
    const loading = state.getState().hydratePreferences();
    state.getState().updatePreferences({ theme: "light" });
    finish(preferences);
    await loading;
    expect(state.getState().themePref).toBe("light");
  });

  it("trims existing logs when the cap is lowered", () => {
    const state = store();
    state.setState({
      logs: {
        1: Array.from({ length: 800 }, (_, index) => ({
          seq: index + 1,
          at: index,
          stream: "stdout" as const,
          text: "line",
        })),
      },
    });
    state.getState().applyPreferences({ ...preferences, logLines: 500 });
    expect(state.getState().logs[1]).toHaveLength(500);
    expect(state.getState().logs[1][0].seq).toBe(301);
  });
});
