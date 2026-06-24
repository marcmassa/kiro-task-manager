import { useState, useEffect, useCallback } from "react";
import { fetchRepoConfig, updateRepoConfig, validateRepoPath } from "../api";
import type { RepoConfig } from "../types";
import { RepoStatusBadge } from "./RepoStatusBadge";
import { useT } from "../i18n/useT";
import i18n from "../i18n";

/**
 * RepoSection — self-contained panel for configuring the workspace Git
 * repository inside the Settings page.
 *
 * When workspaceId is provided (id > 0), the config is loaded/saved from the
 * workspace-scoped API (GET/PUT /api/workspaces/:id). Otherwise it falls back
 * to the global singleton (GET/PUT /api/workspace/repo).
 *
 * Requirements: R3.1, R3.2, R3.3, R3.4, R3.5, R3.6, R3.7
 */
export function RepoSection({ workspaceId }: { workspaceId?: number }): JSX.Element {
  const t = useT();
  const [config, setConfig] = useState<RepoConfig | null>(null);
  const [repoPath, setRepoPath] = useState("");
  const [repoRemoteUrl, setRepoRemoteUrl] = useState("");
  const [repoDefaultBranch, setRepoDefaultBranch] = useState("main");
  const [gitToken, setGitToken] = useState("");
  const [gitTokenConfigured, setGitTokenConfigured] = useState(false);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    ok: boolean;
    message?: string;
    branch?: string;
  } | null>(null);
  const [saveMessage, setSaveMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // ── Load current config on mount / workspace change ──────────────
  const loadConfig = useCallback(async () => {
    try {
      const cfg = await fetchRepoConfig(workspaceId);
      setConfig(cfg);
      setRepoPath(cfg.repoPath ?? "");
      setRepoRemoteUrl(cfg.repoRemoteUrl ?? "");
      setRepoDefaultBranch(cfg.repoDefaultBranch || "main");
      setGitTokenConfigured(!!(cfg as any).gitTokenConfigured);
      // Clear stale feedback
      setValidationResult(null);
      setSaveMessage(null);
    } catch {
      // silently ignore — user will see "No configurado"
    }
  }, [workspaceId]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // ── Validate handler ──────────────────────────────────────────────
  async function handleValidate() {
    if (!repoPath.trim()) return;
    setValidating(true);
    setValidationResult(null);
    try {
      const result = await validateRepoPath(repoPath.trim());
      if (result.ok) {
        setValidationResult({
          ok: true,
          branch: result.currentBranch,
        });
      } else {
        setValidationResult({
          ok: false,
          message: result.message ?? i18n.t("repo.validationError"),
        });
      }
    } catch (e) {
      setValidationResult({
        ok: false,
        message: e instanceof Error ? e.message : i18n.t("repo.validationConn"),
      });
    } finally {
      setValidating(false);
    }
  }

  // ── Save handler ──────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    setSaveMessage(null);
    try {
      const payload: any = {
        repoPath: repoPath.trim() || null,
        repoRemoteUrl: repoRemoteUrl.trim() || null,
        repoDefaultBranch: repoDefaultBranch.trim() || "main",
      };
      // Only send gitToken if user typed something (or wants to clear it)
      if (gitToken !== "") {
        payload.gitToken = gitToken;
      }
      const updated = await updateRepoConfig(payload, workspaceId);
      setConfig(updated);
      setGitTokenConfigured(!!(updated as any).gitTokenConfigured);
      setGitToken(""); // clear after save
      setSaveMessage({ kind: "ok", text: i18n.t("repo.saveOk") });
      setTimeout(() => setSaveMessage(null), 2500);
    } catch (e) {
      setSaveMessage({
        kind: "err",
        text: e instanceof Error ? e.message : i18n.t("repo.saveErr"),
      });
      setTimeout(() => setSaveMessage(null), 4000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-label={t("repo.configLabel")} className="space-y-4">
      {/* Current status badge */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <RepoStatusBadge
          status={config?.repoStatus ?? "not_configured"}
          branch={config?.currentBranch}
        />
      </div>

      {/* Repo path field + validate button */}
      <div className="space-y-3">
        <label className="block">
          <span className="text-xs font-medium text-muted-300 mb-1.5 block">
            {t("repo.localPath")}
          </span>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={repoPath}
              onChange={(e) => {
                setRepoPath(e.target.value);
                setValidationResult(null);
              }}
              placeholder="/home/user/projects/my-app"
              className="input-field flex-1"
              aria-label={t("repo.localPathLabel")}
            />
            <button
              type="button"
              onClick={handleValidate}
              disabled={validating || !repoPath.trim()}
              className="btn-secondary shrink-0"
              aria-label={t("repo.validateLabel")}
            >
              {validating ? t("repo.validating") : t("repo.validate")}
            </button>
          </div>
        </label>

        {/* Validation result */}
        {validationResult && (
          <div
            className={`flex items-center gap-2 p-3 rounded-xl border ${
              validationResult.ok
                ? "bg-success/5 border-success/20"
                : "bg-danger/5 border-danger/20"
            }`}
            role="status"
            aria-live="polite"
          >
            {validationResult.ok ? (
              <>
                <RepoStatusBadge status="connected" branch={validationResult.branch} />
                <span className="text-xs text-success-300">{t("repo.repoValid")}</span>
              </>
            ) : (
              <>
                <RepoStatusBadge status="error" />
                <span className="text-xs text-danger-400">{validationResult.message}</span>
              </>
            )}
          </div>
        )}

        {/* Remote URL field */}
        <label className="block">
          <span className="text-xs font-medium text-muted-300 mb-1.5 block">
            {t("repo.remoteUrl")}
          </span>
          <input
            type="text"
            value={repoRemoteUrl}
            onChange={(e) => setRepoRemoteUrl(e.target.value)}
            placeholder="https://github.com/user/repo.git"
            className="input-field"
            aria-label={t("repo.remoteUrlLabel")}
          />
        </label>

        {/* Default branch field */}
        <label className="block">
          <span className="text-xs font-medium text-muted-300 mb-1.5 block">
            {t("repo.defaultBranch")}
          </span>
          <input
            type="text"
            value={repoDefaultBranch}
            onChange={(e) => setRepoDefaultBranch(e.target.value)}
            placeholder="main"
            className="input-field"
            aria-label={t("repo.defaultBranchLabel")}
          />
        </label>

        {/* Git token field */}
        <label className="block">
          <span className="text-xs font-medium text-muted-300 mb-1.5 block">
            {t("repo.personalToken")}
          </span>
          <div className="flex items-center gap-2">
            <input
              type="password"
              value={gitToken}
              onChange={(e) => setGitToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxx"
              className="input-field flex-1"
              aria-label={t("repo.tokenLabel")}
              autoComplete="off"
            />
            <span
              className={`text-xs px-2 py-1 rounded-full shrink-0 ${
                gitTokenConfigured
                  ? "bg-green-900/30 text-green-400 border border-green-700/50"
                  : "bg-gray-800/50 text-gray-500 border border-gray-700/50"
              }`}
              aria-label={
                gitTokenConfigured ? t("repo.tokenConfiguredLabel") : t("repo.noTokenLabel")
              }
            >
              {gitTokenConfigured ? t("repo.tokenConfigured") : t("repo.noToken")}
            </span>
          </div>
          <p className="text-xs text-muted-500 mt-1">{t("repo.tokenHint")}</p>
        </label>
      </div>

      {/* Save button row */}
      <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-surface-400/30 border border-white/5">
        <p className="text-xs text-muted-400">{t("repo.repoHint")}</p>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary shrink-0"
          aria-label={t("repo.saveLabel")}
        >
          {saving ? t("state.saving") : t("action.save")}
        </button>
      </div>

      {/* Save feedback */}
      {saveMessage && (
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs border ${
            saveMessage.kind === "ok"
              ? "bg-success/5 border-success/20 text-success-300"
              : "bg-danger/5 border-danger/20 text-danger-400"
          }`}
          role="status"
          aria-live="polite"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              saveMessage.kind === "ok" ? "bg-success" : "bg-danger"
            }`}
          />
          {saveMessage.text}
        </div>
      )}
    </section>
  );
}
