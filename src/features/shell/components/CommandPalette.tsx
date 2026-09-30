import { PlayIcon, StarIcon } from "@phosphor-icons/react";
import {
  type CommandItem,
  CommandPalette as SephiroPalette,
} from "@zovaris/sephiro";
import { useMemo } from "react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { type PaletteHit, rankAll, rowsFrom } from "@/features/desktop/palette";
import { latestExecution } from "@/features/executions/execution";

const KEYS: Record<string, PaletteHit> = {};

export function CommandPalette() {
  const { t } = useI18n();
  const open = useStore((state) => state.paletteOpen);
  const setOpen = useStore((state) =>
    state.paletteOpen ? state.closePalette : state.openPalette,
  );
  const projects = useStore((state) => state.projects);
  const customCommands = useStore((state) => state.customCommands);
  const scans = useStore((state) => state.scans);
  const executions = useStore((state) => state.executions);
  const startCommand = useStore((state) => state.startCommand);
  const stopExecution = useStore((state) => state.stopExecution);

  const rows = useMemo(
    () => rowsFrom(projects, scans, customCommands, t("personalCommands")),
    [projects, scans, customCommands, t],
  );

  const items = useMemo<CommandItem[]>(() => {
    for (const key of Object.keys(KEYS)) delete KEYS[key];

    return rankAll(rows, "").map((hit) => {
      const key = `${hit.project.id}:${hit.commandId}`;
      KEYS[key] = hit;

      const running = latestExecution(
        executions,
        hit.project.id,
        hit.commandId,
      );
      const active =
        running?.state === "running" || running?.state === "starting";

      return {
        id: key,
        value: key,
        label: hit.label,
        keywords: `${hit.invocation} ${hit.project.name}`,
        icon: hit.favorite ? (
          <StarIcon size={12} weight="fill" />
        ) : (
          <PlayIcon size={11} weight="fill" />
        ),
        hint: hit.invocation,
        badge: active ? t("stateRunning") : undefined,
        group: hit.project.name,
      };
    });
  }, [rows, executions, t]);

  const run = (item: CommandItem) => {
    const hit = KEYS[String(item.value)];
    if (!hit) return;

    const execution = latestExecution(
      executions,
      hit.project.id,
      hit.commandId,
    );

    if (
      execution &&
      (execution.state === "running" || execution.state === "starting")
    ) {
      void stopExecution(execution.id);
      return;
    }

    void startCommand(hit.project.id, hit.commandId);
  };

  return (
    <SephiroPalette
      open={open}
      onOpenChange={(next) => {
        if (next !== open) setOpen();
      }}
      items={items}
      onSelect={run}
      placeholder={t("palettePlaceholder")}
      emptyMessage={t("paletteEmpty")}
      ariaLabel={t("palettePlaceholder")}
    />
  );
}
