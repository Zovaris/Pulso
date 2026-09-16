import { FolderSimplePlusIcon, PlusIcon } from "@phosphor-icons/react";
import { useI18n } from "@/app/hooks/useI18n";
import { ActionRow } from "@/components/shared/ActionRow";

export function PopoverEmptyState({
  onAddProject,
}: {
  onAddProject: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex min-h-0 flex-1 flex-col items-start justify-center pb-4">
      <FolderSimplePlusIcon size={16} className="text-faint" />
      <p className="mt-2.5 text-[12.5px] font-medium">{t("noProjects")}</p>
      <p className="mt-1 text-[12px] leading-[1.55] text-mist">
        {t("emptyProjects")}
      </p>
      <div className="mt-3 -ml-2.5 w-fit">
        <ActionRow
          emphasis="primary"
          icon={<PlusIcon size={14} weight="bold" />}
          label={t("addProject")}
          onClick={onAddProject}
        />
      </div>
    </div>
  );
}
