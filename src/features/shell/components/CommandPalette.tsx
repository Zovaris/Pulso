import { MagnifyingGlassIcon, PlayIcon, StarIcon } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import {
  type PaletteHit,
  rowsFrom,
  searchCommands,
} from "@/features/desktop/palette";
import { latestExecution } from "@/features/executions/execution";

/**
 * Every command of every project, one keystroke away. The desktop already knows
 * all of them, so this is only about getting to the right one without walking
 * the sidebar.
 */
export function CommandPalette() {
  const { t } = useI18n();
  const open = useStore((state) => state.paletteOpen);
  const close = useStore((state) => state.closePalette);
  const projects = useStore((state) => state.projects);
  const scans = useStore((state) => state.scans);
  const executions = useStore((state) => state.executions);
  const startCommand = useStore((state) => state.startCommand);
  const stopExecution = useStore((state) => state.stopExecution);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const box = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => rowsFrom(projects, scans), [projects, scans]);
  const hits = useMemo(() => searchCommands(rows, query), [rows, query]);

  useEffect(() => {
    if (!open) return;

    setQuery("");
    setIndex(0);
    box.current?.focus();
  }, [open]);

  useEffect(() => {
    setIndex(0);
  }, []);

  if (!open) return null;

  const run = (hit: PaletteHit) => {
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

  const move = (delta: number) => {
    if (hits.length === 0) return;

    setIndex((current) => {
      const next = current + delta;
      if (next < 0) return hits.length - 1;

      return next % hits.length;
    });
  };

  return (
    <div className="pulso-palette absolute inset-0 z-40 flex items-start justify-center pt-[12vh]">
      <button
        type="button"
        aria-label={t("close")}
        className="absolute inset-0 cursor-default"
        onClick={close}
      />
      <div className="pulso-palette__panel relative w-[560px] overflow-hidden rounded-[12px] border border-line bg-panel">
        <label className="flex items-center gap-2.5 border-b border-hairline px-3.5 py-2.5">
          <MagnifyingGlassIcon size={14} className="flex-none text-faint" />
          <input
            ref={box}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                move(event.key === "ArrowDown" ? 1 : -1);
                return;
              }

              if (event.key !== "Enter") return;

              const hit = hits[index];
              if (!hit) return;

              run(hit);
              close();
            }}
            placeholder={t("palettePlaceholder")}
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
          />
          <kbd className="flex-none rounded-[5px] border border-line px-1.5 py-0.5 font-mono text-[10.5px] text-faint">
            ⌘K
          </kbd>
        </label>

        {hits.length === 0 ? (
          <p className="px-3.5 py-6 text-center text-[12px] text-faint">
            {t("paletteEmpty")}
          </p>
        ) : (
          <ul className="max-h-[320px] overflow-auto p-1">
            {hits.map((hit, position) => {
              const running = latestExecution(
                executions,
                hit.project.id,
                hit.commandId,
              );
              const active =
                running?.state === "running" || running?.state === "starting";

              return (
                <li key={`${hit.project.id}:${hit.commandId}`}>
                  <button
                    type="button"
                    onMouseEnter={() => setIndex(position)}
                    onClick={() => {
                      run(hit);
                      close();
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-[7px] px-2 py-1.5 text-left transition-colors duration-[120ms] ${
                      position === index ? "bg-fill" : "hover:bg-hover"
                    }`}
                  >
                    <span className="flex-none text-faint">
                      {hit.favorite ? (
                        <StarIcon size={12} weight="fill" />
                      ) : (
                        <PlayIcon size={11} weight="fill" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px]">
                        {hit.label}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-faint">
                        {hit.project.name} · {hit.invocation}
                      </span>
                    </span>
                    {hit.hidden ? (
                      <span className="flex-none text-[10.5px] text-faint">
                        {t("hiddenBadge")}
                      </span>
                    ) : null}
                    {active ? (
                      <span className="flex-none text-[10.5px] text-accent-strong">
                        {t("stateRunning")}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <footer className="flex items-center gap-3 border-t border-hairline px-3.5 py-2 text-[10.5px] text-faint">
          <span>{t("paletteMove")}</span>
          <span>{t("paletteRun")}</span>
          <span className="ml-auto">{t("paletteEsc")}</span>
        </footer>
      </div>
    </div>
  );
}
