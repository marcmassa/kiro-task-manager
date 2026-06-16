import { useMemo } from "react";
import type { Task } from "../types";
import { ChartRenderer } from "./ChartRenderer";
import { calculateStats } from "../utils/statsCalculator";
import type { StatsData } from "../utils/statsCalculator";
import { formatStatAriaLabel } from "../utils/uiVariants";
import { ChartIcon, ClockIcon, WarningIcon, FireIcon, CalendarIcon, KanbanIcon } from "../Icons";
import { PageHeader } from "./ui/PageHeader";
import { StatCard } from "./ui/StatCard";
import { Card } from "./ui/Card";
import { SectionHeader } from "./ui/SectionHeader";
import { ProgressBar } from "./ui/ProgressBar";
import { DataTable } from "./ui/DataTable";
import { Badge } from "./ui/Badge";
import { LoadingState, ErrorState, EmptyState } from "./ui/StateView";

interface StatsDashboardProps {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function StatsDashboard({ tasks, loading, error, onRetry }: StatsDashboardProps) {
  const { stats, derivedError } = useMemo<{
    stats: StatsData | null;
    derivedError: string | null;
  }>(() => {
    try {
      return { stats: calculateStats(tasks), derivedError: null };
    } catch {
      return {
        stats: null,
        derivedError: "Error al calcular las estadísticas. Intenta de nuevo.",
      };
    }
  }, [tasks]);

  const displayError = error || derivedError;

  if (loading) {
    return (
      <div className="flex-1 ml-[72px] flex items-center justify-center min-h-screen">
        <LoadingState message="Cargando estadísticas..." />
      </div>
    );
  }

  if (displayError) {
    return (
      <div className="flex-1 ml-[72px] flex flex-col min-h-screen">
        <PageHeader title="Estadísticas" subtitle="Análisis de productividad de tu workspace" />
        <main className="flex-1 px-4 md:px-8 py-6 flex items-center justify-center">
          <ErrorState message={displayError} onRetry={onRetry} />
        </main>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex-1 ml-[72px] flex flex-col min-h-screen">
        <PageHeader title="Estadísticas" subtitle="Análisis de productividad de tu workspace" />
        <main className="flex-1 px-4 md:px-8 py-6">
          <EmptyState
            icon={<ChartIcon size={32} className="text-accent-400" />}
            title="Sin datos todavía"
            message="Crea tu primera tarea para ver las estadísticas."
          />
        </main>
      </div>
    );
  }

  const s = stats!;

  const completedTasks = s.statusDistribution.find((d) => d.label === "Completadas")?.value ?? 0;
  const pendingTasks = s.totalTasks - completedTasks;
  const totalForStatus = s.statusDistribution.reduce((sum, d) => sum + d.value, 0);
  const totalForPriority = s.priorityDistribution.reduce((sum, d) => sum + d.value, 0);
  const totalForCategory = s.categoryDistribution.reduce((sum, d) => sum + d.value, 0);

  const complianceTotal = s.completedOnTime + s.completedLate;
  const onTimePercent =
    complianceTotal > 0 ? Math.round((s.completedOnTime / complianceTotal) * 100) : 0;
  const latePercent =
    complianceTotal > 0 ? Math.round((s.completedLate / complianceTotal) * 100) : 0;

