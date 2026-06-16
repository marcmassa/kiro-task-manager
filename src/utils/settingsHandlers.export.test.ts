import { describe, test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { buildExportPayload, exportAttachmentResponse } from "./settingsHandlers";

/**
 * FEAT-005 / T19 / R13 — GET /api/export shape.
 *
 * Verifies:
 *   1. The payload is JSON with the expected top-level shape:
 *      { exportedAt, workspace, tasks, comments, categories, priorities }
 *   2. The Content-Disposition header is set with the right filename
 *   3. The Content-Type is application/json
 *   4. Counts match the seed data
 */

function makeTestDb(): Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#6366f1'
    );
    CREATE TABLE priorities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      level INTEGER NOT NULL,
      color TEXT NOT NULL
    );
    CREATE TABLE tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'done')),
      priority_id INTEGER NOT NULL DEFAULT 1,
      category_id INTEGER NOT NULL DEFAULT 1,
      due_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      author TEXT NOT NULL DEFAULT 'Usuario',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE workspace_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      workspace_name TEXT NOT NULL DEFAULT 'Mi Workspace',
      default_language TEXT NOT NULL DEFAULT 'es-ES',
      default_timezone TEXT NOT NULL DEFAULT 'Europe/Madrid',
      notify_on_due INTEGER NOT NULL DEFAULT 1,
      notify_on_done INTEGER NOT NULL DEFAULT 0,
      notify_daily_digest INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO workspace_settings (id) VALUES (1);
    INSERT INTO categories (name, color) VALUES ('Desarrollo', '#0972D3'), ('Diseño', '#FF9900');
    INSERT INTO priorities (name, level, color) VALUES ('Baja', 1, '#037F0C'), ('Alta', 3, '#D91515');
  `);
  return db;
}

function seedExportFixtures(db: Database) {
  db.prepare("INSERT INTO tasks (title, status) VALUES (?, 'todo')").run("Diseñar UI");
  db.prepare("INSERT INTO tasks (title, status) VALUES (?, 'in_progress')").run(
    "Implementar OAuth",
  );
  db.prepare("INSERT INTO tasks (title, status) VALUES (?, 'done')").run("Escribir docs");
  db.prepare("INSERT INTO comments (task_id, content) VALUES (1, 'Tengo refs en Dribbble')").run();
}

describe("T19 / R13 — export payload shape", () => {
  test("buildExportPayload returns the documented top-level shape", () => {
    const db = makeTestDb();
    seedExportFixtures(db);

    const raw = buildExportPayload(db);
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    expect(parsed).toHaveProperty("exportedAt");
    expect(typeof parsed.exportedAt).toBe("string");
    // ISO timestamp format check
    expect(new Date(parsed.exportedAt as string).toString()).not.toBe("Invalid Date");

    expect(parsed).toHaveProperty("workspace");
    expect(parsed.workspace).toMatchObject({
      workspace_name: "Mi Workspace",
      default_language: "es-ES",
      default_timezone: "Europe/Madrid",
    });

    expect(parsed).toHaveProperty("tasks");
    expect(parsed).toHaveProperty("comments");
    expect(parsed).toHaveProperty("categories");
    expect(parsed).toHaveProperty("priorities");

    expect(Array.isArray(parsed.tasks)).toBe(true);
    expect(Array.isArray(parsed.comments)).toBe(true);
    expect(Array.isArray(parsed.categories)).toBe(true);
    expect(Array.isArray(parsed.priorities)).toBe(true);
  });

  test("counts in the payload match the seed data", () => {
    const db = makeTestDb();
    seedExportFixtures(db);

    const parsed = JSON.parse(buildExportPayload(db)) as {
      tasks: unknown[];
      comments: unknown[];
      categories: unknown[];
      priorities: unknown[];
    };

    expect(parsed.tasks).toHaveLength(3);
    expect(parsed.comments).toHaveLength(1);
    expect(parsed.categories).toHaveLength(2);
    expect(parsed.priorities).toHaveLength(2);
  });

  test("exportAttachmentResponse sets the Content-Disposition + Content-Type headers", () => {
    const db = makeTestDb();
    seedExportFixtures(db);

    const response = exportAttachmentResponse(db);
    expect(response).toBeInstanceOf(Response);
    expect(response.headers.get("Content-Type")).toBe("application/json");

    const disposition = response.headers.get("Content-Disposition") ?? "";
    expect(disposition).toMatch(
      /^attachment; filename="workshop-kiro-tasks-\d{4}-\d{2}-\d{2}\.json"$/,
    );
  });
});
