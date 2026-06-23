import type { TaskContext, ToolDefinition } from "./types";
import type { RepoPromptContext } from "../utils/gitTypes";
import type { SddPhase } from "../utils/sddLifecycle";
import { phaseLabel } from "../utils/sddLifecycle";

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

const SDD_PHASE_INSTRUCTIONS: Record<SddPhase, string> = {
  requirements: `Tu objetivo es ANALIZAR la tarea y producir una lista de REQUISITOS ESTRUCTURADOS.

El output debe seguir este formato:
- Lista numerada de requisitos funcionales
- Lista de requisitos no funcionales relevantes
- Criterios de aceptación claros

Sé preciso y exhaustivo. Este documento será validado por el usuario antes de proceder al diseño.`,

  design: `Tu objetivo es producir un DOCUMENTO DE DISEÑO TÉCNICO basado en los requisitos aprobados.

El output debe incluir:
- Arquitectura propuesta (componentes, módulos, interfaces)
- Decisiones técnicas clave y justificaciones
- Diagrama de flujo o pseudocódigo si aplica
- Consideraciones de rendimiento, seguridad o mantenibilidad

Este documento será validado por el usuario antes de proceder a las tareas de implementación.`,

  tasks: `Tu objetivo es descomponer el trabajo en TAREAS DE IMPLEMENTACIÓN concretas.

El output debe ser una lista de tareas en formato checklist:
- [ ] Cada tarea debe ser accionable y específica
- [ ] Incluye dependencias entre tareas si existen
- [ ] Estima la complejidad (S/M/L) de cada tarea
- [ ] Ordena las tareas por prioridad de implementación

Estas tareas serán validadas por el usuario antes de la fase de ejecución.`,

  execution: `Tu objetivo es EJECUTAR las tareas de implementación listadas en la descripción de la tarea.

- Trabaja en orden de las tareas definidas
- Usa las herramientas disponibles para leer y escribir código
- Reporta progreso con comentarios
- Al finalizar, resume qué se implementó, qué se omitió y por qué`,
};

/**
 * Builds a phase-specific prompt for SDD mode. Used by the agent engine when
 * processing an SDD phase instead of the general `buildSystemPrompt`.
 */
export function buildSddPhasePrompt(
  phase: SddPhase,
  task: TaskContext,
  tools: ToolDefinition[],
  priorOutputs: Array<{ phase: SddPhase; output: string }>,
  repoContext?: RepoPromptContext,
): string {
  const sections: string[] = [];

  sections.push(
    `## Rol\n\nEres Kiro, un asistente de software que trabaja siguiendo el proceso SDD (Spec-Driven Development). Estás en la fase: **${phaseLabel(phase)}**.`,
  );

  sections.push(
    `## Reglas de Comportamiento SDD\n\n- Produce un output estructurado específico para esta fase.\n- NO ejecutes código ni implementes en esta fase si aún estás en requirements, design o tasks.\n- Publica un comentario al inicio indicando que comenzaste la fase.\n- Tu respuesta final DEBE ser el documento de la fase, sin explicaciones adicionales.`,
  );

  if (repoContext) {
    sections.push(
      [
        `## Repositorio de Trabajo`,
        ``,
        `Directorio: ${repoContext.workingDir}`,
        `Rama: ${repoContext.currentBranch}`,
        ``,
        repoContext.directoryTree,
      ].join("\n"),
    );
  }

  const dueDateLine = task.dueDate !== null ? `- **Fecha límite:** ${task.dueDate}` : "";
  sections.push(
    [
      `## Tarea`,
      ``,
      `- **Título:** ${task.title}`,
      `- **Descripción:** ${task.description}`,
      `- **Prioridad:** ${task.priority}`,
      `- **Categoría:** ${task.category}`,
      dueDateLine,
    ]
      .filter((l) => l !== "")
      .join("\n"),
  );

  if (priorOutputs.length > 0) {
    const outputSections = priorOutputs.map(
      (p) => `### Output de ${phaseLabel(p.phase)} (aprobado)\n\n${p.output}`,
    );
    sections.push(`## Contexto de Fases Anteriores\n\n${outputSections.join("\n\n")}`);
  }

  sections.push(
    `## Instrucciones de la Fase: ${phaseLabel(phase)}\n\n${SDD_PHASE_INSTRUCTIONS[phase]}`,
  );

  if (tools.length > 0) {
    const toolLines = tools.map((t) => `- **${t.name}**: ${t.description}`);
    sections.push(`## Herramientas Disponibles\n\n${toolLines.join("\n")}`);
  }

  return sections.join("\n\n");
}

/**
 * Función pura: construye el system prompt para el modo chat conversacional.
 * Se usa cuando el agente responde a mensajes del usuario en una tarea con
 * ejecución activa, sin ejecutar herramientas de edición de ficheros.
 *
 * R3.1, R3.2, R3.3, R3.4
 */
export function buildChatPrompt(taskContext: TaskContext, phaseOutput?: string): string {
  const sections: string[] = [];

  sections.push(
    `## Rol\n\nEres Kiro, un asistente de tareas. Estás en **modo conversación**: responde las preguntas del usuario sobre esta tarea, su estado, tu plan o tus outputs anteriores.\n\nIMPORTANTE: En este modo NO editas ficheros, NO haces commits, NO ejecutas código. Solo respondes preguntas de forma clara y concisa en español.`,
  );

  const dueDateLine = taskContext.dueDate ? `- **Fecha límite:** ${taskContext.dueDate}` : "";
  sections.push(
    [
      `## Tarea en Curso`,
      ``,
      `- **Título:** ${taskContext.title}`,
      `- **Descripción:** ${taskContext.description}`,
      `- **Prioridad:** ${taskContext.priority}`,
      `- **Categoría:** ${taskContext.category}`,
      dueDateLine,
    ]
      .filter((l) => l !== "")
      .join("\n"),
  );

  if (phaseOutput) {
    sections.push(`## Último Output de Fase Aprobado\n\n${phaseOutput}`);
  }

  sections.push(
    `## Instrucciones de Respuesta\n\n- Responde siempre en español.\n- Sé conciso: una respuesta de 2-5 frases suele ser suficiente.\n- Si el usuario pide algo que requiere editar código, explica que eso se hace a través del ciclo de ejecución de tarea (aprobar / solicitar cambios), no en el chat.\n- Si no tienes suficiente información para responder, indícalo con claridad.`,
  );

  return sections.join("\n\n");
}
