<div align="center">

<img src="public/banner.svg" alt="workshop-kiro — Task Manager" width="820"/>

<br/>

![Bun](https://img.shields.io/badge/Bun-%E2%89%A51.3-black?style=flat-square&logo=bun&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react&logoColor=black)
![Elysia](https://img.shields.io/badge/Elysia-1.x-7c5cfc?style=flat-square&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-WAL-003b57?style=flat-square&logo=sqlite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06b6d4?style=flat-square&logo=tailwindcss&logoColor=white)

</div>

---

Aplicación web de gestión de tareas estilo Kanban con agente IA integrado. Interfaz en español. Construida con Bun, Elysia, React y SQLite. Desarrollada como proyecto de taller para demostrar el flujo de trabajo **Harness SDD** con Kiro como IDE principal.

---

## Índice

1. [Vista general](#1-vista-general)
2. [Características](#2-características)
3. [Arquitectura](#3-arquitectura)
4. [Estructura del repositorio](#4-estructura-del-repositorio)
5. [Primeros pasos](#5-primeros-pasos)
6. [Comandos disponibles](#6-comandos-disponibles)
7. [API REST](#7-api-rest)
8. [Base de datos](#8-base-de-datos)
9. [Frontend](#9-frontend)
10. [Tests](#10-tests)
11. [Convenciones del proyecto](#11-convenciones-del-proyecto)
12. [Historial de features](#12-historial-de-features)
13. [Flujo de desarrollo (Harness SDD)](#13-flujo-de-desarrollo-harness-sdd)

---

## 1. Vista general

Task Manager es un tablero Kanban monorepositorio de paquete único con un agente IA capaz de ejecutar tareas de forma autónoma. El backend (Elysia + SQLite) y el frontend (React + Tailwind CSS) conviven bajo `task-manager/`. No hay servidor de desarrollo separado: Bun gestiona el build, el runtime y los tests.

```
Browser (React SPA) ◄──REST/JSON──► Elysia :3000 ──bun:sqlite──► tasks.db
                                          │
                                          └──► Agent Engine (loop interno)
                                                    │
                                                    └──► Proveedor IA (Anthropic / OpenAI / …)
```

**Tecnologías principales:**

| Capa         | Tecnología                        |
| ------------ | --------------------------------- |
| Runtime      | Bun ≥ 1.3                         |
| Backend      | Elysia 1.x                        |
| Persistencia | SQLite (`bun:sqlite`, modo WAL)   |
| Frontend     | React 18 + Tailwind CSS 3         |
| Build        | `bun build` (sin webpack ni Vite) |
| Tests        | `bun:test` + `fast-check`         |
| Lenguaje     | TypeScript modo estricto          |
| Agente IA    | Loop interno + MCP + tool-use     |

---

## 2. Características

### Kanban y tareas

- **Tablero Kanban** con columnas estándar (_Por Hacer_, _En Progreso_, _Completadas_) y columnas personalizadas por workspace.
- **Drag-and-drop nativo** (HTML5) con rollback optimista en caso de error del servidor.
- **CRUD completo de tareas**: título, descripción, prioridad, categoría, fecha de vencimiento.
- **Indicadores visuales de urgencia**: rojo si atrasada, naranja si vence hoy.
- **Multi-workspace**: espacios de trabajo independientes con su propio tablero, columnas y repositorio Git.

### Agente IA (Kiro)

- **Motor de agente autónomo** con ciclo SDD multi-fase: _requirements_ → _design_ → _tasks_ → _execution_.
- **Gate de aprobación humana**: el agente nunca puede marcar `done`; solo el usuario aprueba.
- **Chat conversacional** en tiempo real con el agente mientras la tarea está activa.
- **Soporte multi-proveedor**: Anthropic, OpenAI, Google Gemini, AWS Bedrock, Ollama — API key cifrada en reposo.
- **Tool-use**: herramientas de lectura y escritura de ficheros del repositorio, árbol de directorio, cambios Git.
- **Registro MCP**: gestión de servidores MCP externos con validación, prueba de conexión y generación de `mcp.json`.

### Estadísticas y configuración

- **Dashboard de estadísticas** con KPIs, gráficos SVG nativos y cumplimiento de fechas.
- **Explorador de repositorio Git** con árbol de ficheros, visor con syntax highlighting y feed de cambios.
- **Configuración**: nombre del workspace, idioma, zona horaria, notificaciones, exportación de datos.
- **Integración con Linear**: conectar, sincronizar y desconectar. API key almacenada cifrada (AES-GCM + PBKDF2).

### Calidad

- **427 tests** — 0 fallos (`bun:test` + `fast-check` property tests).
- **Accesibilidad**: HTML semántico, navegación por teclado, `aria-label` en botones de ícono, contraste mínimo 4.5:1.

---

## 3. Arquitectura

### Diagrama de componentes

```
┌─────────────────────────────────────────────┐      ┌────────────────────────────────────────┐
│  Browser — React SPA                        │ HTTP │  Elysia server (puerto 3000)           │
│                                             │◄────►│                                        │
│  ├── HomePage                               │ JSON │  /api/tasks           (CRUD + estados) │
│  ├── KanbanBoard                            │ REST │  /api/tasks/:id/execution  (agente)    │
│  │     ├── KanbanColumn × N                 │      │  /api/tasks/:id/comments               │
│  │     └── TaskCard                         │      │  /api/tasks/:id/attachments            │
│  ├── StatsDashboard                         │      │  /api/ai-provider     (config IA)      │
│  │     └── ChartRenderer                    │      │  /api/agent/status|config|run           │
│  ├── SettingsPage                           │      │  /api/mcp-servers                      │
│  │     ├── AIProviderSection                │      │  /api/workspace/repo|file|tree|git      │
│  │     ├── AgentEngineSection               │      │  /api/workspaces      (multi-ws)       │
│  │     └── MCPRegistrySection               │      │  /api/categories|priorities|settings    │
│  └── Modales (TaskModal, TaskDetailModal,   │      │  /api/integrations/linear              │
│        ConfirmDialog, CreateWorkspaceModal) │      │  SPA fallback → index.html             │
└─────────────────────────────────────────────┘      └──────────────┬─────────────────────────┘
                                                                    │ bun:sqlite
                                                                    ▼
                                              ┌─────────────────────────────────────────────┐
                                              │  tasks.db (WAL mode)                        │
                                              │  ├── tasks / comments / categories           │
                                              │  ├── priorities / workspace_settings         │
                                              │  ├── agent_executions / agents               │
                                              │  ├── agent_engine_config                     │
                                              │  ├── ai_provider_config / mcp_servers        │
                                              │  ├── workspaces / workspace_columns          │
                                              │  └── integration_connections / attachments   │
                                              └─────────────────────────────────────────────┘
```

### Principios arquitectónicos

- **Spec-first (Harness SDD):** toda feature con `"sdd": true` pasa por `requirements.md` → `design.md` → `tasks.md` con aprobación humana antes de tocar código.
- **Una feature a la vez:** máximo un feature `in_progress` simultáneamente.
- **Lógica pura separada de React:** los cálculos de dominio son funciones puras sin dependencias de React, testeables con `fast-check`.
- **Nativo sobre dependencia:** sin librerías de gráficos externas (SVG + Tailwind) ni polyfills de Node.
- **Coherencia visual:** todos los componentes usan la paleta definida en `.kiro/steering/ux-design.md`.

---

## 4. Estructura del repositorio

```
workshop-kiro/
├── task-manager/                # Aplicación principal (ver §4.1)
├── infra/                       # CDK Python — fuera de scope
├── .kiro/
│   ├── steering/                # Convenciones auto-cargadas por Kiro
│   ├── hooks/                   # Pre/post-write hooks
│   ├── skills/                  # Skills de Kiro (frontend-design, etc.)
│   └── specs/                   # Specs SDD de features (FEAT-001 … FEAT-013)
├── .agents/                     # Framework Harness SDD
│   ├── agentic.json
│   ├── subagents/
│   ├── commands/
│   ├── adapters/
│   └── harness/
├── progress/
│   ├── progress.md              # Historial append-only de features completadas
│   ├── decisions.md             # ADRs ligeros
│   └── impl_*.md                # Logs de trazabilidad R↔test por feature
├── AGENTS.md
├── DESIGN.md
├── feature_list.json            # Manifiesto de features con estado y specDir
├── check.sh                     # Verificación integral
└── README.md
```

### 4.1 Estructura de `task-manager/`

```
task-manager/
├── server.ts                    # Servidor Elysia, rutas API, archivos estáticos
├── db/
│   └── database.ts              # Schema SQLite, seed, migraciones
├── src/
│   ├── index.tsx                # Punto de entrada React
│   ├── App.tsx                  # Shell, routing, estado global
│   ├── types.ts                 # Interfaces TypeScript compartidas
│   ├── api.ts                   # Cliente REST (una función por endpoint)
│   ├── Icons.tsx                # Componentes SVG de íconos
│   ├── styles.css               # Directivas Tailwind + CSS personalizado
│   ├── components/
│   │   ├── HomePage.tsx         # Landing: mascota, stats rápidas, accesos
│   │   ├── KiroMascot.tsx       # Mascota SVG (base + variaciones de estado)
│   │   ├── KiroIllustration.tsx # Ilustraciones contextuales de Kiro
│   │   ├── KanbanBoard.tsx      # Board container + columnas
│   │   ├── KanbanColumn.tsx     # Columna drop target
│   │   ├── TaskCard.tsx         # Tarjeta con estado de agente + drag
│   │   ├── TaskModal.tsx        # Formulario creación/edición
│   │   ├── TaskDetailModal.tsx  # Detalle + comentarios + adjuntos + agente
│   │   ├── ActivityIndicator.tsx# Indicador de actividad del agente
│   │   ├── CommentItem.tsx      # Comentario (usuario vs. agente diferenciados)
│   │   ├── StatsDashboard.tsx   # KPIs + 4 gráficos SVG
│   │   ├── ChartRenderer.tsx    # Primitivas SVG: barra, donut, línea-área
│   │   ├── SettingsPage.tsx     # Configuración general (tabs)
│   │   ├── AIProviderSection.tsx# Config proveedor IA + test de conexión
│   │   ├── AgentEngineSection.tsx# Motor del agente: toggle, params, ciclo
│   │   ├── MCPRegistrySection.tsx# Registro servidores MCP
│   │   ├── WorkspaceGitSection.tsx # Explorador Git + visor de ficheros
│   │   ├── IntegrationCard.tsx  # Tarjeta reutilizable para integraciones
│   │   ├── CreateWorkspaceModal.tsx# Modal multi-paso creación de workspace
│   │   ├── ConfirmDialog.tsx    # Diálogo confirmación accesible
│   │   └── SectionHeader.tsx    # Cabecera de sección reutilizable
│   ├── agent/
│   │   ├── engine.ts            # AgentEngine: loop, runCycle, chat, SDD
│   │   ├── types.ts             # Tipos del agente (Message, ToolCall, …)
│   │   ├── systemPrompt.ts      # buildSystemPrompt, buildChatPrompt
│   │   ├── toolRouter.ts        # Enrutador de herramientas MCP/internas
│   │   ├── engine.test.ts       # Tests unitarios del engine
│   │   └── engine.integration.test.ts
│   └── utils/
│       ├── helpers.ts
│       ├── statsCalculator.ts   # Cálculos puros + tests co-localizados
│       ├── crypto.ts            # AES-GCM + PBKDF2
│       ├── sddKanban.ts         # effectiveColumn(): lógica de columna Kanban
│       ├── columnColors.ts      # Tokens de color por columna
│       ├── linearClient.ts      # Cliente GraphQL Linear
│       └── settingsHandlers.ts  # Handlers de servidor (testeables)
├── public/
│   ├── index.html               # Shell SPA
│   ├── banner.svg               # Banner del README
│   ├── styles.css               # CSS compilado
│   └── dist/                    # Bundle frontend (bun build)
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## 5. Primeros pasos

### Prerrequisitos

- [Bun](https://bun.sh) ≥ 1.3
- Node.js no es necesario (Bun lo sustituye)

### Instalación

```bash
cd task-manager
bun install
```

### Levantar el servidor de desarrollo

```bash
bun run dev
# Disponible en http://localhost:3000
```

El primer arranque crea `tasks.db` automáticamente y siembra datos de ejemplo (tareas, categorías, prioridades, comentarios y configuración de workspace).

### Build del frontend

```bash
bun run build
# Genera public/dist/index.js (~2.5 MB)
```

---

## 6. Comandos disponibles

Todos los comandos se ejecutan desde el directorio `task-manager/`.

| Comando                | Descripción                                     |
| ---------------------- | ----------------------------------------------- |
| `bun run dev`          | Arranca el servidor en el puerto 3000           |
| `bun run build`        | Compila el frontend a `public/dist/`            |
| `bun test`             | Ejecuta la suite de tests (427 tests, 0 fallos) |
| `bun run format`       | Formatea con Prettier                           |
| `bun run format:check` | Verifica formato sin modificar archivos         |

Desde la raíz del repositorio:

```bash
./check.sh   # Verificación integral: tests + build + formato + specs + harness
```

---

## 7. API REST

Base URL: `http://localhost:3000/api`

### Tareas

| Método   | Ruta                     | Descripción                                                      |
| -------- | ------------------------ | ---------------------------------------------------------------- |
| `GET`    | `/tasks`                 | Lista todas las tareas con prioridad y categoría embebidas       |
| `GET`    | `/tasks/:id`             | Obtiene una tarea por ID                                         |
| `POST`   | `/tasks`                 | Crea una tarea nueva                                             |
| `PUT`    | `/tasks/:id`             | Actualiza una tarea completa                                     |
| `PATCH`  | `/tasks/:id/status`      | Actualiza el estado (`todo` / `in_progress` / `done`)            |
| `PATCH`  | `/tasks/:id/column`      | Mueve la tarea a cualquier columna (estándar o personalizada)    |
| `PUT`    | `/tasks/:id/description` | Actualiza la descripción (usado por el agente para el checklist) |
| `DELETE` | `/tasks/:id`             | Elimina la tarea y sus datos relacionados (CASCADE)              |
| `DELETE` | `/tasks/all`             | Elimina todas las tareas del workspace                           |

### Comentarios

| Método | Ruta                  | Descripción                    |
| ------ | --------------------- | ------------------------------ |
| `GET`  | `/tasks/:id/comments` | Lista comentarios de una tarea |
| `POST` | `/tasks/:id/comments` | Añade un comentario            |

### Adjuntos

| Método   | Ruta                        | Descripción                     |
| -------- | --------------------------- | ------------------------------- |
| `GET`    | `/tasks/:id/attachments`    | Lista los adjuntos de una tarea |
| `POST`   | `/tasks/:id/attachments`    | Sube un adjunto (multipart)     |
| `GET`    | `/attachments/:id/download` | Descarga un adjunto             |
| `DELETE` | `/attachments/:id`          | Elimina un adjunto              |

### Agente IA

| Método | Ruta                                   | Descripción                                        |
| ------ | -------------------------------------- | -------------------------------------------------- |
| `GET`  | `/agents`                              | Lista los agentes registrados                      |
| `GET`  | `/executions`                          | Lista todas las ejecuciones                        |
| `POST` | `/tasks/:id/assign`                    | Asigna la tarea al agente (`assigned`)             |
| `GET`  | `/tasks/:id/execution`                 | Estado actual de la ejecución                      |
| `POST` | `/tasks/:id/execution/approve`         | Aprueba la entrega final → `done`                  |
| `POST` | `/tasks/:id/execution/approve-phase`   | Aprueba la fase SDD actual y avanza a la siguiente |
| `POST` | `/tasks/:id/execution/request-changes` | Solicita cambios al agente con feedback            |
| `GET`  | `/agent/status`                        | Estado del motor del agente (idle/working/error)   |
| `GET`  | `/agent/config`                        | Configuración del motor (poll, límites, autoStart) |
| `PUT`  | `/agent/config`                        | Actualiza la configuración del motor               |
| `POST` | `/agent/run`                           | Dispara un ciclo del agente manualmente            |

### Proveedor de IA

| Método   | Ruta                    | Descripción                                |
| -------- | ----------------------- | ------------------------------------------ |
| `GET`    | `/ai-provider`          | Configuración activa (sin exponer API key) |
| `PUT`    | `/ai-provider`          | Guarda proveedor, modelo y API key cifrada |
| `DELETE` | `/ai-provider`          | Elimina la configuración del proveedor     |
| `POST`   | `/ai-provider/test`     | Prueba la conexión con el proveedor        |
| `GET`    | `/ai-provider/registry` | Lista de proveedores soportados            |

### Servidores MCP

| Método   | Ruta                      | Descripción                               |
| -------- | ------------------------- | ----------------------------------------- |
| `GET`    | `/mcp-servers`            | Lista los servidores MCP registrados      |
| `POST`   | `/mcp-servers`            | Añade un servidor MCP                     |
| `PATCH`  | `/mcp-servers/:id`        | Actualiza la configuración de un servidor |
| `DELETE` | `/mcp-servers/:id`        | Elimina un servidor                       |
| `POST`   | `/mcp-servers/:id/toggle` | Activa o desactiva un servidor            |
| `POST`   | `/mcp-servers/:id/test`   | Prueba la conexión con el servidor        |
| `POST`   | `/mcp-servers/apply`      | Regenera el fichero `mcp.json`            |

### Workspace y ficheros

| Método   | Ruta                       | Descripción                                       |
| -------- | -------------------------- | ------------------------------------------------- |
| `GET`    | `/workspace/repo`          | Configuración del repositorio Git                 |
| `PUT`    | `/workspace/repo`          | Asocia / actualiza el repositorio Git             |
| `POST`   | `/workspace/repo/validate` | Valida que la ruta es un repo Git válido          |
| `GET`    | `/workspace/tree`          | Árbol de ficheros del repositorio                 |
| `GET`    | `/workspace/file`          | Contenido de un fichero (con syntax highlighting) |
| `PUT`    | `/workspace/file`          | Escribe un fichero                                |
| `POST`   | `/workspace/upload`        | Sube un fichero al repositorio                    |
| `GET`    | `/workspace/changes`       | Feed de cambios del agente                        |
| `GET`    | `/workspace/git/status`    | Estado Git (`git status`)                         |
| `POST`   | `/workspace/git/stage`     | Añade ficheros al staging                         |
| `POST`   | `/workspace/git/unstage`   | Retira ficheros del staging                       |
| `POST`   | `/workspace/git/commit`    | Crea un commit                                    |
| `POST`   | `/workspace/git/push`      | Push al remoto                                    |
| `POST`   | `/workspace/git/pull`      | Pull del remoto                                   |
| `GET`    | `/workspace/git/branches`  | Lista de ramas                                    |
| `POST`   | `/workspace/git/checkout`  | Cambia de rama                                    |
| `GET`    | `/tasks/:id/files`         | Ficheros referenciados por una tarea              |
| `POST`   | `/tasks/:id/files`         | Asocia un fichero a una tarea                     |
| `DELETE` | `/tasks/:id/files/:fileId` | Desasocia un fichero de una tarea                 |
| `GET`    | `/tasks/:id/changes`       | Cambios del agente en una tarea específica        |

### Multi-workspace

| Método   | Ruta                      | Descripción                              |
| -------- | ------------------------- | ---------------------------------------- |
| `GET`    | `/workspaces`             | Lista todos los workspaces               |
| `GET`    | `/workspaces/:id`         | Obtiene un workspace por ID              |
| `POST`   | `/workspaces`             | Crea un workspace nuevo                  |
| `PUT`    | `/workspaces/:id`         | Actualiza un workspace                   |
| `DELETE` | `/workspaces/:id`         | Elimina un workspace                     |
| `POST`   | `/workspaces/:id/seed`    | Siembra datos de ejemplo en el workspace |
| `GET`    | `/workspaces/:id/tree`    | Árbol del repositorio del workspace      |
| `GET`    | `/workspaces/:id/files/*` | Fichero del repositorio del workspace    |
| `PUT`    | `/workspaces/:id/files/*` | Escribe fichero en el workspace          |

### Catálogos y configuración

| Método   | Ruta                           | Descripción                              |
| -------- | ------------------------------ | ---------------------------------------- |
| `GET`    | `/categories`                  | Lista de categorías                      |
| `GET`    | `/priorities`                  | Lista de prioridades                     |
| `GET`    | `/settings`                    | Configuración general                    |
| `PATCH`  | `/settings/workspace`          | Actualiza nombre, idioma, zona horaria   |
| `PATCH`  | `/settings/notifications`      | Actualiza preferencias de notificación   |
| `GET`    | `/integrations/linear`         | Estado de la conexión con Linear         |
| `POST`   | `/integrations/linear/connect` | Conecta con una API key de Linear        |
| `POST`   | `/integrations/linear/sync`    | Sincroniza tareas desde Linear           |
| `DELETE` | `/integrations/linear`         | Desconecta Linear                        |
| `GET`    | `/export`                      | Descarga el workspace completo como JSON |

> **Seguridad:** la API key de Linear y la del proveedor de IA nunca aparecen en ninguna respuesta. Se almacenan cifradas (AES-GCM, clave derivada con PBKDF2). Este invariante está cubierto por tests de propiedad con `fast-check`.

---

## 8. Base de datos

SQLite en modo WAL. El archivo `tasks.db` se crea automáticamente al primer arranque. El schema completo vive en `db/database.ts`.

### Tablas principales

**`tasks`** — Tareas del workspace

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
title TEXT NOT NULL
description TEXT DEFAULT ''
status TEXT NOT NULL DEFAULT 'todo'   -- CHECK: todo | in_progress | done
sdd_phase TEXT                         -- fase SDD activa o columna personalizada
priority_id INTEGER NOT NULL           -- FK → priorities
category_id INTEGER NOT NULL           -- FK → categories
due_date TEXT                          -- ISO 8601
workspace_id INTEGER NOT NULL DEFAULT 1
```

**`comments`**

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
task_id INTEGER NOT NULL   -- FK → tasks ON DELETE CASCADE
content TEXT NOT NULL
author TEXT NOT NULL DEFAULT 'Usuario'
created_at TEXT NOT NULL DEFAULT (datetime('now'))
```

**`agent_executions`** — Estado del ciclo de vida del agente

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
task_id INTEGER NOT NULL UNIQUE   -- FK → tasks
agent_id TEXT NOT NULL DEFAULT 'kiro'
state TEXT NOT NULL                -- assigned | agent_working | pending_review | changes_requested | done
sdd_phase TEXT                     -- requirements | design | tasks | null
phase_output TEXT                  -- último output SDD aprobado
review_feedback TEXT
```

**`agent_engine_config`** — Singleton de configuración del motor

```sql
auto_start INTEGER DEFAULT 0
poll_interval_ms INTEGER DEFAULT 30000
max_iterations INTEGER DEFAULT 50
max_retries INTEGER DEFAULT 3
tool_timeout_ms INTEGER DEFAULT 30000
max_chat_turns_per_execution INTEGER DEFAULT 10
```

**`ai_provider_config`**

```sql
provider TEXT NOT NULL             -- anthropic | openai | google | bedrock | ollama
model TEXT NOT NULL
api_key_encrypted TEXT             -- AES-GCM cifrado, base64
base_url TEXT
temperature REAL DEFAULT 0.7
max_tokens INTEGER DEFAULT 4096
```

**`mcp_servers`**

```sql
id TEXT PRIMARY KEY                -- UUID
name TEXT NOT NULL
command TEXT NOT NULL
args TEXT NOT NULL DEFAULT '[]'    -- JSON array
env TEXT NOT NULL DEFAULT '{}'     -- JSON object (cifrado en reposo)
enabled INTEGER DEFAULT 1
```

**`workspaces`**

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
name TEXT NOT NULL
repo_path TEXT
repo_remote_url TEXT
repo_default_branch TEXT DEFAULT 'main'
repo_status TEXT DEFAULT 'not_configured'
```

**`workspace_columns`** — Columnas personalizadas del Kanban

```sql
id TEXT PRIMARY KEY
workspace_id INTEGER NOT NULL
name TEXT NOT NULL
position INTEGER NOT NULL
color TEXT NOT NULL DEFAULT '#7c5cfc'
```

---

## 9. Frontend

### Páginas

| Ruta        | Componente       | Descripción                                                                 |
| ----------- | ---------------- | --------------------------------------------------------------------------- |
| `/`         | `HomePage`       | Landing: mascota Kiro, resumen de stats, workspace activo y accesos rápidos |
| `/kanban`   | `KanbanBoard`    | Tablero Kanban con columnas estándar + personalizadas y drag-and-drop       |
| `/stats`    | `StatsDashboard` | Dashboard de productividad con KPIs y gráficos                              |
| `/settings` | `SettingsPage`   | Configuración: workspace, proveedor IA, motor, MCP, Git, Linear, datos      |

El routing es client-side (estado en `App.tsx`); el servidor sirve `index.html` para cualquier ruta no-API.

### Paleta de colores (AWS-inspired)

| Token         | Valor     | Uso                                           |
| ------------- | --------- | --------------------------------------------- |
| `accent`      | `#7c5cfc` | Botones primarios, enlaces, estados activos   |
| `accent-300`  | `#b4a5fd` | Sparkles, acentos suaves                      |
| `aws-orange`  | `#FF9900` | Hover call-to-action, prioridad media         |
| `surface`     | `#1a1b26` | Fondo principal de la app                     |
| `surface-500` | `#111219` | Fondo de modales y paneles secundarios        |
| `success`     | `#10b981` | Tareas completadas, prioridad baja, check SDD |
| `danger`      | `#ef4444` | Tareas atrasadas, errores, prioridad alta     |
| `warning`     | `#f59e0b` | Prioridad media, estados intermedios          |
| `squid`       | `#252F3E` | Navbar, sidebar, hero gradient                |

### Estado del agente en la UI

Las tarjetas del Kanban y el modal de detalle muestran visualmente el estado de la ejecución:

| Estado              | Indicador visual                                             |
| ------------------- | ------------------------------------------------------------ |
| `assigned`          | Badge azul "Asignado"                                        |
| `agent_working`     | Spinner + "Kiro está trabajando…"                            |
| `pending_review`    | Badge naranja "Revisión pendiente" + botones Aprobar/Cambios |
| `changes_requested` | Badge rojo "Cambios solicitados"                             |
| `done`              | Badge verde "Completado"                                     |

Durante `pending_review` y `agent_working`, el modal de detalle sondea los comentarios cada 4 s para reflejar las respuestas del agente en tiempo real.

---

## 10. Tests

```bash
# Desde task-manager/
bun test
```

Suite actual: **427 tests — 0 fallos**.

| Archivo / Grupo                 | Tests | Descripción                                                                    |
| ------------------------------- | ----- | ------------------------------------------------------------------------------ |
| `engine.test.ts`                | ~80   | Motor del agente: runCycle, updateConfig, tryStart, chat, SDD                  |
| `engine.integration.test.ts`    | ~40   | Tests de integración del engine contra DB en memoria                           |
| `statsCalculator.test.ts`       | 38    | 32 unitarios + 6 property tests (fast-check, 100 ejecuciones cada uno)         |
| `toolRouter.test.ts`            | 9     | Enrutador de herramientas: clasificación, deduplicación, prioridad             |
| `sddKanban.test.ts`             | ~25   | `effectiveColumn()`: columnas estándar, SDD, custom, carrera de ejecución      |
| `crypto.test.ts`                | 6     | Cifrado/descifrado AES-GCM, derivación de clave PBKDF2                         |
| `linearClient.test.ts`          | 8     | Cliente GraphQL: retry, timeout, taxonomía de errores                          |
| `settingsHandlers.*.test.ts`    | 10    | Conexión/desconexión Linear, eliminación masiva, exportación                   |
| `tailwind.config.test.ts`       | ~10   | Animaciones y tokens de color del config de Tailwind                           |
| Otros tests de utilidades y API | ~200  | Handlers de servidor, validaciones, property tests de invariantes de seguridad |

Los property tests usan `fast-check` con `numRuns: 100`. El invariante más crítico verifica que para cualquier API key con formato `^lin_api_[A-Za-z0-9]{40,}$`, la respuesta JSON nunca la expone en ningún campo.

---

## 11. Convenciones del proyecto

Las convenciones detalladas están en `.kiro/steering/`:

- **`tech.md`** — Bun-native, TypeScript strict, Prettier (comillas dobles, 2 espacios, 100 chars), ESM modules.
- **`structure.md`** — Estructura de directorios, `function` declarations para componentes, named exports, sin barrel files.
- **`ux-design.md`** — Paleta de colores, border-radius 8px, fuente system-ui/Inter, sombra de card, accesibilidad.
- **`product.md`** — Interfaz en español, prioridades y categorías predefinidas.

### Reglas de código clave

- Componentes: `function` declarations con named export (excepto `App.tsx`, que usa default export).
- Props interfaces co-localizadas con el componente, no en `types.ts`.
- Tipos compartidos (usados por más de un módulo) en `src/types.ts`.
- Lógica pura en `utils/`, tests co-localizados junto al módulo (`*.test.ts`).
- Lógica del agente en `src/agent/`, separada de los componentes React.

---

## 12. Historial de features

Todos los features están en estado `done`. Los specs completos (requirements, design, tasks) viven en `.kiro/specs/<feature>/`.

| ID       | Feature                | Sprint | Descripción resumida                                                              |
| -------- | ---------------------- | ------ | --------------------------------------------------------------------------------- |
| FEAT-001 | `task-manager-home`    | S1     | Página de inicio con resumen, accesos rápidos y shell de navegación               |
| FEAT-002 | `kanban-drag-and-drop` | S1     | Tablero Kanban con drag-and-drop HTML5 y rollback optimista                       |
| FEAT-003 | `kiro-home-assets`     | S1     | Mascota Kiro animada, gradiente hero y assets visuales                            |
| FEAT-004 | `statistics-dashboard` | S1     | Dashboard de productividad con KPIs, 4 gráficos SVG y property tests              |
| FEAT-005 | `settings-page`        | S2     | Configuración del workspace, integración Linear cifrada, exportación de datos     |
| FEAT-006 | `agent-orchestration`  | S3     | Ciclo de vida de ejecución (`assigned → done`) con gate de aprobación humana      |
| FEAT-007 | `mcp-registry`         | S3     | Registro y configuración de servidores MCP externos desde Settings                |
| FEAT-008 | `agent-comments`       | S4     | Comunicación bidireccional agente-usuario vía sistema de comentarios              |
| FEAT-009 | `ai-provider`          | S4     | Configuración de proveedor de IA con API key cifrada y prueba de conexión         |
| FEAT-010 | `agent-engine`         | S5     | Motor autónomo: poll, tool-use loop, system prompt, reintentos, submit for review |
| FEAT-011 | `workspace-git`        | S5     | Repositorio Git asociado al workspace: árbol, visor, cambios del agente           |
| FEAT-012 | `sdd-agent-lifecycle`  | S6     | Ciclo SDD multi-fase: requirements → design → tasks → execution, gates humanos    |
| FEAT-013 | `agent-chat`           | S7     | Chat conversacional con el agente durante la ejecución activa de tareas           |

---

## 13. Flujo de desarrollo (Harness SDD)

Este proyecto implementa el framework **Harness SDD** para el desarrollo dirigido por specs.

```
pending → [spec-author] → spec_ready → ⏸ APROBACIÓN HUMANA → in_progress → [implementer] → done
```

Para añadir una nueva feature:

1. Añadir la entrada en `feature_list.json` con `"sdd": true` y `"status": "pending"`.
2. El agente `spec-author` produce `.kiro/specs/<feature>/{requirements,design,tasks}.md` en notación EARS.
3. El spec pasa a `spec_ready` y espera aprobación humana.
4. Tras la aprobación, el agente `implementer` ejecuta `tasks.md` tarea a tarea.
5. El agente `reviewer` verifica trazabilidad R↔test, ejecuta `./check.sh` y marca `done` si todo pasa.

El manifiesto canónico está en `.agents/agentic.json`. Para más detalle, ver `AGENTS.md`.

---

<div align="center">

**Estado actual:** 13/13 features `done` &nbsp;·&nbsp; `./check.sh` verde &nbsp;·&nbsp; **427 tests — 0 fallos** &nbsp;·&nbsp; Build: ~2.5 MB

<br/>

<sub>Construido con <a href="https://kiro.dev">Kiro</a> &nbsp;·&nbsp; Harness SDD &nbsp;·&nbsp; Bun + Elysia + React + SQLite</sub>

</div>
