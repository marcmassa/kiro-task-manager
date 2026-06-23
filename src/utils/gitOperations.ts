/**
 * Git operations via Bun.spawn — human-only (NOT agent tools).
 *
 * All functions execute the system `git` binary with cwd = workingDir.
 * Token is NEVER logged or exposed in responses.
 *
 * Requirements: R16.7, R17.1, R18.1, R18.2, R18.3, R19.1, R19.2, R20.1, R20.2
 */

import { decryptApiKey } from "./crypto";
import type { GitStatusFile, GitBranchInfo } from "./gitTypes";

// ── Internal helper ─────────────────────────────────────────────────────────

async function runGit(
  workingDir: string,
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["git", ...args], {
    cwd: workingDir,
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Ejecuta `git status --porcelain` y parsea la salida.
 */
export async function gitStatus(workingDir: string): Promise<GitStatusFile[]> {
  const { stdout, exitCode, stderr } = await runGit(workingDir, ["status", "--porcelain"]);
  if (exitCode !== 0) {
    throw new Error(stderr || "Error al obtener el estado de Git");
  }
  if (!stdout) return [];
  return stdout.split("\n").map((line) => {
    const indexStatus = line[0];
    const workTreeStatus = line[1];
    const filePath = line.slice(3);

    // A file is staged if it has a non-space, non-? status in the index column
    const staged = indexStatus !== " " && indexStatus !== "?";
    // Determine the status char: prefer worktree status for unstaged, index for staged
    const statusChar = staged ? indexStatus : workTreeStatus;

    let status: GitStatusFile["status"];
    switch (statusChar) {
      case "M":
        status = "modified";
        break;
      case "A":
        status = "added";
        break;
      case "D":
        status = "deleted";
        break;
      case "R":
        status = "renamed";
        break;
      case "?":
        status = "untracked";
        break;
      default:
        status = "modified";
    }
    return { path: filePath, status, staged };
  });
}

/**
 * Ejecuta `git add` para los ficheros indicados.
 */
export async function gitStage(workingDir: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { exitCode, stderr } = await runGit(workingDir, ["add", ...paths]);
  if (exitCode !== 0) {
    throw new Error(stderr || "Error al hacer stage");
  }
}

/**
 * Ejecuta `git restore --staged` para los ficheros indicados.
 */
export async function gitUnstage(workingDir: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { exitCode, stderr } = await runGit(workingDir, ["restore", "--staged", ...paths]);
  if (exitCode !== 0) {
    throw new Error(stderr || "Error al hacer unstage");
  }
}

/**
 * Ejecuta `git commit -m "<message>"` y retorna el hash del commit.
 */
export async function gitCommit(workingDir: string, message: string): Promise<string> {
  const { stdout, exitCode, stderr } = await runGit(workingDir, ["commit", "-m", message]);
  if (exitCode !== 0) {
    throw new Error(stderr || "Error al hacer commit");
  }
  // Extract commit hash from output like: "[branch abc1234] message"
  const match = stdout.match(/\[[\w/.-]+\s+([a-f0-9]+)\]/);
  return match ? match[1] : "unknown";
}

/**
 * Ejecuta `git push` inyectando token en la URL remota.
 * El token NUNCA se loguea.
 */
export async function gitPush(workingDir: string, tokenEncrypted: string): Promise<void> {
  const url = await getRemoteUrlWithToken(workingDir, tokenEncrypted);
  const { exitCode, stderr } = await runGit(workingDir, ["push", url]);
  if (exitCode !== 0) {
    // Sanitize error to not expose token
    const safeError = sanitizeGitError(stderr);
    throw new Error(safeError || "Error al hacer push");
  }
}

/**
 * Ejecuta `git pull` inyectando token en la URL remota.
 * El token NUNCA se loguea.
 */
export async function gitPull(workingDir: string, tokenEncrypted: string): Promise<void> {
  const url = await getRemoteUrlWithToken(workingDir, tokenEncrypted);
  const { exitCode, stderr } = await runGit(workingDir, ["pull", url]);
  if (exitCode !== 0) {
    const safeError = sanitizeGitError(stderr);
    throw new Error(safeError || "Error al hacer pull");
  }
}

/**
 * Ejecuta `git branch` y parsea la lista de ramas.
 */
export async function gitBranches(workingDir: string): Promise<GitBranchInfo> {
  const { stdout, exitCode, stderr } = await runGit(workingDir, ["branch"]);
  if (exitCode !== 0) {
    throw new Error(stderr || "Error al listar ramas");
  }
  if (!stdout) {
    return { branches: [], current: "" };
  }
  const lines = stdout.split("\n");
  let current = "";
  const branches: string[] = [];
  for (const line of lines) {
    const name = line.replace(/^\*?\s+/, "").trim();
    if (!name) continue;
    branches.push(name);
    if (line.startsWith("*")) {
      current = name;
    }
  }
  return { branches, current };
}

/**
 * Ejecuta `git checkout [-b] <branch>`.
 */
export async function gitCheckout(
  workingDir: string,
  branch: string,
  create?: boolean,
): Promise<void> {
  const args = create ? ["checkout", "-b", branch] : ["checkout", branch];
  const { exitCode, stderr } = await runGit(workingDir, args);
  if (exitCode !== 0) {
    throw new Error(stderr || `Error al cambiar a la rama ${branch}`);
  }
}

// ── Private helpers ─────────────────────────────────────────────────────────

/**
 * Lee la remote URL y la reescribe con token inline.
 * https://github.com/user/repo.git → https://<token>@github.com/user/repo.git
 */
async function getRemoteUrlWithToken(workingDir: string, tokenEncrypted: string): Promise<string> {
  const token = await decryptApiKey(tokenEncrypted);
  const { stdout, exitCode } = await runGit(workingDir, ["remote", "get-url", "origin"]);
  if (exitCode !== 0 || !stdout) {
    throw new Error("No se pudo obtener la URL del remoto 'origin'");
  }
  try {
    const url = new URL(stdout);
    url.username = token;
    url.password = "";
    return url.toString();
  } catch {
    // Fallback: insert token after protocol
    // https://github.com/user/repo.git → https://token@github.com/user/repo.git
    return stdout.replace("https://", `https://${token}@`);
  }
}

/**
 * Elimina tokens/credenciales de mensajes de error de Git.
 */
function sanitizeGitError(error: string): string {
  // Remove any URL with embedded credentials
  return error.replace(/https:\/\/[^@]+@/g, "https://***@");
}
