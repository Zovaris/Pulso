import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useTrayBadge } from "@/features/executions/useTrayBadge";
import {
  MenubarMenu,
  type MenuView,
} from "@/features/popover/menubar/MenubarMenu";
import { useMenuKeyboard } from "@/features/popover/menubar/useMenuKeyboard";
import { usePopoverActions } from "@/features/popover/usePopoverActions";
import { onPopoverPrepare } from "@/lib/events";
import { fitPopover } from "@/lib/tauri";

const HOME: MenuView = { kind: "home" };

/** Where Left and Escape lead from each view. */
function parentOf(view: MenuView): MenuView {
  return view.kind === "project" ? { kind: "projects" } : HOME;
}

export function PopoverShell() {
  useTrayBadge();
  const actions = usePopoverActions();
  const [view, setView] = useState<MenuView>(HOME);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const viaKeyboard = useRef(false);
  const trail = useRef<number[]>([]);
  const restore = useRef<number | null>(null);

  const navigate = useCallback(
    (next: MenuView) => {
      const items = [
        ...(root.current?.querySelectorAll<HTMLButtonElement>(
          ".pulso-menu__item:not(:disabled)",
        ) ?? []),
      ];
      if (next.kind === "home") {
        restore.current = trail.current[0] ?? null;
        trail.current = [];
      } else if (next.kind === parentOf(view).kind)
        restore.current = trail.current.pop() ?? null;
      else
        trail.current.push(
          items.indexOf(document.activeElement as HTMLButtonElement),
        );
      if (next.kind !== "search") setQuery("");
      setView(next);
    },
    [view],
  );
  const openSearch = useCallback((seed = "") => {
    setQuery((current) => current + seed);
    setView({ kind: "search" });
  }, []);

  useMenuKeyboard(root, {
    view,
    back: () => navigate(parentOf(view)),
    openSearch,
    query,
    setQuery,
    actions,
  });

  useLayoutEffect(() => {
    const menu = root.current;
    if (menu) menu.scrollTop = 0;
    const index = restore.current;
    restore.current = null;
    if (!menu || view.kind === "search" || !viaKeyboard.current) return;
    const items = [
      ...menu.querySelectorAll<HTMLButtonElement>(
        ".pulso-menu__item:not(:disabled)",
      ),
    ];
    (index !== null && index >= 0
      ? items[index]
      : items.find((item) => !item.dataset.back)
    )?.focus();
  }, [view]);

  useEffect(() => {
    const menu = root.current;
    if (!menu) return;
    const observer = new ResizeObserver(() => {
      const box = menu.getBoundingClientRect();
      void fitPopover(box.width, box.height);
    });
    observer.observe(menu);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const prepared = onPopoverPrepare(() => navigate(HOME));
    return () => void prepared.then((unlisten) => unlisten());
  }, [navigate]);

  return (
    <div
      ref={root}
      role="menu"
      aria-orientation="vertical"
      className="pulso-menu"
      onKeyDownCapture={() => {
        viaKeyboard.current = true;
      }}
      onPointerMove={() => {
        viaKeyboard.current = false;
      }}
      onPointerLeave={() => {
        if (
          root.current?.contains(document.activeElement) &&
          document.activeElement instanceof HTMLButtonElement
        )
          document.activeElement.blur();
      }}
    >
      <MenubarMenu
        view={view}
        navigate={navigate}
        query={query}
        setQuery={setQuery}
        actions={actions}
      />
    </div>
  );
}
