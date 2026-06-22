import type { TaskContext, ToolDefinition } from "./types";
import type { RepoPromptContext } from "../utils/gitTypes";

/**
 * Función pura: construye el system prompt para el agente.
 * Recibe contexto de tarea + lista de herramientas + contexto de repo opcional
 * → produce el system prompt string.
 * Sin side effects, testeable en aislamiento.
 */
export function buildSystemPrompt(
  task: TaskContext,
  tools: ToolDefinition[],
  repoContext?: RepoPromptContext,
): string {
  const sections: string[] = [];

  // 1. Rol del agente
  sections.push(
    `## Rol\n\nEres Kiro, un asistente de tareas inteligente. Tu objetivo es completar la tarea asignada de forma precisa y eficiente, utilizando las herramientas disponibles cuando sea necesario.`,
  );

  // 2. Reglas de comportamiento
  sections.push(
    `## Reglas de Comportamiento\n\n- Usa las herramientas disponibles cuando necesites información o realizar acciones.\n- Reporta tu progreso publicando comentarios en la tarea.\n- No inventes información: si no tienes datos suficientes, indica qué falta.\n- Publica un comentario de progreso al INICIO indicando que comenzaste a trabajar.\n- Publica un comentario resumen al FINAL con lo que lograste o los problemas encontrados.`,
  );

  // 2.5. Contexto del repositorio (solo si está configurado)
  if (repoContext) {
    const repoLines = [
      `## Repositorio de Trabajo`,
      ``,
      `Estás trabajando en el repositorio local: ${repoContext.workingDir}`,
      `Rama actual: ${repoContext.currentBranch}`,
      ``,
      `### Estructura del proyecto (primer nivel)`,
      repoContext.directoryTree,
    ];

    if (repoContext.contextFiles.length > 0) {
      repoLines.push(``);
      repoLines.push(`### Ficheros de contexto relevantes`);
      repoLines.push(``);
      repoLines.push(...repoContext.contextFiles.map((f) => `- ${f}`));
    }

    sections.push(repoLines.join("\n"));
  }

  // 3. Feedback de revisión anterior (posición prioritaria, antes del detalle de tarea)
  if (task.reviewFeedback !== null) {
    sections.push(
      `## Feedback de Revisión Anterior (PRIORIDAD)\n\nLa tarea fue devuelta con el siguiente feedback. Debes abordar estos puntos antes de continuar:\n\n${task.reviewFeedback}`,
    );
  }

  // 4. Detalle completo de la tarea
  const dueDateLine = task.dueDate !== null ? `- **Fecha límite:** ${task.dueDate}` : "";
  sections.push(
    [
      `## Tarea Asignada`,
      ``,
      `- **Título:** ${task.title}`,
      `- **Descripción:** ${task.description}`,
      `- **Prioridad:** ${task.priority}`,
      `- **Categoría:** ${task.category}`,
      dueDateLine,
    ]
      .filter((line) => line !== "")
      .join("\n"),
  );

  // 5. Historial de comentarios
  if (task.comments.length > 0) {
    const commentLines = task.comments.map((c) => `- [${c.createdAt}] ${c.author}: ${c.content}`);
    sections.push(`## Comentarios Previos\n\n${commentLines.join("\n")}`);
  }

  // 6. Adjuntos
  if (task.attachments.length > 0) {
    const attachmentLines = task.attachments.map((a) => `- ${a.filename}`);
    sections.push(`## Adjuntos\n\n${attachmentLines.join("\n")}`);
  }

  // 7. Herramientas disponibles
  if (tools.length > 0) {
    const toolLines = tools.map((t) => `- **${t.name}**: ${t.description}`);
    sections.push(`## Herramientas Disponibles\n\n${toolLines.join("\n")}`);
  }

  return sections.join("\n\n");
}
