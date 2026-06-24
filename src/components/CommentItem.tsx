import type { Comment, AgentState } from "../types";
import { useT } from "../i18n/useT";
import i18n from "../i18n";

const LOCALE_MAP: Record<string, string> = { es: "es-ES", en: "en-GB" };

interface CommentItemProps {
  comment: Comment;
  isAgent: boolean;
  agentState?: AgentState | null;
}

/**
 * Renderiza un comentario individual con estilo diferenciado según autoría.
 * - Agente: fondo accent/10, borde izquierdo accent, icono robot, etiqueta agente
 * - Humano: fondo surface-400/50, estilo estándar
 * R4.1, R4.2, R8.1, R8.2
 */
export function CommentItem({ comment, isAgent }: CommentItemProps) {
  const t = useT();
  const locale = LOCALE_MAP[i18n.language] ?? "es-ES";
  const formattedDate = new Date(comment.created_at).toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isAgent) {
    return (
      <article
        role="article"
        aria-label={`Comentario de ${comment.author}, ${formattedDate}`}
        className="flex gap-3 p-3 rounded-xl bg-accent/10 border-l-2 border-accent"
      >
        {/* Robot avatar */}
        <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center shrink-0 mt-0.5">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-accent-300"
          >
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <circle cx="12" cy="5" r="3" />
            <line x1="12" y1="8" x2="12" y2="11" />
            <circle cx="8" cy="16" r="1.5" fill="currentColor" />
            <circle cx="16" cy="16" r="1.5" fill="currentColor" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-accent-300">{comment.author}</span>
            <span className="inline-flex items-center rounded-full bg-accent/20 px-1.5 py-0.5 text-[9px] font-medium text-accent-300 uppercase tracking-wide">
              {t("agent.label")}
            </span>
            <span className="text-[10px] text-muted-500">{formattedDate}</span>
          </div>
          <p className="text-sm text-gray-200 whitespace-pre-wrap">{comment.content}</p>
        </div>
      </article>
    );
  }

  // Human comment
  return (
    <article
      role="article"
      aria-label={`Comentario de ${comment.author}, ${formattedDate}`}
      className="flex gap-3 p-3 rounded-xl bg-surface-400/50"
    >
      {/* User avatar */}
      <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-muted-400"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-muted-300">{comment.author}</span>
          <span className="text-[10px] text-muted-500">{formattedDate}</span>
        </div>
        <p className="text-sm text-gray-300 whitespace-pre-wrap">{comment.content}</p>
      </div>
    </article>
  );
}
