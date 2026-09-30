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
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-2 py-6 text-center">
      <FolderSimplePlusIcon size={28} className="text-accent-strong" />
      <p className="mt-4 text-[14px] font-medium">{t("noProjects")}</p>
      <p className="mt-1.5 max-w-[240px] text-[12px] leading-[1.55] text-mist">
        {t("emptyProjects")}
      </p>
      <div className="mt-5 w-fit">
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
