import { useI18n } from "@/app/hooks/useI18n";
import type { DetectedPort } from "@/lib/types";

export function PortBadge({
  port,
  onOpen,
}: {
  port: DetectedPort;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  const label = `:${port.port}`;

  if (!port.url) {
    return (
      <span
        className="soffy-port"
        data-passive="true"
        title={t("portNoUrl", { port: String(port.port) })}
      >
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      className="soffy-port"
      title={t("openPort", { url: port.url })}
      aria-label={t("openPort", { url: port.url })}
      onClick={onOpen}
    >
      {label}
    </button>
  );
}
