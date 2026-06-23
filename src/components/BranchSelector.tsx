import { useState } from "react";
import type { GitBranchInfo } from "../types";

interface BranchSelectorProps {
  branchInfo: GitBranchInfo | null;
  hasChanges: boolean;
  onCheckout: (branch: string, create?: boolean) => void;
}

/**
 * BranchSelector — dropdown de ramas + botón "Nueva rama".
 * Warning si hay cambios sin commitear al cambiar.
 *
 * Requirements: R20.3, R20.4, R20.6
 */
export function BranchSelector({
  branchInfo,
  hasChanges,
  onCheckout,
}: BranchSelectorProps): JSX.Element {
  const [showNewBranch, setShowNewBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [showWarning, setShowWarning] = useState(false);
  const [pendingBranch, setPendingBranch] = useState<string | null>(null);

  function handleBranchChange(branch: string) {
    if (branch === branchInfo?.current) return;
    if (hasChanges) {
      setPendingBranch(branch);
      setShowWarning(true);
    } else {
      onCheckout(branch);
    }
  }

  function confirmChange() {
    if (pendingBranch) {
      onCheckout(pendingBranch);
    }
    setShowWarning(false);
    setPendingBranch(null);
  }

  function cancelChange() {
    setShowWarning(false);
    setPendingBranch(null);
  }

  function handleCreateBranch() {
    const name = newBranchName.trim();
    if (!name) return;
    onCheckout(name, true);
    setNewBranchName("");
    setShowNewBranch(false);
  }

  return (
    <div className="flex items-center gap-2 relative">
      {/* Branch dropdown */}
      <label htmlFor="branch-select" className="sr-only">
        Rama actual
      </label>
      <select
        id="branch-select"
        value={branchInfo?.current ?? ""}
        onChange={(e) => handleBranchChange(e.target.value)}
        className="bg-surface-400 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-muted-200 focus:outline-none focus:ring-2 focus:ring-accent min-w-[140px]"
        aria-label="Seleccionar rama"
      >
        {branchInfo?.branches.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
        {!branchInfo && <option value="">Cargando...</option>}
      </select>

      {/* New branch button/input */}
      {showNewBranch ? (
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateBranch()}
            placeholder="nombre-rama"
            className="bg-surface-400 border border-white/10 rounded-lg px-2 py-1 text-sm text-muted-200 w-32 focus:outline-none focus:ring-2 focus:ring-accent"
            aria-label="Nombre de la nueva rama"
            autoFocus
          />
          <button
            onClick={handleCreateBranch}
            disabled={!newBranchName.trim()}
            className="text-xs px-2 py-1 bg-success-600 hover:bg-success-500 disabled:bg-surface-400 disabled:text-muted-500 text-white rounded-lg transition-colors"
            aria-label="Crear nueva rama"
          >
            Crear
          </button>
          <button
            onClick={() => {
              setShowNewBranch(false);
              setNewBranchName("");
            }}
            className="text-xs px-2 py-1 text-muted-400 hover:text-white transition-colors"
            aria-label="Cancelar creación de rama"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowNewBranch(true)}
          className="text-xs px-2 py-1.5 bg-surface-400/80 hover:bg-surface-300 text-muted-300 rounded-lg transition-colors"
          aria-label="Nueva rama"
        >
          + Rama
        </button>
      )}

      {/* Warning modal for uncommitted changes */}
      {showWarning && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-surface-400 border border-warning-500/50 rounded-lg p-3 shadow-card min-w-[260px]">
          <p className="text-sm text-warning-300 mb-2">
            ⚠️ Hay cambios sin commitear. ¿Cambiar de rama igualmente?
          </p>
          <div className="flex gap-2">
            <button
              onClick={confirmChange}
              className="text-xs px-3 py-1 bg-warning-600 hover:bg-warning-500 text-white rounded-lg transition-colors"
              aria-label="Confirmar cambio de rama"
            >
              Cambiar
            </button>
            <button
              onClick={cancelChange}
              className="text-xs px-3 py-1 bg-surface-400/80 hover:bg-surface-300 text-muted-300 rounded-lg transition-colors"
              aria-label="Cancelar cambio de rama"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
