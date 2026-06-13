import { Task, Comment, Category, Priority, TaskFormData } from "./types";

const BASE_URL = "/api";

export async function fetchTasks(): Promise<Task[]> {
  const res = await fetch(`${BASE_URL}/tasks`);
  return res.json();
}

export async function fetchTask(id: number): Promise<Task> {
  const res = await fetch(`${BASE_URL}/tasks/${id}`);
  return res.json();
}

export async function createTask(data: TaskFormData): Promise<Task> {
  const res = await fetch(`${BASE_URL}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateTask(id: number, data: TaskFormData): Promise<Task> {
  const res = await fetch(`${BASE_URL}/tasks/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateTaskStatus(id: number, status: string): Promise<Task> {
  const res = await fetch(`${BASE_URL}/tasks/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  return res.json();
}

export async function deleteTask(id: number): Promise<void> {
  await fetch(`${BASE_URL}/tasks/${id}`, { method: "DELETE" });
}

export async function fetchComments(taskId: number): Promise<Comment[]> {
  const res = await fetch(`${BASE_URL}/tasks/${taskId}/comments`);
  return res.json();
}

export async function addComment(
  taskId: number,
  content: string,
  author: string,
): Promise<Comment> {
  const res = await fetch(`${BASE_URL}/tasks/${taskId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, author }),
  });
  return res.json();
}

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${BASE_URL}/categories`);
  return res.json();
}

export async function fetchPriorities(): Promise<Priority[]> {
  const res = await fetch(`${BASE_URL}/priorities`);
  return res.json();
}
