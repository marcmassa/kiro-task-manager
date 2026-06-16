import { useState, useEffect, useCallback } from "react";
import { WarningIcon, DownloadIcon, TrashIcon, CheckCircleIcon } from "../Icons";
import { ConfirmDialog } from "./ConfirmDialog";
import { IntegrationCard } from "./IntegrationCard";
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
} from "../api";
import type {
  SettingsResponse,
  WorkspaceSettings,
  NotificationSettings,
  LinearIntegrationStatus,
  SyncResult,
} from "../types";

interface SettingsPageProps {
  loading: boolean;
  error: string | null;
  onRetry: () => Promise<void> | void;
  /** Called after a successful `DELETE /api/tasks/all` so the rest of the
   *  app (Kanban + Stats) refreshes its data. */
  onDataChanged?: () => Promise<void> | void;
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
}: SettingsPageProps) {
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

  // ── Data load ──────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLocalError(null);
    try {
      const [s, lin] = await Promise.all([fetchSettings(), getLinearStatus()]);
      setSettings(s);
      setLinearStatus(lin);
      setWorkspaceForm(s.workspace);
      setNotificationForm(s.notifications);
    } catch (e) {
      console.error("SettingsPage load error:", e);
      setLocalError("No se pudo cargar la configuración. Intenta de nuevo.");
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
      setFeedback({ kind: "ok", text: "Cambios guardados" });
      setTimeout(() => setFeedback(null), 2500);
    } catch {
      setFeedback({ kind: "err", text: "No se pudieron guardar los cambios" });
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
      setFeedback({ kind: "ok", text: "Preferencias guardadas" });
      setTimeout(() => setFeedback(null), 2500);
    } catch {
      // Revert on failure
      setNotificationForm(notificationForm);
      setFeedback({ kind: "err", text: "No se pudieron guardar las preferencias" });
    }
  }

  // ── Linear integration handlers ────────────────────────────────────
  async function handleConnect(apiKey: string) {
    setConnectError(null);
    try {
      const next = await connectLinear(apiKey);
      setLinearStatus(next);
      setFeedback({ kind: "ok", text: "Linear conectado correctamente" });
      setTimeout(() => setFeedback(null), 2500);
    } catch (e) {
      setConnectError("No se pudo conectar con Linear. Verifica el API key.");
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
      setSyncError("No se pudo sincronizar. Inténtalo de nuevo.");
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
      setFeedback({ kind: "ok", text: "Linear desconectado" });
      setTimeout(() => setFeedback(null), 2500);
    } catch {
      setFeedback({ kind: "err", text: "No se pudo desconectar Linear" });
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
      setFeedback({ kind: "ok", text: "Exportación iniciada" });
      setTimeout(() => setFeedback(null), 2500);
    } catch {
      setFeedback({ kind: "err", text: "No se pudo iniciar la exportación" });
    }
  }

  async function handleConfirmDeleteAll() {
    setDeleting(true);
    try {
      await deleteAllTasks();
      setShowDeleteAllConfirm(false);
      setFeedback({ kind: "ok", text: "Todas las tareas han sido eliminadas" });
      setTimeout(() => setFeedback(null), 2500);
      if (onDataChanged) await onDataChanged();
    } catch {
      setFeedback({ kind: "err", text: "No se pudieron eliminar las tareas" });
    } finally {
      setDeleting(false);
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

  if (loading || (!settings && !externalError && !localError)) {
    return (
      <div className="flex-1 ml-[72px] flex items-center justify-center min-h-screen">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full bg-accent/40" />
          </div>
          <p className="text-muted-400 text-sm" role="status" aria-live="polite">
            Cargando configuración...
          </p>
        </div>
      </div>
    );
  }

  if (externalError || localError) {
    const displayError = externalError ?? localError;
    return (
      <div className="flex-1 ml-[72px] flex flex-col min-h-screen">
        <header className="sticky top-0 z-10 bg-surface-600/80 backdrop-blur-xl border-b border-white/5">
          <div className="px-8 py-6">
            <h1 className="text-2xl font-bold text-white">Configuración</h1>
            <p className="text-sm text-muted-400 mt-1">
              Preferencias del workspace e integraciones
            </p>
          </div>
        </header>
        <main className="flex-1 px-4 md:px-8 py-6 flex items-center justify-center">
          <div className="home-card text-center py-12 max-w-md">
            <div className="w-12 h-12 rounded-xl bg-danger/15 text-danger-400 flex items-center justify-center mx-auto mb-4">
              <WarningIcon size={24} />
            </div>
            <p className="text-danger-400 mb-4">{displayError}</p>
            <button className="btn-primary" onClick={() => void handleRetrySettings()}>
              Reintentar
            </button>
          </div>
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
    <div className="flex-1 ml-[72px] flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-surface-600/80 backdrop-blur-xl border-b border-white/5">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Configuración</h1>
              <p className="text-sm text-muted-400 mt-1">
                Preferencias del workspace e integraciones
              </p>
            </div>
            {feedback && (
              <div
                role="status"
                aria-live="polite"
                className={`text-xs px-3 py-1.5 rounded-lg shrink-0 ${
                  feedback.kind === "ok"
                    ? "bg-success/15 text-success-400 border border-success/20"
                    : "bg-danger/15 text-danger-400 border border-danger/20"
                }`}
              >
                {feedback.text}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 px-8 py-6">
        <div className="space-y-8">
          {/* ── 1. Datos del workspace ─────────────────────────────── */}
          <section aria-label="Datos del workspace">
            <h2 className="text-sm font-semibold text-gray-200 mb-4">Datos del workspace</h2>
            <div className="home-card space-y-4">
              <label className="block">
                <span className="text-xs font-medium text-muted-300 mb-1.5 block">
                  Nombre del workspace
                </span>
                <input
                  type="text"
                  value={ws.workspaceName}
                  onChange={(e) => setWorkspaceForm({ ...ws, workspaceName: e.target.value })}
                  className="input-field"
                  maxLength={64}
                  aria-label="Nombre del workspace"
                />
                <p className="text-[11px] text-muted-500 mt-1">
                  {ws.workspaceName.length}/64 caracteres
                </p>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-medium text-muted-300 mb-1.5 block">
                    Idioma por defecto
                  </span>
                  <select
                    value={ws.defaultLanguage}
                    onChange={(e) => setWorkspaceForm({ ...ws, defaultLanguage: e.target.value })}
                    className="input-field"
                    aria-label="Idioma por defecto"
                    disabled
                  >
                    <option value="es-ES">Español (España)</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-muted-300 mb-1.5 block">
                    Zona horaria
                  </span>
                  <select
                    value={ws.defaultTimezone}
                    onChange={(e) => setWorkspaceForm({ ...ws, defaultTimezone: e.target.value })}
                    className="input-field"
                    aria-label="Zona horaria por defecto"
                    disabled
                  >
                    <option value="Europe/Madrid">Europe/Madrid</option>
                  </select>
                </label>
              </div>
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-400/30 border border-white/5">
                <p className="text-xs text-muted-400">
                  Los cambios se guardan localmente en este workspace.
                </p>
                <button
                  onClick={handleSaveWorkspace}
                  disabled={!workspaceDirty}
                  className="btn-primary"
                  aria-label="Guardar cambios del workspace"
                >
                  Guardar
                </button>
              </div>
            </div>
          </section>

          {/* ── 2. Integración con servicio profesional ────────────── */}
          <section aria-label="Integración con servicio profesional">
            <h2 className="text-sm font-semibold text-gray-200 mb-4">
              Integración con servicio profesional
            </h2>
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
          <section aria-label="Preferencias de notificación">
            <h2 className="text-sm font-semibold text-gray-200 mb-4">Notificaciones</h2>
            <div className="home-card space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-400/30 border border-white/5">
                <div className="w-6 h-6 rounded-md bg-white/5 text-muted-400 flex items-center justify-center shrink-0">
                  <WarningIcon size={14} />
                </div>
                <p className="text-xs text-muted-400 leading-relaxed">
                  Las notificaciones se almacenan con tus preferencias y se activarán en la próxima
                  versión. Mientras tanto, las estadísticas se actualizan en tiempo real.
                </p>
              </div>

              <NotificationCheckbox
                label="Notificarme cuando una tarea vence"
                description="Aviso preventivo antes de que expire una tarea activa."
                checked={ns.notifyOnDue}
                onChange={() => handleToggleNotification("notifyOnDue")}
              />
              <NotificationCheckbox
                label="Notificarme cuando se completa una tarea"
                description="Confirmación automática cuando una tarea pasa a completada."
                checked={ns.notifyOnDone}
                onChange={() => handleToggleNotification("notifyOnDone")}
              />
              <NotificationCheckbox
                label="Resumen diario por correo"
                description="Resumen consolidado de actividad y progreso al final del día."
                checked={ns.notifyDailyDigest}
                onChange={() => handleToggleNotification("notifyDailyDigest")}
              />
            </div>
          </section>

          {/* ── 4. Gestión de datos ────────────────────────────────── */}
          <section aria-label="Gestión de datos">
            <h2 className="text-sm font-semibold text-gray-200 mb-4">Gestión de datos</h2>
            <div className="home-card space-y-4">
              {/* Export row */}
              <div className="flex items-center justify-between gap-4 flex-wrap p-4 rounded-xl bg-surface-400/30 border border-white/5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">Exportar tareas (JSON)</p>
                  <p className="text-xs text-muted-400 mt-0.5">
                    Descarga una copia de seguridad con tareas, comentarios, categorías y
                    prioridades.
                  </p>
                </div>
                <button
                  onClick={handleExport}
                  className="btn-secondary flex items-center gap-2 shrink-0"
                  aria-label="Exportar todas las tareas en JSON"
                >
                  <DownloadIcon size={16} />
                  <span>Exportar</span>
                </button>
              </div>

              {/* Delete row */}
              <div className="flex items-center justify-between gap-4 flex-wrap p-4 rounded-xl bg-danger/5 border border-danger/10">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">Eliminar todas las tareas</p>
                  <p className="text-xs text-muted-400 mt-0.5">
                    Borra de forma permanente todas las tareas y comentarios.{" "}
                    <span className="font-semibold text-danger-400">No se puede deshacer.</span>
                  </p>
                </div>
                <button
                  onClick={() => setShowDeleteAllConfirm(true)}
                  className="btn-danger flex items-center gap-2 shrink-0"
                  aria-label="Eliminar todas las tareas"
                >
                  <TrashIcon size={16} />
                  <span>Eliminar todas</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* ── Confirm dialogs ─────────────────────────────────────── */}
      {showDisconnectConfirm && (
        <ConfirmDialog
          title="Desconectar Linear"
          message="¿Desconectar Linear? Las tareas sincronizadas permanecerán en tu workspace pero dejarán de actualizarse."
          onConfirm={handleDisconnect}
          onCancel={() => setShowDisconnectConfirm(false)}
        />
      )}

      {showDeleteAllConfirm && (
        <ConfirmDialog
          title="Eliminar todas las tareas"
          message="¿Eliminar TODAS las tareas? Esta acción no se puede deshacer."
          onConfirm={handleConfirmDeleteAll}
          onCancel={() => setShowDeleteAllConfirm(false)}
        />
      )}

      {deleting && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 bg-surface-300 border border-white/10 rounded-xl px-4 py-2 text-sm text-white shadow-modal animate-fade-in flex items-center gap-2"
        >
          <div className="w-3 h-3 rounded-full bg-danger animate-pulse" />
          Eliminando todas las tareas...
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
