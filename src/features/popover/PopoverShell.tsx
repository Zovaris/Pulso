import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { PopoverFooter } from "@/features/popover/components/PopoverFooter";
import { PopoverHeader } from "@/features/popover/components/PopoverHeader";
import { PopoverProjects } from "@/features/popover/components/PopoverProjects";
import { usePopoverActions } from "@/features/popover/usePopoverActions";

export function PopoverShell() {
  const { t } = useI18n();
  const projects = useStore((state) => state.projects);
  const actions = usePopoverActions();

  return (
    <div className="soffy-popover flex h-full flex-col overflow-hidden rounded-[12px] text-paper">
      <PopoverHeader title={t("appName")} runningCount={0} />
      <PopoverProjects projects={projects} />
      <PopoverFooter {...actions} />
    </div>
  );
}
