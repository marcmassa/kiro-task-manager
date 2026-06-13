import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import db from "./db/database";
import path from "path";

const PUBLIC_DIR = path.resolve(import.meta.dir, "public");

const app = new Elysia()
  .use(cors())

  // Serve static files from public directory
  .get("/styles.css", () => Bun.file(path.join(PUBLIC_DIR, "styles.css")))
  .get("/dist/index.js", () => Bun.file(path.join(PUBLIC_DIR, "dist/index.js")))

  // Get all tasks with related data
  .get("/api/tasks", () => {
    const tasks = db
      .query(
        `
      SELECT t.*, p.name as priority_name, p.color as priority_color, p.level as priority_level,
             c.name as category_name, c.color as category_color
      FROM tasks t
      JOIN priorities p ON t.priority_id = p.id
      JOIN categories c ON t.category_id = c.id
      ORDER BY t.created_at DESC
    `,
      )
      .all();
    return tasks;
  })

  // Get single task
  .get("/api/tasks/:id", ({ params }) => {
    const task = db
      .query(
        `
      SELECT t.*, p.name as priority_name, p.color as priority_color, p.level as priority_level,
             c.name as category_name, c.color as category_color
      FROM tasks t
      JOIN priorities p ON t.priority_id = p.id
      JOIN categories c ON t.category_id = c.id
      WHERE t.id = ?
    `,
      )
      .get(params.id);
    if (!task) return new Response("Task not found", { status: 404 });
    return task;
  })

  // Create task
  .post("/api/tasks", ({ body }) => {
    const { title, description, status, priority_id, category_id, due_date } = body as any;
    const result = db
      .prepare(
        "INSERT INTO tasks (title, description, status, priority_id, category_id, due_date) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        title,
        description || "",
        status || "todo",
        priority_id || 2,
        category_id || 1,
        due_date || null,
      );

    const task = db
      .query(
        `
      SELECT t.*, p.name as priority_name, p.color as priority_color, p.level as priority_level,
             c.name as category_name, c.color as category_color
      FROM tasks t
      JOIN priorities p ON t.priority_id = p.id
      JOIN categories c ON t.category_id = c.id
      WHERE t.id = ?
    `,
      )
      .get(result.lastInsertRowid);
    return task;
  })

  // Update task
  .put("/api/tasks/:id", ({ params, body }) => {
    const { title, description, status, priority_id, category_id, due_date } = body as any;
    db.prepare(
      "UPDATE tasks SET title = ?, description = ?, status = ?, priority_id = ?, category_id = ?, due_date = ?, updated_at = datetime('now') WHERE id = ?",
    ).run(title, description || "", status, priority_id, category_id, due_date || null, params.id);

    const task = db
      .query(
        `
      SELECT t.*, p.name as priority_name, p.color as priority_color, p.level as priority_level,
             c.name as category_name, c.color as category_color
      FROM tasks t
      JOIN priorities p ON t.priority_id = p.id
      JOIN categories c ON t.category_id = c.id
      WHERE t.id = ?
    `,
      )
      .get(params.id);
    return task;
  })

  // Update task status only
  .patch("/api/tasks/:id/status", ({ params, body }) => {
    const { status } = body as any;
    db.prepare("UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?").run(
      status,
      params.id,
    );
    const task = db
      .query(
        `
      SELECT t.*, p.name as priority_name, p.color as priority_color, p.level as priority_level,
             c.name as category_name, c.color as category_color
      FROM tasks t
      JOIN priorities p ON t.priority_id = p.id
      JOIN categories c ON t.category_id = c.id
      WHERE t.id = ?
    `,
      )
      .get(params.id);
    return task;
  })

  // Delete task
  .delete("/api/tasks/:id", ({ params }) => {
    db.prepare("DELETE FROM comments WHERE task_id = ?").run(params.id);
    db.prepare("DELETE FROM tasks WHERE id = ?").run(params.id);
    return { success: true };
  })

  // Get comments for a task
  .get("/api/tasks/:id/comments", ({ params }) => {
    return db
      .query("SELECT * FROM comments WHERE task_id = ? ORDER BY created_at DESC")
      .all(params.id);
  })

  // Add comment to a task
  .post("/api/tasks/:id/comments", ({ params, body }) => {
    const { content, author } = body as any;
    const result = db
      .prepare("INSERT INTO comments (task_id, content, author) VALUES (?, ?, ?)")
      .run(params.id, content, author || "Usuario");
    return db.query("SELECT * FROM comments WHERE id = ?").get(result.lastInsertRowid);
  })

  // Get categories
  .get("/api/categories", () => {
    return db.query("SELECT * FROM categories ORDER BY name").all();
  })

  // Get priorities
  .get("/api/priorities", () => {
    return db.query("SELECT * FROM priorities ORDER BY level").all();
  })

  // Serve index.html for all non-API routes (SPA fallback)
  .get("/*", ({ request }) => {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api")) {
      return new Response("Not Found", { status: 404 });
    }
    return new Response(Bun.file(path.join(PUBLIC_DIR, "index.html")), {
      headers: { "Content-Type": "text/html" },
    });
  })

  .listen(3000);

console.log(`🚀 Task Manager running at http://localhost:${app.server?.port}`);
