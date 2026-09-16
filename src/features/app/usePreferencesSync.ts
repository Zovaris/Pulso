import { useEffect } from "react";
import { useStore } from "@/app/store";
import { onPreferencesChanged } from "@/lib/events";

export function usePreferencesSync() {
  const applyPreferences = useStore((state) => state.applyPreferences);

  useEffect(() => {
    let stopWatching: (() => void) | undefined;

    void onPreferencesChanged((preferences) => {
      applyPreferences(preferences);
    }).then((unlisten) => {
      stopWatching = unlisten;
    });

    return () => stopWatching?.();
  }, [applyPreferences]);
}
