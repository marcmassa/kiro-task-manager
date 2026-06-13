import { WarningIcon } from "../Icons";

interface ConfirmDialogProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="modal-overlay" onClick={onCancel} role="presentation">
      <div
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
          <button onClick={onConfirm} className="btn-danger flex-1">
            Eliminar
          </button>
          <button onClick={onCancel} className="btn-secondary flex-1">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
