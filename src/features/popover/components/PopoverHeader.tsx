import {
  ArrowClockwiseIcon,
  SpeakerHighIcon,
  SpeakerSlashIcon,
} from "@phosphor-icons/react";
import { IconButton } from "@zovaris/sephiro";
import { useI18n } from "@/app/hooks/useI18n";

type PopoverHeaderProps = {
  title: string;
  runningCount: number;
  rescanning: boolean;
  sound: boolean;
  onRescan: () => void;
  onToggleSound: () => void;
};

export function PopoverHeader({
  title,
  runningCount,
  rescanning,
  sound,
  onRescan,
  onToggleSound,
}: PopoverHeaderProps) {
  const { t } = useI18n();

  return (
    <>
      <header className="flex items-center gap-3 px-4 pt-3 pb-2.5">
        <h1 className="text-[13px] font-semibold tracking-[-0.01em]">
          {title}
        </h1>
        <p className="ml-auto flex items-center gap-1.5 text-[11.5px] text-mist">
          <span className="pulso-status" data-active={runningCount > 0} />
          {runningCount === 0
            ? t("noneRunning")
            : t("runningCount", { count: runningCount })}
        </p>
        <IconButton
          type="button"
          size="sm"
          variant="ghost"
          label={sound ? t("muteSound") : t("unmuteSound")}
          title={sound ? t("muteHint") : t("unmuteHint")}
          onClick={onToggleSound}
          data-off={!sound}
          icon={
            sound ? (
              <SpeakerHighIcon size={13} weight="bold" />
            ) : (
              <SpeakerSlashIcon size={13} weight="bold" />
            )
          }
          className="pulso-header-tool"
        />
        <IconButton
          type="button"
          size="sm"
          variant="ghost"
          label={t("rescan")}
          title={t("rescanHint")}
          disabled={rescanning}
          aria-busy={rescanning}
          data-busy={rescanning}
          onClick={onRescan}
          icon={<ArrowClockwiseIcon size={13} weight="bold" />}
          className="pulso-header-tool"
        />
      </header>
      <div className="h-px bg-line" />
    </>
  );
}
