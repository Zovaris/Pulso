import { useI18n } from "@/app/hooks/useI18n";
import type { DetectedCommand } from "@/lib/types";

/**
 * One detected command: what it is called and what Soffy would run.
 *
 * There is no play control yet on purpose. Running commands arrives with the
 * supervisor, and a button that does nothing is worse than no button.
 */
export function CommandRow({ command }: { command: DetectedCommand }) {
  const { t } = useI18n();
  const invocation = [command.program, ...command.args].join(" ");

  return (
    <div className="soffy-command">
      <span
        className="soffy-command__marker"
        data-running={command.longRunning}
        title={command.longRunning ? t("longRunningHint") : undefined}
      />
      <span className="soffy-command__label">{command.label}</span>
      <span className="soffy-command__invocation" title={invocation}>
        {invocation}
      </span>
    </div>
  );
}
