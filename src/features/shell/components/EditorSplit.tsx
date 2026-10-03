import {
  ArrowsClockwiseIcon,
  CaretDownIcon,
  FolderOpenIcon,
} from "@phosphor-icons/react";
import { Button, IconButton, Menu } from "@zovaris/sephiro";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { AppIcon } from "@/features/shell/components/AppIcon";

export function EditorSplit({ projectId }: { projectId: number }) {
  const { t } = useI18n();
  const editors = useStore((state) => state.editors);
  const preferred = useStore((state) => state.editor);
  const openProjectIn = useStore((state) => state.openProjectIn);
  const rescanProject = useStore((state) => state.rescanProject);
  const scanning = useStore((state) => state.scanningProjectId === projectId);
  const chosen =
    editors.find((editor) => editor.id === preferred) ?? editors[0];
  return (
    <div className="flex flex-none items-center gap-2">
      <Menu
        align="end"
        label={t("openIn")}
        trigger={
          <Button variant="secondary" density="compact" motion="none">
            <FolderOpenIcon size={15} />
            {t("openIn")}
            <CaretDownIcon size={12} />
          </Button>
        }
        items={[
          ...editors.map((editor) => ({
            value: editor.id,
            label: editor.name,
            icon: <AppIcon id={editor.id} name={editor.name} />,
            shortcut: editor.id === chosen?.id ? "⌘O" : undefined,
          })),
          ...(editors.length > 0 ? [{ separator: true }] : []),
          {
            value: "finder",
            label: t("revealInFinder"),
            icon: <FolderOpenIcon size={15} />,
          },
        ]}
        onSelect={(value) => void openProjectIn(projectId, value)}
      />
      <IconButton
        density="compact"
        variant="ghost"
        icon={<ArrowsClockwiseIcon size={16} />}
        label={t("rescanProject")}
        title={t("rescanProject")}
        disabled={scanning}
        loading={scanning}
        onClick={() => void rescanProject(projectId)}
      />
    </div>
  );
}
