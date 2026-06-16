import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { deleteAllTasks } from "./settingsHandlers";

/**
 * FEAT-005 / T18 / R14 — Delete-all must be transactional.
 *
 * 1. Happy path: pre-seed tasks + comments, call deleteAllTasks, verify both
 *    tables are empty and the deleted count is correct.
 * 2. Rollback path: make the second DELETE fail (mocked), call deleteAllTasks,
 *    verify the tasks that the first DELETE would have removed are still
 *    present (the transaction rolled back).
 */

function makeTestDb(): Database {
  const db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
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
      priority_id INTEGER NOT NULL DEFAULT 2,
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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );
  `);
  return db;
}

function seedFixtures(db: Database) {
  db.prepare("INSERT INTO tasks (title, status, priority_id, category_id) VALUES (?, ?, 1, 1)").run(
    "Tarea 1",
    "todo",
  );
  db.prepare("INSERT INTO tasks (title, status, priority_id, category_id) VALUES (?, ?, 1, 1)").run(
    "Tarea 2",
    "in_progress",
  );
  db.prepare("INSERT INTO tasks (title, status, priority_id, category_id) VALUES (?, ?, 1, 1)").run(
    "Tarea 3",
    "done",
  );
  db.prepare("INSERT INTO comments (task_id, content) VALUES (1, 'comentario a')").run();
  db.prepare("INSERT INTO comments (task_id, content) VALUES (2, 'comentario b')").run();
}

describe("T18 / R14 — deleteAllTasks is transactional", () => {
  test("happy path: deletes all tasks AND all comments, returns the count", () => {
    const db = makeTestDb();
    seedFixtures(db);

    expect((db.query("SELECT COUNT(*) as n FROM tasks").get() as { n: number }).n).toBe(3);
    expect((db.query("SELECT COUNT(*) as n FROM comments").get() as { n: number }).n).toBe(2);

    const result = deleteAllTasks(db);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ deleted: 3 });

    expect((db.query("SELECT COUNT(*) as n FROM tasks").get() as { n: number }).n).toBe(0);
    expect((db.query("SELECT COUNT(*) as n FROM comments").get() as { n: number }).n).toBe(0);
  });

  test("works correctly on an empty database (returns 0)", () => {
    const db = makeTestDb();
    const result = deleteAllTasks(db);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ deleted: 0 });
  });

  test("rollback: if the second DELETE throws, the first is rolled back", () => {
    const db = makeTestDb();
    seedFixtures(db);

    // Wrap db.transaction so we can verify rollback semantics.
    // We do this by wrapping the delete in a manual transaction and
    // forcing a failure on the second statement.
    let deleteCount = 0;
    const originalExec = db.exec.bind(db);
    (db as unknown as { exec: (sql: string) => void }).exec = (sql: string) => {
      // The handler does:
      //   db.transaction(() => { db.exec("DELETE FROM comments"); db.exec("DELETE FROM tasks"); })();
      // We make the SECOND exec (the one deleting tasks) throw to simulate
      // a database failure. The transaction should roll back, leaving both
      // tables in their pre-call state.
      if (/DELETE FROM tasks/.test(sql)) {
        deleteCount++;
        throw new Error("Simulated database failure on tasks DELETE");
      }
      return originalExec(sql);
    };

    expect(() => deleteAllTasks(db)).toThrow("Simulated");
    expect(deleteCount).toBe(1);

    // After the failed call, both tables should still hold their original data
    // (the transaction rolled back the first DELETE FROM comments too).
    const tasksLeft = (db.query("SELECT COUNT(*) as n FROM tasks").get() as { n: number }).n;
    const commentsLeft = (db.query("SELECT COUNT(*) as n FROM comments").get() as { n: number }).n;
    expect(tasksLeft).toBe(3);
    expect(commentsLeft).toBe(2);
  });
});
