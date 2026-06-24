import { useState, useEffect, useCallback } from "react";
import { fetchAgentStatus, fetchAgentConfig, updateAgentConfig, triggerAgentRun } from "../api";
import type { AgentStatusResponse, AgentEngineConfig } from "../types";
import { useT } from "../i18n/useT";
import i18n from "../i18n";
import { useT } from "../i18n/useT";

/** Color map for the status badge (no labels — resolved via i18n). */
const STATUS_STYLES: Record<string, { badge: string; dot: string }> = {
  idle: {
    badge:
      "inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] font-medium text-muted-400",
    dot: "bg-muted-500",
  },
  working: {
    badge:
      "inline-flex items-center gap-1 rounded-full bg-accent/10 border border-accent/20 px-2 py-0.5 text-[10px] font-medium text-accent-300",
    dot: "bg-accent",
  },
  error: {
    badge:
      "inline-flex items-center gap-1 rounded-full bg-danger/10 border border-danger/20 px-2 py-0.5 text-[10px] font-medium text-danger-400",
    dot: "bg-danger",
  },
  disabled: {
    badge:
      "inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] font-medium text-muted-500",
    dot: "bg-muted-600",
  },
};

const STATUS_LABEL_KEY: Record<string, string> = {
  idle: "agent.statusIdle",
  working: "agent.statusWorking",
  error: "agent.statusError",
  disabled: "agent.statusDisabled",
};

/**
 * AgentEngineSection — self-contained panel showing the agent engine
 * status, configuration toggles, and manual cycle trigger.
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4
 */
