import { Plus, SignOut, SquaresFour } from "@phosphor-icons/react";
import { useI18n } from "@/app/hooks/useI18n";
import { ActionRow } from "@/components/shared/ActionRow";
import type { PopoverActions } from "@/features/popover/usePopoverActions";

export function PopoverFooter({ addProject, openApp, quit }: PopoverActions) {
  const { t } = useI18n();

  return (
    <footer className="flex flex-col gap-0.5 border-t border-line px-1.5 py-1.5">
      <ActionRow
        icon={<Plus size={14} weight="bold" />}
        label={t("addProject")}
        onClick={addProject}
      />
      <ActionRow
        icon={<SquaresFour size={14} />}
        label={t("openApp")}
        onClick={openApp}
      />
      <ActionRow
        icon={<SignOut size={14} />}
        label={t("quit")}
        onClick={quit}
      />
    </footer>
  );
}
