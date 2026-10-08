import { CaretDownIcon } from "@phosphor-icons/react";
import { Button, Menu } from "@zovaris/sephiro";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { AppIcon } from "@/features/shell/components/AppIcon";

export function AppPicker() {
  const { t } = useI18n();
  const editors = useStore((state) => state.editors);
  const preferred = useStore((state) => state.editor);
  const updatePreferences = useStore((state) => state.updatePreferences);

  if (editors.length === 0) {
    return (
      <p className="max-w-[220px] text-right text-[11.5px] text-faint">
        {t("noEditors")}
      </p>
    );
  }

  const chosen =
    editors.find((editor) => editor.id === preferred) ?? editors[0];

  return (
    <Menu
      align="end"
      className="flex-none"
      trigger={
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="pulso-row-fill w-[170px] flex-none"
        >
          <AppIcon id={chosen.id} name={chosen.name} />
          <span className="truncate">{chosen.name}</span>
          <CaretDownIcon size={10} className="ml-auto flex-none text-faint" />
        </Button>
      }
      items={editors.map((editor) => ({
        value: editor.id,
        label: editor.name,
        icon: <AppIcon id={editor.id} name={editor.name} />,
        shortcut: editor.id === chosen.id ? t("defaultEditor") : undefined,
      }))}
      onSelect={(editor) => updatePreferences({ editor })}
    />
  );
}