export function AgentEngineSection(): JSX.Element {
  const t = useT();
  const [status, setStatus] = useState<AgentStatusResponse | null>(null);
  const [config, setConfig] = useState<AgentEngineConfig | null>(null);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Load initial data ────────────────────────────────────────────────
  useEffect(() => {
    fetchAgentStatus()
      .then(setStatus)
      .catch(() => {});
    fetchAgentConfig()
      .then(setConfig)
      .catch(() => {});
  }, []);

  // ── Poll status every 5 seconds ─────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAgentStatus()
        .then(setStatus)
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleToggleAutoStart = useCallback(async () => {
    if (!config) return;
    setSaving(true);
    try {
      const updated = await updateAgentConfig({ autoStart: !config.autoStart });
      setConfig(updated);
    } catch {
      // silently ignore
    } finally {
      setSaving(false);
    }
  }, [config]);

  const handleMaxChatTurnsChange = useCallback(
    async (value: number) => {
      if (!config) return;
      const clamped = Math.max(1, Math.min(50, value));
      setSaving(true);
      try {
        const updated = await updateAgentConfig({ maxChatTurnsPerExecution: clamped });
        setConfig(updated);
      } catch {
        // silently ignore
      } finally {
        setSaving(false);
      }
    },
    [config],
  );

  const handlePollIntervalChange = useCallback(
    async (value: number) => {
      if (!config) return;
      const clamped = Math.max(5000, Math.min(300000, value));
      setSaving(true);
      try {
        const updated = await updateAgentConfig({ pollIntervalMs: clamped });
        setConfig(updated);
      } catch {
        // silently ignore
      } finally {
        setSaving(false);
      }
    },
    [config],
  );

  const handleRunCycle = useCallback(async () => {
    setRunning(true);
    try {
      await triggerAgentRun();
      // Refresh status immediately after triggering
      const freshStatus = await fetchAgentStatus();
      setStatus(freshStatus);
    } catch {
      // silently ignore
    } finally {
      setRunning(false);
    }
  }, []);

  // ── Derived values ───────────────────────────────────────────────────
  const currentStatus = status?.status ?? "disabled";
  const style = STATUS_STYLES[currentStatus] ?? STATUS_STYLES.disabled;
  const statusLabel = i18n.t(
    (STATUS_LABEL_KEY[currentStatus] ?? "agent.statusDisabled") as Parameters<typeof i18n.t>[0],
  );
  const isWorking = currentStatus === "working";

  return (
    <section aria-label={t("agent.enginePanelLabel")} className="space-y-4">
      {/* Status badge + last cycle */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* Badge */}
        <span
          className={style.badge}
          aria-label={t("agent.engineStatusLabel", { status: statusLabel })}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
          {statusLabel}
        </span>

        {/* Last cycle timestamp */}
        {status?.lastCycleAt && (
          <span className="text-xs text-muted-500" aria-label={t("agent.lastCycleLabel")}>
            {t("agent.lastCycleText")}{" "}
            <time dateTime={status.lastCycleAt}>
              {new Date(status.lastCycleAt).toLocaleString(
                i18n.language === "en" ? "en-GB" : "es-ES",
              )}
            </time>
          </span>
        )}
      </div>

      {/* Current task indicator — only when working */}
      {isWorking && status?.currentTaskId != null && (
        <div
          className="flex items-center gap-2 p-3 rounded-xl bg-accent/5 border border-accent/20"
          aria-label={t("agent.currentTaskLabel")}
        >
          <span className="animate-pulse h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
          <span className="text-sm font-medium text-accent-300">
            {t("agent.currentTaskText", {
              id: status.currentTaskId,
              title: status.currentTaskTitle,
            })}
          </span>
        </div>
      )}

      {/* Config controls */}
      <div className="space-y-3">
        {/* Auto-start toggle */}
        <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-surface-400/30 border border-white/5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">{t("agent.autoStart")}</p>
            <p className="text-xs text-muted-400 mt-0.5">{t("agent.autoStartDesc")}</p>
          </div>
          <button
            id="agent-auto-start"
            role="switch"
            type="button"
            aria-checked={config?.autoStart ?? false}
            aria-label={t("agent.autoStartLabel")}
            disabled={saving}
            onClick={handleToggleAutoStart}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:ring-offset-0 disabled:opacity-50 ${
              config?.autoStart ? "bg-accent" : "bg-white/10"
            }`}
          >
            <span
              aria-hidden="true"
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                config?.autoStart ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {/* Max chat turns */}
        <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-surface-400/30 border border-white/5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">{t("agent.maxTurns")}</p>
            <p className="text-xs text-muted-400 mt-0.5">{t("agent.maxTurnsDesc")}</p>
          </div>
          <input
            type="number"
            min={1}
            max={50}
            step={1}
            value={config?.maxChatTurnsPerExecution ?? 10}
            aria-label={t("agent.maxTurnsLabel")}
            disabled={saving}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) {
                setConfig((prev) => (prev ? { ...prev, maxChatTurnsPerExecution: val } : prev));
              }
            }}
            onBlur={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) handleMaxChatTurnsChange(val);
            }}
            className="input-field w-20 !py-1.5 text-right text-sm"
          />
        </div>

        {/* Poll interval */}
        <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-surface-400/30 border border-white/5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">{t("agent.pollInterval")}</p>
            <p className="text-xs text-muted-400 mt-0.5">{t("agent.pollIntervalDesc")}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              id="agent-poll-interval"
              type="number"
              min={5000}
              max={300000}
              step={1000}
              value={config?.pollIntervalMs ?? 30000}
              aria-label={t("agent.pollIntervalLabel")}
              disabled={saving}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  setConfig((prev) => (prev ? { ...prev, pollIntervalMs: val } : prev));
                }
              }}
              onBlur={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  handlePollIntervalChange(val);
                }
              }}
              className="input-field w-28 !py-1.5 text-right text-sm"
            />
            <span className="text-xs text-muted-500">ms</span>
          </div>
        </div>
      </div>

      {/* Run Cycle button */}
      <button
        type="button"
        disabled={isWorking || running}
        onClick={handleRunCycle}
        aria-label={t("agent.runCycleLabel")}
        className="btn-primary inline-flex items-center gap-2"
      >
        {running ? (
          <>
            <span
              className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"
              aria-hidden="true"
            />
            {t("agent.runCycleRunning")}
          </>
        ) : (
          t("agent.runCycle")
        )}
      </button>

      {/* Last error */}
      {status?.lastError && (
        <div
          className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger-400"
          role="alert"
          aria-label={t("agent.lastErrorLabel")}
        >
          <span className="font-medium">{t("agent.lastErrorText")}</span> {status.lastError}
        </div>
      )}
    </section>
  );
}
