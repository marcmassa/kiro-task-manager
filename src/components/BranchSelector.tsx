import { useState } from "react";
import type { GitBranchInfo } from "../types";
import { useT } from "../i18n/useT";

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
  const t = useT();
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
        {t("branch.current")}
      </label>
      <select
        id="branch-select"
        value={branchInfo?.current ?? ""}
        onChange={(e) => handleBranchChange(e.target.value)}
        className="bg-surface-400 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-muted-200 focus:outline-none focus:ring-2 focus:ring-accent min-w-[140px]"
        aria-label={t("branch.select")}
      >
        {branchInfo?.branches.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
        {!branchInfo && <option value="">{t("branch.loading")}</option>}
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
            aria-label={t("branch.newBranchName")}
            autoFocus
          />
          <button
            onClick={handleCreateBranch}
            disabled={!newBranchName.trim()}
            className="text-xs px-2 py-1 bg-success-600 hover:bg-success-500 disabled:bg-surface-400 disabled:text-muted-500 text-white rounded-lg transition-colors"
            aria-label={t("branch.createBranch")}
          >
            {t("action.create")}
          </button>
          <button
            onClick={() => {
              setShowNewBranch(false);
              setNewBranchName("");
            }}
            className="text-xs px-2 py-1 text-muted-400 hover:text-white transition-colors"
            aria-label={t("branch.cancelBranchCreation")}
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowNewBranch(true)}
          className="text-xs px-2 py-1.5 bg-surface-400/80 hover:bg-surface-300 text-muted-300 rounded-lg transition-colors"
          aria-label={t("branch.newBranch")}
        >
          {t("branch.newBranchButton")}
        </button>
      )}

      {/* Warning modal for uncommitted changes */}
      {showWarning && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-surface-400 border border-warning-500/50 rounded-lg p-3 shadow-card min-w-[260px]">
          <p className="text-sm text-warning-300 mb-2">
            {t("branch.uncommittedWarning")}
          </p>
          <div className="flex gap-2">
            <button
              onClick={confirmChange}
              className="text-xs px-3 py-1 bg-warning-600 hover:bg-warning-500 text-white rounded-lg transition-colors"
              aria-label={t("branch.confirmChange")}
            >
              {t("branch.switch")}
            </button>
            <button
              onClick={cancelChange}
              className="text-xs px-3 py-1 bg-surface-400/80 hover:bg-surface-300 text-muted-300 rounded-lg transition-colors"
              aria-label={t("branch.cancelChange")}
            >
              {t("action.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
