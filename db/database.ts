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
`);

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

  insertTask.run(
    "Diseñar interfaz de usuario",
    "Crear los mockups y prototipos para la nueva landing page del producto. Incluir versión mobile y desktop.",
    "todo",
    2,
    2,
    "2025-06-20",
  );
  insertTask.run(
    "Implementar autenticación OAuth",
    "Integrar login con Google y GitHub usando OAuth 2.0. Configurar tokens de refresh y manejo de sesiones.",
    "in_progress",
    3,
    1,
    "2025-06-15",
  );
  insertTask.run(
    "Escribir documentación API",
    "Documentar todos los endpoints REST con ejemplos de request/response usando OpenAPI 3.0.",
    "todo",
    1,
    1,
    "2025-06-25",
  );
  insertTask.run(
    "Campaña de lanzamiento",
    "Preparar materiales para el lanzamiento: emails, posts en redes sociales y blog post de anuncio.",
    "done",
    2,
    3,
    "2025-06-10",
  );
  insertTask.run(
    "Investigar tendencias UX 2025",
    "Revisar las últimas tendencias en diseño de interfaces y experiencia de usuario para aplicar en el próximo sprint.",
    "in_progress",
    1,
    4,
    "2025-06-18",
  );
  insertTask.run(
    "Optimizar rendimiento del backend",
    "Identificar cuellos de botella en las consultas SQL y optimizar los endpoints críticos del API.",
    "todo",
    4,
    1,
    "2025-06-12",
  );
  insertTask.run(
    "Actualizar dependencias del proyecto",
    "Revisar y actualizar todas las dependencias a sus últimas versiones estables.",
    "done",
    1,
    5,
    "2025-06-05",
  );

  // Seed example comments
  const insertComment = db.prepare(
    "INSERT INTO comments (task_id, content, author) VALUES (?, ?, ?)",
  );
  insertComment.run(1, "Ya tengo algunas referencias de Dribbble para inspiración.", "María");
  insertComment.run(1, "Excelente, compártelas en el canal de diseño.", "Carlos");
  insertComment.run(2, "El flujo de Google ya está funcionando en staging.", "Ana");
  insertComment.run(2, "Falta implementar el refresh token, lo tengo para mañana.", "Pedro");
  insertComment.run(4, "Los copies de email ya están aprobados por el equipo.", "Laura");
  insertComment.run(6, "Las consultas más lentas están en el endpoint de búsqueda.", "Ana");
}

export default db;
