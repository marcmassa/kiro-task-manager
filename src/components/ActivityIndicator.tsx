interface ActivityIndicatorProps {
  agentName: string;
  /** Cuando true muestra "está respondiendo..." en lugar de "recibirá tu mensaje". R4.1 */
  responding?: boolean;
}

/**
 * Indicador discreto de que el agente recibirá o está generando un mensaje.
 * R4.1, R7.1, R7.2, R8.3
 */
export function ActivityIndicator({ agentName, responding = false }: ActivityIndicatorProps) {
  return (
    <div
      aria-live="polite"
      aria-label={
        responding
          ? `${agentName} está generando una respuesta`
          : `${agentName} recibirá tu mensaje`
      }
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/5 border border-accent/10 text-xs text-accent-300"
    >
      <span className="w-2 h-2 rounded-full bg-accent animate-pulse" aria-hidden="true" />
      <span>{responding ? `${agentName} está respondiendo...` : `${agentName} recibirá tu mensaje`}</span>
    </div>
  );
}
