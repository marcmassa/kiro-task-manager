import { useState, useEffect, useCallback } from "react";
import { DownloadIcon, TrashIcon, CheckCircleIcon, BellIcon } from "../Icons";
import { PageHeader } from "./ui/PageHeader";
import { SectionHeader } from "./ui/SectionHeader";
import { LoadingState, ErrorState } from "./ui/StateView";
import { useT } from "../i18n/useT";
import i18n from "../i18n";
import { ConfirmDialog } from "./ConfirmDialog";
import { IntegrationCard } from "./IntegrationCard";
import { McpServersSection, McpServerForm } from "./McpServersSection";
import { AiProviderSection } from "./AiProviderSection";
import { AgentEngineSection } from "./AgentEngineSection";
import { RepoSection } from "./RepoSection";
import { WorkspaceSettingsSection } from "./WorkspaceSettingsSection";
import {
  fetchSettings,
  updateWorkspaceSettings,
  updateNotificationSettings,
  getLinearStatus,
  connectLinear,
  syncLinear,
  disconnectLinear,
  exportTasks,
  deleteAllTasks,
  fetchMcpServers,
  createMcpServer as apiCreateMcpServer,
  updateMcpServer as apiUpdateMcpServer,
  toggleMcpServer as apiToggleMcpServer,
  deleteMcpServer as apiDeleteMcpServer,
  testMcpServer as apiTestMcpServer,
  applyMcpConfig as apiApplyMcpConfig,
  fetchAiProviderRegistry,
  fetchAiProviderConfig,
  saveAiProviderConfig as apiSaveAiProvider,
  deleteAiProviderConfig as apiDeleteAiProvider,
  testAiProviderConnection as apiTestAiProvider,
} from "../api";
import type {
  SettingsResponse,
  WorkspaceSettings,
  NotificationSettings,
  LinearIntegrationStatus,
  SyncResult,
  McpServer,
  McpServerInput,
  McpTestResult,
  AiProviderMeta,
  AiProviderConfigResponse,
  AiProviderSaveInput,
  AiConnectionTestResult,
} from "../types";

interface SettingsPageProps {
  loading: boolean;
  error: string | null;
  onRetry: () => Promise<void> | void;
  /** Called after a successful `DELETE /api/tasks/all` so the rest of the
   *  app (Kanban + Stats) refreshes its data. */
  onDataChanged?: () => Promise<void> | void;
  /** Current active workspace ID for settings UI. */
  activeWorkspaceId: number;
  /** Called when user activates a different workspace. */
  onWorkspaceChange: (id: number) => void;
  /** Optional workspace selector rendered in the page header. */
  workspaceSelector?: React.ReactNode;
}

/**
 * SettingsPage — replaces the placeholder in `App.tsx` (R1).
 *
 * 4 sections (R2 / R4 / R11 / R13/R14):
 *   1. Datos del workspace      → editable form (R2, R3)
 *   2. Integración (Linear)     → IntegrationCard
 *   3. Notificaciones           → 3 checkboxes + "Próximamente" tooltip (R11, R12)
 *   4. Gestión de datos         → Export JSON + Delete-all (R13, R14)
 *
 * Loading + error states follow the same pattern as `StatsDashboard`.
 */
