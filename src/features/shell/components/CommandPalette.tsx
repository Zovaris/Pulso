import { PlayIcon, StarIcon } from "@phosphor-icons/react";
import {
  type CommandItem,
  CommandPalette as SephiroPalette,
} from "@zovaris/sephiro";
import { useCallback, useMemo, useRef } from "react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import {
  type PaletteHit,
  rankAll,
  rowsFrom,
  SUGGESTIONS,
} from "@/features/desktop/palette";
import { latestExecution } from "@/features/executions/execution";

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
    const ranked = rankAll(rows, "");

    return ranked.map((hit) => {
      const execution = latestExecution(
        executions,
        hit.project.id,
        hit.commandId,
      );
      const active =
        execution?.state === "running" || execution?.state === "starting";

      return {
        id: key(hit),
        value: key(hit),
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

  /**
   * The palette only offers the favourites-first shortlist until something is
   * typed, then every command of every project. Sephiro owns the query, so the
   * cap and the full ranking are both resolved here, once per keystroke.
   */
  const ranked = useRef(new Map<string, Set<string>>());

  const filter = useCallback(
    (item: CommandItem, query: string) => {
      if (!ranked.current.has(query)) {
        const hits = rankAll(rows, query);
        ranked.current.set(
          query,
          new Set(
            (query.trim() === "" ? hits.slice(0, SUGGESTIONS) : hits).map(
              (hit) => key(hit),
            ),
          ),
        );
      }

      return ranked.current.get(query)?.has(String(item.id)) === true;
    },
    [rows],
  );

  const run = (item: CommandItem) => {
    const hit = rows.find(
      (row) => `${row.project.id}:${row.commandId}` === item.id,
    );
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
      filter={filter}
      onSelect={run}
      placeholder={t("palettePlaceholder")}
      emptyMessage={t("paletteEmpty")}
      ariaLabel={t("palettePlaceholder")}
    />
  );
}

function key(hit: PaletteHit): string {
  return `${hit.project.id}:${hit.commandId}`;
}
