import { useMemo } from "react";
import type { Task, AgentExecution, WorkspaceColumn } from "../types";
import { useT } from "../i18n/useT";
import { columnColorTokens } from "../utils/columnColors";
import { ChartRenderer } from "./ChartRenderer";
import { calculateStats } from "../utils/statsCalculator";
import type { StatsData } from "../utils/statsCalculator";
import { formatStatAriaLabel } from "../utils/uiVariants";
import { ChartIcon, ClockIcon, WarningIcon, FireIcon, CalendarIcon, KanbanIcon } from "../Icons";
import { PageHeader } from "./ui/PageHeader";
import { Card } from "./ui/Card";
import { SectionHeader } from "./ui/SectionHeader";
import { DataTable } from "./ui/DataTable";
import { StatsTable } from "./ui/StatsTable";
import { Badge } from "./ui/Badge";
import { LoadingState, ErrorState, EmptyState } from "./ui/StateView";

// ─────────────────────────────────────────────────────────────────────────────
// KPI card — uses design-system classes kpi-card, kpi-card-*, kpi-icon-*
// defined in styles.css @layer components. Zero hex literals.
// ─────────────────────────────────────────────────────────────────────────────
type KpiVariant = "accent" | "orange" | "red" | "green";

interface KpiCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  variant: KpiVariant;
  ariaLabel: string;
}

