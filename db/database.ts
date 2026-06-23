import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

// FEAT-011 / R24 — Server mode persistence.
// The DB lives under DATA_DIR so it can be mounted on a persistent volume in
// production (Docker). Defaults to "." (the package root) for local/workshop
// use, which keeps the historical `task-manager/tasks.db` location intact.
const DATA_DIR = process.env.DATA_DIR || ".";
mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, "tasks.db");

const db = new Database(DB_PATH, { create: true });

// Enable WAL mode for better performance
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#6366f1'
  );

  CREATE TABLE IF NOT EXISTS priorities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    level INTEGER NOT NULL,
    color TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'done')),
    priority_id INTEGER NOT NULL DEFAULT 2,
    category_id INTEGER NOT NULL DEFAULT 1,
    due_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (priority_id) REFERENCES priorities(id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    author TEXT NOT NULL DEFAULT 'Usuario',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );

  -- FEAT-005: workspace + notifications singleton (one row, id = 1)
  CREATE TABLE IF NOT EXISTS workspace_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    workspace_name TEXT NOT NULL DEFAULT 'Mi Workspace',
    default_language TEXT NOT NULL DEFAULT 'es-ES',
    default_timezone TEXT NOT NULL DEFAULT 'Europe/Madrid',
    notify_on_due INTEGER NOT NULL DEFAULT 1,
    notify_on_done INTEGER NOT NULL DEFAULT 0,
    notify_daily_digest INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- FEAT-005: external service integrations (Linear in v1)
  CREATE TABLE IF NOT EXISTS integration_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL UNIQUE,
    api_key_encrypted TEXT NOT NULL,
    account_id TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_email TEXT NOT NULL,
    last_sync_at TEXT,
    last_sync_summary TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- FEAT-006: agentes disponibles (extensible sin cambios de código)
  CREATE TABLE IF NOT EXISTS agents (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    kind       TEXT NOT NULL DEFAULT 'mcp',
    enabled    INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- FEAT-006: ejecución de agente, paralela al status Kanban.
  -- Una ejecución activa por tarea (UNIQUE task_id).
  CREATE TABLE IF NOT EXISTS agent_executions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id         INTEGER NOT NULL UNIQUE,
    agent_id        TEXT NOT NULL,
    state           TEXT NOT NULL DEFAULT 'assigned'
                    CHECK (state IN ('assigned','agent_working','pending_review','changes_requested','done')),
    agent_summary   TEXT,
    review_feedback TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (task_id)  REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES agents(id)
  );

  -- FEAT-006: historial de transiciones (auditoría del gate humano).
  CREATE TABLE IF NOT EXISTS agent_execution_events (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_id INTEGER NOT NULL,
    from_state   TEXT NOT NULL,
    to_state     TEXT NOT NULL,
    actor        TEXT NOT NULL CHECK (actor IN ('human','agent')),
    note         TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (execution_id) REFERENCES agent_executions(id) ON DELETE CASCADE
  );

  -- FEAT-006: adjuntos de tarea (fichero en disco, metadata aquí).
  CREATE TABLE IF NOT EXISTS task_attachments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id     INTEGER NOT NULL,
    filename    TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    mime_type   TEXT NOT NULL,
    size_bytes  INTEGER NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );

  -- FEAT-007: registro de servidores MCP externos.
  CREATE TABLE IF NOT EXISTS mcp_servers (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL UNIQUE,
    transport     TEXT NOT NULL DEFAULT 'stdio'
                  CHECK (transport IN ('stdio','http')),
    command       TEXT,
    args          TEXT NOT NULL DEFAULT '[]',
    env_encrypted TEXT NOT NULL DEFAULT '',
    url           TEXT,
    enabled       INTEGER NOT NULL DEFAULT 1,
    auto_approve  TEXT NOT NULL DEFAULT '[]',
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- FEAT-009: configuración del proveedor de IA (singleton, máximo 1 fila).
  CREATE TABLE IF NOT EXISTS ai_provider_config (
    id                          INTEGER PRIMARY KEY CHECK (id = 1),
    provider_id                 TEXT NOT NULL,
    model                       TEXT NOT NULL,
    api_key_encrypted           TEXT NOT NULL DEFAULT '',
    secret_access_key_encrypted TEXT NOT NULL DEFAULT '',
    access_key_id               TEXT NOT NULL DEFAULT '',
    region                      TEXT NOT NULL DEFAULT '',
    base_url                    TEXT NOT NULL DEFAULT '',
    temperature                 REAL NOT NULL DEFAULT 0.7,
    max_tokens                  INTEGER NOT NULL DEFAULT 4096,
    created_at                  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at                  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- FEAT-010: configuración del motor de agente (singleton).
  CREATE TABLE IF NOT EXISTS agent_engine_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    auto_start INTEGER NOT NULL DEFAULT 0,
    poll_interval_ms INTEGER NOT NULL DEFAULT 30000,
    max_iterations INTEGER NOT NULL DEFAULT 50,
    max_retries INTEGER NOT NULL DEFAULT 3,
    tool_timeout_ms INTEGER NOT NULL DEFAULT 30000,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// FEAT-005: ensure the singleton workspace_settings row exists with defaults.
db.exec("INSERT OR IGNORE INTO workspace_settings (id) VALUES (1)");

// FEAT-006: seed the default Kiro agent (idempotent).
db.exec("INSERT OR IGNORE INTO agents (id, name, kind) VALUES ('kiro', 'Kiro', 'mcp')");

// FEAT-010: seed the singleton agent engine config row (idempotent).
db.exec("INSERT OR IGNORE INTO agent_engine_config (id) VALUES (1)");

// FEAT-013: add max_chat_turns_per_execution to agent_engine_config (idempotent).
try {
  db.exec(
    "ALTER TABLE agent_engine_config ADD COLUMN max_chat_turns_per_execution INTEGER NOT NULL DEFAULT 10",
  );
} catch {
  // Column already exists — ignore.
}

// Seed priorities
const priorityCount = db.query("SELECT COUNT(*) as count FROM priorities").get() as {
  count: number;
};
if (priorityCount.count === 0) {
  const insertPriority = db.prepare("INSERT INTO priorities (name, level, color) VALUES (?, ?, ?)");
  insertPriority.run("Baja", 1, "#037F0C");
  insertPriority.run("Media", 2, "#FF9900");
  insertPriority.run("Alta", 3, "#D91515");
  insertPriority.run("Urgente", 4, "#920B0B");
}

// Seed categories
const categoryCount = db.query("SELECT COUNT(*) as count FROM categories").get() as {
  count: number;
};
if (categoryCount.count === 0) {
  const insertCategory = db.prepare("INSERT INTO categories (name, color) VALUES (?, ?)");
  insertCategory.run("Desarrollo", "#0972D3");
  insertCategory.run("Diseño", "#FF9900");
  insertCategory.run("Marketing", "#037F0C");
  insertCategory.run("Investigación", "#6366f1");
  insertCategory.run("Personal", "#252F3E");
}

// FEAT-011: workspace-git — add repo columns to workspace_settings (idempotent)
try {
  db.exec("ALTER TABLE workspace_settings ADD COLUMN repo_path TEXT DEFAULT NULL");
} catch {}
try {
  db.exec("ALTER TABLE workspace_settings ADD COLUMN repo_remote_url TEXT DEFAULT NULL");
} catch {}
try {
  db.exec(
    "ALTER TABLE workspace_settings ADD COLUMN repo_default_branch TEXT NOT NULL DEFAULT 'main'",
  );
} catch {}
try {
  db.exec(
    "ALTER TABLE workspace_settings ADD COLUMN repo_status TEXT NOT NULL DEFAULT 'not_configured'",
  );
} catch {}
try {
  db.exec("ALTER TABLE workspace_settings ADD COLUMN repo_current_branch TEXT DEFAULT NULL");
} catch {}

// FEAT-011: workspace-git — git token column for push/pull authentication
try {
  db.exec("ALTER TABLE workspace_settings ADD COLUMN git_token_encrypted TEXT NOT NULL DEFAULT ''");
} catch {}

// FEAT-011: workspace-git — file references and changes tables
db.exec(`
  CREATE TABLE IF NOT EXISTS task_file_references (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    reference_type TEXT NOT NULL DEFAULT 'context'
      CHECK (reference_type IN ('context', 'output', 'modified')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS task_file_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    change_type TEXT NOT NULL CHECK (change_type IN ('created', 'modified', 'deleted')),
    agent_execution_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_execution_id) REFERENCES agent_executions(id) ON DELETE SET NULL
  );
`);

// FEAT-011: Multi-workspace support (R22) — workspaces table
db.exec(`
  CREATE TABLE IF NOT EXISTS workspaces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    repo_path TEXT DEFAULT NULL,
    repo_remote_url TEXT DEFAULT NULL,
    repo_default_branch TEXT NOT NULL DEFAULT 'main',
    repo_status TEXT NOT NULL DEFAULT 'not_configured'
      CHECK (repo_status IN ('connected', 'disconnected', 'error', 'not_configured', 'cloning')),
    repo_current_branch TEXT DEFAULT NULL,
    git_token_encrypted TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migrate singleton data from workspace_settings to workspaces table (if not already done)
const workspaceCount = (
  db.query("SELECT COUNT(*) as count FROM workspaces").get() as { count: number }
).count;
if (workspaceCount === 0) {
  const ws = db
    .query(
      "SELECT repo_path, repo_remote_url, repo_default_branch, repo_status, repo_current_branch, git_token_encrypted FROM workspace_settings WHERE id = 1",
    )
    .get() as any;
  if (ws && (ws.repo_path || ws.repo_remote_url)) {
    db.prepare(
      "INSERT INTO workspaces (id, name, slug, repo_path, repo_remote_url, repo_default_branch, repo_status, repo_current_branch, git_token_encrypted) VALUES (1, 'Default', 'default', ?, ?, ?, ?, ?, ?)",
    ).run(
      ws.repo_path ?? null,
      ws.repo_remote_url ?? null,
      ws.repo_default_branch ?? "main",
      ws.repo_status ?? "not_configured",
      ws.repo_current_branch ?? null,
      ws.git_token_encrypted ?? "",
    );
  } else {
    db.prepare("INSERT INTO workspaces (id, name, slug) VALUES (1, 'Default', 'default')").run();
  }
}

// Helper: returns the set of column names for a table using PRAGMA table_info.
function tableColumns(table: string): Set<string> {
  const cols = db.query(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return new Set(cols.map((c) => c.name));
}

// Helper: returns the CREATE TABLE sql for a table from sqlite_master.
function tableSchema(table: string): string {
  const row = db.query("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(table) as
    | { sql: string }
    | undefined;
  return row?.sql ?? "";
}

// FEAT-012: SDD lifecycle — add sdd_phase and phase_output columns to agent_executions (idempotent)
if (!tableColumns("agent_executions").has("sdd_phase")) {
  db.exec("ALTER TABLE agent_executions ADD COLUMN sdd_phase TEXT DEFAULT NULL");
}
if (!tableColumns("agent_executions").has("phase_output")) {
  db.exec("ALTER TABLE agent_executions ADD COLUMN phase_output TEXT DEFAULT NULL");
}

// Manual SDD: allow user to place a task in a SDD column without an agent execution
if (!tableColumns("tasks").has("sdd_phase")) {
  db.exec("ALTER TABLE tasks ADD COLUMN sdd_phase TEXT DEFAULT NULL");
}

// Workspace project type: drives which Kanban columns and stats are shown
if (!tableColumns("workspaces").has("project_type")) {
  db.exec("ALTER TABLE workspaces ADD COLUMN project_type TEXT NOT NULL DEFAULT 'normal'");
}
if (!tableColumns("workspaces").has("visible_columns")) {
  db.exec("ALTER TABLE workspaces ADD COLUMN visible_columns TEXT DEFAULT NULL");
}

// Add workspace_id to tasks (backward compatible, default 1)
if (!tableColumns("tasks").has("workspace_id")) {
  db.exec("ALTER TABLE tasks ADD COLUMN workspace_id INTEGER DEFAULT 1");
}

// Add workspace_id to categories, priorities, comments.
// Uses simple nullable DEFAULT 1 (no NOT NULL / REFERENCES) for maximum SQLite
// compatibility. Existing rows receive DEFAULT 1; new rows always pass workspace_id
// explicitly from the application layer.
if (!tableColumns("categories").has("workspace_id")) {
  db.exec("ALTER TABLE categories ADD COLUMN workspace_id INTEGER DEFAULT 1");
}
if (!tableColumns("priorities").has("workspace_id")) {
  db.exec("ALTER TABLE priorities ADD COLUMN workspace_id INTEGER DEFAULT 1");
}
if (!tableColumns("comments").has("workspace_id")) {
  db.exec("ALTER TABLE comments ADD COLUMN workspace_id INTEGER DEFAULT 1");
}

// Recreate categories with UNIQUE(name, workspace_id).
// Uses RENAME instead of DROP TABLE to avoid FK constraint failures:
//   1. legacy_alter_table=ON → RENAME does NOT update FK refs in tasks, so tasks still
//      references "categories" by name after the rename.
//   2. Create new "categories" with composite unique, copy data.
//   3. DROP _categories_old — safe because nothing has an FK pointing to "_categories_old".
{
  const schema = tableSchema("categories");
  const hasCols = tableColumns("categories").has("workspace_id");
  const hasComposite =
    schema.includes("workspace_id") && schema.includes("UNIQUE(name, workspace_id)");
  if (hasCols && !hasComposite) {
    try {
      db.exec("PRAGMA legacy_alter_table = ON");
      db.exec("PRAGMA foreign_keys = OFF");
      db.exec("DROP TABLE IF EXISTS _categories_old");
      db.exec("ALTER TABLE categories RENAME TO _categories_old");
      db.exec(
        "CREATE TABLE categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#6366f1', workspace_id INTEGER NOT NULL DEFAULT 1, UNIQUE(name, workspace_id))",
      );
      db.exec(
        "INSERT INTO categories (id, name, color, workspace_id) SELECT id, name, color, COALESCE(workspace_id, 1) FROM _categories_old",
      );
      db.exec("DROP TABLE _categories_old");
      console.log("[migration] categories: composite unique constraint applied");
    } catch (e) {
      console.error("[migration] categories composite unique failed:", e);
      // If categories was renamed but new table not yet created, restore it.
      try {
        const hasCat = db
          .query("SELECT name FROM sqlite_master WHERE type='table' AND name='categories'")
          .get();
        const hasOld = db
          .query("SELECT name FROM sqlite_master WHERE type='table' AND name='_categories_old'")
          .get();
        if (!hasCat && hasOld) {
          db.exec("ALTER TABLE _categories_old RENAME TO categories");
        }
      } catch {}
    } finally {
      db.exec("PRAGMA foreign_keys = ON");
      db.exec("PRAGMA legacy_alter_table = OFF");
    }
  }
}

// Recreate priorities with UNIQUE(name, workspace_id) — same RENAME strategy.
{
  const schema = tableSchema("priorities");
  const hasCols = tableColumns("priorities").has("workspace_id");
  const hasComposite =
    schema.includes("workspace_id") && schema.includes("UNIQUE(name, workspace_id)");
  if (hasCols && !hasComposite) {
    try {
      db.exec("PRAGMA legacy_alter_table = ON");
      db.exec("PRAGMA foreign_keys = OFF");
      db.exec("DROP TABLE IF EXISTS _priorities_old");
      db.exec("ALTER TABLE priorities RENAME TO _priorities_old");
      db.exec(
        "CREATE TABLE priorities (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, level INTEGER NOT NULL, color TEXT NOT NULL, workspace_id INTEGER NOT NULL DEFAULT 1, UNIQUE(name, workspace_id))",
      );
      db.exec(
        "INSERT INTO priorities (id, name, level, color, workspace_id) SELECT id, name, level, color, COALESCE(workspace_id, 1) FROM _priorities_old",
      );
      db.exec("DROP TABLE _priorities_old");
      console.log("[migration] priorities: composite unique constraint applied");
    } catch (e) {
      console.error("[migration] priorities composite unique failed:", e);
      try {
        const hasPrio = db
          .query("SELECT name FROM sqlite_master WHERE type='table' AND name='priorities'")
          .get();
        const hasOld = db
          .query("SELECT name FROM sqlite_master WHERE type='table' AND name='_priorities_old'")
          .get();
        if (!hasPrio && hasOld) {
          db.exec("ALTER TABLE _priorities_old RENAME TO priorities");
        }
      } catch {}
    } finally {
      db.exec("PRAGMA foreign_keys = ON");
      db.exec("PRAGMA legacy_alter_table = OFF");
    }
  }
}

// Seed categories/priorities for any workspace that is missing them (created
// before the seeding fix or from a failed creation that left an orphan row).
{
  const workspaceIds = (
    db.query("SELECT id FROM workspaces").all() as { id: number }[]
  ).map((r) => r.id);
  for (const wid of workspaceIds) {
    const catCount = (
      db.query("SELECT COUNT(*) AS c FROM categories WHERE workspace_id = ?").get(wid) as any
    ).c;
    if (catCount === 0) {
      const catIns = db.prepare(
        "INSERT OR IGNORE INTO categories (name, color, workspace_id) VALUES (?, ?, ?)",
      );
      catIns.run("Desarrollo", "#0972D3", wid);
      catIns.run("Diseño", "#FF9900", wid);
      catIns.run("Marketing", "#037F0C", wid);
      catIns.run("Investigación", "#6366f1", wid);
      catIns.run("Personal", "#252F3E", wid);
    }
    const prioCount = (
      db.query("SELECT COUNT(*) AS c FROM priorities WHERE workspace_id = ?").get(wid) as any
    ).c;
    if (prioCount === 0) {
      const prioIns = db.prepare(
        "INSERT OR IGNORE INTO priorities (name, level, color, workspace_id) VALUES (?, ?, ?, ?)",
      );
      prioIns.run("Baja", 1, "#037F0C", wid);
      prioIns.run("Media", 2, "#FF9900", wid);
      prioIns.run("Alta", 3, "#D91515", wid);
      prioIns.run("Urgente", 4, "#920B0B", wid);
    }
  }
}

export default db;
