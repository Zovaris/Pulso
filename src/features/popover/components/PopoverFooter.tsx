import { Gear, Plus, SignOut, SquaresFour } from "@phosphor-icons/react";
import { useI18n } from "@/app/hooks/useI18n";
import { ActionButton } from "@/components/shared/ActionButton";
import type { PopoverActions } from "@/features/popover/usePopoverActions";

export function PopoverFooter({
  addProject,
  openApp,
  openSettings,
  quit,
}: PopoverActions) {
  const { t } = useI18n();

  return (
    <footer className="border-t border-line px-1.5 py-1.5">
      <ActionButton
        icon={<Plus size={14} weight="bold" />}
        label={t("addProject")}
        onClick={addProject}
      />
      <ActionButton
        icon={<SquaresFour size={14} />}
        label={t("openApp")}
        onClick={openApp}
      />
      <ActionButton
        icon={<Gear size={14} />}
        label={t("settings")}
        onClick={openSettings}
      />
      <ActionButton
        icon={<SignOut size={14} />}
        label={t("quit")}
        onClick={quit}
      />
    </footer>
  );
}