function KpiCard({ label, value, icon, variant, ariaLabel }: KpiCardProps) {
  return (
    <div className={`kpi-card kpi-card-${variant} home-stat-card`} aria-label={ariaLabel}>
      <div className="flex items-center gap-3">
        <div className={`kpi-icon kpi-icon-${variant}`}>{icon}</div>
        <div>
          <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
          <p className="text-xs text-muted-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Metric tile — uses metric-tile-success / metric-tile-danger / metric-tile-accent
// ─────────────────────────────────────────────────────────────────────────────
type MetricVariant = "success" | "danger" | "accent";

interface MetricTileProps {
  label: string;
  value: number | string;
  sub: string;
  variant: MetricVariant;
}

function MetricTile({ label, value, sub, variant }: MetricTileProps) {
  const labelColor: Record<MetricVariant, string> = {
    success: "text-success",
    danger: "text-danger",
    accent: "text-accent",
  };
  return (
    <div className={`metric-tile-${variant}`}>
      <p className={`metric-tile-label ${labelColor[variant]}`}>{label}</p>
      <p className="metric-tile-value">{value}</p>
      <p className="metric-tile-sub">{sub}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatsDashboard
// ─────────────────────────────────────────────────────────────────────────────
interface StatsDashboardProps {
  tasks: Task[];
  executions?: Map<number, AgentExecution>;
  customColumns?: WorkspaceColumn[];
  columnCounts?: Map<string, number>;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  workspaceSelector?: React.ReactNode;
  activeWorkspaceName?: string;
}

export function StatsDashboard({
  tasks,
  executions,
  customColumns = [],
  columnCounts = new Map(),
  loading,
  error,
  onRetry,
  workspaceSelector,
  activeWorkspaceName,
}: StatsDashboardProps) {
  const t = useT();
  const hasCustomColumns = customColumns.length > 0;
  const { stats, derivedError } = useMemo<{
    stats: StatsData | null;
    derivedError: string | null;
  }>(() => {
    try {
      return { stats: calculateStats(tasks), derivedError: null };
    } catch {
      return { stats: null, derivedError: t("stats.calcError") };
    }
  }, [tasks]);

  const displayError = error || derivedError;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <LoadingState message={t("stats.loading")} />
      </div>
    );
  }

  if (displayError) {
    return (
      <div className="flex-1 flex flex-col min-h-screen">
        <PageHeader
          title={t("stats.title")}
          subtitle={t("stats.subtitle", {
            name: activeWorkspaceName ?? t("stats.defaultWorkspace"),
          })}
          actions={workspaceSelector}
        />
        <main className="flex-1 px-8 py-6 flex items-center justify-center">
          <ErrorState message={displayError} onRetry={onRetry} />
        </main>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex-1 flex flex-col min-h-screen">
        <PageHeader
          title={t("stats.title")}
          subtitle={t("stats.subtitle", {
            name: activeWorkspaceName ?? t("stats.defaultWorkspace"),
          })}
          actions={workspaceSelector}
        />
        <main className="flex-1 px-8 py-6">
          <EmptyState
            icon={<ChartIcon size={32} className="text-accent-400" />}
            title={t("stats.noDataTitle")}
            message={t("stats.noDataMsg")}
          />
        </main>
      </div>
    );
  }

  const s = stats!;

  const complianceTotal = s.completedOnTime + s.completedLate;
  const onTimePercent =
    complianceTotal > 0 ? Math.round((s.completedOnTime / complianceTotal) * 100) : 0;
  const latePercent =
    complianceTotal > 0 ? Math.round((s.completedLate / complianceTotal) * 100) : 0;

  const customExtra = customColumns.reduce((sum, c) => sum + (columnCounts.get(c.id) ?? 0), 0);
  const totalForStatus = s.statusDistribution.reduce((n, d) => n + d.value, 0) + customExtra;
  const totalForPriority = s.priorityDistribution.reduce((n, d) => n + d.value, 0);
  const totalForCategory = s.categoryDistribution.reduce((n, d) => n + d.value, 0);

  const pct = (v: number) => (totalForStatus > 0 ? (v / totalForStatus) * 100 : 0);

  const customRows = customColumns.map((col) => {
    const value = columnCounts.get(col.id) ?? 0;
    const tokens = columnColorTokens(col.color);
    return {
      label: col.label,
      value,
      percent: pct(value),
      color: tokens.dot,
      textColor: tokens.text,
    };
  });

  const statusRows = [
    ...s.statusDistribution
      .filter((d) => d.label === "Por Hacer")
      .map((d) => ({ ...d, percent: pct(d.value), color: "bg-accent", textColor: "text-accent" })),
    ...customRows,
    ...s.statusDistribution
      .filter((d) => d.label !== "Por Hacer")
      .map((d) => ({
        ...d,
        percent: pct(d.value),
        color: d.label === "En Progreso" ? "bg-warning" : "bg-success",
        textColor: d.label === "En Progreso" ? "text-warning" : "text-success",
      })),
  ];

  const priorityRows = s.priorityDistribution.map((d) => ({
    ...d,
    color:
      d.label === "Baja"
        ? "bg-success"
        : d.label === "Media"
          ? "bg-warning"
          : d.label === "Alta"
            ? "bg-danger"
            : "bg-danger",
    textColor:
      d.label === "Baja" ? "text-success" : d.label === "Media" ? "text-warning" : "text-danger",
  }));

  const categoryRows = s.categoryDistribution.map((d) => ({
    ...d,
    color: "bg-accent",
    textColor: "text-accent",
  }));

  const maxWeekly = s.weeklyActivity.reduce((m, w) => Math.max(m, w.count), 1);
  const activeWeeklyRows = [...s.weeklyActivity]
    .reverse()
    .filter((w) => w.count > 0)
    .slice(0, 6)
    .map((w) => ({
      color: "bg-accent",
      textColor: "text-accent",
      label: w.weekLabel,
      value: w.count,
      percent: Math.round((w.count / maxWeekly) * 100),
    }));

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <PageHeader
        title="Estadísticas"
        subtitle={`Análisis de productividad · ${activeWorkspaceName ?? "Workspace activo"}`}
        actions={workspaceSelector}
      />

      <main className="flex-1 px-8 py-6 space-y-8">
        {/* ── KPI Cards ─────────────────────────────────────────── */}
        <section aria-label={t("stats.kpiSection")}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label={t("stats.totalTasks")}
              value={s.totalTasks}
              icon={<KanbanIcon size={20} />}
              variant="accent"
              ariaLabel={formatStatAriaLabel(t("stats.totalTasksLabel"), s.totalTasks)}
            />
            <KpiCard
              label={t("stats.overdueTasks")}
              value={s.overdueTasks}
              icon={<WarningIcon size={20} />}
              variant="red"
              ariaLabel={formatStatAriaLabel(t("stats.overdueTasksLabel"), s.overdueTasks)}
            />
            <KpiCard
              label={t("stats.inProgressTasks")}
              value={s.inProgressTasks}
              icon={<ClockIcon size={20} />}
              variant="orange"
              ariaLabel={formatStatAriaLabel(t("stats.inProgressLabel"), s.inProgressTasks)}
            />
            <KpiCard
              label={t("stats.urgentPending")}
              value={s.urgentPendingTasks}
              icon={<FireIcon size={20} />}
              variant="red"
              ariaLabel={formatStatAriaLabel(t("stats.urgentLabel"), s.urgentPendingTasks)}
            />
          </div>
        </section>

        {/* ── Cumplimiento unificado ─────────────────────────────── */}
        <section aria-label={t("stats.complianceSection")}>
          <Card>
            {/* Header row */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-200 mb-0.5">
                  {t("stats.completionRateTitle")}
                </h2>
                <p className="text-xs text-muted-500">{t("stats.completionRateSub")}</p>
              </div>
              <p className="text-4xl font-bold text-white tabular-nums leading-none shrink-0">
                {s.completionRate}
                <span className="text-lg font-normal text-muted-400">%</span>
              </p>
            </div>

            {/* Progress bar — gradient accent → aws-orange via two stacked fills */}
            <div
              className="h-2 rounded-full overflow-hidden mb-6 bg-white/5"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={s.completionRate}
              aria-label={t("stats.completionRateLabel", { rate: s.completionRate })}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent to-aws-orange transition-[width] duration-500"
                style={{ width: `${s.completionRate}%` }}
              />
            </div>

            {/* Divider */}
            <div className="h-px bg-white/5 mb-5" />

            {/* Date compliance zone */}
            {s.noDueDateTasks ? (
              <div className="flex items-center gap-3">
                <div className="kpi-icon kpi-icon-accent w-9 h-9 rounded-xl">
                  <CalendarIcon size={18} />
                </div>
                <div>
                  <p className="text-xs font-medium text-white">{t("stats.noDueDates")}</p>
                  <p className="text-xs text-muted-500 mt-0.5">{t("stats.noDueDatesDesc")}</p>
                </div>
              </div>
            ) : (
              <>
                {/* Sub-heading */}
                <div className="flex items-center justify-between mb-4">
                  <p className="metric-tile-label text-muted-500">{t("stats.dateCompliance")}</p>
                  {s.overdueAndPending > 0 && (
                    <Badge variant="danger">
                      {s.overdueAndPending}{" "}
                      {s.overdueAndPending !== 1 ? t("stats.overdueMany") : t("stats.overdueOne")}
                    </Badge>
                  )}
                </div>

                {/* Three metric tiles */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <MetricTile
                    label={t("stats.onTime")}
                    value={s.completedOnTime}
                    sub={t("stats.ofTotal", { pct: onTimePercent })}
                    variant="success"
                  />
                  <MetricTile
                    label={t("stats.late")}
                    value={s.completedLate}
                    sub={t("stats.ofTotal", { pct: latePercent })}
                    variant="danger"
                  />
                  <MetricTile
                    label={t("stats.punctuality")}
                    value={s.punctualityRate !== null ? `${s.punctualityRate}%` : "—"}
                    sub={
                      s.punctualityRate !== null ? t("stats.successRate") : t("stats.noMetricData")
                    }
                    variant="accent"
                  />
                </div>

                {/* Dual progress bar */}
                <div>
                  <div className="flex justify-between text-[10px] uppercase tracking-wider text-white/35 mb-1.5">
                    <span>{t("stats.onTime")}</span>
                    <span>{t("stats.late")}</span>
                  </div>
                  <div className="compliance-bar-track">
                    {onTimePercent > 0 && (
                      <div
                        className="h-full bg-success transition-[width] duration-500"
                        style={{ width: `${onTimePercent}%` }}
                      />
                    )}
                    {latePercent > 0 && (
                      <div
                        className="h-full bg-aws-red transition-[width] duration-500"
                        style={{ width: `${latePercent}%` }}
                      />
                    )}
                  </div>
                </div>
              </>
            )}
          </Card>
        </section>

        {/* ── Distribuciones ─────────────────────────────────────── */}
        <section aria-label={t("stats.distributionSection")}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Por estado */}
            <Card>
              <SectionHeader label={t("stats.byStatus")} dotColor="ds-dot-accent bg-accent" />
              <p className="text-xs text-muted-500 -mt-2 mb-4 tabular-nums">
                {t("stats.taskCount", { total: totalForStatus })}
              </p>
              <StatsTable rows={statusRows} />
              <div className="sr-only">
                <DataTable
                  aria-label={t("stats.statusDist")}
                  columns={[
                    { key: "estado", header: t("stats.col_estado") },
                    { key: "cantidad", header: t("stats.col_tasks"), numeric: true },
                    { key: "porcentaje", header: t("stats.col_pct"), numeric: true },
                  ]}
                  rows={s.statusDistribution.map((d) => ({
                    estado: d.label,
                    cantidad: d.value,
                    porcentaje: `${d.percent.toFixed(1)}%`,
                  }))}
                />
              </div>
              <div className="sr-only">
                <ChartRenderer
                  type="horizontal-bar"
                  data={s.statusDistribution}
                  title={t("stats.statusDist")}
                />
              </div>
            </Card>

            {/* Por categoría */}
            <Card>
              <SectionHeader label={t("stats.byCategory")} dotColor="ds-dot-warning bg-warning" />
              <p className="text-xs text-muted-500 -mt-2 mb-4 tabular-nums">
                {t("stats.catCount", {
                  count: s.categoryDistribution.length,
                  total: totalForCategory,
                })}
              </p>
              {s.categoryDistribution.length === 0 ? (
                <p className="text-xs text-muted-500 py-4 text-center">{t("stats.noCats")}</p>
              ) : (
                <StatsTable rows={categoryRows} />
              )}
            </Card>

            {/* Actividad semanal */}
            <Card>
              <SectionHeader
                label={t("stats.weeklyActivity")}
                dotColor="ds-dot-success bg-success"
              />
              <p className="text-xs text-muted-500 -mt-2 mb-4">{t("stats.weeklyActivitySub")}</p>
              <ChartRenderer
                type="line-area"
                data={s.weeklyActivity.map((w) => ({
                  label: w.weekLabel,
                  value: w.count,
                  percent: 0,
                  color: "#7c5cfc",
                }))}
                title={t("stats.weeklyActivity")}
                insufficientWeeklyData={s.insufficientWeeklyData}
              />
              {activeWeeklyRows.length > 0 && (
                <div className="mt-5">
                  <p className="metric-tile-label text-muted-500 mb-2">{t("stats.weeksActive")}</p>
                  <StatsTable rows={activeWeeklyRows} unit={t("stats.col_tasks")} />
                </div>
              )}
            </Card>

            {/* Por prioridad */}
            <Card>
              <SectionHeader label={t("stats.byPriority")} dotColor="ds-dot-danger bg-danger" />
              <p className="text-xs text-muted-500 -mt-2 mb-4 tabular-nums">
                {t("stats.taskCount", { total: totalForPriority })}
              </p>
              <ChartRenderer
                type="donut"
                data={s.priorityDistribution}
                title={t("stats.priorityDist")}
              />
              <div className="h-px bg-white/5 my-4" />
              <StatsTable rows={priorityRows} />
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}
