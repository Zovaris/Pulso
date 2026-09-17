import { useEffect } from "react";
import { useStore } from "@/app/store";
import { isActiveState } from "@/features/executions/execution";
import { renderBadge } from "@/features/executions/trayBadge";
import { setTrayBadge } from "@/services/api/tray";

export function useTrayBadge() {
  const running = useStore(
    (state) =>
      state.executions.filter((execution) => isActiveState(execution.state))
        .length,
  );

  useEffect(() => {
    let stale = false;

    void renderBadge(running)
      .then((png) => {
        if (!stale) void setTrayBadge(png).catch(() => undefined);
      })
      .catch(() => undefined);

    return () => {
      stale = true;
    };
  }, [running]);
}