  return (
    <div className="flex-1 ml-[72px] flex flex-col min-h-screen">
      <PageHeader title="Estadísticas" subtitle="Análisis de productividad de tu workspace" />

      <main className="flex-1 px-8 py-6 space-y-8">
        {/* KPI Cards */}
        <section aria-label="Indicadores clave de rendimiento">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total tareas"
              value={s.totalTasks}
              icon={<KanbanIcon size={20} />}
              color="accent"
              aria-label={formatStatAriaLabel("Total de tareas", s.totalTasks)}
            />
            <StatCard
              label="Tareas vencidas"
              value={s.overdueTasks}
              icon={<WarningIcon size={20} />}
              color="danger"
              aria-label={formatStatAriaLabel("Tareas vencidas", s.overdueTasks)}
            />
            <StatCard
              label="En progreso"
              value={s.inProgressTasks}
              icon={<ClockIcon size={20} />}
              color="warning"
              aria-label={formatStatAriaLabel("Tareas en progreso", s.inProgressTasks)}
            />
            <StatCard
              label="Urgentes pendientes"
              value={s.urgentPendingTasks}
              icon={<FireIcon size={20} />}
              color="danger"
              aria-label={formatStatAriaLabel("Tareas urgentes pendientes", s.urgentPendingTasks)}
            />
          </div>
        </section>

        {/* Completion Rate */}
        <section aria-label="Tasa de cumplimiento general">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-200">Tasa de Cumplimiento</h2>
              <span className="text-xs text-muted-400">{s.completionRate}% completado</span>
            </div>
            <div className="mb-4">
              <ProgressBar value={s.completionRate} color="accent" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <div className="w-2 h-2 rounded-full bg-accent" />
                  <span className="text-xs text-muted-400">Pendientes</span>
                </div>
                <p className="text-lg font-semibold text-white">{pendingTasks}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <div className="w-2 h-2 rounded-full bg-warning" />
                  <span className="text-xs text-muted-400">En Progreso</span>
                </div>
                <p className="text-lg font-semibold text-white">{s.inProgressTasks}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <div className="w-2 h-2 rounded-full bg-success" />
                  <span className="text-xs text-muted-400">Completadas</span>
                </div>
                <p className="text-lg font-semibold text-white">{completedTasks}</p>
              </div>
            </div>
          </Card>
        </section>

        {/* Distribution Charts */}
        <section aria-label="Distribución de tareas">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <SectionHeader label="Por estado" />
              <p className="text-xs text-muted-400 -mt-2 mb-4">{totalForStatus} tareas</p>
              <ChartRenderer
                type="horizontal-bar"
                data={s.statusDistribution}
                title="Distribución de tareas por estado"
              />
              <div className="mt-4">
                <DataTable
                  aria-label="Distribución de tareas por estado"
                  columns={[
                    { key: "estado", header: "Estado" },
                    { key: "cantidad", header: "Tareas", numeric: true },
                    { key: "porcentaje", header: "Porcentaje", numeric: true },
                  ]}
                  rows={s.statusDistribution.map((d) => ({
                    estado: d.label,
                    cantidad: d.value,
                    porcentaje: `${d.percent.toFixed(1)}%`,
                  }))}
                  emptyMessage="No hay datos de estado disponibles"
                />
              </div>
            </Card>

            <Card>
              <SectionHeader label="Por prioridad" />
              <p className="text-xs text-muted-400 -mt-2 mb-4">{totalForPriority} tareas</p>
              <ChartRenderer
                type="donut"
                data={s.priorityDistribution}
                title="Distribución de tareas por prioridad"
              />
            </Card>

            <Card>
              <SectionHeader label="Por categoría" />
              <p className="text-xs text-muted-400 -mt-2 mb-4">
                {s.categoryDistribution.length} categorías · {totalForCategory} tareas
              </p>
              <ChartRenderer
                type="vertical-bar"
                data={s.categoryDistribution}
                title="Distribución de tareas por categoría"
              />
            </Card>

            <Card>
              <SectionHeader label="Actividad semanal" />
              <p className="text-xs text-muted-400 -mt-2 mb-4">Últimas 8 semanas</p>
              <ChartRenderer
                type="line-area"
                data={s.weeklyActivity.map((w) => ({
                  label: w.weekLabel,
                  value: w.count,
                  percent: 0,
                  color: "hsl(264 100% 64%)",
                }))}
                title="Actividad semanal"
                insufficientWeeklyData={s.insufficientWeeklyData}
              />
            </Card>
          </div>
        </section>

        {/* Date Compliance */}
        <section aria-label="Cumplimiento de fechas límite">
          {s.noDueDateTasks ? (
            <Card className="flex items-center gap-3 py-4">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                <CalendarIcon size={20} className="text-accent-400" />
              </div>
              <div>
                <p className="text-sm text-white">Sin fechas límite asignadas</p>
                <p className="text-xs text-muted-400">
                  Asigna una fecha de vencimiento a tus tareas para activar esta métrica.
                </p>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-200">Cumplimiento de fechas</h2>
                {s.overdueAndPending > 0 && (
                  <Badge variant="danger">
                    {s.overdueAndPending} vencida{s.overdueAndPending !== 1 ? "s" : ""}
                  </Badge>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5">
                <div className="flex-1 w-full">
                  <div className="flex justify-between text-xs text-muted-400 mb-2">
                    <span>
                      A tiempo:{" "}
                      <span className="text-success-300 font-semibold">{s.completedOnTime}</span>
                    </span>
                    <span>
                      Con retraso:{" "}
                      <span className="text-danger-300 font-semibold">{s.completedLate}</span>
                    </span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden flex">
                    {onTimePercent > 0 && (
                      <div
                        className="h-full bg-success transition-all duration-700"
                        style={{ width: `${onTimePercent}%` }}
                      />
                    )}
                    {latePercent > 0 && (
                      <div
                        className="h-full bg-danger transition-all duration-700"
                        style={{ width: `${latePercent}%` }}
                      />
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-400 mb-0.5">Tasa de puntualidad</p>
                  <p className="text-2xl font-bold text-white">
                    {s.punctualityRate !== null ? `${s.punctualityRate}%` : "N/A"}
                  </p>
                </div>
              </div>
            </Card>
          )}
        </section>
      </main>
    </div>
  );
}
