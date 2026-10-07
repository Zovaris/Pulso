import { Button, SegmentedControl, Toolbar } from "@zovaris/sephiro";
import { useEffect, useState } from "react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { installDesignDemo } from "@/features/design-review/demo";
import { AppShell } from "@/features/shell/AppShell";
import { PopoverShell } from "@/features/popover/PopoverShell";
import { applyDocumentLocale } from "@/lib/i18n";

export function DesignReview() {
  const { t } = useI18n();
  const theme = useStore((state) => state.themePref);
  const palette = useStore((state) => state.palette);
  const locale = useStore((state) => state.locale);
  const surface = useStore((state) => state.surface);
  const notice = useStore((state) => state.notice);
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme === "light" ? "light" : "dark";
    root.dataset.themePref = theme;
    root.dataset.sephiroTheme = palette;
    root.dataset.transparency = "off";
    root.dataset.surface = "app";
    root.style.colorScheme = theme === "light" ? "light" : "dark";
    applyDocumentLocale(locale);
  }, [theme, palette, locale]);
  const choose = (value: string) => {
    useStore.setState({
      surface: value === "menubar" ? "popover" : "app",
      section: "projects",
      paletteOpen: value === "palette",
    });
  };
  return (
    <div className="flex h-full min-h-0 flex-col bg-void text-paper">
      <div className="flex-none border-b border-line p-3">
        <Toolbar
          label={t("designReview")}
          className="pulso-review-toolbar"
          start={
            <div>
              <p className="text-xs font-medium">{t("designReview")}</p>
              <p className="mt-1 text-xs text-faint">{t("designReviewHint")}</p>
            </div>
          }
          end={
            <>
              <SegmentedControl
                size="sm"
                ariaLabel={t("designReview")}
                value={surface === "popover" ? "menubar" : "desktop"}
                onValueChange={choose}
                options={[
                  { value: "desktop", label: t("designReviewDesktop") },
                  { value: "menubar", label: t("designReviewMenubar") },
                ]}
              />
              <Button
                size="sm"
                density="compact"
                variant="secondary"
                onClick={() => choose("palette")}
              >
                {t("designReviewPalette")}
              </Button>
              <SegmentedControl
                size="sm"
                ariaLabel={t("theme")}
                value={theme}
                onValueChange={(value) =>
                  useStore.setState({ themePref: value as "light" | "dark" })
                }
                options={[
                  { value: "light", label: t("themeLight") },
                  { value: "dark", label: t("themeDark") },
                ]}
              />
              <SegmentedControl
                size="sm"
                ariaLabel={t("language")}
                value={locale}
                onValueChange={(value) =>
                  useStore.setState({ locale: value as "es" | "en" })
                }
                options={[
                  { value: "es", label: "ES" },
                  { value: "en", label: "EN" },
                ]}
              />
              <Button
                size="sm"
                density="compact"
                variant="quiet"
                onClick={() => {
                  installDesignDemo();
                  setGeneration((value) => value + 1);
                }}
              >
                {t("designReviewReset")}
              </Button>
            </>
          }
        />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden" key={generation}>
        {surface === "popover" ? (
          <div className="relative flex h-full items-start justify-center p-6">
            <div className="flex max-h-[610px] w-[300px] max-w-full flex-col">
              <PopoverShell />
            </div>
            {notice ? (
              <Button
                variant="secondary"
                className="absolute right-4 bottom-4 max-w-[360px]"
                onClick={() => useStore.getState().dismissNotice()}
              >
                {notice}
              </Button>
            ) : null}
          </div>
        ) : (
          <AppShell />
        )}
      </div>
    </div>
  );
}
