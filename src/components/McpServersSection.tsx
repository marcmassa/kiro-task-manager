import { useState } from "react";
import { PencilIcon, TrashIcon } from "../Icons";
import type { McpServer, McpServerInput, McpTestResult, McpTransport } from "../types";
import { useT } from "../i18n/useT";

interface McpServersSectionProps {
  servers: McpServer[];
  onEdit: (server: McpServer) => void;
  onToggle: (id: number) => void;
  onTest: (id: number) => void;
  onDelete: (server: McpServer) => void;
  testResults: Record<number, McpTestResult | "loading">;
  error: string | null;
}

/** Power icon — toggle enable/disable. */
function PowerIcon({ className = "", size = 20 }: { className?: string; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      fill="currentColor"
      viewBox="0 0 256 256"
      className={className}
    >
      <path d="M128,24a8,8,0,0,0-8,8V128a8,8,0,0,0,16,0V32A8,8,0,0,0,128,24Zm64.37,35.19a8,8,0,0,0-10.13,12.37A80,80,0,1,1,73.76,71.56a8,8,0,1,0-10.13-12.37,96,96,0,1,0,128.74,0Z" />
    </svg>
  );
}

/** Lightning/play icon — test connection. */
function LightningIcon({ className = "", size = 20 }: { className?: string; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      fill="currentColor"
      viewBox="0 0 256 256"
      className={className}
    >
      <path d="M215.79,118.17a8,8,0,0,0-5-5.66L153.18,90.9l14.66-73.33a8,8,0,0,0-13.69-7l-112,120a8,8,0,0,0,3,12.95l57.63,21.61L88.16,238.43a8,8,0,0,0,13.69,7l112-120A8,8,0,0,0,215.79,118.17ZM109.37,214l10.47-52.38a8,8,0,0,0-5-9.06L62,132.71l84.62-90.66L136.16,94.38a8,8,0,0,0,5,9.06l52.8,19.8Z" />
    </svg>
  );
}

/** Server icon for empty state. */
function ServerIcon({ className = "", size = 48 }: { className?: string; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      fill="currentColor"
      viewBox="0 0 256 256"
      className={className}
    >
      <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216ZM172,128a12,12,0,1,1-12-12A12,12,0,0,1,172,128Zm-44,0a12,12,0,1,1-12-12A12,12,0,0,1,128,128Zm-44,0a12,12,0,1,1-12-12A12,12,0,0,1,84,128Z" />
    </svg>
  );
}

/** Spinner for loading states. */
function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      fill="none"
      viewBox="0 0 24 24"
      className="animate-spin"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" opacity="0.75" />
    </svg>
  );
}

/**
 * Sección de lista de servidores MCP para la página de Configuración.
 * Muestra los servidores registrados con acciones de editar, toggle,
 * probar y eliminar. Incluye estados vacío y de error.
 */
