import { useI18n } from "@/app/hooks/useI18n";

type PopoverHeaderProps = {
  title: string;
  runningCount: number;
};

export function PopoverHeader({ title, runningCount }: PopoverHeaderProps) {
  const { t } = useI18n();

  return (
    <>
      <header className="flex items-center justify-between px-4 pt-3 pb-2.5">
        <h1 className="text-[13px] font-semibold tracking-[-0.01em]">
          {title}
        </h1>
        <p className="flex items-center gap-1.5 text-[11.5px] text-mist">
          <span className="soffy-status" data-active={runningCount > 0} />
          {runningCount === 0
            ? t("noneRunning")
            : t("runningCount", { count: runningCount })}
        </p>
      </header>
      <div className="h-px bg-line" />
    </>
  );
}
