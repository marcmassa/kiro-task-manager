import type { RepoStatus } from "../types";
import { useT } from "../i18n/useT";

interface RepoStatusBadgeProps {
  status: RepoStatus;
  branch?: string | null;
}

const STATUS_STYLES: Record<RepoStatus, { badge: string; dot: string }> = {
  connected: {
    badge:
      "inline-flex items-center gap-1 rounded-full bg-success/10 border border-success/20 px-2 py-0.5 text-[10px] font-medium text-success-300",
    dot: "bg-success",
  },
  disconnected: {
    badge:
      "inline-flex items-center gap-1 rounded-full bg-warning/10 border border-warning/20 px-2 py-0.5 text-[10px] font-medium text-warning",
    dot: "bg-warning",
  },
  error: {
    badge:
      "inline-flex items-center gap-1 rounded-full bg-danger/10 border border-danger/20 px-2 py-0.5 text-[10px] font-medium text-danger-400",
    dot: "bg-danger",
  },
  not_configured: {
    badge:
      "inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] font-medium text-muted-500",
    dot: "bg-muted-600",
  },
  cloning: {
    badge:
      "inline-flex items-center gap-1 rounded-full bg-accent/10 border border-accent/20 px-2 py-0.5 text-[10px] font-medium text-accent-300",
    dot: "bg-accent animate-pulse",
  },
};

const STATUS_KEY: Record<RepoStatus, string> = {
  connected: "repo.statusConnected",
  disconnected: "repo.statusDisconnected",
  error: "repo.statusError",
  not_configured: "repo.statusNotConfigured",
  cloning: "repo.statusCloning",
};

export function RepoStatusBadge({ status, branch }: RepoStatusBadgeProps): JSX.Element {
  const t = useT();
  const style = STATUS_STYLES[status];
  const label = t(STATUS_KEY[status] as Parameters<typeof t>[0]);

  return (
    <span className={style.badge} aria-label={t("repo.statusLabel", { status: label })}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
      {label}
      {status === "connected" && branch && (
        <span className="ml-0.5 text-muted-400">({branch})</span>
      )}
    </span>
  );
}
