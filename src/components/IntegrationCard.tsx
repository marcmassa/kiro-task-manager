import { useState } from "react";
import { LinkIcon, CheckCircleIcon, RefreshIcon, WarningIcon } from "../Icons";
import type { LinearIntegrationStatus, SyncResult } from "../types";

interface IntegrationCardProps {
  status: LinearIntegrationStatus;
  syncing: boolean;
  error: string | null;
  /** Called when the user clicks "Conectar" with a non-empty API key. */
  onConnect: (apiKey: string) => Promise<void>;
  /** Called when the user clicks "Sincronizar ahora". */
  onSync: () => Promise<SyncResult | null>;
  /** Called when the user clicks "Desconectar" (after ConfirmDialog confirmation upstream). */
  onDisconnect: () => Promise<void>;
}

const PROVIDERS = [
  { id: "linear", label: "Linear", enabled: true },
  { id: "jira", label: "Jira (Próximamente)", enabled: false },
  { id: "trello", label: "Trello (Próximamente)", enabled: false },
  { id: "asana", label: "Asana (Próximamente)", enabled: false },
];

/**
 * Sub-component of `SettingsPage` that owns the integration UX.
 *
 * Three visual states:
 *   - disconnected: provider select + apiKey input + "Conectar" button
 *   - connected: account + sync console widget + mini dashboard + buttons
 *   - syncing: "Sincronizar ahora" disabled, with role="status" / aria-live="polite"
 *
 * The ConfirmDialog for "Desconectar" is owned by SettingsPage (it appears
 * outside the card and is part of the destructive-action pattern).
 */
