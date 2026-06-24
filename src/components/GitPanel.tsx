import { useState, useEffect, useCallback } from "react";
import type { GitStatusFile, GitBranchInfo } from "../types";
import { useT } from "../i18n/useT";
import i18n from "../i18n";
import {
  fetchGitStatus,
  gitStageFiles,
  gitUnstageFiles,
  gitCommitChanges,
  gitPushChanges,
  gitPullChanges,
  fetchGitBranches,
  gitCheckoutBranch,
  fetchRepoConfig,
} from "../api";
import { GitStatusList } from "./GitStatusList";
import { BranchSelector } from "./BranchSelector";

interface GitPanelProps {
  workspaceId: number;
  onFileClick: (path: string) => void;
}

/**
 * GitPanel — panel con status, staging, commit, push/pull, branches.
 * Se integra en WorkspacePage como panel lateral o tab.
 *
 * Requirements: R17.2, R17.3, R18.5, R18.6, R18.7, R19.4, R19.5, R19.6
 */
export function GitPanel({ workspaceId, onFileClick }: GitPanelProps): JSX.Element {
  const t = useT();
  const [files, setFiles] = useState<GitStatusFile[]>([]);
  const [branchInfo, setBranchInfo] = useState<GitBranchInfo | null>(null);
  const [commitMessage, setCommitMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pullLoading, setPullLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [tokenConfigured, setTokenConfigured] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, branchRes, repoRes] = await Promise.all([
        fetchGitStatus(workspaceId),
        fetchGitBranches(workspaceId),
        fetchRepoConfig(workspaceId),
      ]);
      setFiles(statusRes.files);
      setBranchInfo(branchRes);
      setTokenConfigured(!!(repoRes as any).gitTokenConfigured);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al refrescar");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  }

  async function handleStage(paths: string[]) {
    try {
      await gitStageFiles(paths, workspaceId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al hacer stage");
    }
  }

  async function handleUnstage(paths: string[]) {
    try {
      await gitUnstageFiles(paths, workspaceId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al hacer unstage");
    }
  }

  async function handleCommit() {
    if (!commitMessage.trim()) return;
    setError(null);
    try {
      const result = await gitCommitChanges(commitMessage.trim(), workspaceId);
      showSuccess(i18n.t("git.commitCreated", { hash: result.hash }));
      setCommitMessage("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al hacer commit");
    }
  }

  async function handlePush() {
    setPushLoading(true);
    setError(null);
    try {
      await gitPushChanges(workspaceId);
      showSuccess(i18n.t("git.pushCompleted"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al hacer push");
    } finally {
      setPushLoading(false);
    }
  }

  async function handlePull() {
    setPullLoading(true);
    setError(null);
    try {
      await gitPullChanges(workspaceId);
      showSuccess(i18n.t("git.pullCompleted"));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al hacer pull");
    } finally {
      setPullLoading(false);
    }
  }

  async function handleCheckout(branch: string, create?: boolean) {
    setError(null);
    try {
      await gitCheckoutBranch(branch, create, workspaceId);
      showSuccess(i18n.t("git.switchBranchSuccess", { branch }));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cambiar de rama");
    }
  }

  const stagedCount = files.filter((f) => f.staged).length;
  const canCommit = stagedCount > 0 && commitMessage.trim().length > 0;

  return (
    <section
      className="flex flex-col h-full bg-surface-500 border-l border-white/5"
      aria-label={t("workspace.gitPanel")}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <h3 className="text-sm font-semibold text-muted-300">Git</h3>
        <button
          onClick={refresh}
          disabled={loading}
          className="text-xs px-2 py-1 bg-surface-400/80 hover:bg-surface-300 text-muted-300 rounded-lg transition-colors disabled:opacity-50"
          aria-label={t("git.refreshLabel")}
        >
          {loading ? "..." : `⟳ ${t("git.refresh")}`}
        </button>
      </div>

      {/* Branch selector */}
      <div className="px-3 py-2 border-b border-white/5">
        <BranchSelector
          branchInfo={branchInfo}
          hasChanges={files.length > 0}
          onCheckout={handleCheckout}
        />
      </div>

      {/* Error/Success messages */}
      {error && (
        <div className="px-3 py-2 bg-danger-700/30 border-b border-danger-700/50">
          <p className="text-xs text-danger-300">{error}</p>
        </div>
      )}
      {successMsg && (
        <div className="px-3 py-2 bg-success-700/30 border-b border-success-700/50">
          <p className="text-xs text-success-300">{successMsg}</p>
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto px-1 py-2">
        <GitStatusList
          files={files}
          onStage={handleStage}
          onUnstage={handleUnstage}
          onFileClick={onFileClick}
        />
      </div>

      {/* Commit section */}
      <div className="border-t border-white/5 px-3 py-2 space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && canCommit && handleCommit()}
            placeholder={t("git.commitMessagePlaceholder")}
            className="flex-1 bg-surface-400 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-muted-200 placeholder-muted-500 focus:outline-none focus:ring-2 focus:ring-accent"
            aria-label={t("git.commitMessage")}
          />
          <button
            onClick={handleCommit}
            disabled={!canCommit}
            className="px-3 py-1.5 text-sm bg-accent hover:bg-accent-500 disabled:bg-surface-400 disabled:text-muted-500 text-white rounded-lg transition-colors font-medium"
            aria-label={t("git.commitLabel")}
          >
            {t("git.commit")}
          </button>
        </div>

        {/* Push / Pull */}
        <div className="flex gap-2">
          <button
            onClick={handlePush}
            disabled={pushLoading || !tokenConfigured}
            className="flex-1 px-3 py-1.5 text-xs bg-surface-400/80 hover:bg-surface-300 disabled:bg-surface-500 disabled:text-muted-600 text-muted-200 rounded-lg transition-colors"
            aria-label={t("git.pushLabel")}
            title={!tokenConfigured ? t("git.tokenNotConfigured") : t("git.pushLabel")}
          >
            {pushLoading ? t("git.pushing") : "↑ Push"}
          </button>
          <button
            onClick={handlePull}
            disabled={pullLoading || !tokenConfigured}
            className="flex-1 px-3 py-1.5 text-xs bg-surface-400/80 hover:bg-surface-300 disabled:bg-surface-500 disabled:text-muted-600 text-muted-200 rounded-lg transition-colors"
            aria-label={t("git.pullLabel")}
            title={!tokenConfigured ? t("git.tokenNotConfigured") : t("git.pullLabel")}
          >
            {pullLoading ? t("git.pulling") : "↓ Pull"}
          </button>
        </div>
        {!tokenConfigured && (
          <p className="text-xs text-muted-500 text-center">
            {t("git.configureToken")}
          </p>
        )}
      </div>
    </section>
  );
}
