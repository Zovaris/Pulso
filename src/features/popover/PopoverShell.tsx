import { useI18n } from "@/app/hooks/useI18n";
import { EmptyState } from "@/components/shared/EmptyState";
import { FavoritesSection } from "@/features/popover/components/FavoritesSection";
import { PopoverFooter } from "@/features/popover/components/PopoverFooter";
import { PopoverHeader } from "@/features/popover/components/PopoverHeader";
import { usePopoverActions } from "@/features/popover/usePopoverActions";

export function PopoverShell() {
  const { t } = useI18n();
  const actions = usePopoverActions();

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[12px] bg-panel text-paper">
      <PopoverHeader title={t("appName")} status={t("noneRunning")} />
      <FavoritesSection title={t("favorites")}>
        <EmptyState>{t("emptyFavorites")}</EmptyState>
      </FavoritesSection>
      <PopoverFooter {...actions} />
    </div>
  );
}
