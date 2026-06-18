import { useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import type {
  AiProviderMeta,
  AiProviderConfigResponse,
  AiProviderSaveInput,
  AiConnectionTestResult,
} from "../types";

interface AiProviderSectionProps {
  registry: AiProviderMeta[];
  config: AiProviderConfigResponse | null;
  onSave: (data: AiProviderSaveInput) => Promise<void>;
  onDelete: () => void;
  onTest: (data: AiProviderSaveInput) => Promise<AiConnectionTestResult>;
  saving: boolean;
  deleting: boolean;
}

/**
 * AiProviderSection — sección de configuración del proveedor de IA
 * para la página de Settings (FEAT-009).
 *
 * Muestra:
 *  - Estado actual (sin configurar / conectado)
 *  - Formulario dinámico según el proveedor seleccionado
 *  - Prueba de conexión y guardado
 */
export function AiProviderSection({
  registry,
  config,
  onSave,
  onDelete,
  onTest,
  saving,
  deleting,
}: AiProviderSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isConfigured = config?.configured === true;

  // Show form if not configured or user clicked "Cambiar proveedor"
  const formVisible = showForm || !isConfigured;

  return (
    <div className="space-y-4">
      {/* Summary card when configured */}
      {isConfigured && !showForm && (
        <ConfiguredSummary
          config={config!}
          onChangeProvider={() => setShowForm(true)}
          onDelete={() => setShowDeleteConfirm(true)}
          deleting={deleting}
        />
      )}

      {/* Form */}
      {formVisible && (
        <AiProviderForm
          registry={registry}
          onSave={async (data) => {
            await onSave(data);
            setShowForm(false);
          }}
          onTest={onTest}
          onCancel={isConfigured ? () => setShowForm(false) : undefined}
          saving={saving}
        />
      )}

      {/* Delete confirm dialog */}
      {showDeleteConfirm && (
        <ConfirmDialog
          title="Eliminar configuración"
          message="¿Eliminar la configuración del proveedor de IA? El agente quedará sin cerebro hasta que configures uno nuevo."
          confirmLabel="Eliminar"
          cancelLabel="Cancelar"
          onConfirm={() => {
            onDelete();
            setShowDeleteConfirm(false);
            setShowForm(false);
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}

// ── ConfiguredSummary ─────────────────────────────────────────────────────

interface ConfiguredSummaryProps {
  config: AiProviderConfigResponse;
  onChangeProvider: () => void;
  onDelete: () => void;
  deleting: boolean;
}

function ConfiguredSummary({
  config,
  onChangeProvider,
  onDelete,
  deleting,
}: ConfiguredSummaryProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap p-4 rounded-xl bg-surface-400/30 border border-white/5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 mb-1.5">
            <p className="text-sm font-semibold text-white">{config.providerName}</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 border border-success/20 px-2 py-0.5 text-[10px] font-medium text-success-300">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              Conectado
            </span>
          </div>
          <p className="text-xs text-muted-400">
            Modelo: <span className="text-muted-300 font-medium">{config.model}</span>
          </p>
          {config.apiKeyMasked && (
            <p className="text-xs text-muted-500 mt-0.5 font-mono">{config.apiKeyMasked}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onChangeProvider}
            className="btn-secondary text-xs"
            aria-label="Cambiar proveedor de IA"
          >
            Cambiar proveedor
          </button>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="btn-danger text-xs"
            aria-label="Eliminar configuración del proveedor de IA"
          >
            {deleting ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AiProviderForm ────────────────────────────────────────────────────────

interface AiProviderFormProps {
  registry: AiProviderMeta[];
  onSave: (data: AiProviderSaveInput) => Promise<void>;
  onTest: (data: AiProviderSaveInput) => Promise<AiConnectionTestResult>;
  onCancel?: () => void;
  saving: boolean;
}

function AiProviderForm({ registry, onSave, onTest, onCancel, saving }: AiProviderFormProps) {
  const [providerId, setProviderId] = useState("");
  const [model, setModel] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [region, setRegion] = useState("");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<AiConnectionTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedProvider = registry.find((p) => p.id === providerId) ?? null;

  function buildSaveInput(): AiProviderSaveInput {
    const resolvedModel = model === "__custom" ? customModel.trim() : model;
    const data: AiProviderSaveInput = {
      providerId,
      model: resolvedModel,
    };
    if (selectedProvider) {
      if (selectedProvider.authType === "api_key") {
        data.apiKey = apiKey;
      } else if (selectedProvider.authType === "aws_credentials") {
        data.region = region;
        data.accessKeyId = accessKeyId;
        data.secretAccessKey = secretAccessKey;
      } else if (selectedProvider.authType === "none") {
        data.baseUrl = baseUrl;
      }
      // Custom base URL for providers that support it
      if (selectedProvider.supportsCustomBaseUrl && baseUrl.trim()) {
        data.baseUrl = baseUrl;
      }
    }
    if (showAdvanced) {
      data.temperature = temperature;
      data.maxTokens = maxTokens;
    }
    return data;
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const result = await onTest(buildSaveInput());
      setTestResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al probar conexión");
    } finally {
      setTesting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onSave(buildSaveInput());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar configuración");
    }
  }

  function handleProviderChange(newProviderId: string) {
    setProviderId(newProviderId);
    setModel("");
    setCustomModel("");
    setApiKey("");
    setRegion("");
    setAccessKeyId("");
    setSecretAccessKey("");
    setBaseUrl("");
    setTestResult(null);
    setError(null);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" aria-label="Formulario de proveedor de IA">
      {/* Status badge when not configured */}
      {!onCancel && (
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] font-medium text-muted-400">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-500" />
            Sin configurar
          </span>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger-400 flex items-center gap-2"
        >
          <span className="shrink-0">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* Provider selector */}
      <label className="block">
        <span className="text-xs font-medium text-muted-300 mb-1.5 block">
          Proveedor <span className="text-danger-400">*</span>
        </span>
        <select
          value={providerId}
          onChange={(e) => handleProviderChange(e.target.value)}
          className="input-field"
          required
          aria-label="Seleccionar proveedor de IA"
        >
          <option value="">— Seleccionar proveedor —</option>
          {registry.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName}
            </option>
          ))}
        </select>
      </label>

      {/* Dynamic fields based on authType */}
      {selectedProvider && (
        <>
          {/* API Key (api_key providers) */}
          {selectedProvider.authType === "api_key" && (
            <label className="block">
              <span className="text-xs font-medium text-muted-300 mb-1.5 block">
                API Key <span className="text-danger-400">*</span>
              </span>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="input-field"
                placeholder="sk-..."
                required
                autoComplete="off"
                aria-label="API Key del proveedor"
              />
            </label>
          )}

          {/* AWS Credentials (bedrock) */}
          {selectedProvider.authType === "aws_credentials" && (
            <>
              <label className="block">
                <span className="text-xs font-medium text-muted-300 mb-1.5 block">
                  Región AWS <span className="text-danger-400">*</span>
                </span>
                <input
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="input-field"
                  placeholder="us-east-1"
                  required
                  aria-label="Región AWS"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-300 mb-1.5 block">
                  Access Key ID <span className="text-danger-400">*</span>
                </span>
                <input
                  type="text"
                  value={accessKeyId}
                  onChange={(e) => setAccessKeyId(e.target.value)}
                  className="input-field"
                  placeholder="AKIA..."
                  required
                  aria-label="Access Key ID"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-300 mb-1.5 block">
                  Secret Access Key <span className="text-danger-400">*</span>
                </span>
                <input
                  type="password"
                  value={secretAccessKey}
                  onChange={(e) => setSecretAccessKey(e.target.value)}
                  className="input-field"
                  placeholder="••••••••"
                  required
                  autoComplete="off"
                  aria-label="Secret Access Key"
                />
              </label>
            </>
          )}

          {/* Base URL (Ollama - authType "none") */}
          {selectedProvider.authType === "none" && (
            <label className="block">
              <span className="text-xs font-medium text-muted-300 mb-1.5 block">
                URL Base <span className="text-danger-400">*</span>
              </span>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="input-field"
                placeholder={selectedProvider.defaultBaseUrl || "http://localhost:11434"}
                required
                aria-label="URL base del proveedor"
              />
            </label>
          )}

          {/* Model selector */}
          <label className="block">
            <span className="text-xs font-medium text-muted-300 mb-1.5 block">
              Modelo <span className="text-danger-400">*</span>
            </span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="input-field"
              required
              aria-label="Seleccionar modelo"
            >
              <option value="">— Seleccionar modelo —</option>
              {selectedProvider.models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
              <option value="__custom">Otro (escribir manualmente)</option>
            </select>
          </label>

          {/* Custom model free text */}
          {model === "__custom" && (
            <label className="block">
              <span className="text-xs font-medium text-muted-300 mb-1.5 block">
                Nombre del modelo <span className="text-danger-400">*</span>
              </span>
              <input
                type="text"
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                className="input-field"
                placeholder="nombre-del-modelo"
                required
                aria-label="Nombre personalizado del modelo"
              />
            </label>
          )}

          {/* Advanced section (collapsible) */}
          <div className="border border-white/5 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between px-4 py-3 text-xs font-medium text-muted-300 hover:text-white hover:bg-surface-400/20 transition-colors"
              aria-expanded={showAdvanced}
              aria-controls="ai-advanced-config"
              aria-label="Configuración avanzada"
            >
              <span>Configuración avanzada</span>
              <span className="text-muted-500">{showAdvanced ? "▲" : "▼"}</span>
            </button>

            {showAdvanced && (
              <div
                id="ai-advanced-config"
                className="px-4 pb-4 pt-2 space-y-4 border-t border-white/5"
              >
                {/* Temperature */}
                <label className="block">
                  <span className="text-xs font-medium text-muted-300 mb-1.5 block">
                    Temperature ({temperature.toFixed(1)})
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full accent-accent"
                    aria-label="Temperature del modelo"
                  />
                  <div className="flex justify-between text-[10px] text-muted-500 mt-1">
                    <span>0.0 (determinista)</span>
                    <span>2.0 (creativo)</span>
                  </div>
                </label>

                {/* Max tokens */}
                <label className="block">
                  <span className="text-xs font-medium text-muted-300 mb-1.5 block">
                    Tokens máximos
                  </span>
                  <input
                    type="number"
                    min="1"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value) || 1)}
                    className="input-field"
                    aria-label="Tokens máximos"
                  />
                </label>

                {/* Base URL override (for providers that support it) */}
                {selectedProvider.supportsCustomBaseUrl && selectedProvider.authType !== "none" && (
                  <label className="block">
                    <span className="text-xs font-medium text-muted-300 mb-1.5 block">
                      URL Base personalizada
                    </span>
                    <input
                      type="text"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      className="input-field"
                      placeholder={selectedProvider.defaultBaseUrl}
                      aria-label="URL base personalizada"
                    />
                    <p className="text-[10px] text-muted-500 mt-1">
                      Dejar vacío para usar la URL por defecto del proveedor.
                    </p>
                  </label>
                )}
              </div>
            )}
          </div>

          {/* Test result */}
          {testResult && (
            <div
              role="status"
              aria-live="polite"
              className={`rounded-xl border px-4 py-3 text-sm flex items-center gap-2 ${
                testResult.ok
                  ? "border-success/20 bg-success/10 text-success-300"
                  : "border-danger/20 bg-danger/10 text-danger-400"
              }`}
            >
              {testResult.ok ? (
                <>
                  <span>✓</span>
                  <span>
                    Conexión exitosa{testResult.model ? ` — modelo: ${testResult.model}` : ""}
                  </span>
                </>
              ) : (
                <>
                  <span>✗</span>
                  <span>
                    {testResult.errorKind === "timeout"
                      ? "Error: tiempo de espera agotado (15s)"
                      : testResult.errorKind === "auth_error"
                        ? "Error: credenciales inválidas"
                        : testResult.errorKind === "network_error"
                          ? "Error: no se pudo conectar al proveedor"
                          : testResult.message || "Error del proveedor"}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="btn-secondary"
                disabled={saving || testing}
                aria-label="Cancelar configuración"
              >
                Cancelar
              </button>
            )}
            <button
              type="button"
              onClick={handleTest}
              disabled={
                testing || !providerId || !model || (model === "__custom" && !customModel.trim())
              }
              className="btn-secondary flex items-center gap-1.5"
              aria-label="Probar conexión al proveedor"
            >
              {testing ? "Probando…" : "Probar conexión"}
            </button>
            <button
              type="submit"
              disabled={
                saving || !providerId || !model || (model === "__custom" && !customModel.trim())
              }
              className="btn-primary"
              aria-label="Guardar configuración del proveedor"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </>
      )}
    </form>
  );
}
