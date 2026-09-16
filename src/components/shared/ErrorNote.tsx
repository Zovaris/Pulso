import { WarningCircle, X } from "@phosphor-icons/react";
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

/**
 * The backend sends a kind and a technical message; the copy a person reads is
 * chosen here. The technical line is only worth showing when the failure came
 * from inside Soffy, because that is the case nobody can guess.
 */
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
    <p role="alert" className="soffy-error">
      <WarningCircle size={13} className="soffy-error__icon" />
      <span className="soffy-error__text">
        {t(MESSAGES[error.kind])}
        {technical ? (
          <span className="soffy-error__detail">{error.message}</span>
        ) : null}
      </span>
      <button
        type="button"
        className="soffy-error__dismiss"
        aria-label={t("dismiss")}
        onClick={onDismiss}
      >
        <X size={12} />
      </button>
    </p>
  );
}
