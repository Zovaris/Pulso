import {
  ArrowsClockwiseIcon,
  CaretDownIcon,
  FolderOpenIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { IconTool } from "@/components/shared/IconTool";
import { AppIcon } from "@/features/shell/components/AppIcon";

/**
 * The main button opens in the editor the header is already showing; the caret
 * is for the times the user wants a different one. Three tools, no labels: a
 * frequent action does not need one when the icon is the app itself.
 */
export function EditorSplit({ projectId }: { projectId: number }) {
  const { t } = useI18n();
  const editors = useStore((state) => state.editors);
  const preferred = useStore((state) => state.editor);
  const openProjectIn = useStore((state) => state.openProjectIn);
  const rescanProject = useStore((state) => state.rescanProject);
  const scanning = useStore((state) => state.scanningProjectId === projectId);
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

  const chosen =
    editors.find((editor) => editor.id === preferred) ?? editors[0] ?? null;

  return (
    <div className="flex items-center gap-1.5">
      <div ref={box} className="relative flex">
        <button
          type="button"
          title={
            chosen
              ? t("openInEditor", { name: chosen.name })
              : t("revealInFinder")
          }
          onClick={() => void openProjectIn(projectId, chosen?.id ?? null)}
          className="flex h-[28px] items-center gap-1.5 rounded-l-[7px] border border-line px-2 text-mist transition-colors duration-[120ms] hover:bg-hover hover:text-paper"
        >
          {chosen ? (
            <AppIcon id={chosen.id} name={chosen.name} />
          ) : (
            <FolderOpenIcon size={14} />
          )}
        </button>
        <button
          type="button"
          title={t("openIn")}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex h-[28px] w-[20px] items-center justify-center rounded-r-[7px] border border-l-0 border-line text-faint transition-colors duration-[120ms] hover:bg-hover hover:text-paper"
        >
          <CaretDownIcon size={10} />
        </button>

        {open ? (
          <div className="absolute top-[32px] left-0 z-30 w-[210px] rounded-[9px] border border-line bg-panel p-1 shadow-[0_16px_40px_rgb(0_0_0/0.42)]">
            {editors.length === 0 ? (
              <p className="px-2 py-2 text-[11.5px] text-faint">
                {t("noEditors")}
              </p>
            ) : (
              editors.map((editor) => (
                <button
                  key={editor.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    void openProjectIn(projectId, editor.id);
                  }}
                  className="flex h-[28px] w-full items-center gap-2 rounded-[6px] px-1.5 text-left text-[12px] text-mist transition-colors duration-[120ms] hover:bg-hover hover:text-paper"
                >
                  <AppIcon id={editor.id} name={editor.name} />
                  <span className="truncate">{editor.name}</span>
                  {editor.id === preferred ? (
                    <span className="ml-auto text-[10.5px] text-faint">
                      {t("defaultEditor")}
                    </span>
                  ) : null}
                </button>
              ))
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void openProjectIn(projectId, "finder");
              }}
              className="flex h-[28px] w-full items-center gap-2 rounded-[6px] px-1.5 text-left text-[12px] text-mist transition-colors duration-[120ms] hover:bg-hover hover:text-paper"
            >
              <AppIcon id="finder" name="Finder" />
              {t("revealInFinder")}
            </button>
          </div>
        ) : null}
      </div>

      <IconTool
        icon={FolderOpenIcon}
        label={t("revealInFinder")}
        onClick={() => void openProjectIn(projectId, "finder")}
      />
      <IconTool
        icon={ArrowsClockwiseIcon}
        label={t("rescanProject")}
        active={scanning}
        onClick={() => void rescanProject(projectId)}
      />
    </div>
  );
}
