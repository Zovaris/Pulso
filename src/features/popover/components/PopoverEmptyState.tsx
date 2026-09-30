import { FolderSimplePlusIcon, PlusIcon } from "@phosphor-icons/react";
import { Button } from "@zovaris/sephiro";
import { useI18n } from "@/app/hooks/useI18n";

export function PopoverEmptyState({
  onAddProject,
}: {
  onAddProject: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex min-h-0 flex-1 flex-col items-start pt-6 pb-4">
      <FolderSimplePlusIcon size={16} className="text-faint" />
      <p className="mt-2.5 text-[12.5px] font-medium">{t("noProjects")}</p>
      <p className="mt-1 text-[12px] leading-[1.55] text-mist">
        {t("emptyProjects")}
      </p>
      <div className="mt-4 w-fit">
        <Button variant="primary" size="sm" onClick={onAddProject}>
          <span className="inline-flex items-center gap-1.5">
            <PlusIcon size={14} weight="bold" />
            {t("addProject")}
          </span>
        </Button>
      </div>
    </div>
  );
}
