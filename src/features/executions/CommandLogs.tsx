import { useEffect, useRef } from "react";
import { useI18n } from "@/app/hooks/useI18n";
import { useReveal } from "@/app/hooks/useReveal";
import { useStore } from "@/app/store";
import { formatLogTime } from "@/features/executions/execution";
import { prefersReducedMotion } from "@/lib/motion";
import type { LogLine } from "@/lib/types";

const NONE: LogLine[] = [];

export function CommandLogs({
  executionId,
  open,
  active,
  label,
}: {
  executionId: number;
  open: boolean;
  active: boolean;
  label: string;
}) {
  const { t } = useI18n();
  const lines = useStore((state) => state.logs[executionId] ?? NONE);
  const box = useReveal<HTMLDivElement>(open);
  const panel = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const following = useRef(true);

  useEffect(() => {
    const element = box.current;
    if (!open || !element) return;

    const reveal = () =>
      panel.current?.scrollIntoView({
        block: "nearest",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });

    const animations = element.getAnimations();
    if (animations.length === 0) {
      reveal();
      return;
    }

    void Promise.all(animations.map((animation) => animation.finished))
      .then(reveal)
      .catch(reveal);
  }, [open, box]);

  useEffect(() => {
    const element = list.current;
    if (!element || !open || lines.length === 0) return;
    if (!following.current) return;

    element.scrollTop = element.scrollHeight;
  }, [lines, open]);

  const onScroll = () => {
    const element = list.current;
    if (!element) return;

    following.current =
      element.scrollHeight - element.scrollTop - element.clientHeight < 24;
  };

  return (
    <div className="soffy-logs" ref={box} inert={!open}>
      <div className="soffy-logs__panel" ref={panel}>
        {lines.length > 0 ? (
          <ol
            ref={list}
            className="soffy-logs__list"
            aria-label={t("outputOf", { label })}
            onScroll={onScroll}
          >
            {lines.map((line) => (
              <li
                key={line.seq}
                className="soffy-log"
                data-stream={line.stream}
              >
                <time className="soffy-log__time">
                  {formatLogTime(line.at)}
                </time>
                <span className="soffy-log__text">{line.text}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="soffy-logs__empty" data-live={active}>
            {active ? t("waitingOutput") : t("noOutput")}
          </p>
        )}
      </div>
    </div>
  );
}
