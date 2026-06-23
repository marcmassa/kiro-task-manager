import type { RepoStatus } from "../types";

interface RepoStatusBadgeProps {
  status: RepoStatus;
  branch?: string | null;
}

const STATUS_STYLES: Record<RepoStatus, { badge: string; dot: string; label: string }> = {
  connected: {
    badge:
      "inline-flex items-center gap-1 rounded-full bg-success/10 border border-success/20 px-2 py-0.5 text-[10px] font-medium text-success-300",
    dot: "bg-success",
    label: "Conectado",
  },
  disconnected: {
    badge:
      "inline-flex items-center gap-1 rounded-full bg-warning/10 border border-warning/20 px-2 py-0.5 text-[10px] font-medium text-warning",
    dot: "bg-warning",
    label: "Desconectado",
  },
  error: {
    badge:
      "inline-flex items-center gap-1 rounded-full bg-danger/10 border border-danger/20 px-2 py-0.5 text-[10px] font-medium text-danger-400",
    dot: "bg-danger",
    label: "Error",
  },
  not_configured: {
    badge:
      "inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] font-medium text-muted-500",
    dot: "bg-muted-600",
    label: "No configurado",
  },
  cloning: {
    badge:
      "inline-flex items-center gap-1 rounded-full bg-accent/10 border border-accent/20 px-2 py-0.5 text-[10px] font-medium text-accent-300",
    dot: "bg-accent animate-pulse",
    label: "Clonando",
  },
};

export function RepoStatusBadge({ status, branch }: RepoStatusBadgeProps): JSX.Element {
  const style = STATUS_STYLES[status];

  return (
    <span className={style.badge} aria-label={`Estado del repositorio: ${style.label}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
      {style.label}
      {status === "connected" && branch && (
        <span className="ml-0.5 text-muted-400">({branch})</span>
      )}
    </span>
  );
}