export function SettingsPage({
  loading,
  error: externalError,
  onRetry,
  onDataChanged,
  activeWorkspaceId,
  onWorkspaceChange,
  workspaceSelector,
}: SettingsPageProps) {
  const t = useT();
  const [lang, setLang] = useState<"es" | "en">(() => (i18n.language === "en" ? "en" : "es"));
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [linearStatus, setLinearStatus] = useState<LinearIntegrationStatus>({
    connected: false,
  });
  const [syncing, setSyncing] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Local copies of the editable form fields
  const [workspaceForm, setWorkspaceForm] = useState<WorkspaceSettings | null>(null);
  const [notificationForm, setNotificationForm] = useState<NotificationSettings | null>(null);

  // MCP Servers state
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [mcpError, setMcpError] = useState<string | null>(null);
  const [mcpFormMode, setMcpFormMode] = useState<"hidden" | "create" | "edit">("hidden");
  const [mcpEditTarget, setMcpEditTarget] = useState<McpServer | null>(null);
  const [mcpFormError, setMcpFormError] = useState<string | null>(null);
  const [mcpSubmitting, setMcpSubmitting] = useState(false);
  const [mcpTestResults, setMcpTestResults] = useState<Record<number, McpTestResult | "loading">>(
    {},
  );
  const [mcpDeleteTarget, setMcpDeleteTarget] = useState<McpServer | null>(null);
  const [mcpApplying, setMcpApplying] = useState(false);

  // AI Provider state
  const [aiRegistry, setAiRegistry] = useState<AiProviderMeta[]>([]);
  const [aiConfig, setAiConfig] = useState<AiProviderConfigResponse | null>(null);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiDeleting, setAiDeleting] = useState(false);

  // ── Data load ──────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLocalError(null);
    try {
      const [s, lin, mcpList, aiReg, aiCfg] = await Promise.all([
        fetchSettings(),
        getLinearStatus(),
        fetchMcpServers(),
        fetchAiProviderRegistry(),
        fetchAiProviderConfig(),
      ]);
      setSettings(s);
      setLinearStatus(lin);
      setMcpServers(mcpList);
      setAiRegistry(aiReg);
      setAiConfig(aiCfg);
      setWorkspaceForm(s.workspace);
      setNotificationForm(s.notifications);
    } catch (e) {
      console.error("SettingsPage load error:", e);
      setLocalError(i18n.t("settings.loadConfigErr"));
    }
  }, []);

  useEffect(() => {
    if (!loading) {
      loadAll();
    }
  }, [loading, loadAll]);

  // ── Workspace form handlers ────────────────────────────────────────
  async function handleSaveWorkspace() {
    if (!workspaceForm) return;
    try {
      const next = await updateWorkspaceSettings(workspaceForm);
      setSettings(next);
      setWorkspaceForm(next.workspace);
      setFeedback({ kind: "ok", text: i18n.t("settings.saveOk") });
      setTimeout(() => setFeedback(null), 2500);
    } catch {
      setFeedback({ kind: "err", text: i18n.t("settings.saveErr") });
    }
  }

  // ── Notifications form handlers ────────────────────────────────────
  async function handleToggleNotification(key: keyof NotificationSettings) {
    if (!notificationForm) return;
    const nextValue = !notificationForm[key];
    // Optimistic update
    setNotificationForm({ ...notificationForm, [key]: nextValue });
    try {
      const next = await updateNotificationSettings({ [key]: nextValue });
      setSettings(next);
      setNotificationForm(next.notifications);
      setFeedback({ kind: "ok", text: i18n.t("settings.prefSaved") });
      setTimeout(() => setFeedback(null), 2500);
    } catch {
      // Revert on failure
      setNotificationForm(notificationForm);
      setFeedback({ kind: "err", text: i18n.t("settings.prefErr") });
    }
  }

  // ── Linear integration handlers ────────────────────────────────────
  async function handleConnect(apiKey: string) {
    setConnectError(null);
    try {
      const next = await connectLinear(apiKey);
      setLinearStatus(next);
      setFeedback({ kind: "ok", text: i18n.t("settings.linearConnected") });
      setTimeout(() => setFeedback(null), 2500);
    } catch (e) {
      setConnectError(i18n.t("settings.linearConnectErr"));
      throw e;
    }
  }

  async function handleSync(): Promise<SyncResult | null> {
    setSyncError(null);
    setSyncing(true);
    try {
      const result = await syncLinear();
      // Refresh the integration status so lastSyncAt updates
      const lin = await getLinearStatus();
      setLinearStatus(lin);
      return result;
    } catch {
      setSyncError(i18n.t("settings.linearSyncErr"));
      return null;
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    try {
      const next = await disconnectLinear();
      setLinearStatus(next);
      setShowDisconnectConfirm(false);
      setFeedback({ kind: "ok", text: i18n.t("settings.linearDisconnected") });
      setTimeout(() => setFeedback(null), 2500);
    } catch {
      setFeedback({ kind: "err", text: i18n.t("settings.linearDisconnectErr") });
    }
  }

  // ── Data management handlers ───────────────────────────────────────
  async function handleExport() {
    try {
      const { filename } = await exportTasks();
      // Trigger the actual download — fetching as a blob then creating an
      // object URL lets us handle the response cleanly without losing headers.
      const res = await fetch("/api/export");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setFeedback({ kind: "ok", text: i18n.t("settings.exportOk") });
      setTimeout(() => setFeedback(null), 2500);
    } catch {
      setFeedback({ kind: "err", text: i18n.t("settings.exportErr") });
    }
  }

  async function handleConfirmDeleteAll() {
    setDeleting(true);
    try {
      await deleteAllTasks();
      setShowDeleteAllConfirm(false);
      setFeedback({ kind: "ok", text: i18n.t("settings.deleteAllOk") });
      setTimeout(() => setFeedback(null), 2500);
      if (onDataChanged) await onDataChanged();
    } catch {
      setFeedback({ kind: "err", text: i18n.t("settings.deleteAllErr") });
    } finally {
      setDeleting(false);
    }
  }

  // ── AI Provider handlers ─────────────────────────────────────────
  async function handleAiSave(data: AiProviderSaveInput) {
    setAiSaving(true);
    try {
      const cfg = await apiSaveAiProvider(data);
      setAiConfig(cfg);
      setFeedback({ kind: "ok", text: i18n.t("settings.aiSaved") });
      setTimeout(() => setFeedback(null), 2500);
    } catch (e) {
      throw e; // let the section component handle the error display
    } finally {
      setAiSaving(false);
    }
  }

  async function handleAiDelete() {
    setAiDeleting(true);
    try {
      const cfg = await apiDeleteAiProvider();
      setAiConfig(cfg);
      setFeedback({ kind: "ok", text: i18n.t("settings.aiDeleted") });
      setTimeout(() => setFeedback(null), 2500);
    } finally {
      setAiDeleting(false);
    }
  }

  async function handleAiTest(data: AiProviderSaveInput): Promise<AiConnectionTestResult> {
    return await apiTestAiProvider(data);
  }

  // ── MCP Servers handlers ─────────────────────────────────────────
  async function handleMcpCreate(data: McpServerInput) {
    setMcpFormError(null);
    setMcpSubmitting(true);
    try {
      await apiCreateMcpServer(data);
      setMcpFormMode("hidden");
      const list = await fetchMcpServers();
      setMcpServers(list);
      setFeedback({ kind: "ok", text: i18n.t("settings.mcpCreated") });
      setTimeout(() => setFeedback(null), 2500);
    } catch (e) {
      setMcpFormError(e instanceof Error ? e.message : i18n.t("error.unknown"));
    } finally {
      setMcpSubmitting(false);
    }
  }

  async function handleMcpEdit(data: McpServerInput) {
    if (!mcpEditTarget) return;
    setMcpFormError(null);
    setMcpSubmitting(true);
    try {
      await apiUpdateMcpServer(mcpEditTarget.id, data);
      setMcpFormMode("hidden");
      setMcpEditTarget(null);
      const list = await fetchMcpServers();
      setMcpServers(list);
      setFeedback({ kind: "ok", text: i18n.t("settings.mcpUpdated") });
      setTimeout(() => setFeedback(null), 2500);
    } catch (e) {
      setMcpFormError(e instanceof Error ? e.message : i18n.t("error.unknown"));
    } finally {
      setMcpSubmitting(false);
    }
  }

  async function handleMcpToggle(id: number) {
    try {
      await apiToggleMcpServer(id);
      const list = await fetchMcpServers();
      setMcpServers(list);
    } catch {
      setMcpError(i18n.t("settings.mcpToggleErr"));
      setTimeout(() => setMcpError(null), 3000);
    }
  }

  async function handleMcpTest(id: number) {
    setMcpTestResults((prev) => ({ ...prev, [id]: "loading" }));
    try {
      const result = await apiTestMcpServer(id);
      setMcpTestResults((prev) => ({ ...prev, [id]: result }));
    } catch {
      setMcpTestResults((prev) => ({
        ...prev,
        [id]: {
          ok: false,
          errorKind: "protocol_error" as const,
          message: i18n.t("settings.mcpConnectionError"),
        },
      }));
    }
  }

  async function handleMcpDelete() {
    if (!mcpDeleteTarget) return;
    try {
      await apiDeleteMcpServer(mcpDeleteTarget.id);
      setMcpDeleteTarget(null);
      const list = await fetchMcpServers();
      setMcpServers(list);
      setFeedback({ kind: "ok", text: i18n.t("settings.mcpDeleted") });
      setTimeout(() => setFeedback(null), 2500);
    } catch {
      setMcpError(i18n.t("settings.mcpDeleteErr"));
      setTimeout(() => setMcpError(null), 3000);
    }
  }

  async function handleMcpApply() {
    setMcpApplying(true);
    try {
      await apiApplyMcpConfig();
      setFeedback({ kind: "ok", text: i18n.t("settings.mcpApplied") });
      setTimeout(() => setFeedback(null), 2500);
    } catch {
      setFeedback({ kind: "err", text: i18n.t("settings.mcpApplyErr") });
      setTimeout(() => setFeedback(null), 3000);
    } finally {
      setMcpApplying(false);
    }
  }

  // ── Loading / error states ─────────────────────────────────────────
  async function handleRetrySettings() {
    try {
      await onRetry();
    } catch {
      // Keep trying to reload settings even if the global retry fails.
    }
    await loadAll();
  }

  function handleLanguageChange(newLang: "es" | "en") {
    setLang(newLang);
    localStorage.setItem("lang", newLang);
    i18n.changeLanguage(newLang);
  }

  if (loading || (!settings && !externalError && !localError)) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <LoadingState message={t("settings.loadingConfig")} />
      </div>
    );
  }

  if (externalError || localError) {
    const displayError = externalError ?? localError;
    return (
      <div className="flex-1 flex flex-col min-h-screen">
        <PageHeader
          title={t("settings.title")}
          subtitle={t("settings.subtitle")}
          actions={workspaceSelector}
        />
        <main className="flex-1 px-8 py-6 flex items-center justify-center">
          <ErrorState message={displayError!} onRetry={() => void handleRetrySettings()} />
        </main>
      </div>
    );
  }

  // settings is guaranteed non-null past the loading + error gates
  const s = settings!;
  const ws = workspaceForm ?? s.workspace;
  const ns = notificationForm ?? s.notifications;
  const workspaceDirty =
    !!workspaceForm &&
    (workspaceForm.workspaceName !== s.workspace.workspaceName ||
      workspaceForm.defaultLanguage !== s.workspace.defaultLanguage ||
      workspaceForm.defaultTimezone !== s.workspace.defaultTimezone);

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* Header — usa el mismo PageHeader que StatsDashboard */}
      <PageHeader
        title="Configuración"
        subtitle="Preferencias del workspace e integraciones"
        actions={workspaceSelector}
      />

      <main className="flex-1 px-8 py-6 space-y-8">
        {/* ── 1. Datos del workspace ─────────────────────────────── */}
        <section aria-label={t("settings.workspace")}>
          <SectionHeader label={t("settings.workspace")} dotColor="bg-accent" />
          <div className="home-card space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-muted-300 mb-1.5 block">
                {t("settings.workspaceName")}
              </span>
              <input
                type="text"
                value={ws.workspaceName}
                onChange={(e) => setWorkspaceForm({ ...ws, workspaceName: e.target.value })}
                className="input-field"
                maxLength={64}
                aria-label={t("settings.workspaceName")}
              />
              <p className="text-[11px] text-muted-500 mt-1">
                {t("settings.charCount", { count: ws.workspaceName.length })}
              </p>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs font-medium text-muted-300 mb-1.5 block">
                  {t("settings.defaultLanguage")}
                </span>
                <select
                  value={ws.defaultLanguage}
                  onChange={(e) => setWorkspaceForm({ ...ws, defaultLanguage: e.target.value })}
                  className="input-field"
                  aria-label={t("settings.defaultLanguage")}
                  disabled
                >
                  <option value="es-ES">{t("settings.langOption_es")}</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-300 mb-1.5 block">
                  {t("settings.defaultTimezone")}
                </span>
                <select
                  value={ws.defaultTimezone}
                  onChange={(e) => setWorkspaceForm({ ...ws, defaultTimezone: e.target.value })}
                  className="input-field"
                  aria-label={t("settings.defaultTimezone")}
                  disabled
                >
                  <option value="Europe/Madrid">Europe/Madrid</option>
                </select>
              </label>
            </div>
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-400/30 border border-white/5">
              <p className="text-xs text-muted-400">{t("settings.workspaceHint")}</p>
              <button
                onClick={handleSaveWorkspace}
                disabled={!workspaceDirty}
                className="btn-primary"
                aria-label={t("settings.saveWorkspaceLabel")}
              >
                {t("settings.saveBtn")}
              </button>
            </div>
          </div>
        </section>

        {/* ── 1b. Repositorio ────────────────────────────────────── */}
        <section aria-label={t("settings.repo")}>
          <SectionHeader label={t("settings.repo")} dotColor="bg-accent" />
          <div className="home-card">
            <RepoSection workspaceId={activeWorkspaceId} />
          </div>
        </section>

        {/* ── 1c. Workspaces ───────────────────────────────────── */}
        <section aria-label={t("settings.workspaces")}>
          <SectionHeader label={t("settings.workspaces")} dotColor="bg-accent" />
          <div className="home-card">
            <WorkspaceSettingsSection
              activeWorkspaceId={activeWorkspaceId}
              onWorkspaceChange={onWorkspaceChange}
            />
          </div>
        </section>

        {/* ── 1d. Apariencia (idioma) ───────────────────────────── */}
        <section aria-label={t("settings.appearance")}>
          <SectionHeader label={t("settings.appearance")} dotColor="bg-accent" />
          <div className="home-card space-y-3">
            <p className="text-xs font-medium text-muted-300">{t("settings.language")}</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleLanguageChange("es")}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  lang === "es"
                    ? "bg-accent border-accent text-white"
                    : "bg-surface-400/30 border-white/10 text-muted-300 hover:border-accent/40"
                }`}
                aria-pressed={lang === "es"}
              >
                {t("settings.language_es")}
              </button>
              <button
                onClick={() => handleLanguageChange("en")}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  lang === "en"
                    ? "bg-accent border-accent text-white"
                    : "bg-surface-400/30 border-white/10 text-muted-300 hover:border-accent/40"
                }`}
                aria-pressed={lang === "en"}
              >
                {t("settings.language_en")}
              </button>
            </div>
          </div>
        </section>

        {/* ── 2. Integración con servicio profesional ────────────── */}
        <section aria-label={t("settings.integration")}>
          <SectionHeader label={t("settings.integration")} dotColor="bg-warning" />
          <IntegrationCard
            status={linearStatus}
            syncing={syncing}
            error={connectError ?? syncError}
            onConnect={handleConnect}
            onSync={handleSync}
            onDisconnect={async () => {
              setShowDisconnectConfirm(true);
            }}
          />
        </section>

        {/* ── 3. Notificaciones ──────────────────────────────────── */}
        <section aria-label={t("settings.notifLabel")}>
          <SectionHeader label={t("settings.notifications")} dotColor="bg-success" />
          <div className="home-card space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-400/30 border border-white/5">
              <div className="w-6 h-6 rounded-md bg-white/5 text-muted-400 flex items-center justify-center shrink-0">
                <BellIcon size={14} />
              </div>
              <p className="text-xs text-muted-400 leading-relaxed">{t("settings.notifHint")}</p>
            </div>

            <NotificationCheckbox
              label={t("settings.notifyOnDue")}
              description={t("settings.notifyOnDueDesc")}
              checked={ns.notifyOnDue}
              onChange={() => handleToggleNotification("notifyOnDue")}
            />
            <NotificationCheckbox
              label={t("settings.notifyOnDone")}
              description={t("settings.notifyOnDoneDesc")}
              checked={ns.notifyOnDone}
              onChange={() => handleToggleNotification("notifyOnDone")}
            />
            <NotificationCheckbox
              label={t("settings.notifyDailyDigest")}
              description={t("settings.notifyDailyDigestDesc")}
              checked={ns.notifyDailyDigest}
              onChange={() => handleToggleNotification("notifyDailyDigest")}
            />
          </div>
        </section>

        {/* ── 4. Apariencia ───────────────────────────────────────── */}
        <section aria-label={t("settings.appearance")}>
          <SectionHeader label={t("settings.appearance")} dotColor="bg-accent" />
          <div className="home-card">
            <p className="text-sm font-medium text-muted-300 mb-3">{t("settings.language")}</p>
            <div className="flex gap-2">
              {(["es", "en"] as const).map((code) => (
                <button
                  key={code}
                  onClick={() => handleLanguageChange(code)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-200 ${
                    lang === code
                      ? "bg-accent/20 border-accent/40 text-accent-300"
                      : "bg-surface-400/50 border-white/10 text-muted-300 hover:border-white/20 hover:text-white"
                  }`}
                  aria-pressed={lang === code}
                >
                  {t(code === "es" ? "settings.language_es" : "settings.language_en")}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── 5. Gestión de datos ────────────────────────────────── */}
        <section aria-label={t("settings.data")}>
          <SectionHeader label={t("settings.data")} dotColor="bg-danger" />
          <div className="home-card space-y-4">
            {/* Export row */}
            <div className="flex items-center justify-between gap-4 flex-wrap p-4 rounded-xl bg-surface-400/30 border border-white/5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">{t("settings.exportTitle")}</p>
                <p className="text-xs text-muted-400 mt-0.5">{t("settings.exportDesc")}</p>
              </div>
              <button
                onClick={handleExport}
                className="btn-secondary flex items-center gap-2 shrink-0"
                aria-label={t("settings.exportLabel")}
              >
                <DownloadIcon size={16} />
                <span>{t("settings.exportBtn")}</span>
              </button>
            </div>

            {/* Delete row */}
            <div className="flex items-center justify-between gap-4 flex-wrap p-4 rounded-xl bg-danger/5 border border-danger/10">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">{t("settings.deleteAllTitle")}</p>
                <p className="text-xs text-muted-400 mt-0.5">
                  {t("settings.deleteAllLabel")}{" "}
                  <span className="font-semibold text-danger-400">
                    {t("settings.deleteAllWarn")}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setShowDeleteAllConfirm(true)}
                className="btn-danger flex items-center gap-2 shrink-0"
                aria-label={t("settings.deleteAllAriaLabel")}
              >
                <TrashIcon size={16} />
                <span>{t("settings.deleteAllButton")}</span>
              </button>
            </div>
          </div>
        </section>

        {/* ── 5. Motor de Agente ──────────────────────────────────── */}
        <section aria-label={t("settings.agentEngine")}>
          <SectionHeader label={t("settings.agentEngine")} dotColor="bg-accent" />
          <div className="home-card">
            <AgentEngineSection />
          </div>
        </section>

        {/* ── 6. Proveedor de IA ─────────────────────────────────── */}
        <section aria-label={t("settings.aiProvider")}>
          <SectionHeader label={t("settings.aiProvider")} dotColor="bg-warning" />
          <div className="home-card">
            <AiProviderSection
              registry={aiRegistry}
              config={aiConfig}
              onSave={handleAiSave}
              onDelete={handleAiDelete}
              onTest={handleAiTest}
              saving={aiSaving}
              deleting={aiDeleting}
            />
          </div>
        </section>

        {/* ── 7. Servidores MCP ──────────────────────────────────── */}
        <section aria-label={t("settings.mcpServers")}>
          <SectionHeader label={t("settings.mcpServers")} dotColor="bg-accent" />
          <div className="home-card space-y-4">
            {/* Action bar: Add + Apply */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-muted-400">{t("settings.mcpInfo")}</p>
              <div className="flex items-center gap-2">
                {mcpFormMode === "hidden" && (
                  <button
                    onClick={() => {
                      setMcpFormMode("create");
                      setMcpFormError(null);
                    }}
                    className="btn-primary text-xs"
                    aria-label={t("mcp.add")}
                  >
                    {t("settings.addMcpServer")}
                  </button>
                )}
                <button
                  onClick={handleMcpApply}
                  disabled={mcpApplying || mcpServers.length === 0}
                  className="btn-secondary text-xs flex items-center gap-1.5"
                  aria-label={t("settings.applyMcp")}
                >
                  {mcpApplying ? t("settings.applyingMcp") : t("settings.applyMcp")}
                </button>
              </div>
            </div>

            {/* Form (create/edit) */}
            {mcpFormMode !== "hidden" && (
              <McpServerForm
                mode={mcpFormMode === "create" ? "create" : "edit"}
                initialData={mcpEditTarget}
                onSubmit={mcpFormMode === "create" ? handleMcpCreate : handleMcpEdit}
                onCancel={() => {
                  setMcpFormMode("hidden");
                  setMcpEditTarget(null);
                  setMcpFormError(null);
                }}
                error={mcpFormError}
                submitting={mcpSubmitting}
              />
            )}

            {/* Server list */}
            <McpServersSection
              servers={mcpServers}
              onEdit={(server) => {
                setMcpEditTarget(server);
                setMcpFormMode("edit");
                setMcpFormError(null);
              }}
              onToggle={handleMcpToggle}
              onTest={handleMcpTest}
              onDelete={(server) => setMcpDeleteTarget(server)}
              testResults={mcpTestResults}
              error={mcpError}
            />
          </div>
        </section>
      </main>

      {/* ── Confirm dialogs ─────────────────────────────────────── */}
      {showDisconnectConfirm && (
        <ConfirmDialog
          title={t("settings.disconnectLinearTitle")}
          message={t("settings.disconnectLinearMsg")}
          onConfirm={handleDisconnect}
          onCancel={() => setShowDisconnectConfirm(false)}
        />
      )}

      {showDeleteAllConfirm && (
        <ConfirmDialog
          title={t("settings.deleteAllTitle")}
          message={t("settings.deleteAllConfirm")}
          onConfirm={handleConfirmDeleteAll}
          onCancel={() => setShowDeleteAllConfirm(false)}
        />
      )}

      {mcpDeleteTarget && (
        <ConfirmDialog
          title={t("settings.mcpDeleteTitle")}
          message={t("settings.mcpDeleteMsg", { name: mcpDeleteTarget.name })}
          onConfirm={handleMcpDelete}
          onCancel={() => setMcpDeleteTarget(null)}
        />
      )}

      {deleting && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 bg-surface-300 border border-white/10 rounded-xl px-4 py-2 text-sm text-white shadow-modal animate-fade-in flex items-center gap-2"
        >
          <div className="w-3 h-3 rounded-full bg-danger animate-pulse" />
          {t("settings.deletingAll")}
        </div>
      )}

      {/* Toast flotante de feedback (éxito / error) */}
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-4 right-4 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm shadow-modal animate-slide-up border ${
            feedback.kind === "ok"
              ? "bg-surface-300 border-success/30 text-success-300"
              : "bg-surface-300 border-danger/30 text-danger-300"
          } ${deleting ? "bottom-16" : ""}`}
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${feedback.kind === "ok" ? "bg-success" : "bg-danger"}`}
          />
          {feedback.text}
        </div>
      )}
    </div>
  );
}

interface NotificationCheckboxProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}

function NotificationCheckbox({
  label,
  description,
  checked,
  onChange,
}: NotificationCheckboxProps) {
  return (
    <label
      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
        checked
          ? "bg-accent/10 border-accent/25"
          : "bg-surface-300/20 border-white/10 hover:border-accent/20"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
        aria-label={label}
      />
      <span
        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent peer-focus-visible:outline-offset-2 ${
          checked ? "bg-accent border-accent" : "bg-surface-400 border-white/15"
        }`}
        aria-hidden="true"
      >
        {checked && <CheckCircleIcon size={14} className="text-white" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-sm text-gray-200 block">{label}</span>
        <span className="text-xs text-muted-400 mt-0.5 block">{description}</span>
      </span>
    </label>
  );
}
