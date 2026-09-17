import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { isActiveState } from "@/features/executions/execution";

export function StatusBar() {
  const { t } = useI18n();
  const projectCount = useStore((state) => state.projects.length);
  const commandCount = useStore((state) =>
    Object.values(state.scans).reduce(
      (total, scan) => total + scan.commands.length,
      0,
    ),
  );
  const liveCount = useStore(
    (state) =>
      state.executions.filter((execution) => isActiveState(execution.state))
        .length,
  );

  return (
    <footer className="flex h-[30px] flex-none items-center gap-3 border-t border-line bg-night px-3.5 text-[11.5px] text-faint">
      <span>{t("runningCount", { count: liveCount })}</span>
      <span className="h-[14px] w-px bg-line" />
      <span>{t("commandCount", { count: commandCount })}</span>
      <span className="ml-auto tabular-nums">
        {t("projectCount", { count: projectCount })}
      </span>
    </footer>
  );
}
