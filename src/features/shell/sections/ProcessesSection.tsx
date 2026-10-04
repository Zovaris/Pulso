import { MagnifyingGlassIcon, StopIcon } from "@phosphor-icons/react";
import { Button, EmptyState, Input, SegmentedControl } from "@zovaris/sephiro";
import { useState } from "react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { byUptime, finishedExecutions } from "@/features/desktop/session";
import { ExecutionTable } from "@/features/shell/components/ExecutionTable";

type Kind = "active" | "finished" | "all";
const KINDS: Kind[] = ["active", "finished", "all"];

export function ProcessesSection() {
  const { t } = useI18n();
  const executions = useStore((state) => state.executions);
  const projects = useStore((state) => state.projects);
  const clearFinished = useStore((state) => state.clearFinished);
  const stopExecution = useStore((state) => state.stopExecution);
  const confirmStop = useStore((state) => state.confirmStop);
  const live = byUptime(executions);
  const done = finishedExecutions(executions);
  const [kind, setKind] = useState<Kind>(() =>
    live.length > 0 ? "active" : "all",
  );
  const [text, setText] = useState("");
  const [confirmingAll, setConfirmingAll] = useState(false);

  const lists: Record<Kind, typeof executions> = {
    active: live,
    finished: done,
    all: [...live, ...done],
  };
  const words = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const projectName = (id: number) =>
    projects.find((project) => project.id === id)?.name ??
    t("personalCommands");
  const shown = lists[kind].filter((execution) => {
    const haystack =
      `${execution.label} ${projectName(execution.projectId)} ${execution.program} ${execution.args.join(" ")} ${execution.pid ?? ""} ${execution.ports.map((port) => port.port).join(" ")}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
  const stopAll = () => {
    for (const execution of live) void stopExecution(execution.id);
  };

  return (
    <div className="pulso-pane flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex flex-none items-start gap-4 px-6 pt-5 pb-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-[16px] font-semibold tracking-[-0.015em]">
            {t("sectionProcesses")}
          </h1>
          <p className="mt-1 text-[12px] text-mist">{t("processesLede")}</p>
        </div>
        <Button
          size="sm"
          variant="quiet"
          disabled={done.length === 0}
          onClick={() => void clearFinished()}
        >
          {t("clearFinished")}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={live.length === 0}
          onClick={() => (confirmStop ? setConfirmingAll(true) : stopAll())}
        >
          <StopIcon size={11} weight="fill" />
          {t("stopAll")}
        </Button>
      </header>

      <div className="pulso-filter-bar">
        <SegmentedControl
          size="sm"
          ariaLabel={t("sectionProcesses")}
          value={kind}
          onValueChange={(value) => setKind(value as Kind)}
          options={KINDS.map((entry) => ({
            value: entry,
            label: (
              <>
                {t(`kind${entry[0].toUpperCase()}${entry.slice(1)}`)}
                <span className="pulso-count">{lists[entry].length}</span>
              </>
            ),
          }))}
        />
        <label className="pulso-search ml-auto">
          <MagnifyingGlassIcon size={13} aria-hidden />
          <Input
            size="sm"
            aria-label={t("searchProcesses")}
            placeholder={t("searchProcesses")}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-5 pb-4">
        <ExecutionTable
          executions={shown}
          label={t("sectionProcesses")}
          empty={
            <EmptyState
              compact
              title={
                executions.length === 0
                  ? t("noExecutions")
                  : t("nothingInFilter")
              }
            />
          }
        />
      </div>

      <footer className="pulso-section-footer flex justify-between gap-4">
        <span>{t("samplingNote")}</span>
        <span>{t("runCount", { count: shown.length })}</span>
      </footer>

      {confirmingAll ? (
        <ConfirmDialog
          title={t("confirmStopAllTitle", { count: live.length })}
          body={t("confirmStopAllBody")}
          confirmLabel={t("stopAll")}
          cancelLabel={t("cancel")}
          onCancel={() => setConfirmingAll(false)}
          onConfirm={() => {
            setConfirmingAll(false);
            stopAll();
          }}
        />
      ) : null}
    </div>
  );
}
