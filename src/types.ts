export interface Task {
  id: number;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done";
  priority_id: number;
  category_id: number;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  priority_name: string;
  priority_color: string;
  priority_level: number;
  category_name: string;
  category_color: string;
}

export interface Comment {
  id: number;
  task_id: number;
  content: string;
  author: string;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  color: string;
}

export interface Priority {
  id: number;
  name: string;
  level: number;
  color: string;
}

export type TaskStatus = "todo" | "in_progress" | "done";

export interface TaskFormData {
  title: string;
  description: string;
  priority_id: number;
  category_id: number;
  due_date: string;
  status: TaskStatus;
}
