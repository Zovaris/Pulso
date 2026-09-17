import { useEffect } from "react";
import { useStore } from "@/app/store";
import { createCueTracker, playCue } from "@/features/executions/cues";
import { onExecutionChanged } from "@/lib/events";

export function useExecutionCues() {
  const sound = useStore((state) => state.sound);

  useEffect(() => {
    if (!sound) return;

    const tracker = createCueTracker();
    let stop: (() => void) | undefined;

    void onExecutionChanged((execution) => {
      const cue = tracker.observe(execution);
      if (cue) playCue(cue);
    }).then((unlisten) => {
      stop = unlisten;
    });

    return () => stop?.();
  }, [sound]);
}
