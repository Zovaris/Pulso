import { Gear, Plus, SignOut, SquaresFour } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { useI18n } from "@/app/hooks/useI18n";
import { hidePopover, openMainWindow, quitSoffy } from "@/lib/tauri";

export function PopoverShell() {
  const { t } = useI18n();

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[12px] bg-panel text-paper">
      <header className="flex items-baseline justify-between px-4 pt-3.5 pb-2">
        <h1 className="text-[15px] font-semibold tracking-tight">
          {t("appName")}
        </h1>
        <p className="text-[11px] text-mist">{t("noneRunning")}</p>
      </header>

      <div className="mx-4 h-px bg-line" />

      <section className="flex min-h-0 flex-1 flex-col px-4 py-3">
        <p className="mb-2 text-[11px] font-medium text-faint">
          {t("favorites")}
        </p>
        <div className="flex flex-1 items-center justify-center rounded-xl bg-fill px-6 text-center">
          <p className="max-w-[16rem] text-[12.5px] leading-5 text-mist">
            {t("emptyFavorites")}
          </p>
        </div>
      </section>

      <footer className="border-t border-line px-1.5 py-1.5">
        <FooterButton
          icon={<Plus size={14} weight="bold" />}
          label={t("addProject")}
          onClick={() => void openMainWindow()}
        />
        <FooterButton
          icon={<SquaresFour size={14} />}
          label={t("openApp")}
          onClick={() => {
            void openMainWindow();
            void hidePopover();
          }}
        />
        <FooterButton
          icon={<Gear size={14} />}
          label={t("settings")}
          onClick={() => {
            void openMainWindow();
            void hidePopover();
          }}
        />
        <FooterButton
          icon={<SignOut size={14} />}
          label={t("quit")}
          onClick={() => void quitSoffy()}
        />
      </footer>
    </div>
  );
}

function FooterButton({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] hover:bg-hover active:scale-[0.99]"
    >
      <span className="text-mist">{icon}</span>
      {label}
    </button>
  );
}
