import { Button } from "@zovaris/sephiro";
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
        className="pulso-port"
        data-passive="true"
        title={t("portNoUrl", { port: String(port.port) })}
      >
        {label}
      </span>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="quiet"
      title={t("openPort", { url: port.url })}
      aria-label={t("openPort", { url: port.url })}
      onClick={onOpen}
      className="pulso-port"
    >
      {label}
    </Button>
  );
}
