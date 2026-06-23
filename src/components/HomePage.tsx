import { Task, Workspace, WorkspaceColumn } from "../types";
import { columnColorTokens } from "../utils/columnColors";
import {
  KanbanIcon,
  CheckCircleIcon,
  ClockIcon,
  FireIcon,
  ArrowRightIcon,
  CalendarIcon,
  LayersIcon,
} from "../Icons";
import { KiroMascot } from "./KiroMascot";
import { KiroIllustration } from "./KiroIllustration";
import { PageHeader } from "./ui/PageHeader";

interface HomePageProps {
  tasks: Task[];
  todoCount: number;
  inProgressCount: number;
  doneCount: number;
  customColumns: WorkspaceColumn[];
  columnCounts: Map<string, number>;
  onNavigate: (page: string) => void;
  activeWorkspace?: Workspace | null;
  workspaceSelector?: React.ReactNode;
}

export function HomePage({
  tasks,
  todoCount,
  inProgressCount,
  doneCount,
  customColumns,
  columnCounts,
  onNavigate,
  activeWorkspace,
  workspaceSelector,
}: HomePageProps) {
  const totalTasks = tasks.length;
  const completionRate = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0;

  const overdueTasks = tasks.filter((t) => {
    if (!t.due_date || t.status === "done") return false;
    return new Date(t.due_date) < new Date();
  });
  function workspaceStatusLabel(status?: string): string {
    switch (status) {
      case "connected":
        return "Conectado";
      case "cloning":
        return "Clonando";
      case "error":
        return "Error";
      case "disconnected":
        return "Desconectado";
      default:
        return "No configurado";
    }
  }

  function workspaceStatusDot(status?: string): string {
    switch (status) {
      case "connected":
        return "bg-success";
      case "cloning":
        return "bg-warning animate-pulse";
      case "error":
        return "bg-danger";
      case "disconnected":
        return "bg-warning";
      default:
        return "bg-muted-500";
    }
  }

  const recentTasks = tasks.slice(0, 5);

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <PageHeader
        title="Bienvenido de vuelta"
        subtitle={`Aquí tienes un resumen de ${activeWorkspace?.name ?? "tu espacio de trabajo"}`}
        actions={workspaceSelector}
      />

      <main className="flex-1 px-8 py-6 space-y-8">
        {/* Hero Section */}
        <div className="home-card hero-gradient flex items-center gap-6 md:flex-row flex-col">
          <div className="kiro-float shrink-0">
            <KiroMascot
              size={160}
              className="w-[60px] h-[60px] md:w-[120px] md:h-[120px] lg:w-[160px] lg:h-[160px]"
            />
          </div>
          <div className="text-center md:text-left">
            <h2 className="text-lg font-semibold text-white">Kiro está listo para ayudarte</h2>
            <p className="text-sm text-muted-400 mt-1">
              Tu asistente de productividad está aquí. ¡Organicemos tu día!
            </p>
          </div>
        </div>

        <div className="home-card flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
              <LayersIcon size={18} className="text-accent-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-400">Workspace activo</p>
              <p className="text-sm font-semibold text-white truncate">
                {activeWorkspace?.name ?? "Sin workspace seleccionado"}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-400 flex items-center justify-end gap-2">
              <span
                className={`w-2 h-2 rounded-full ${workspaceStatusDot(activeWorkspace?.repoStatus)}`}
              />
              <span>{workspaceStatusLabel(activeWorkspace?.repoStatus)}</span>
            </p>
            <p className="text-xs text-muted-500 mt-1">
              {activeWorkspace?.repoCurrentBranch
                ? `Rama ${activeWorkspace.repoCurrentBranch}`
                : "Sin rama activa"}
            </p>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="home-stat-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
                <KanbanIcon size={20} className="text-accent-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{totalTasks}</p>
                <p className="text-xs text-muted-400">Total tareas</p>
              </div>
            </div>
          </div>

          <div className="home-stat-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-warning/15 flex items-center justify-center">
                <ClockIcon size={20} className="text-warning-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{inProgressCount}</p>
                <p className="text-xs text-muted-400">En progreso</p>
              </div>
            </div>
          </div>

          <div className="home-stat-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-success/15 flex items-center justify-center">
                <CheckCircleIcon size={20} className="text-success-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{completionRate}%</p>
                <p className="text-xs text-muted-400">Completado</p>
              </div>
            </div>
          </div>

          <div className="home-stat-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-danger/15 flex items-center justify-center">
                <FireIcon size={20} className="text-danger-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{overdueTasks.length}</p>
                <p className="text-xs text-muted-400">Vencidas</p>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Overview */}
        <div className="home-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-200">Progreso General</h2>
            <span className="text-xs text-muted-400">{completionRate}% completado</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-gradient-to-r from-accent to-accent-400 rounded-full transition-all duration-700"
              style={{ width: `${completionRate}%` }}
            ></div>
          </div>
          <div className="grid grid-cols-3 gap-3" style={{ gridTemplateColumns: `repeat(${3 + customColumns.length}, minmax(0,1fr))` }}>
            {[
              { label: "Por Hacer", count: todoCount, dot: "bg-accent" },
              ...customColumns.map((c) => ({
                label: c.label,
                count: columnCounts.get(c.id) ?? 0,
                dot: columnColorTokens(c.color).dot,
              })),
              { label: "En Progreso", count: inProgressCount, dot: "bg-warning" },
              { label: "Completadas", count: doneCount, dot: "bg-success" },
            ].map((col) => (
              <div key={col.label} className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <div className={`w-2 h-2 rounded-full ${col.dot}`}></div>
                  <span className="text-[10px] text-muted-400 leading-tight">{col.label}</span>
                </div>
                <p
                  className={`text-lg font-semibold ${col.count > 0 ? "text-white" : "text-muted-600"}`}
                >
                  {col.count}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Pipeline — only shown when workspace has custom columns */}
        {customColumns.length > 0 && (
          <div className="home-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-200">Pipeline</h2>
              <button
                onClick={() => onNavigate("kanban")}
                className="text-xs text-accent-400 hover:text-accent-300 flex items-center gap-1 transition-colors"
              >
                Ver tablero <ArrowRightIcon size={12} />
              </button>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {[
                { label: "Por Hacer", count: todoCount, dot: "bg-muted-500" },
                ...customColumns.map((c) => ({
                  label: c.label,
                  count: columnCounts.get(c.id) ?? 0,
                  dot: columnColorTokens(c.color).dot,
                })),
                { label: "En Progreso", count: inProgressCount, dot: "bg-warning" },
                { label: "Completadas", count: doneCount, dot: "bg-success" },
              ].map((col, i, arr) => (
                <div key={col.label} className="flex items-center gap-1 shrink-0">
                  <div className="flex flex-col items-center gap-1 px-2">
                    <span className={`text-base font-bold ${col.count > 0 ? "text-white" : "text-muted-600"}`}>
                      {col.count}
                    </span>
                    <div className="flex items-center gap-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${col.dot}`} />
                      <span className="text-[10px] text-muted-400 whitespace-nowrap">{col.label}</span>
                    </div>
                  </div>
                  {i < arr.length - 1 && <ArrowRightIcon size={10} className="text-muted-600 shrink-0" />}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Tasks */}
          <div className="home-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-200">Tareas Recientes</h2>
              <button
                onClick={() => onNavigate("kanban")}
                className="text-xs text-accent-400 hover:text-accent-300 flex items-center gap-1 transition-colors"
              >
                Ver tablero <ArrowRightIcon size={12} />
              </button>
            </div>
            <div className="space-y-2">
              {recentTasks.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <KiroIllustration mood="vacio" size={56} className="opacity-80" />
                  <p className="text-sm text-muted-400 text-center">
                    No hay tareas aún. ¡Crea tu primera tarea!
                  </p>
                </div>
              ) : (
                recentTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-surface-400/30 border border-white/5 hover:border-white/10 transition-colors"
                  >
                    <div
                      className="w-1 h-8 rounded-full shrink-0"
                      style={{ backgroundColor: task.priority_color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 truncate">{task.title}</p>
                      <p className="text-xs text-muted-500">{task.category_name}</p>
                    </div>
                    <span className="badge text-[10px] bg-surface-400/60 text-muted-300 border border-white/10">
                      {task.priority_name}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Overdue Tasks */}
          <div className="home-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-200">Tareas Vencidas</h2>
              {overdueTasks.length > 0 && (
                <span className="badge bg-danger/15 text-danger-400 text-[10px]">
                  {overdueTasks.length} pendiente{overdueTasks.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="space-y-2">
              {overdueTasks.length === 0 ? (
                <div className="text-center py-6">
                  <CheckCircleIcon size={24} className="text-success-400 mx-auto mb-2" />
                  <p className="text-sm text-muted-400">¡Estás al día! Sin tareas vencidas.</p>
                </div>
              ) : (
                overdueTasks.slice(0, 5).map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-danger/5 border border-danger/10"
                  >
                    <CalendarIcon size={14} className="text-danger-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 truncate">{task.title}</p>
                      <p className="text-xs text-danger-400">
                        Venció:{" "}
                        {new Date(task.due_date!).toLocaleDateString("es-ES", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="home-card">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">Acceso Rápido</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button onClick={() => onNavigate("kanban")} className="quick-action-btn">
              <KanbanIcon size={20} className="text-accent-400" />
              <span>Tablero Kanban</span>
            </button>
            <button onClick={() => onNavigate("stats")} className="quick-action-btn">
              <CheckCircleIcon size={20} className="text-success-400" />
              <span>Estadísticas</span>
            </button>
            <button onClick={() => onNavigate("config")} className="quick-action-btn">
              <ClockIcon size={20} className="text-warning-400" />
              <span>Configuración</span>
            </button>
            <button onClick={() => onNavigate("kanban")} className="quick-action-btn">
              <FireIcon size={20} className="text-danger-400" />
              <span>Tareas Urgentes</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
