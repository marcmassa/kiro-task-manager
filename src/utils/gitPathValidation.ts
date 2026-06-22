import { existsSync, statSync, accessSync, readFileSync, constants } from "node:fs";
import { join, resolve } from "node:path";
import type { FsAdapter, RepoPathValidationResult, FilePathValidationResult } from "./gitTypes";

/**
 * Adaptador de filesystem por defecto — usa el filesystem real.
 */
const defaultFsAdapter: FsAdapter = {
  exists(path: string): boolean {
    try {
      return existsSync(path);
    } catch {
      return false;
    }
  },
  isDirectory(path: string): boolean {
    try {
      return statSync(path).isDirectory();
    } catch {
      return false;
    }
  },
  hasReadWritePermission(path: string): boolean {
    try {
      accessSync(path, constants.R_OK | constants.W_OK);
      return true;
    } catch {
      return false;
    }
  },
  readGitHead(path: string): string | null {
    try {
      const headPath = join(path, ".git", "HEAD");
      return readFileSync(headPath, "utf-8").trim();
    } catch {
      return null;
    }
  },
};

/**
 * Normaliza una ruta de repositorio:
 * - Resuelve ~ al inicio a la home del usuario
 * - Elimina trailing slashes (excepto root /)
 * - Trim de whitespace
 */
export function normalizeRepoPath(rawPath: string): string {
  let path = rawPath.trim();

  // Resolve ~ to home directory
  if (path === "~" || path.startsWith("~/")) {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? "/";
    path = path === "~" ? home : join(home, path.slice(2));
  }

  // Remove trailing slashes (but keep root "/")
  while (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }

  return path;
}

/**
 * Normaliza una ruta de fichero relativa:
 * - Elimina "./" al inicio
 * - Colapsa barras duplicadas "//" → "/"
 * - Elimina trailing slashes
 * - Trim de whitespace
 */
export function normalizeFilePath(rawPath: string): string {
  let path = rawPath.trim();

  // Remove leading "./"
  while (path.startsWith("./")) {
    path = path.slice(2);
  }

  // Collapse duplicate slashes
  path = path.replace(/\/\/+/g, "/");

  // Remove trailing slashes
  while (path.length > 0 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }

  return path;
}

/**
 * Valida que un string sea una ruta absoluta a un repo Git válido.
 * Acepta un FsAdapter inyectable para testing.
 */
export function validateRepoPath(rawPath: string, fs?: FsAdapter): RepoPathValidationResult {
  const adapter = fs ?? defaultFsAdapter;

  // 1. EMPTY_PATH
  if (rawPath.trim() === "") {
    return {
      ok: false,
      code: "EMPTY_PATH",
      message: "La ruta del repositorio no puede estar vacía",
    };
  }

  // 2. Normalize
  const path = normalizeRepoPath(rawPath);

  // 3. NOT_ABSOLUTE
  if (!path.startsWith("/")) {
    return {
      ok: false,
      code: "NOT_ABSOLUTE",
      message: "La ruta debe ser absoluta (comenzar con /)",
    };
  }

  // 4. DIR_NOT_FOUND
  if (!adapter.exists(path) || !adapter.isDirectory(path)) {
    return {
      ok: false,
      code: "DIR_NOT_FOUND",
      message: `El directorio no existe: ${path}`,
    };
  }

  // 5. NOT_GIT_REPO
  const headContent = adapter.readGitHead(path);
  if (headContent === null) {
    return {
      ok: false,
      code: "NOT_GIT_REPO",
      message: "El directorio no es un repositorio Git (no contiene .git/)",
    };
  }

  // 6. NO_PERMISSIONS
  if (!adapter.hasReadWritePermission(path)) {
    return {
      ok: false,
      code: "NO_PERMISSIONS",
      message: `Sin permisos de lectura/escritura en: ${path}`,
    };
  }

  // 7. All pass — extract branch from HEAD
  let currentBranch = "HEAD";
  const refMatch = headContent.match(/^ref: refs\/heads\/(.+)$/);
  if (refMatch) {
    currentBranch = refMatch[1];
  }

  return {
    ok: true,
    repoPath: path,
    currentBranch,
  };
}

/**
 * Valida una ruta de fichero relativa (path traversal prevention).
 * Función COMPLETAMENTE PURA — sin IO.
 */
export function validateFilePath(rawPath: string): FilePathValidationResult {
  // 1. EMPTY_PATH
  if (rawPath.trim() === "") {
    return {
      ok: false,
      code: "EMPTY_PATH",
      message: "La ruta del fichero no puede estar vacía",
    };
  }

  // 2. NULL_CHAR
  if (rawPath.includes("\0")) {
    return {
      ok: false,
      code: "NULL_CHAR",
      message: "La ruta contiene caracteres nulos no permitidos",
    };
  }

  // 3. ABSOLUTE_PATH
  if (rawPath.trimStart().startsWith("/")) {
    return {
      ok: false,
      code: "ABSOLUTE_PATH",
      message: "La ruta debe ser relativa (no puede comenzar con /)",
    };
  }

  // 4. Normalize
  const normalizedPath = normalizeFilePath(rawPath);

  // 5. PATH_TRAVERSAL — check if any segment is ".." or if resolved path escapes root
  const segments = normalizedPath.split("/");
  if (segments.some((seg) => seg === "..")) {
    return {
      ok: false,
      code: "PATH_TRAVERSAL",
      message: "La ruta contiene secuencias no permitidas (..)",
    };
  }

  // Additional check using path.resolve to catch edge cases
  const resolved = resolve("/", normalizedPath);
  if (resolved.includes("..")) {
    return {
      ok: false,
      code: "PATH_TRAVERSAL",
      message: "La ruta contiene secuencias no permitidas (..)",
    };
  }

  // 6. All pass
  return {
    ok: true,
    normalizedPath,
  };
}

/**
 * Resuelve una ruta relativa contra un working directory y verifica que
 * el resultado está dentro del sandbox.
 */
export function resolveInSandbox(workingDir: string, relativePath: string): string | null {
  const validation = validateFilePath(relativePath);
  if (!validation.ok) return null;

  const resolved = resolve(workingDir, validation.normalizedPath);
  // Verify it's still within workingDir
  if (!resolved.startsWith(workingDir + "/") && resolved !== workingDir) {
    return null;
  }
  return resolved;
}
