/**
 * Git tool handlers — operaciones de filesystem para el agente.
 *
 * Cada handler opera exclusivamente dentro del Working_Directory configurado
 * (sandbox enforcement via resolveInSandbox). Los handlers async usan
 * Bun.file() / Bun.write() para lectura/escritura.
 *
 * Cubre: R8.1, R8.2, R8.3, R8.4, R8.5, R13.6
 */
import type { Database } from "bun:sqlite";
import { existsSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { resolveInSandbox, validateFilePath } from "./gitPathValidation";

/** Mismo patrón ok/error que src/mcp/handlers.ts */
export type ToolHandlerResult = { ok: true; data: unknown } | { ok: false; error: string };

/** Tamaño máximo de fichero para lectura: 1 MB. */
const MAX_FILE_SIZE = 1024 * 1024;

/** Directorios excluidos del listing por defecto. */
const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "__pycache__",
  ".next",
  ".cache",
]);

/**
 * Lee un fichero del working directory.
 * Valida ruta, sandbox, y tamaño máximo 1 MB.
 */
export async function handleReadFile(
  _db: Database,
  workingDir: string,
  args: { path: string },
): Promise<ToolHandlerResult> {
  const resolved = resolveInSandbox(workingDir, args.path);
  if (!resolved) {
    return { ok: false, error: `Ruta inválida o fuera del directorio de trabajo: ${args.path}` };
  }

  if (!existsSync(resolved)) {
    return { ok: false, error: `Fichero no encontrado: ${args.path}` };
  }

  const stat = statSync(resolved);
  if (stat.isDirectory()) {
    return { ok: false, error: `La ruta es un directorio, no un fichero: ${args.path}` };
  }
  if (stat.size > MAX_FILE_SIZE) {
    return {
      ok: false,
      error: `Fichero demasiado grande (${stat.size} bytes, máximo 1 MB): ${args.path}`,
    };
  }

  const content = await Bun.file(resolved).text();
  return { ok: true, data: { content, size: stat.size } };
}

/**
 * Escribe contenido a un fichero del working directory.
 * Determina si es "created" o "modified" y registra File_Change en DB.
 */
export async function handleWriteFile(
  db: Database,
  workingDir: string,
  taskId: number,
  executionId: number | null,
  args: { path: string; content: string },
): Promise<ToolHandlerResult> {
  const resolved = resolveInSandbox(workingDir, args.path);
  if (!resolved) {
    return { ok: false, error: `Ruta inválida o fuera del directorio de trabajo: ${args.path}` };
  }

  // Determinar si el fichero ya existe (created vs modified)
  const existed = existsSync(resolved);
  const changeType = existed ? "modified" : "created";

  // Asegurar que el directorio padre existe
  const dir = dirname(resolved);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Escribir el fichero
  await Bun.write(resolved, args.content);

  // Normalizar la ruta para almacenar en DB
  const validation = validateFilePath(args.path);
  const normalizedPath = validation.ok ? validation.normalizedPath : args.path;

  // Registrar File_Change en DB
  db.prepare(
    "INSERT INTO task_file_changes (task_id, file_path, change_type, agent_execution_id) VALUES (?, ?, ?, ?)",
  ).run(taskId, normalizedPath, changeType, executionId);

  return { ok: true, data: { path: normalizedPath, changeType } };
}

/**
 * Lista el contenido de un directorio del working directory.
 * Excluye directorios ignorados por defecto (node_modules, .git, etc.).
 */
export function handleListDirectory(
  _db: Database,
  workingDir: string,
  args: { path?: string },
): ToolHandlerResult {
  let targetDir: string;

  if (args.path) {
    const resolved = resolveInSandbox(workingDir, args.path);
    if (!resolved) {
      return { ok: false, error: `Ruta inválida o fuera del directorio de trabajo: ${args.path}` };
    }
    targetDir = resolved;
  } else {
    targetDir = workingDir;
  }

  if (!existsSync(targetDir)) {
    return { ok: false, error: `Directorio no encontrado: ${args.path ?? "."}` };
  }

  const stat = statSync(targetDir);
  if (!stat.isDirectory()) {
    return { ok: false, error: `La ruta no es un directorio: ${args.path ?? "."}` };
  }

  const entries = readdirSync(targetDir, { withFileTypes: true })
    .filter((entry) => !IGNORED_DIRS.has(entry.name))
    .map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? ("directory" as const) : ("file" as const),
      size: entry.isDirectory() ? 0 : statSync(join(targetDir, entry.name)).size,
    }))
    .sort((a, b) => {
      // Directorios primero, luego alfabético
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  return { ok: true, data: { entries } };
}

/**
 * Comprueba si un fichero existe en el working directory.
 */
export function handleFileExists(
  _db: Database,
  workingDir: string,
  args: { path: string },
): ToolHandlerResult {
  const resolved = resolveInSandbox(workingDir, args.path);
  if (!resolved) {
    return { ok: false, error: `Ruta inválida o fuera del directorio de trabajo: ${args.path}` };
  }

  const exists = existsSync(resolved);
  return { ok: true, data: { exists, path: args.path } };
}
