import { useI18n } from "@/app/hooks/useI18n";

export function PendingSection({
  titleKey,
  noteKey,
}: {
  titleKey: string;
  noteKey: string;
}) {
  const { t } = useI18n();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 px-8 text-center">
      <p className="text-[13px] font-medium">{t(titleKey)}</p>
      <p className="max-w-[340px] text-[12.5px] leading-6 text-mist">
        {t(noteKey)}
      </p>
    </div>
  );
}
