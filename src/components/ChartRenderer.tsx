import { useState } from "react";
import type { ChartDataPoint } from "../utils/statsCalculator";

export type ChartType = "horizontal-bar" | "donut" | "vertical-bar" | "line-area";

interface ChartRendererProps {
  type: ChartType;
  data: ChartDataPoint[];
  title: string;
  insufficientWeeklyData?: boolean;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  label: string;
  value: number;
  percent: number;
}

export function ChartRenderer({ type, data, title, insufficientWeeklyData }: ChartRendererProps) {
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    label: "",
    value: 0,
    percent: 0,
  });

  const id = `chart-${title.replace(/\s+/g, "-").toLowerCase()}`;

  function handleTooltipShow(e: React.MouseEvent | React.FocusEvent, d: ChartDataPoint) {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const parent = (e.target as HTMLElement)
      .closest("[data-chart-wrapper]")
      ?.getBoundingClientRect();
    const x = parent ? rect.left - parent.left + rect.width / 2 : rect.width / 2;
    const y = parent ? rect.top - parent.top : 0;
    setTooltip({
      visible: true,
      x,
      y,
      label: d.label,
      value: d.value,
      percent: d.percent,
    });
  }

  function handleTooltipHide() {
    setTooltip((prev) => ({ ...prev, visible: false }));
  }

  const isEmpty = data.length === 0 || data.every((d) => d.value === 0);

  function renderHorizontalBar() {
    const viewW = 400;
    const labelOffset = 90;
    const rightPad = 60;
    const barHeight = 28;
    const gap = 16;
    const viewH = Math.max(data.length * (barHeight + gap) - gap + 8, 40);
    const barAvailable = viewW - labelOffset - rightPad;
    const maxValue = Math.max(...data.map((d) => d.value), 1);

    return (
      <svg
        className="w-full h-auto"
        viewBox={`0 0 ${viewW} ${viewH}`}
        role="img"
        aria-label={`Gráfico: ${title}`}
        aria-describedby={`chart-table-${id}`}
      >
        <title>{title}</title>
        {isEmpty ? (
          <text
            x={viewW / 2}
            y={viewH / 2}
            textAnchor="middle"
            fill="#6b7280"
            fontSize={13}
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            Sin datos disponibles
          </text>
        ) : (
          data.map((d, i) => {
            const barW = (d.value / maxValue) * barAvailable;
            const barX = labelOffset;
            const barY = i * (barHeight + gap);
            return (
              <g key={d.label}>
                <text
                  x={labelOffset - 8}
                  y={barY + barHeight / 2}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fill="#9ca3af"
                  fontSize={12}
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  {d.label}
                </text>
                <rect
                  x={barX}
                  y={barY}
                  width={barW}
                  height={barHeight}
                  rx={4}
                  fill={d.color}
                  tabIndex={0}
                  role="graphics-symbol"
                  aria-label={`${d.label}: ${d.value} tareas, ${d.percent.toFixed(1)}%`}
                  onMouseEnter={(e) => handleTooltipShow(e, d)}
                  onMouseLeave={handleTooltipHide}
                  onFocus={(e) => handleTooltipShow(e, d)}
                  onBlur={handleTooltipHide}
                  className="cursor-pointer focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
                />
                <text
                  x={barX + barW + 6}
                  y={barY + barHeight / 2}
                  dominantBaseline="middle"
                  fill="#e5e7eb"
                  fontSize={12}
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  {d.value}
                </text>
              </g>
            );
          })
        )}
      </svg>
    );
  }

  function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function describeDonutSegment(
    cx: number,
    cy: number,
    outerR: number,
    innerR: number,
    startAngle: number,
    endAngle: number,
  ) {
    const outerStart = polarToCartesian(cx, cy, outerR, endAngle);
    const outerEnd = polarToCartesian(cx, cy, outerR, startAngle);
    const innerStart = polarToCartesian(cx, cy, innerR, endAngle);
    const innerEnd = polarToCartesian(cx, cy, innerR, startAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return [
      `M ${outerStart.x} ${outerStart.y}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 0 ${outerEnd.x} ${outerEnd.y}`,
      `L ${innerEnd.x} ${innerEnd.y}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 1 ${innerStart.x} ${innerStart.y}`,
      "Z",
    ].join(" ");
  }

  function renderDonut() {
    const cx = 100;
    const cy = 100;
    const outerR = 80;
    const innerR = 50;
    const totalTasks = data.reduce((s, d) => s + d.value, 0);

    return (
      <div className="flex flex-col sm:flex-row items-center gap-4">
        {/* SVG donut — fixed width so it doesn't stretch on desktop */}
        <div className="w-full sm:w-[180px] shrink-0">
          <svg
            className="w-full h-auto"
            viewBox="0 0 200 200"
            role="img"
            aria-label={`Gráfico: ${title}`}
            aria-describedby={`chart-table-${id}`}
          >
            <title>{title}</title>
            {isEmpty ? (
              <>
                <circle
                  cx={cx}
                  cy={cy}
                  r={outerR}
                  fill="none"
                  stroke="#374151"
                  strokeWidth={outerR - innerR}
                />
                <text
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#6b7280"
                  fontSize={13}
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  Sin datos disponibles
                </text>
              </>
            ) : (
              <>
                {(() => {
                  let currentAngle = 0;
                  return data.map((d) => {
                    const angle = (d.percent / 100) * 360;
                    const segment = describeDonutSegment(
                      cx,
                      cy,
                      outerR,
                      innerR,
                      currentAngle,
                      currentAngle + angle,
                    );
                    const entry = (
                      <path
                        key={d.label}
                        d={segment}
                        fill={d.color}
                        tabIndex={0}
                        role="graphics-symbol"
                        aria-label={`${d.label}: ${d.value} tareas, ${d.percent.toFixed(1)}%`}
                        onMouseEnter={(e) => handleTooltipShow(e, d)}
                        onMouseLeave={handleTooltipHide}
                        onFocus={(e) => handleTooltipShow(e, d)}
                        onBlur={handleTooltipHide}
                        className="cursor-pointer focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
                      />
                    );
                    currentAngle += angle;
                    return entry;
                  });
                })()}
                <text
                  x={cx}
                  y={cy - 8}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#e5e7eb"
                  fontSize={22}
                  fontWeight={700}
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  {totalTasks}
                </text>
                <text
                  x={cx}
                  y={cy + 14}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#6b7280"
                  fontSize={11}
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  tareas
                </text>
              </>
            )}
          </svg>
        </div>
        {/* Leyenda a la derecha en desktop, centrada en móvil */}
        {!isEmpty && (
          <div className="flex flex-col gap-2 w-full sm:flex-1">
            {data.map((d) => (
              <div key={d.label} className="flex items-center gap-2.5">
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: d.color }}
                />
                <span className="text-xs text-muted-400 flex-1 truncate">{d.label}</span>
                <span className="text-xs font-semibold text-gray-200 tabular-nums">{d.value}</span>
                <span className="text-[11px] text-muted-500 tabular-nums w-10 text-right">
                  {d.percent.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderVerticalBar() {
    const viewW = 400;
    const viewH = 200;
    const topPad = 24;
    const bottomPad = 48;
    const sidePad = 16;
    const availableH = viewH - topPad - bottomPad;
    const numBars = data.length || 1;
    const slotW = (viewW - sidePad * 2) / numBars;
    const MIN_BAR_W = 24;
    const barW = Math.max(slotW * 0.6, MIN_BAR_W);
    // Re-derive the gap after clamping so barX positions remain correct
    const effectiveSlot = barW + Math.max(slotW * 0.4, 4);
    const barGap = effectiveSlot - barW;
    const maxValue = Math.max(...data.map((d) => d.value), 1);

    return (
      <svg
        className="w-full h-auto"
        viewBox={`0 0 ${viewW} ${viewH}`}
        role="img"
        aria-label={`Gráfico: ${title}`}
        aria-describedby={`chart-table-${id}`}
      >
        <title>{title}</title>
        {isEmpty ? (
          <text
            x={viewW / 2}
            y={viewH / 2}
            textAnchor="middle"
            fill="#6b7280"
            fontSize={13}
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            Sin datos disponibles
          </text>
        ) : (
          data.map((d, i) => {
            const barH = (d.value / maxValue) * availableH;
            const barX = sidePad + i * effectiveSlot + barGap / 2;
            const barY = topPad + (availableH - barH);
            const label = d.label.length > 10 ? d.label.slice(0, 10) + "..." : d.label;
            return (
              <g key={d.label}>
                {d.value > 0 && (
                  <text
                    x={barX + barW / 2}
                    y={barY - 4}
                    textAnchor="middle"
                    fill="#e5e7eb"
                    fontSize={11}
                    fontFamily="system-ui, -apple-system, sans-serif"
                  >
                    {d.value}
                  </text>
                )}
                <rect
                  x={barX}
                  y={barY}
                  width={barW}
                  height={barH}
                  rx={4}
                  fill={d.color}
                  tabIndex={0}
                  role="graphics-symbol"
                  aria-label={`${d.label}: ${d.value} tareas, ${d.percent.toFixed(1)}%`}
                  onMouseEnter={(e) => handleTooltipShow(e, d)}
                  onMouseLeave={handleTooltipHide}
                  onFocus={(e) => handleTooltipShow(e, d)}
                  onBlur={handleTooltipHide}
                  className="cursor-pointer focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
                />
                <text
                  x={barX + barW / 2}
                  y={topPad + availableH + 16}
                  textAnchor="middle"
                  fill="#9ca3af"
                  fontSize={11}
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  {label}
                </text>
              </g>
            );
          })
        )}
      </svg>
    );
  }

  function renderLineArea() {
    const viewW = 480;
    const viewH = 180;
    const top = 20;
    const right = 20;
    const bottom = 40;
    const left = 40;
    const plotW = viewW - left - right;
    const plotH = viewH - top - bottom;
    const numPoints = 8;
    const xStep = numPoints > 1 ? plotW / (numPoints - 1) : plotW;
    const maxCount = Math.max(...data.map((d) => d.value), 1);

    function yScale(count: number) {
      return plotH - (count / maxCount) * plotH;
    }

    const points = data.map((d, i) => ({
      x: left + i * xStep,
      y: top + yScale(d.value),
      ...d,
    }));

    const linePath =
      points.length > 0
        ? points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`).join(" ")
        : "";

    const areaPath =
      points.length > 0
        ? `${linePath} L ${points[points.length - 1].x},${top + plotH} L ${points[0].x},${top + plotH} Z`
        : "";

    return (
      <svg
        className="w-full h-auto"
        viewBox={`0 0 ${viewW} ${viewH}`}
        role="img"
        aria-label={`Gráfico: ${title}`}
        aria-describedby={`chart-table-${id}`}
      >
        <title>{title}</title>
        {isEmpty ? (
          <text
            x={viewW / 2}
            y={viewH / 2}
            textAnchor="middle"
            fill="#6b7280"
            fontSize={13}
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            Sin datos disponibles
          </text>
        ) : (
          <>
            {/* Y-axis guide lines */}
            {[0, 1, 2, 3].map((i) => {
              const value = (maxCount / 3) * i;
              const y = top + yScale(value);
              return (
                <g key={i}>
                  <line
                    x1={left}
                    y1={y}
                    x2={left + plotW}
                    y2={y}
                    stroke="#374151"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />
                  <text
                    x={left - 8}
                    y={y}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fill="#9ca3af"
                    fontSize={11}
                    fontFamily="system-ui, -apple-system, sans-serif"
                  >
                    {Math.round(value)}
                  </text>
                </g>
              );
            })}
            {/* Area fill */}
            <path d={areaPath} fill="hsl(264 100% 64% / 0.15)" />
            {/* Line */}
            <path
              d={linePath}
              fill="none"
              stroke="hsl(264 100% 64%)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Points */}
            {points.map((p, i) => (
              <g key={i}>
                {/* Larger invisible hit target for easier hover */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={12}
                  fill="transparent"
                  onMouseEnter={(e) => handleTooltipShow(e, p)}
                  onMouseLeave={handleTooltipHide}
                  tabIndex={0}
                  role="graphics-symbol"
                  aria-label={`${p.label}: ${p.value} tareas`}
                  onFocus={(e) => handleTooltipShow(e, p)}
                  onBlur={handleTooltipHide}
                  className="cursor-pointer focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
                />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={4}
                  fill="hsl(264 100% 64%)"
                  className="pointer-events-none"
                />
              </g>
            ))}
            {/* X-axis labels */}
            {points.map((p, i) => (
              <text
                key={i}
                x={p.x}
                y={top + plotH + 20}
                textAnchor="middle"
                fill="#9ca3af"
                fontSize={11}
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                {p.label}
              </text>
            ))}
          </>
        )}
      </svg>
    );
  }

  const chart =
    type === "horizontal-bar"
      ? renderHorizontalBar()
      : type === "donut"
        ? renderDonut()
        : type === "vertical-bar"
          ? renderVerticalBar()
          : renderLineArea();

  return (
    <div data-chart-wrapper className="relative">
      {chart}
      {tooltip.visible && (
        <div
          className="pointer-events-none absolute z-10 px-3 py-2 rounded-xl text-xs"
          style={{
            background: "#252F3E",
            border: "1px solid rgba(255,255,255,0.08)",
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -110%)",
            fontFamily: "system-ui, -apple-system, sans-serif",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}
          role="tooltip"
        >
          <p className="font-medium text-white mb-0.5">{tooltip.label}</p>
          <p className="text-muted-400">
            {tooltip.value} tareas
            {tooltip.percent > 0 && <> · {tooltip.percent.toFixed(1)}%</>}
          </p>
        </div>
      )}
      {insufficientWeeklyData && type === "line-area" && (
        <p className="text-xs text-muted-500 text-center mt-2">
          Datos insuficientes para mostrar tendencia
        </p>
      )}
      {/* sr-only table for accessibility */}
      <table className="sr-only" id={`chart-table-${id}`}>
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Categoría</th>
            <th scope="col">Cantidad</th>
            <th scope="col">Porcentaje</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <td>{d.label}</td>
              <td>{d.value}</td>
              <td>{d.percent.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
