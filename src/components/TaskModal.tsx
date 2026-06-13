import { useState } from "react";
import { Task, Category, Priority, TaskFormData } from "../types";
import { XIcon } from "../Icons";

interface TaskModalProps {
  task: Task | null;
  categories: Category[];
  priorities: Priority[];
  onSave: (data: TaskFormData) => void;
  onClose: () => void;
}

export function TaskModal({ task, categories, priorities, onSave, onClose }: TaskModalProps) {
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
            {task ? "Editar Tarea" : "Nueva Tarea"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-muted-400 hover:text-white transition-colors"
            aria-label="Cerrar"
          >
            <XIcon size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-muted-300 mb-2">Título *</label>
            <input
              type="text"
              className="input-field"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="¿Qué necesitas hacer?"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-300 mb-2">Descripción</label>
            <textarea
              className="input-field resize-none"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Agrega más detalles sobre esta tarea..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-300 mb-2">Prioridad</label>
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
              <label className="block text-sm font-medium text-muted-300 mb-2">Categoría</label>
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
              Fecha de vencimiento
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
              <label className="block text-sm font-medium text-muted-300 mb-2">Estado</label>
              <select
                className="input-field"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              >
                <option value="todo">Por Hacer</option>
                <option value="in_progress">En Progreso</option>
                <option value="done">Completada</option>
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button type="submit" className="btn-primary flex-1">
              {task ? "Guardar Cambios" : "Crear Tarea"}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
