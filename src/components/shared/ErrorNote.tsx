import { WarningCircleIcon, XIcon } from "@phosphor-icons/react";
import { useI18n } from "@/app/hooks/useI18n";
import type { BackendError, BackendErrorKind } from "@/lib/types";

const MESSAGES: Record<BackendErrorKind, string> = {
  notFound: "errorNotFound",
  notADirectory: "errorNotADirectory",
  unreadable: "errorUnreadable",
  invalidInput: "errorInvalidInput",
  storage: "errorStorage",
  internal: "errorInternal",
};

export function ErrorNote({
  error,
  onDismiss,
}: {
  error: BackendError;
  onDismiss: () => void;
}) {
  const { t } = useI18n();
  const technical = error.kind === "storage" || error.kind === "internal";

  return (
    <p role="alert" className="pulso-error">
      <WarningCircleIcon size={13} className="pulso-error__icon" />
      <span className="pulso-error__text">
        {t(MESSAGES[error.kind])}
        {technical ? (
          <span className="pulso-error__detail">{error.message}</span>
        ) : null}
      </span>
      <button
        type="button"
        className="pulso-error__dismiss"
        aria-label={t("dismiss")}
        onClick={onDismiss}
      >
        <XIcon size={12} />
      </button>
    </p>
  );
}
