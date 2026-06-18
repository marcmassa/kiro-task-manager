interface ActivityIndicatorProps {
  agentName: string;
}

/**
 * Indicador discreto de que el agente recibirá el mensaje.
 * R7.1, R8.3
 */
export function ActivityIndicator({ agentName }: ActivityIndicatorProps) {
  return (
    <div
      aria-live="polite"
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/5 border border-accent/10 text-xs text-accent-300"
    >
      <span className="w-2 h-2 rounded-full bg-accent animate-pulse" aria-hidden="true" />
      <span>{agentName} recibirá tu mensaje</span>
    </div>
  );
}
