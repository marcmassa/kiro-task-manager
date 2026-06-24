import { useEffect, useRef } from "react";
import { WarningIcon } from "../Icons";
import { useT } from "../i18n/useT";
import i18n from "../i18n";

interface ConfirmDialogProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Override the default button labels. Defaults: "Eliminar" / "Cancelar". */
  confirmLabel?: string;
  cancelLabel?: string;
}

/**
 * Accessible confirmation dialog for destructive actions (R14).
 *
 * Accessibility features:
 *   - `role="alertdialog"` + `aria-modal="true"` (screen readers know it's modal)
 *   - `aria-labelledby` / `aria-describedby` linking the title and message
 *   - On mount: focus moves to the **Cancel** button (safer default for destructive actions)
 *   - **Esc** key cancels
 *   - **Tab** is trapped within the dialog (focus cycles between the two buttons)
 *   - Click on the backdrop cancels
 *
 * v1 trade-off: focus trap is implemented via a Tab/Shift+Tab handler on the
 * dialog that wraps focus to the opposite button when it would leave the
 * dialog. This covers the keyboard-only case; a full focus-trap would also
 * intercept screen-reader virtual cursors and `aria-hidden` siblings, which
 * is out of scope for the workshop.
 */
export function ConfirmDialog({
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel,
  cancelLabel,
}: ConfirmDialogProps) {
  const t = useT();
  const resolvedConfirmLabel = confirmLabel ?? i18n.t("action.delete");
  const resolvedCancelLabel = cancelLabel ?? i18n.t("action.cancel");
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Focus the safer default (Cancel) on open
    cancelRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key === "Tab") {
        // Two-button focus trap
        const active = document.activeElement;
        if (e.shiftKey && active === cancelRef.current) {
          e.preventDefault();
          confirmRef.current?.focus();
        } else if (!e.shiftKey && active === confirmRef.current) {
          e.preventDefault();
          cancelRef.current?.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div className="modal-overlay" onClick={onCancel} role="presentation">
      <div
        ref={dialogRef}
        className="bg-surface-300 border border-white/10 rounded-2xl shadow-modal w-full max-w-sm p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-danger/10 p-2.5 rounded-xl border border-danger/20">
            <WarningIcon className="text-danger-400" size={22} />
          </div>
          <h3 id="confirm-dialog-title" className="text-lg font-semibold text-white">
            {title}
          </h3>
        </div>
        <p id="confirm-dialog-message" className="text-sm text-muted-300 mb-6 leading-relaxed">
          {message}
        </p>
        <div className="flex gap-3">
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className="btn-danger flex-1"
            aria-label={t("confirm.destructiveLabel", { label: resolvedConfirmLabel })}
          >
            {resolvedConfirmLabel}
          </button>
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="btn-secondary flex-1"
            aria-label={resolvedCancelLabel}
          >
            {resolvedCancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
