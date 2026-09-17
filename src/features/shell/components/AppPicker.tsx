import { CaretDownIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { AppIcon } from "@/features/shell/components/AppIcon";

/**
 * Picking a default is configuration, not an action, so it lives here and not in
 * the project header. The chip shows the app's own icon, which is the fastest way
 * to read which one it is.
 */
export function AppPicker() {
  const { t } = useI18n();
  const editors = useStore((state) => state.editors);
  const preferred = useStore((state) => state.editor);
  const updatePreferences = useStore((state) => state.updatePreferences);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const close = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

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
    <div ref={box} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex h-[28px] w-[170px] items-center gap-2 rounded-[7px] border border-line px-2 text-left text-[12px] text-mist transition-colors duration-[120ms] hover:bg-hover hover:text-paper"
      >
        <AppIcon id={chosen.id} name={chosen.name} />
        <span className="truncate">{chosen.name}</span>
        <CaretDownIcon size={10} className="ml-auto flex-none text-faint" />
      </button>

      {open ? (
        <div className="absolute top-[32px] right-0 z-30 max-h-[280px] w-[220px] overflow-auto rounded-[9px] border border-line bg-panel p-1 shadow-[0_16px_40px_rgb(0_0_0/0.42)]">
          {editors.map((editor) => (
            <button
              key={editor.id}
              type="button"
              onClick={() => {
                setOpen(false);
                updatePreferences({ editor: editor.id });
              }}
              className="flex h-[28px] w-full items-center gap-2 rounded-[6px] px-1.5 text-left text-[12px] text-mist transition-colors duration-[120ms] hover:bg-hover hover:text-paper"
            >
              <AppIcon id={editor.id} name={editor.name} />
              <span className="truncate">{editor.name}</span>
              {editor.id === chosen.id ? (
                <span className="ml-auto text-[10.5px] text-faint">
                  {t("defaultEditor")}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