export function IntegrationCard({
  status,
  syncing,
  error,
  onConnect,
  onSync,
  onDisconnect,
}: IntegrationCardProps) {
  const [provider, setProvider] = useState("linear");
  const [apiKey, setApiKey] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleConnect() {
    if (!apiKey.trim()) return;
    setSubmitting(true);
    try {
      await onConnect(apiKey.trim());
      setApiKey(""); // forget the key from local state as soon as the call resolves
    } catch {
      // The error is surfaced via the `error` prop from the parent
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSync() {
    setSubmitting(true);
    try {
      await onSync();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDisconnect() {
    setSubmitting(true);
    try {
      await onDisconnect();
    } finally {
      setSubmitting(false);
    }
  }

  function formatLastSync(iso: string | null | undefined): string {
    if (!iso) return "Nunca";
    try {
      return new Date(iso).toLocaleString("es-ES", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Fecha desconocida";
    }
  }

  // ── Connected state ──────────────────────────────────────────────────
  if (status.connected && status.account) {
    const summary = status.lastSyncSummary;
    const lastSyncFormatted = formatLastSync(status.lastSyncAt);

    return (
      <div
        className="home-card border border-success/20 bg-gradient-to-br from-success/5 via-transparent to-accent/5"
        role="region"
        aria-label="Integración con Linear"
      >
        <div className="flex items-start justify-between gap-6 flex-col md:flex-row">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <div className="w-12 h-12 rounded-xl bg-success/15 text-success-300 flex items-center justify-center shrink-0 mt-0.5">
              <LinkIcon size={22} />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              {/* Account name + Connected badge */}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-white truncate">
                    {status.account.name}
                  </span>
                  <span className="badge bg-success/15 text-success-300 border border-success/20 text-[10px] inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-4s" />
                    Conectado
                  </span>
                </div>
                <p className="text-xs text-muted-400 truncate mt-0.5">{status.account.email}</p>
              </div>

              {/* Change 1: Compact sync console widget */}
              <div className="rounded-lg border border-white/5 bg-surface-200/50 p-3 border-l-2 border-l-accent/30">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-4s shrink-0" />
                  <span className="text-xs font-mono text-muted-400">
                    Última sincronización: {lastSyncFormatted}
                  </span>
                </div>
                {summary ? (
                  <p className="text-xs text-muted-500 ml-[18px]">
                    {summary.found} issues encontradas · {summary.mappable} listas para importar
                  </p>
                ) : (
                  <p className="text-xs text-muted-600 ml-[18px]">
                    Sin datos de sincronización todavía
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 shrink-0 flex-wrap">
            <button
              onClick={handleSync}
              disabled={syncing || submitting}
              className="btn-primary flex items-center gap-2"
              aria-label="Sincronizar ahora con Linear"
              aria-busy={syncing}
            >
              <RefreshIcon size={16} className={syncing ? "animate-spin" : ""} />
              <span>{syncing ? "Sincronizando..." : "Sincronizar ahora"}</span>
            </button>
            <button
              onClick={handleDisconnect}
              disabled={submitting}
              className="btn-danger whitespace-nowrap"
              aria-label="Desconectar Linear"
            >
              Desconectar
            </button>
          </div>
        </div>

        {/* Mini dashboard — 3 stat cards */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="rounded-xl border border-white/10 bg-surface-400/50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-500">Último sync</p>
            <p className="text-sm font-medium text-white mt-1">{lastSyncFormatted}</p>
          </div>
          <div className="rounded-xl border border-accent/20 bg-accent/10 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-accent-300">
              Issues encontradas
            </p>
            <p className="text-sm font-medium text-white mt-1">{summary?.found ?? 0}</p>
          </div>
          <div className="rounded-xl border border-success/20 bg-success/10 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-success-300">Importables</p>
            <p className="text-sm font-medium text-white mt-1">{summary?.mappable ?? 0}</p>
          </div>
        </div>

        {syncing && (
          <div
            role="status"
            aria-live="polite"
            className="mt-4 flex items-center gap-2 text-xs text-accent-300"
          >
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span>Sincronizando...</span>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-4 text-xs text-danger-400">
            {error}
          </p>
        )}
      </div>
    );
  }

  // ── Disconnected state ───────────────────────────────────────────────
  return (
    <div
      className="home-card border border-white/10"
      role="region"
      aria-label="Conectar integración"
    >
      {/* Info banner */}
      <div className="flex items-start gap-3 p-3 rounded-xl border border-accent/20 bg-accent/10 mb-4">
        <div className="w-8 h-8 rounded-lg bg-accent/20 text-accent-300 flex items-center justify-center shrink-0">
          <LinkIcon size={16} />
        </div>
        <div>
          <p className="text-sm font-medium text-white">Conecta tu herramienta profesional</p>
          <p className="text-xs text-muted-300 mt-0.5">
            En esta versión, solo Linear está habilitado.
          </p>
        </div>
      </div>

      {/* Change 2: One-line description above the form row */}
      <p className="text-xs text-muted-400 mb-4">
        Conecta tu workspace con Linear para importar issues y asignarlas a tu kanban.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-xs font-medium text-muted-300 mb-1.5 block">Proveedor</span>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="input-field"
            aria-label="Seleccionar proveedor de integración"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id} disabled={!p.enabled}>
                {p.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-500 mt-1">
            Jira, Trello y Asana llegarán en próximas versiones.
          </p>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-300 mb-1.5 block">API key personal</span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="lin_api_..."
            className="input-field font-mono text-sm"
            autoComplete="off"
            spellCheck={false}
            aria-label="API key de Linear"
          />
          {/* Change 2: Helper text below API key input */}
          <p className="text-[10px] text-muted-400 mt-1">
            Consíguelo en Linear → Settings → API keys
          </p>
        </label>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-xs text-danger-400 flex items-center gap-1.5">
          <WarningIcon size={14} />
          <span>{error}</span>
        </p>
      )}

      <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-500 max-w-md">
          El API key se cifra antes de guardarse. Linear no se contacta hasta que pulses "Conectar".
        </p>
        <button
          onClick={handleConnect}
          disabled={!apiKey.trim() || submitting}
          className="btn-primary flex items-center gap-2"
          aria-label="Conectar con Linear"
        >
          {submitting ? (
            <>
              <div className="w-3 h-3 rounded-full bg-white/30 animate-pulse" />
              <span>Conectando...</span>
            </>
          ) : (
            <>
              <CheckCircleIcon size={16} />
              <span>Conectar</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
