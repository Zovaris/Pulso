import { type RefObject, useEffect, useRef } from "react";
import type { MenuView } from "@/features/popover/menubar/MenubarMenu";
import type { PopoverActions } from "@/features/popover/usePopoverActions";
import { closePopover } from "@/lib/tauri";

type Options = {
  view: MenuView;
  back: () => void;
  openSearch: (seed?: string) => void;
  query: string;
  setQuery: (value: string) => void;
  actions: PopoverActions;
};

function items(root: HTMLElement): HTMLButtonElement[] {
  return [
    ...root.querySelectorAll<HTMLButtonElement>(
      ".pulso-menu__item:not(:disabled)",
    ),
  ];
}

/** Clicks the item whose shortcut hint matches, so a hint and its key never disagree. */
function pressShortcut(root: HTMLElement, hint: string): boolean {
  const kbd = [
    ...root.querySelectorAll<HTMLElement>(".pulso-menu__shortcut"),
  ].find((node) => node.textContent === hint);
  const item = kbd?.closest<HTMLButtonElement>(".pulso-menu__item");
  if (!item || item.disabled) return false;
  item.click();
  return true;
}

const SHORTCUT_KEYS: Record<string, string> = {
  o: "⌘O",
  ",": "⌘,",
  q: "⌘Q",
  n: "⌘N",
  r: "⌘R",
  k: "⌘K",
  Backspace: "⌘⌫",
};

/**
 * NSMenu keyboard model: arrows move one shared highlight and wrap, Right opens
 * a submenu, Left or Escape goes back, Return activates, and typing searches.
 */
export function useMenuKeyboard(
  root: RefObject<HTMLElement | null>,
  options: Options,
) {
  const latest = useRef(options);
  latest.current = options;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const menu = root.current;
      if (!menu || event.defaultPrevented) return;
      const { view, back, openSearch, query, setQuery, actions } =
        latest.current;
      const inField = event.target instanceof HTMLInputElement;
      const focused =
        document.activeElement instanceof HTMLButtonElement &&
        menu.contains(document.activeElement)
          ? document.activeElement
          : null;

      if (event.metaKey && !event.ctrlKey && !event.altKey) {
        const hint =
          SHORTCUT_KEYS[
            event.key.length === 1 ? event.key.toLowerCase() : event.key
          ];
        if (event.key === "Enter") {
          event.preventDefault();
          actions.openApp();
          return;
        }
        if (hint === "⌘K") {
          event.preventDefault();
          openSearch();
          return;
        }
        const rowAction =
          focused?.parentElement?.querySelector<HTMLButtonElement>(
            ".pulso-menu__action[data-stops]",
          );
        if (hint === "⌘⌫" && rowAction) {
          event.preventDefault();
          if (!rowAction.disabled) rowAction.click();
          return;
        }
        if (hint && !(inField && hint === "⌘⌫") && pressShortcut(menu, hint))
          event.preventDefault();
        return;
      }
      if (event.ctrlKey || event.altKey) return;

      const list = items(menu);
      const index = focused ? list.indexOf(focused) : -1;
      const move = (delta: number) => {
        if (!list.length) return;
        const next =
          index === -1
            ? delta > 0
              ? 0
              : list.length - 1
            : (index + delta + list.length) % list.length;
        list[next].focus();
      };

      switch (event.key) {
        case "ArrowDown":
          move(1);
          break;
        case "ArrowUp":
          if (inField) return;
          move(-1);
          break;
        case "ArrowRight":
          if (inField || !focused?.dataset.submenu) return;
          focused.click();
          break;
        case "ArrowLeft":
          if (inField || view.kind === "home") return;
          back();
          break;
        case "Enter":
          if (!inField) return;
          list[0]?.click();
          break;
        case "Escape":
          if (inField && query) setQuery("");
          else if (view.kind !== "home") back();
          else void closePopover();
          break;
        default:
          if (!inField && event.key.length === 1 && event.key !== " ") {
            openSearch(event.key);
            break;
          }
          return;
      }
      event.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [root]);
}
