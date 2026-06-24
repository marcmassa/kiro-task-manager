import { useState } from "react";
import { Task, Category, Priority, TaskFormData } from "../types";
import { XIcon } from "../Icons";
import { useT } from "../i18n/useT";

interface TaskModalProps {
  task: Task | null;
  categories: Category[];
  priorities: Priority[];
  onSave: (data: TaskFormData) => void;
  onClose: () => void;
}

export function TaskModal({ task, categories, priorities, onSave, onClose }: TaskModalProps) {
  const t = useT();
  const [formData, setFormData] = useState<TaskFormData>({
    title: task?.title || "",
    description: task?.description || "",
    priority_id: task?.priority_id || 2,
    category_id: task?.category_id || 1,
    due_date: task?.due_date || "",
    status: task?.status || "todo",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.title.trim()) return;
    onSave(formData);
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-modal-title"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 id="task-modal-title" className="text-lg font-semibold text-white">
            {task ? t("task.edit") : t("task.new")}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-muted-400 hover:text-white transition-colors"
            aria-label={t("action.close")}
          >
            <XIcon size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-muted-300 mb-2">
              {t("task.titleRequired")}
            </label>
            <input
              type="text"
              className="input-field"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder={t("task.titlePlaceholder")}
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-300 mb-2">
              {t("task.description")}
            </label>
            <textarea
              className="input-field resize-none"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t("task.descriptionPlaceholder")}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-300 mb-2">
                {t("task.priority")}
              </label>
              <select
                className="input-field"
                value={formData.priority_id}
                onChange={(e) => setFormData({ ...formData, priority_id: Number(e.target.value) })}
              >
                {priorities.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-300 mb-2">
                {t("task.category")}
              </label>
              <select
                className="input-field"
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: Number(e.target.value) })}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-300 mb-2">
              {t("task.dueDate")}
            </label>
            <input
              type="date"
              className="input-field"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
            />
          </div>

          {task && (
            <div>
              <label className="block text-sm font-medium text-muted-300 mb-2">
                {t("task.status")}
              </label>
              <select
                className="input-field"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              >
                <option value="todo">{t("task.status_todo")}</option>
                <option value="in_progress">{t("task.status_in_progress")}</option>
                <option value="done">{t("task.status_done")}</option>
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button type="submit" className="btn-primary flex-1">
              {task ? t("action.save") : t("action.create")}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">
              {t("action.cancel")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
