import { useState, useEffect, useCallback, useRef } from "react";
import {
  Task,
  Category,
  Priority,
  TaskStatus,
  TaskFormData,
  AgentExecution,
  Workspace,
} from "./types";
import {
  fetchTasks,
  fetchCategories,
  fetchPriorities,
  fetchAllExecutions,
  fetchWorkspaces,
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
import { StatsDashboard } from "./components/StatsDashboard";
import { SettingsPage } from "./components/SettingsPage";
import { KiroIllustration } from "./components/KiroIllustration";
import { PageHeader } from "./components/ui/PageHeader";
import { WorkspaceSelector } from "./components/WorkspaceSelector";
import { WorkspacePage } from "./components/WorkspacePage";
import {
  PlusIcon,
  KanbanIcon,
  HomeIcon,
  ChartIcon,
  SettingsIcon,
  LayersIcon,
  CodeIcon,
} from "./Icons";
import { effectiveColumn } from "./utils/sddKanban";
import { KiroColumnTransition } from "./components/KiroColumnTransition";
import type { SddPhase } from "./utils/sddLifecycle";

type Page = "home" | "kanban" | "workspace" | "stats" | "config";

const WS_KEY = "workshop-kiro:activeWorkspaceId";

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [executions, setExecutions] = useState<Map<number, AgentExecution>>(new Map());
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>("home");

  // ── SDD animation state ───────────────────────────────────────────────────
  const [currentSddPhase, setCurrentSddPhase] = useState<SddPhase | null>(null);
  const prevExecutionsRef = useRef<Map<number, AgentExecution>>(new Map());

  // ── Workspace state ──────────────────────────────────────────────────────────
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<number>(() => {
    const stored = localStorage.getItem(WS_KEY);
    return stored ? Number(stored) : 0;
  });

  // Reload tasks when workspace changes
  const loadData = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const wsId = activeWorkspaceId > 0 ? activeWorkspaceId : undefined;
      const [tasksData, catsData, priosData, workspacesData] = await Promise.all([
        fetchTasks(wsId),
        fetchCategories(wsId),
        fetchPriorities(wsId),
        fetchWorkspaces(),
      ]);
      setWorkspaces(workspacesData);
      if (workspacesData.length > 0 && !workspacesData.find((w) => w.id === activeWorkspaceId)) {
        const targetId = workspacesData[0].id;
        setActiveWorkspaceId(targetId);
        localStorage.setItem(WS_KEY, String(targetId));
      }
      setTasks(tasksData);
      setCategories(catsData);
      setPriorities(priosData);
      try {
        const execs = await fetchAllExecutions();
        const newMap = new Map(execs.map((e) => [e.task_id, e]));
        // Detect SDD phase transitions for animation
        for (const [taskId, exec] of newMap) {
          const prev = prevExecutionsRef.current.get(taskId);
          if (prev && prev.sdd_phase !== exec.sdd_phase && exec.sdd_phase) {
            setCurrentSddPhase(exec.sdd_phase);
          }
        }
        prevExecutionsRef.current = newMap;
        setExecutions(newMap);
      } catch (execErr) {
        console.error("Error loading executions:", execErr);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      setError("Error al cargar las estadísticas. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleWorkspaceChange(id: number) {
    if (id === activeWorkspaceId) return;
    setTasks([]);
    setCategories([]);
    setPriorities([]);
    setExecutions(new Map());
    setActiveWorkspaceId(id);
    localStorage.setItem(WS_KEY, String(id));
  }

  // ── Derived data ─────────────────────────────────────────────────────────
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  const todoTasks = tasks.filter(
    (t) => effectiveColumn(t, executions.get(t.id) ?? null) === "todo",
  );
  const requirementsTasks = tasks.filter(
    (t) => effectiveColumn(t, executions.get(t.id) ?? null) === "requirements",
  );
  const designTasks = tasks.filter(
    (t) => effectiveColumn(t, executions.get(t.id) ?? null) === "design",
  );
  const sddTasksTasks = tasks.filter(
    (t) => effectiveColumn(t, executions.get(t.id) ?? null) === "tasks",
  );
  const inProgressTasks = tasks.filter(
    (t) => effectiveColumn(t, executions.get(t.id) ?? null) === "in_progress",
  );
  const doneTasks = tasks.filter(
    (t) => effectiveColumn(t, executions.get(t.id) ?? null) === "done",
  );
  const workspaceSelector = (
    <WorkspaceSelector
      activeWorkspaceId={activeWorkspaceId}
      onWorkspaceChange={handleWorkspaceChange}
    />
  );

  // ── Task handlers ────────────────────────────────────────────────────────
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
      await deleteTask(taskToDelete.id, activeWorkspaceId);
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
      const updated = await updateTask(editingTask.id, data, activeWorkspaceId);
      setTasks(tasks.map((t) => (t.id === editingTask.id ? updated : t)));
      if (selectedTask && selectedTask.id === editingTask.id) {
        setSelectedTask(updated);
      }
    } else {
      const created = await createTask(data, activeWorkspaceId);
      setTasks([created, ...tasks]);
    }
    setShowTaskModal(false);
    setEditingTask(null);
  }

  async function handleStatusChange(task: Task, newStatus: TaskStatus) {
    const updated = await updateTaskStatus(task.id, newStatus, activeWorkspaceId);
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
      const updated = await updateTaskStatus(taskId, targetStatus, activeWorkspaceId);
      setTasks((current) => current.map((t) => (t.id === taskId ? updated : t)));
    } catch (error) {
      setTasks(previousTasks);
      console.error("Failed to update task status:", error);
    }
  }

  // ── Loading / Error screens ───────────────────────────────────────────────
  if (loading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-600">
        <div className="flex flex-col items-center gap-4">
          <KiroIllustration mood="pensando" size={120} />
          <p className="text-muted-400 text-sm">Cargando tareas...</p>
        </div>
      </div>
    );
  }

  if (!loading && error && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-600">
        <div className="flex flex-col items-center gap-4">
          <KiroIllustration mood="error" size={120} />
          <p className="text-sm text-danger-400">{error}</p>
          <button
            onClick={loadData}
            className="btn-primary"
            aria-label="Reintentar carga de tareas"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-600 flex">
      {/* FEAT-012: SDD phase transition animation */}
      <KiroColumnTransition currentPhase={currentSddPhase} />
      {/* Sidebar — solo íconos de navegación */}
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
            className={`sidebar-item ${currentPage === "workspace" ? "active" : ""}`}
            aria-label="Workspace"
            title="Workspace"
            onClick={() => setCurrentPage("workspace")}
          >
            <CodeIcon size={20} />
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

      {/* Main content area */}
      <div className="flex-1 ml-[72px]">
        {currentPage === "home" && (
          <>
            {error && tasks.length > 0 && (
              <div className="mx-8 mt-4 flex items-center gap-3 p-4 rounded-xl bg-danger/5 border border-danger/20">
                <KiroIllustration mood="error" size={40} animated={false} />
                <p className="text-sm text-danger-400 flex-1">{error}</p>
                <button
                  onClick={loadData}
                  className="btn-danger text-sm"
                  aria-label="Reintentar carga de tareas"
                >
                  Reintentar
                </button>
              </div>
            )}
            <HomePage
              tasks={tasks}
              todoCount={todoTasks.length}
              requirementsCount={requirementsTasks.length}
              designCount={designTasks.length}
              tasksCount={sddTasksTasks.length}
              inProgressCount={inProgressTasks.length}
              doneCount={doneTasks.length}
              onNavigate={(page) => setCurrentPage(page as Page)}
              activeWorkspace={activeWorkspace}
              workspaceSelector={workspaceSelector}
            />
          </>
        )}

        {currentPage === "kanban" && (
          <div className="flex flex-col min-h-full">
            <PageHeader
              title="Tablero de Tareas"
              subtitle={`${tasks.length} tareas · ${doneTasks.length} completadas · ${activeWorkspace?.name ?? "Workspace"}`}
              actions={
                <div className="flex items-center gap-2">
                  <button onClick={handleNewTask} className="btn-primary flex items-center gap-2">
                    <PlusIcon size={18} />
                    <span>Nueva Tarea</span>
                  </button>
                  <span className="w-px h-5 bg-white/5" aria-hidden="true" />
                  {workspaceSelector}
                </div>
              }
            />

            {/* Error banner when refresh fails but tasks are already loaded */}
            {error && tasks.length > 0 && (
              <div className="mx-8 mt-4 flex items-center gap-3 p-4 rounded-xl bg-danger/5 border border-danger/20">
                <KiroIllustration mood="error" size={40} animated={false} />
                <p className="text-sm text-danger-400 flex-1">{error}</p>
                <button
                  onClick={loadData}
                  className="btn-danger text-sm"
                  aria-label="Reintentar carga de tareas"
                >
                  Reintentar
                </button>
              </div>
            )}

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

            {/* Celebration: all tasks completed */}
            {tasks.length > 0 && todoTasks.length === 0 && inProgressTasks.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-6">
                <KiroIllustration mood="celebrando" size={100} />
                <p className="text-sm text-success-400 font-medium">
                  ¡Felicidades! Todas las tareas están completadas 🎉
                </p>
              </div>
            )}

            {/* Kanban Board */}
            <main className="flex-1 px-8 pb-8">
              <div className="flex gap-6 overflow-x-auto pb-4">
                <KanbanColumn
                  title="Por Hacer"
                  status="todo"
                  tasks={todoTasks}
                  color="accent"
                  executions={executions}
                  onViewTask={handleViewTask}
                  onEditTask={handleEditTask}
                  onDeleteTask={handleDeleteRequest}
                  onStatusChange={handleStatusChange}
                  onDrop={handleDrop}
                />
                <KanbanColumn
                  title="Requirements"
                  tasks={requirementsTasks}
                  color="purple"
                  executions={executions}
                  onViewTask={handleViewTask}
                  onEditTask={handleEditTask}
                  onDeleteTask={handleDeleteRequest}
                  onStatusChange={handleStatusChange}
                  isSdd
                />
                <KanbanColumn
                  title="Diseño"
                  tasks={designTasks}
                  color="indigo"
                  executions={executions}
                  onViewTask={handleViewTask}
                  onEditTask={handleEditTask}
                  onDeleteTask={handleDeleteRequest}
                  onStatusChange={handleStatusChange}
                  isSdd
                />
                <KanbanColumn
                  title="Tasks"
                  tasks={sddTasksTasks}
                  color="yellow"
                  executions={executions}
                  onViewTask={handleViewTask}
                  onEditTask={handleEditTask}
                  onDeleteTask={handleDeleteRequest}
                  onStatusChange={handleStatusChange}
                  isSdd
                />
                <KanbanColumn
                  title="En Progreso"
                  status="in_progress"
                  tasks={inProgressTasks}
                  color="warning"
                  executions={executions}
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
                  executions={executions}
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
          <StatsDashboard
            tasks={tasks}
            executions={executions}
            loading={loading}
            error={error}
            onRetry={loadData}
            workspaceSelector={workspaceSelector}
            activeWorkspaceName={activeWorkspace?.name}
          />
        )}

        {currentPage === "config" && (
          <SettingsPage
            loading={loading}
            error={error}
            onRetry={loadData}
            onDataChanged={loadData}
            activeWorkspaceId={activeWorkspaceId}
            onWorkspaceChange={handleWorkspaceChange}
            workspaceSelector={workspaceSelector}
          />
        )}

        {currentPage === "workspace" && (
          <WorkspacePage
            workspaceId={activeWorkspaceId}
            workspaceName={activeWorkspace?.name}
            workspaceSelector={workspaceSelector}
          />
        )}
      </div>

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
          onExecutionChanged={loadData}
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
