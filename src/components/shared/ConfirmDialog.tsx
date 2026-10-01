import { Button } from "@zovaris/sephiro";
import { useEffect } from "react";

/** Only shown when the user asked to be asked, so it stays out of the way. */
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
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
      if (event.key === "Enter") onConfirm();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel, onConfirm]);

  return (
    <div className="pulso-palette absolute inset-0 z-40 flex items-start justify-center pt-[18vh]">
      <button
        type="button"
        aria-label={cancelLabel}
        className="absolute inset-0 cursor-default"
        onClick={onCancel}
      />
      <div className="pulso-palette__panel relative w-[360px] rounded-[12px] border border-line bg-panel p-4">
        <h3 className="text-[13px] font-medium">{title}</h3>
        <p className="mt-1.5 text-[12px] leading-5 text-mist">{body}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            size="md"
            variant="secondary"
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            size="md"
            variant="primary"
            onClick={onConfirm}
            className="pulso-control-danger"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
