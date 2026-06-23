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
        className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 min-w-[140px]"
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
            className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 w-32 focus:outline-none focus:ring-2 focus:ring-purple-500"
            aria-label="Nombre de la nueva rama"
            autoFocus
          />
          <button
            onClick={handleCreateBranch}
            disabled={!newBranchName.trim()}
            className="text-xs px-2 py-1 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded transition-colors"
            aria-label="Crear nueva rama"
          >
            Crear
          </button>
          <button
            onClick={() => {
              setShowNewBranch(false);
              setNewBranchName("");
            }}
            className="text-xs px-2 py-1 text-gray-400 hover:text-white transition-colors"
            aria-label="Cancelar creación de rama"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowNewBranch(true)}
          className="text-xs px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
          aria-label="Nueva rama"
        >
          + Rama
        </button>
      )}

      {/* Warning modal for uncommitted changes */}
      {showWarning && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-gray-800 border border-orange-500/50 rounded-lg p-3 shadow-lg min-w-[260px]">
          <p className="text-sm text-orange-300 mb-2">
            ⚠️ Hay cambios sin commitear. ¿Cambiar de rama igualmente?
          </p>
          <div className="flex gap-2">
            <button
              onClick={confirmChange}
              className="text-xs px-3 py-1 bg-orange-600 hover:bg-orange-500 text-white rounded transition-colors"
              aria-label="Confirmar cambio de rama"
            >
              Cambiar
            </button>
            <button
              onClick={cancelChange}
              className="text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
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
