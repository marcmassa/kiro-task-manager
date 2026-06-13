import { Task } from "../types";
import {
  KanbanIcon,
  CheckCircleIcon,
  ClockIcon,
  FireIcon,
  ArrowRightIcon,
  CalendarIcon,
} from "../Icons";

interface HomePageProps {
  tasks: Task[];
  todoCount: number;
  inProgressCount: number;
  doneCount: number;
  onNavigate: (page: string) => void;
}

export function HomePage({
  tasks,
  todoCount,
  inProgressCount,
  doneCount,
  onNavigate,
}: HomePageProps) {
  const totalTasks = tasks.length;
  const completionRate = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0;

  const overdueTasks = tasks.filter((t) => {
    if (!t.due_date || t.status === "done") return false;
    return new Date(t.due_date) < new Date();
  });

  const recentTasks = tasks.slice(0, 5);

  return (
    <div className="flex-1 ml-[72px] flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-surface-600/80 backdrop-blur-xl border-b border-white/5">
        <div className="px-8 py-6">
          <h1 className="text-2xl font-bold text-white">Bienvenido de vuelta</h1>
          <p className="text-sm text-muted-400 mt-1">
            Aquí tienes un resumen de tu espacio de trabajo
          </p>
        </div>
      </header>

      <main className="flex-1 px-8 py-6 space-y-8">
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
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full bg-accent"></div>
                <span className="text-xs text-muted-400">Por Hacer</span>
              </div>
              <p className="text-lg font-semibold text-white">{todoCount}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full bg-warning"></div>
                <span className="text-xs text-muted-400">En Progreso</span>
              </div>
              <p className="text-lg font-semibold text-white">{inProgressCount}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full bg-success"></div>
                <span className="text-xs text-muted-400">Completadas</span>
              </div>
              <p className="text-lg font-semibold text-white">{doneCount}</p>
            </div>
          </div>
        </div>

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
                <p className="text-sm text-muted-400 text-center py-6">
                  No hay tareas aún. ¡Crea tu primera tarea!
                </p>
              ) : (
                recentTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-surface-400/30 border border-white/5 hover:border-white/10 transition-colors"
                  >
                    <div
                      className="w-1 h-8 rounded-full"
                      style={{ backgroundColor: task.priority_color }}
                    ></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 truncate">{task.title}</p>
                      <p className="text-xs text-muted-500">{task.category_name}</p>
                    </div>
                    <span
                      className="badge text-[10px]"
                      style={{
                        backgroundColor: task.priority_color + "20",
                        color: task.priority_color,
                      }}
                    >
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
