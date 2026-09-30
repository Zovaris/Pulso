import { useEffect } from "react";
import { useStore } from "@/app/store";
import { onPreferencesChanged } from "@/lib/events";

export function usePreferencesSync() {
  const applyPreferences = useStore((state) => state.applyPreferences);
  const hydratePreferences = useStore((state) => state.hydratePreferences);

  useEffect(() => {
    let cancelled = false;
    let stopWatching: (() => void) | undefined;

    void onPreferencesChanged((preferences) => {
      applyPreferences(preferences);
    })
      .then((unlisten) => {
        if (cancelled) unlisten();
        else {
          stopWatching = unlisten;
          void hydratePreferences();
        }
      })
      .catch(() => {
        if (!cancelled) void hydratePreferences();
      });

    return () => {
      cancelled = true;
      stopWatching?.();
    };
  }, [applyPreferences, hydratePreferences]);
}