export function McpServersSection({
  servers,
  onEdit,
  onToggle,
  onTest,
  onDelete,
  testResults,
  error,
}: McpServersSectionProps) {
  const t = useT();
  return (
    <section aria-label="Lista de servidores MCP">
      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger-400 flex items-center gap-2"
        >
          <span className="shrink-0">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* Empty state */}
      {servers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ServerIcon className="text-muted-600 mb-4" size={48} />
          <p className="text-sm font-medium text-muted-400">{t("mcp.noServers")}</p>
          <p className="text-xs text-muted-500 mt-1">{t("mcp.addHint")}</p>
        </div>
      )}

      {/* Server list */}
      {servers.length > 0 && (
        <ul className="space-y-3" role="list">
          {servers.map((server) => {
            const result = testResults[server.id];
            const isLoading = result === "loading";
            const testResult = result && result !== "loading" ? (result as McpTestResult) : null;

            return (
              <li
                key={server.id}
                className="group rounded-xl border border-white/5 bg-surface-200 p-4 transition-all duration-200 hover:border-white/10"
              >
                <div className="flex items-center justify-between gap-4">
                  {/* Left: name + badges */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate">{server.name}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {/* Transport badge */}
                        <span className="inline-flex items-center rounded-full bg-accent/10 border border-accent/20 px-2 py-0.5 text-[10px] font-medium text-accent-300 uppercase tracking-wide">
                          {server.transport}
                        </span>

                        {/* Enabled/Disabled badge */}
                        {server.enabled ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 border border-success/20 px-2 py-0.5 text-[10px] font-medium text-success-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-success" />
                            Habilitado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] font-medium text-muted-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-muted-500" />
                            Deshabilitado
                          </span>
                        )}

                        {/* Tool count from test result */}
                        {testResult && testResult.ok && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 border border-success/20 px-2 py-0.5 text-[10px] font-medium text-success-300">
                            ✓ {testResult.toolCount} herramientas
                          </span>
                        )}
                      </div>

                      {/* Error from test */}
                      {testResult && !testResult.ok && (
                        <p className="mt-1.5 text-xs text-danger-400">
                          {testResult.errorKind === "timeout"
                            ? "Error: tiempo de espera agotado"
                            : testResult.errorKind === "spawn_error"
                              ? "Error: no se pudo iniciar el proceso"
                              : testResult.message || "Error de protocolo"}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: action buttons */}
                  <div className="flex items-center gap-1 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={() => onEdit(server)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-400 hover:text-white hover:bg-white/10 transition-colors"
                      aria-label={`Editar servidor ${server.name}`}
                    >
                      <PencilIcon size={16} />
                    </button>

                    <button
                      onClick={() => onToggle(server.id)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                        server.enabled
                          ? "text-success-300 hover:text-success hover:bg-success/10"
                          : "text-muted-400 hover:text-white hover:bg-white/10"
                      }`}
                      aria-label={
                        server.enabled
                          ? `Deshabilitar servidor ${server.name}`
                          : `Habilitar servidor ${server.name}`
                      }
                    >
                      <PowerIcon size={16} />
                    </button>

                    <button
                      onClick={() => onTest(server.id)}
                      disabled={isLoading}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-accent-300 hover:text-accent hover:bg-accent/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label={`Probar servidor ${server.name}`}
                    >
                      {isLoading ? <Spinner size={16} /> : <LightningIcon size={16} />}
                    </button>

                    <button
                      onClick={() => onDelete(server)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-400 hover:text-danger-400 hover:bg-danger/10 transition-colors"
                      aria-label={`Eliminar servidor ${server.name}`}
                    >
                      <TrashIcon size={16} />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ── McpServerForm ─────────────────────────────────────────────────────────

interface McpServerFormProps {
  mode: "create" | "edit";
  initialData?: McpServer | null;
  onSubmit: (data: McpServerInput) => Promise<void>;
  onCancel: () => void;
  error: string | null;
  submitting: boolean;
}

/**
 * Formulario de alta/edición de un servidor MCP.
 * - env values usan type=password y nunca se precargan (R19).
 * - Errores del backend se muestran en español (R20).
 */
export function McpServerForm({
  mode,
  initialData,
  onSubmit,
  onCancel,
  error,
  submitting,
}: McpServerFormProps) {
  const [name, setName] = useState(mode === "edit" && initialData ? initialData.name : "");
  const [transport, setTransport] = useState<McpTransport>(
    mode === "edit" && initialData ? initialData.transport : "stdio",
  );
  const [command, setCommand] = useState(
    mode === "edit" && initialData && initialData.command ? initialData.command : "",
  );
  const [argsText, setArgsText] = useState(
    mode === "edit" && initialData ? initialData.args.join("\n") : "",
  );
  const [url, setUrl] = useState(
    mode === "edit" && initialData && initialData.url ? initialData.url : "",
  );
  const [envRows, setEnvRows] = useState<{ key: string; value: string }[]>([]);
  const [autoApproveText, setAutoApproveText] = useState(
    mode === "edit" && initialData ? initialData.autoApprove.join("\n") : "",
  );

  function addEnvRow() {
    setEnvRows([...envRows, { key: "", value: "" }]);
  }

  function removeEnvRow(index: number) {
    setEnvRows(envRows.filter((_, i) => i !== index));
  }

  function updateEnvRow(index: number, field: "key" | "value", val: string) {
    const updated = [...envRows];
    updated[index] = { ...updated[index], [field]: val };
    setEnvRows(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const args = argsText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const autoApprove = autoApproveText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    // Build env only from non-empty rows
    const env: Record<string, string> = {};
    for (const row of envRows) {
      const k = row.key.trim();
      if (k && row.value) {
        env[k] = row.value;
      }
    }

    const data: McpServerInput = {
      name: name.trim(),
      transport,
      ...(transport === "stdio" ? { command: command.trim(), args } : { url: url.trim() }),
      ...(Object.keys(env).length > 0 ? { env } : {}),
      autoApprove: autoApprove.length > 0 ? autoApprove : undefined,
    };

    await onSubmit(data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" aria-label="Formulario de servidor MCP">
      {/* Backend error */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger-400 flex items-center gap-2"
        >
          <span className="shrink-0">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* Name */}
      <label className="block">
        <span className="text-xs font-medium text-muted-300 mb-1.5 block">
          Nombre <span className="text-danger-400">*</span>
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input-field"
          placeholder="Ej: filesystem, github, aws-docs"
          required
          aria-label="Nombre del servidor"
        />
      </label>

      {/* Transport */}
      <label className="block">
        <span className="text-xs font-medium text-muted-300 mb-1.5 block">
          Transporte <span className="text-danger-400">*</span>
        </span>
        <select
          value={transport}
          onChange={(e) => setTransport(e.target.value as McpTransport)}
          className="input-field"
          aria-label="Tipo de transporte"
        >
          <option value="stdio">stdio</option>
          <option value="http">http</option>
        </select>
      </label>

      {/* Command (stdio only) */}
      {transport === "stdio" && (
        <label className="block">
          <span className="text-xs font-medium text-muted-300 mb-1.5 block">
            Comando <span className="text-danger-400">*</span>
          </span>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            className="input-field"
            placeholder="Ej: npx, node, python"
            required={transport === "stdio"}
            aria-label="Comando del servidor"
          />
        </label>
      )}

      {/* Args (stdio only) */}
      {transport === "stdio" && (
        <label className="block">
          <span className="text-xs font-medium text-muted-300 mb-1.5 block">
            Argumentos (uno por línea)
          </span>
          <textarea
            value={argsText}
            onChange={(e) => setArgsText(e.target.value)}
            className="input-field min-h-[80px] resize-y"
            placeholder={"Ej:\n-y\n@modelcontextprotocol/server-filesystem\n/path/to/dir"}
            rows={3}
            aria-label="Argumentos del comando"
          />
        </label>
      )}

      {/* URL (http only) */}
      {transport === "http" && (
        <label className="block">
          <span className="text-xs font-medium text-muted-300 mb-1.5 block">
            URL <span className="text-danger-400">*</span>
          </span>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="input-field"
            placeholder="Ej: http://localhost:8080/mcp"
            required={transport === "http"}
            aria-label="URL del servidor"
          />
        </label>
      )}

      {/* Env (key/value pairs) */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-medium text-muted-300 mb-1.5 block">
          Variables de entorno
        </legend>

        {mode === "edit" && (
          <p className="text-[11px] text-muted-500 -mt-1">
            Deja vacío para mantener los secretos actuales
          </p>
        )}

        {envRows.map((row, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="text"
              value={row.key}
              onChange={(e) => updateEnvRow(idx, "key", e.target.value)}
              className="input-field flex-1"
              placeholder="Clave"
              aria-label={`Variable de entorno clave ${idx + 1}`}
            />
            <input
              type="password"
              value={row.value}
              onChange={(e) => updateEnvRow(idx, "value", e.target.value)}
              className="input-field flex-1"
              placeholder="Valor (secreto)"
              aria-label={`Variable de entorno valor ${idx + 1}`}
            />
            <button
              type="button"
              onClick={() => removeEnvRow(idx)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-400 hover:text-danger-400 hover:bg-danger/10 transition-colors shrink-0"
              aria-label={`Eliminar variable ${idx + 1}`}
            >
              <TrashIcon size={14} />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addEnvRow}
          className="text-xs font-medium text-accent-300 hover:text-accent transition-colors"
          aria-label="Añadir variable de entorno"
        >
          + Añadir variable
        </button>
      </fieldset>

      {/* Auto-approve */}
      <label className="block">
        <span className="text-xs font-medium text-muted-300 mb-1.5 block">
          Auto-approve (uno por línea)
        </span>
        <textarea
          value={autoApproveText}
          onChange={(e) => setAutoApproveText(e.target.value)}
          className="input-field min-h-[80px] resize-y"
          placeholder={"Ej:\nread_file\nlist_directory\ngrep_search"}
          rows={3}
          aria-label="Tools con auto-aprobación"
        />
      </label>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary"
          disabled={submitting}
          aria-label="Cancelar"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="btn-primary"
          disabled={submitting}
          aria-label={mode === "create" ? "Crear servidor" : "Guardar cambios"}
        >
          {submitting ? "Guardando…" : mode === "create" ? "Crear servidor" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
