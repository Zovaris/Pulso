import { Button, Dialog } from "@zovaris/sephiro";

/**
 * Only shown when the user asked to be asked, so it stays out of the way.
 * Focus starts on the confirming button: Return confirms because that button
 * has focus, never because a key was pressed somewhere else in the window.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog
      open
      onClose={onCancel}
      title={title}
      description={body}
      closeLabel={cancelLabel}
      initialFocus={() =>
        document.querySelector<HTMLElement>("[data-confirm-action]")
      }
      className="pulso-confirm"
      footer={
        <>
          <Button type="button" size="sm" variant="quiet" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            data-confirm-action
            type="button"
            size="sm"
            variant="primary"
            onClick={onConfirm}
            className="pulso-control-danger"
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
