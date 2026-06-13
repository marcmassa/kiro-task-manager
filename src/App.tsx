import { useState, useEffect } from "react";
import { Task, Category, Priority, TaskStatus, TaskFormData } from "./types";
import {
  fetchTasks,
  fetchCategories,
  fetchPriorities,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
} from "./api";
import { KanbanColumn } from "./components/KanbanColumn";
import { TaskModal } from "./components/TaskModal";
import { TaskDetailModal } from "./components/TaskDetailModal";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { HomePage } from "./components/HomePage";
import { PlusIcon, KanbanIcon, HomeIcon, ChartIcon, SettingsIcon, LayersIcon } from "./Icons";

type Page = "home" | "kanban" | "stats" | "config";

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<Page>("home");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [tasksData, catsData, priosData] = await Promise.all([
        fetchTasks(),
        fetchCategories(),
        fetchPriorities(),
      ]);
      setTasks(tasksData);
      setCategories(catsData);
      setPriorities(priosData);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }

  const todoTasks = tasks.filter((t) => t.status === "todo");
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress");
  const doneTasks = tasks.filter((t) => t.status === "done");

  function handleNewTask() {
    setEditingTask(null);
    setShowTaskModal(true);
  }

  function handleEditTask(task: Task) {
    setEditingTask(task);
    setShowTaskModal(true);
  }

  function handleViewTask(task: Task) {
    setSelectedTask(task);
    setShowDetailModal(true);
  }

  function handleDeleteRequest(task: Task) {
    setTaskToDelete(task);
    setShowConfirmDialog(true);
  }

  async function handleConfirmDelete() {
    if (taskToDelete) {
      await deleteTask(taskToDelete.id);
      setTasks(tasks.filter((t) => t.id !== taskToDelete.id));
      setTaskToDelete(null);
      setShowConfirmDialog(false);
      if (showDetailModal) {
        setShowDetailModal(false);
        setSelectedTask(null);
      }
    }
  }

  async function handleSaveTask(data: TaskFormData) {
    if (editingTask) {
      const updated = await updateTask(editingTask.id, data);
      setTasks(tasks.map((t) => (t.id === editingTask.id ? updated : t)));
      if (selectedTask && selectedTask.id === editingTask.id) {
        setSelectedTask(updated);
      }
    } else {
      const created = await createTask(data);
      setTasks([created, ...tasks]);
    }
    setShowTaskModal(false);
    setEditingTask(null);
  }

  async function handleStatusChange(task: Task, newStatus: TaskStatus) {
    const updated = await updateTaskStatus(task.id, newStatus);
    setTasks(tasks.map((t) => (t.id === task.id ? updated : t)));
    if (selectedTask && selectedTask.id === task.id) {
      setSelectedTask(updated);
    }
  }

  async function handleDrop(taskId: number, targetStatus: TaskStatus) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (task.status === targetStatus) return;

    const previousTasks = tasks;
    setTasks(tasks.map((t) => (t.id === taskId ? { ...t, status: targetStatus } : t)));

    try {
      const updated = await updateTaskStatus(taskId, targetStatus);
      setTasks((current) => current.map((t) => (t.id === taskId ? updated : t)));
    } catch (error) {
      setTasks(previousTasks);
      console.error("Failed to update task status:", error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-600">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full bg-accent/40"></div>
          </div>
          <p className="text-muted-400 text-sm">Cargando tareas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-600 flex">
      {/* Sidebar */}
      <aside className="sidebar" aria-label="Navegación principal">
        <nav className="flex flex-col items-center gap-2 flex-1">
          {/* Logo */}
          <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center mb-6">
            <LayersIcon className="text-accent-400" size={20} />
          </div>

          {/* Nav Items */}
          <button
            className={`sidebar-item ${currentPage === "home" ? "active" : ""}`}
            aria-label="Inicio"
            title="Inicio"
            onClick={() => setCurrentPage("home")}
          >
            <HomeIcon size={20} />
          </button>
          <button
            className={`sidebar-item ${currentPage === "kanban" ? "active" : ""}`}
            aria-label="Tablero Kanban"
            title="Tablero Kanban"
            onClick={() => setCurrentPage("kanban")}
          >
            <KanbanIcon size={20} />
          </button>
          <button
            className={`sidebar-item ${currentPage === "stats" ? "active" : ""}`}
            aria-label="Estadísticas"
            title="Estadísticas"
            onClick={() => setCurrentPage("stats")}
          >
            <ChartIcon size={20} />
          </button>

          {/* Spacer to push Configuración to bottom */}
          <div className="flex-1" />

          <button
            className={`sidebar-item ${currentPage === "config" ? "active" : ""}`}
            aria-label="Configuración"
            title="Configuración"
            onClick={() => setCurrentPage("config")}
          >
            <SettingsIcon size={20} />
          </button>
        </nav>
      </aside>

      {/* Page Content */}
      {currentPage === "home" && (
        <HomePage
          tasks={tasks}
          todoCount={todoTasks.length}
          inProgressCount={inProgressTasks.length}
          doneCount={doneTasks.length}
          onNavigate={(page) => setCurrentPage(page as Page)}
        />
      )}

      {currentPage === "kanban" && (
        <div className="flex-1 ml-[72px] flex flex-col min-h-screen">
          {/* Header */}
          <header className="sticky top-0 z-10 bg-surface-600/80 backdrop-blur-xl border-b border-white/5">
            <div className="px-8 py-5 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-white">Tablero de Tareas</h1>
                <p className="text-sm text-muted-400 mt-0.5">
                  {tasks.length} tareas · {doneTasks.length} completadas
                </p>
              </div>
              <button onClick={handleNewTask} className="btn-primary flex items-center gap-2">
                <PlusIcon size={18} />
                <span>Nueva Tarea</span>
              </button>
            </div>
          </header>

          {/* Stats Bar */}
          <div className="px-8 py-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="stat-card">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-muted-400">Por Hacer</span>
                  <span className="text-lg font-bold text-white">{todoTasks.length}</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-500"
                    style={{
                      width: tasks.length ? `${(todoTasks.length / tasks.length) * 100}%` : "0%",
                    }}
                  ></div>
                </div>
              </div>
              <div className="stat-card">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-muted-400">En Progreso</span>
                  <span className="text-lg font-bold text-white">{inProgressTasks.length}</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-warning rounded-full transition-all duration-500"
                    style={{
                      width: tasks.length
                        ? `${(inProgressTasks.length / tasks.length) * 100}%`
                        : "0%",
                    }}
                  ></div>
                </div>
              </div>
              <div className="stat-card">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-muted-400">Completadas</span>
                  <span className="text-lg font-bold text-white">{doneTasks.length}</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-success rounded-full transition-all duration-500"
                    style={{
                      width: tasks.length ? `${(doneTasks.length / tasks.length) * 100}%` : "0%",
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Kanban Board */}
          <main className="flex-1 px-8 pb-8">
            <div className="flex gap-6 overflow-x-auto pb-4">
              <KanbanColumn
                title="Por Hacer"
                status="todo"
                tasks={todoTasks}
                color="accent"
                onViewTask={handleViewTask}
                onEditTask={handleEditTask}
                onDeleteTask={handleDeleteRequest}
                onStatusChange={handleStatusChange}
                onDrop={handleDrop}
              />
              <KanbanColumn
                title="En Progreso"
                status="in_progress"
                tasks={inProgressTasks}
                color="warning"
                onViewTask={handleViewTask}
                onEditTask={handleEditTask}
                onDeleteTask={handleDeleteRequest}
                onStatusChange={handleStatusChange}
                onDrop={handleDrop}
              />
              <KanbanColumn
                title="Completadas"
                status="done"
                tasks={doneTasks}
                color="success"
                onViewTask={handleViewTask}
                onEditTask={handleEditTask}
                onDeleteTask={handleDeleteRequest}
                onStatusChange={handleStatusChange}
                onDrop={handleDrop}
              />
            </div>
          </main>
        </div>
      )}

      {currentPage === "stats" && (
        <div className="flex-1 ml-[72px] flex flex-col min-h-screen">
          <header className="sticky top-0 z-10 bg-surface-600/80 backdrop-blur-xl border-b border-white/5">
            <div className="px-8 py-6">
              <h1 className="text-xl font-bold text-white">Estadísticas</h1>
              <p className="text-sm text-muted-400 mt-0.5">Resumen de productividad</p>
            </div>
          </header>
          <main className="flex-1 px-8 py-6">
            <div className="home-card text-center py-12">
              <ChartIcon size={48} className="text-muted-500 mx-auto mb-4" />
              <p className="text-muted-400">Próximamente — estadísticas detalladas</p>
            </div>
          </main>
        </div>
      )}

      {currentPage === "config" && (
        <div className="flex-1 ml-[72px] flex flex-col min-h-screen">
          <header className="sticky top-0 z-10 bg-surface-600/80 backdrop-blur-xl border-b border-white/5">
            <div className="px-8 py-6">
              <h1 className="text-xl font-bold text-white">Configuración</h1>
              <p className="text-sm text-muted-400 mt-0.5">Preferencias de la aplicación</p>
            </div>
          </header>
          <main className="flex-1 px-8 py-6">
            <div className="home-card text-center py-12">
              <SettingsIcon size={48} className="text-muted-500 mx-auto mb-4" />
              <p className="text-muted-400">Próximamente — configuración de la aplicación</p>
            </div>
          </main>
        </div>
      )}

      {/* Modals */}
      {showTaskModal && (
        <TaskModal
          task={editingTask}
          categories={categories}
          priorities={priorities}
          onSave={handleSaveTask}
          onClose={() => {
            setShowTaskModal(false);
            setEditingTask(null);
          }}
        />
      )}

      {showDetailModal && selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedTask(null);
          }}
          onEdit={(task) => {
            setShowDetailModal(false);
            handleEditTask(task);
          }}
          onDelete={(task) => handleDeleteRequest(task)}
          onStatusChange={handleStatusChange}
        />
      )}

      {showConfirmDialog && taskToDelete && (
        <ConfirmDialog
          title="Eliminar tarea"
          message={`¿Estás seguro de que deseas eliminar "${taskToDelete.title}"? Esta acción no se puede deshacer.`}
          onConfirm={handleConfirmDelete}
          onCancel={() => {
            setShowConfirmDialog(false);
            setTaskToDelete(null);
          }}
        />
      )}
    </div>
  );
}
