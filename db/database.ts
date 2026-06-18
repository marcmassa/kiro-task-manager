import { Database } from "bun:sqlite";

const db = new Database("tasks.db", { create: true });

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
`);

// FEAT-005: ensure the singleton workspace_settings row exists with defaults.
db.exec("INSERT OR IGNORE INTO workspace_settings (id) VALUES (1)");

// FEAT-006: seed the default Kiro agent (idempotent).
db.exec("INSERT OR IGNORE INTO agents (id, name, kind) VALUES ('kiro', 'Kiro', 'mcp')");

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

// Seed example tasks
const taskCount = db.query("SELECT COUNT(*) as count FROM tasks").get() as { count: number };
if (taskCount.count === 0) {
  const insertTask = db.prepare(
    "INSERT INTO tasks (title, description, status, priority_id, category_id, due_date) VALUES (?, ?, ?, ?, ?, ?)",
  );

  // We capture each task's auto-generated id via last_insert_rowid()
  // so the comments below can reference them by their real ids. This
  // is robust to AUTOINCREMENT starting at any value (the seed used
  // to crash with FK error in environments where other writes had
  // already consumed ids 1-7).
  insertTask.run(
    "Diseñar interfaz de usuario",
    "Crear los mockups y prototipos para la nueva landing page del producto. Incluir versión mobile y desktop.",
    "todo",
    2,
    2,
    "2025-06-20",
  );
  const idDiseno = Number(
    (db.query("SELECT last_insert_rowid() AS id").get() as { id: number } | null)?.id ?? 0,
  );

  insertTask.run(
    "Implementar autenticación OAuth",
    "Integrar login con Google y GitHub usando OAuth 2.0. Configurar tokens de refresh y manejo de sesiones.",
    "in_progress",
    3,
    1,
    "2025-06-15",
  );
  const idOauth = Number(
    (db.query("SELECT last_insert_rowid() AS id").get() as { id: number } | null)?.id ?? 0,
  );

  insertTask.run(
    "Escribir documentación API",
    "Documentar todos los endpoints REST con ejemplos de request/response usando OpenAPI 3.0.",
    "todo",
    1,
    1,
    "2025-06-25",
  );
  const idDocs = Number(
    (db.query("SELECT last_insert_rowid() AS id").get() as { id: number } | null)?.id ?? 0,
  );

  insertTask.run(
    "Campaña de lanzamiento",
    "Preparar materiales para el lanzamiento: emails, posts en redes sociales y blog post de anuncio.",
    "done",
    2,
    3,
    "2025-06-10",
  );
  const idCampana = Number(
    (db.query("SELECT last_insert_rowid() AS id").get() as { id: number } | null)?.id ?? 0,
  );

  insertTask.run(
    "Investigar tendencias UX 2025",
    "Revisar las últimas tendencias en diseño de interfaces y experiencia de usuario para aplicar en el próximo sprint.",
    "in_progress",
    1,
    4,
    "2025-06-18",
  );
  const idUx = Number(
    (db.query("SELECT last_insert_rowid() AS id").get() as { id: number } | null)?.id ?? 0,
  );

  insertTask.run(
    "Optimizar rendimiento del backend",
    "Identificar cuellos de botella en las consultas SQL y optimizar los endpoints críticos del API.",
    "todo",
    4,
    1,
    "2025-06-12",
  );
  const idPerf = Number(
    (db.query("SELECT last_insert_rowid() AS id").get() as { id: number } | null)?.id ?? 0,
  );

  insertTask.run(
    "Actualizar dependencias del proyecto",
    "Revisar y actualizar todas las dependencias a sus últimas versiones estables.",
    "done",
    1,
    5,
    "2025-06-05",
  );
  const idDeps = Number(
    (db.query("SELECT last_insert_rowid() AS id").get() as { id: number } | null)?.id ?? 0,
  );

  // Seed example comments — references are the auto-generated ids above,
  // not hardcoded 1/2/4/6 (which would crash FK if AUTOINCREMENT started
  // at any value other than 1).
  const insertComment = db.prepare(
    "INSERT INTO comments (task_id, content, author) VALUES (?, ?, ?)",
  );
  insertComment.run(
    idDiseno,
    "Ya tengo algunas referencias de Dribbble para inspiración.",
    "María",
  );
  insertComment.run(idDiseno, "Excelente, compártelas en el canal de diseño.", "Carlos");
  insertComment.run(idOauth, "El flujo de Google ya está funcionando en staging.", "Ana");
  insertComment.run(idOauth, "Falta implementar el refresh token, lo tengo para mañana.", "Pedro");
  insertComment.run(idCampana, "Los copies de email ya están aprobados por el equipo.", "Laura");
  insertComment.run(idPerf, "Las consultas más lentas están en el endpoint de búsqueda.", "Ana");
}

export default db;
