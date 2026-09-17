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
          <button
            type="button"
            onClick={onCancel}
            className="h-[28px] rounded-[7px] border border-line px-3 text-[12px] text-mist transition-colors duration-[120ms] hover:bg-hover hover:text-paper"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-[28px] rounded-[7px] bg-alarm px-3 text-[12px] text-white transition-opacity duration-[120ms] hover:opacity-88"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
