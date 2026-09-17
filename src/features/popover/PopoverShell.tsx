import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { isActiveState } from "@/features/executions/execution";
import { useTrayBadge } from "@/features/executions/useTrayBadge";
import { PopoverFooter } from "@/features/popover/components/PopoverFooter";
import { PopoverHeader } from "@/features/popover/components/PopoverHeader";
import { PopoverProjects } from "@/features/popover/components/PopoverProjects";
import { usePopoverActions } from "@/features/popover/usePopoverActions";
import { usePopoverEntrance } from "@/features/popover/usePopoverEntrance";
import { usePopoverKeyboard } from "@/features/popover/usePopoverKeyboard";

export function PopoverShell() {
  const { t } = useI18n();
  useTrayBadge();
  const projects = useStore((state) => state.projects);
  const runningCount = useStore(
    (state) =>
      state.executions.filter((execution) => isActiveState(execution.state))
        .length,
  );
  const rescanning = useStore((state) => state.rescanning);
  const rescanProjects = useStore((state) => state.rescanProjects);
  const sound = useStore((state) => state.sound);
  const setSound = useStore((state) => state.setSound);
  const actions = usePopoverActions();
  const { shell, content } = usePopoverEntrance<
    HTMLDivElement,
    HTMLDivElement
  >();
  usePopoverKeyboard();

  return (
    <div
      ref={shell}
      className="pulso-popover flex h-full flex-col overflow-hidden rounded-[12px] text-paper"
    >
      <div
        ref={content}
        className="pulso-popover-content flex h-full min-h-0 flex-1 flex-col"
      >
        <PopoverHeader
          title={t("appName")}
          runningCount={runningCount}
          rescanning={rescanning}
          sound={sound}
          onRescan={() => void rescanProjects()}
          onToggleSound={() => setSound(!sound)}
        />
        <PopoverProjects
          projects={projects}
          onAddProject={actions.addProject}
        />
        <PopoverFooter {...actions} showAddProject={projects.length > 0} />
      </div>
    </div>
  );
}
