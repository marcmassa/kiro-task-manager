# workshop-kiro — Task Manager

Aplicación web de gestión de tareas estilo Kanban con interfaz en español. Construida con Bun, Elysia, React y SQLite. Desarrollada como proyecto de taller para demostrar el flujo de trabajo **Harness SDD** con Kiro como IDE principal.

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

Task Manager es un tablero Kanban monorepositorio de paquete único. El backend (Elysia + SQLite) y el frontend (React + Tailwind CSS) conviven bajo `task-manager/`. No hay un servidor de desarrollo separado: Bun gestiona el build, el runtime y los tests.

```
Browser (React SPA) ◄──REST/JSON──► Elysia :3000 ──bun:sqlite──► tasks.db
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

---

## 2. Características

- **Tablero Kanban** con tres columnas: _Por Hacer_, _En Progreso_, _Completadas_.
- **Drag-and-drop nativo** (HTML5) con rollback optimista en caso de error del servidor.
- **CRUD completo de tareas**: título, descripción, prioridad, categoría y fecha de vencimiento.
- **Sistema de comentarios** por tarea.
- **Indicadores visuales de urgencia**: rojo si atrasada, naranja si vence hoy.
- **Dashboard de estadísticas** con KPIs, gráficos SVG nativos y cumplimiento de fechas.
- **Página de configuración**: nombre del workspace, idioma, zona horaria, preferencias de notificación.
- **Integración con Linear** (conectar, sincronizar, desconectar). Las claves API se almacenan cifradas con AES-GCM + PBKDF2; nunca se devuelven al frontend.
- **Exportación de datos** del workspace en JSON.
- **Eliminación masiva** de tareas con diálogo de confirmación accesible.
- **Accesibilidad**: HTML semántico, navegación por teclado, `aria-label` en botones de ícono, contraste mínimo 4.5:1.

---

## 3. Arquitectura

### Diagrama de componentes

```
┌─────────────────────────────────────┐        ┌───────────────────────────────────┐
│  Browser — React SPA                │ HTTPS  │  Elysia server (puerto 3000)      │
│                                     │◄──────►│                                   │
│  ├── HomePage                       │  JSON  │  /api/tasks           (CRUD)      │
│  ├── KanbanBoard                    │  REST  │  /api/tasks/:id/comments          │
│  │     ├── KanbanColumn × 3         │        │  /api/categories                  │
│  │     └── TaskCard                 │        │  /api/priorities                  │
│  ├── StatsDashboard                 │        │  /api/settings                    │
│  │     └── ChartRenderer            │        │  /api/integrations/linear         │
│  ├── SettingsPage                   │        │  /api/export                      │
│  │     └── IntegrationCard          │        │  SPA fallback → index.html        │
│  └── Modales (TaskModal,            │        └──────────────┬────────────────────┘
│        TaskDetailModal,             │                       │ bun:sqlite
│        ConfirmDialog)               │                       ▼
└─────────────────────────────────────┘        ┌───────────────────────────────────┐
                                               │  tasks.db (WAL mode)              │
                                               │  ├── tasks                        │
                                               │  ├── categories                   │
                                               │  ├── priorities                   │
                                               │  ├── comments                     │
                                               │  ├── workspace_settings           │
                                               │  └── integration_connections      │
                                               └───────────────────────────────────┘
```

### Principios arquitectónicos

- **Spec-first (Harness SDD):** toda feature con `"sdd": true` pasa por `requirements.md` → `design.md` → `tasks.md` con aprobación humana antes de tocar código. Los specs viven en `.kiro/specs/<feature>/`.
- **Una feature a la vez:** máximo un feature `in_progress` simultáneamente.
- **Lógica pura separada de React:** los cálculos de dominio (p. ej. `statsCalculator.ts`) son funciones puras sin dependencias de React, testeables con `fast-check`.
- **Nativo sobre dependencia:** sin librerías de gráficos externas (SVG + Tailwind) ni polyfills de Node (APIs de Bun en todo el stack).
- **Coherencia visual:** todos los componentes usan la paleta AWS definida en `.kiro/steering/ux-design.md`.

---

## 4. Estructura del repositorio

```
workshop-kiro/
├── task-manager/                # Aplicación principal (ver §4.1)
├── infra/                       # CDK Python — fuera de scope (no validado por check.sh)
├── .kiro/
│   ├── steering/                # Convenciones auto-cargadas por Kiro
│   │   ├── product.md
│   │   ├── tech.md
│   │   ├── structure.md
│   │   └── ux-design.md
│   ├── hooks/                   # Pre/post-write hooks (typecheck, format, secrets, review)
│   ├── skills/frontend-design/  # Skill de diseño frontend (formato Kiro)
│   └── specs/                   # Specs SDD de features (canónico)
│       ├── task-manager-home/
│       ├── kanban-drag-and-drop/
│       ├── kiro-home-assets/
│       ├── statistics-dashboard/
│       └── settings-page/
├── .agents/                     # Framework Harness SDD
│   ├── agentic.json             # Manifiesto canónico (sub-agents, skills, commands)
│   ├── subagents/               # Definiciones de roles (SUBAGENT.md por rol)
│   ├── commands/                # Cuerpos de slash commands (/spec, /implement, etc.)
│   ├── adapters/                # Adaptadores CLI (opencode, _common)
│   └── harness/                 # Documentación operacional del framework
├── progress/
│   ├── current.md               # Estado de la sesión activa
│   ├── handoff.md               # Notas de traspaso entre sesiones
│   ├── progress.md              # Historial append-only de features completadas
│   ├── decisions.md             # ADRs ligeros
│   └── backlog.md               # Items diferidos
├── AGENTS.md                    # Punto de entrada para cualquier agente
├── DESIGN.md                    # Arquitectura de alto nivel
├── feature_list.json            # Lista de features con estado y specDir
├── check.sh                     # Script de verificación integral
└── README.md                    # Este archivo
```

### 4.1 Estructura de `task-manager/`

```
task-manager/
├── server.ts                    # Servidor Elysia, rutas API, archivos estáticos
├── config.ts                    # Configuración de entorno
├── db/
│   └── database.ts              # Schema SQLite, seed, instancia db exportada
├── src/
│   ├── index.tsx                # Punto de entrada React (root render)
│   ├── App.tsx                  # Shell, routing de páginas, modales, estado global
│   ├── types.ts                 # Interfaces TypeScript compartidas
│   ├── api.ts                   # Cliente REST (una función por endpoint)
│   ├── Icons.tsx                # Componentes SVG de íconos
│   ├── styles.css               # Directivas Tailwind + CSS personalizado
│   ├── components/
│   │   ├── KanbanColumn.tsx
│   │   ├── TaskCard.tsx
│   │   ├── TaskModal.tsx
│   │   ├── TaskDetailModal.tsx
│   │   ├── ConfirmDialog.tsx
│   │   ├── HomePage.tsx
│   │   ├── KiroMascot.tsx
│   │   ├── StatsDashboard.tsx
│   │   ├── ChartRenderer.tsx
│   │   ├── SettingsPage.tsx
│   │   ├── IntegrationCard.tsx
│   │   └── SectionHeader.tsx
│   └── utils/
│       ├── helpers.ts
│       ├── statsCalculator.ts   # Cálculos puros + tests co-localizados
│       ├── crypto.ts            # AES-GCM + PBKDF2
│       ├── linearClient.ts      # Cliente GraphQL Linear
│       └── settingsHandlers.ts  # Handlers de servidor (testeables de forma aislada)
├── public/
│   ├── index.html               # Shell SPA
│   ├── styles.css               # CSS compilado
│   └── dist/                    # Bundle frontend generado por bun build
├── tailwind.config.js
├── postcss.config.js
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

El primer arranque crea `tasks.db` automáticamente y siembra datos de ejemplo (tareas, categorías, prioridades y comentarios).

### Build del frontend

```bash
bun run build
# Genera public/dist/index.js
```

El servidor sirve el bundle generado como archivo estático. Tras el build, `bun run dev` sirve la versión compilada.

---

## 6. Comandos disponibles

Todos los comandos se ejecutan desde el directorio `task-manager/`.

| Comando                | Descripción                             |
| ---------------------- | --------------------------------------- |
| `bun run dev`          | Arranca el servidor en el puerto 3000   |
| `bun run build`        | Compila el frontend a `public/dist/`    |
| `bun test`             | Ejecuta la suite de tests (65 tests)    |
| `bun run format`       | Formatea con Prettier                   |
| `bun run format:check` | Verifica formato sin modificar archivos |

Desde la raíz del repositorio:

```bash
./check.sh   # Verificación integral: tests + build + formato + specs + harness
```

---

## 7. API REST

Base URL: `http://localhost:3000/api`

### Tareas

| Método   | Ruta                | Descripción                                                |
| -------- | ------------------- | ---------------------------------------------------------- |
| `GET`    | `/tasks`            | Lista todas las tareas con prioridad y categoría embebidas |
| `GET`    | `/tasks/:id`        | Obtiene una tarea por ID                                   |
| `POST`   | `/tasks`            | Crea una tarea nueva                                       |
| `PUT`    | `/tasks/:id`        | Actualiza una tarea completa                               |
| `PATCH`  | `/tasks/:id/status` | Actualiza solo el estado (`todo` / `in_progress` / `done`) |
| `DELETE` | `/tasks/:id`        | Elimina una tarea y sus comentarios (CASCADE)              |
| `DELETE` | `/tasks/all`        | Elimina todas las tareas del workspace                     |

**Body de creación/actualización:**

```json
{
  "title": "string",
  "description": "string",
  "status": "todo | in_progress | done",
  "priority_id": 1,
  "category_id": 1,
  "due_date": "2025-12-31"
}
```

### Comentarios

| Método | Ruta                  | Descripción                    |
| ------ | --------------------- | ------------------------------ |
| `GET`  | `/tasks/:id/comments` | Lista comentarios de una tarea |
| `POST` | `/tasks/:id/comments` | Añade un comentario            |

**Body de comentario:**

```json
{ "content": "Texto del comentario", "author": "Nombre" }
```

### Catálogos

| Método | Ruta          | Descripción                      |
| ------ | ------------- | -------------------------------- |
| `GET`  | `/categories` | Lista de categorías disponibles  |
| `GET`  | `/priorities` | Lista de prioridades disponibles |

### Configuración

| Método  | Ruta                      | Descripción                                       |
| ------- | ------------------------- | ------------------------------------------------- |
| `GET`   | `/settings`               | Configuración actual (workspace + notificaciones) |
| `PATCH` | `/settings/workspace`     | Actualiza nombre, idioma, zona horaria            |
| `PATCH` | `/settings/notifications` | Actualiza preferencias de notificación            |

### Integración con Linear

| Método   | Ruta                           | Descripción                                  |
| -------- | ------------------------------ | -------------------------------------------- |
| `GET`    | `/integrations/linear`         | Estado de la conexión (sin exponer la clave) |
| `POST`   | `/integrations/linear/connect` | Conecta con una API key de Linear            |
| `POST`   | `/integrations/linear/sync`    | Sincroniza tareas desde Linear               |
| `DELETE` | `/integrations/linear`         | Desconecta Linear                            |

> **Seguridad:** la API key de Linear nunca aparece en ninguna respuesta. Se almacena cifrada (AES-GCM, clave derivada con PBKDF2) en `integration_connections`. Este invariante está cubierto por un test de propiedad con `fast-check` (R7 en el spec de FEAT-005).

### Exportación

| Método | Ruta      | Descripción                              |
| ------ | --------- | ---------------------------------------- |
| `GET`  | `/export` | Descarga el workspace completo como JSON |

---

## 8. Base de datos

SQLite en modo WAL. El archivo `tasks.db` se crea automáticamente al primer arranque. El schema completo vive en `db/database.ts`.

### Tablas

**`categories`**

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
name TEXT NOT NULL UNIQUE
color TEXT NOT NULL DEFAULT '#6366f1'
```

Seed: Desarrollo, Diseño, Marketing, Investigación, Personal.

**`priorities`**

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
name TEXT NOT NULL UNIQUE
level INTEGER NOT NULL      -- 1=Baja, 2=Media, 3=Alta, 4=Urgente
color TEXT NOT NULL
```

Seed: Baja (`#037F0C`), Media (`#FF9900`), Alta (`#D91515`), Urgente (`#920B0B`).

**`tasks`**

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
title TEXT NOT NULL
description TEXT DEFAULT ''
status TEXT NOT NULL DEFAULT 'todo'  -- CHECK: todo | in_progress | done
priority_id INTEGER NOT NULL         -- FK → priorities
category_id INTEGER NOT NULL         -- FK → categories
due_date TEXT                        -- ISO 8601 (YYYY-MM-DD)
created_at TEXT NOT NULL DEFAULT (datetime('now'))
updated_at TEXT NOT NULL DEFAULT (datetime('now'))
```

**`comments`**

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
task_id INTEGER NOT NULL   -- FK → tasks ON DELETE CASCADE
content TEXT NOT NULL
author TEXT NOT NULL DEFAULT 'Usuario'
created_at TEXT NOT NULL DEFAULT (datetime('now'))
```

**`workspace_settings`** (singleton, `id = 1`)

```sql
workspace_name TEXT NOT NULL DEFAULT 'Mi Workspace'
default_language TEXT NOT NULL DEFAULT 'es-ES'
default_timezone TEXT NOT NULL DEFAULT 'Europe/Madrid'
notify_on_due INTEGER NOT NULL DEFAULT 1
notify_on_done INTEGER NOT NULL DEFAULT 0
notify_daily_digest INTEGER NOT NULL DEFAULT 0
```

**`integration_connections`**

```sql
provider TEXT NOT NULL UNIQUE          -- 'linear'
api_key_encrypted TEXT NOT NULL        -- AES-GCM cifrado, base64
account_id/name/email TEXT NOT NULL    -- datos de la cuenta conectada
last_sync_at TEXT                      -- ISO timestamp
last_sync_summary TEXT                 -- JSON serializado
```

---

## 9. Frontend

### Páginas

| Ruta        | Componente         | Descripción                                                 |
| ----------- | ------------------ | ----------------------------------------------------------- |
| `/`         | `HomePage`         | Landing con mascota Kiro, resumen de stats, accesos rápidos |
| `/kanban`   | `App` (board view) | Tablero Kanban con tres columnas y drag-and-drop            |
| `/stats`    | `StatsDashboard`   | Dashboard de productividad con KPIs y gráficos              |
| `/settings` | `SettingsPage`     | Configuración del workspace, Linear, notificaciones y datos |

El routing es client-side (estado en `App.tsx`); el servidor sirve `index.html` para cualquier ruta no-API.

### Componentes principales

| Componente        | Responsabilidad                                                               |
| ----------------- | ----------------------------------------------------------------------------- |
| `App.tsx`         | Shell, estado global, carga de datos, routing de páginas, apertura de modales |
| `KanbanColumn`    | Columna del tablero; drop target para drag-and-drop                           |
| `TaskCard`        | Tarjeta de tarea: borde de prioridad, badge de fecha, acciones en hover       |
| `TaskModal`       | Formulario de creación/edición de tarea                                       |
| `TaskDetailModal` | Vista de detalle con comentarios                                              |
| `ConfirmDialog`   | Diálogo de confirmación accesible (foco, Esc, Tab cíclico)                    |
| `StatsDashboard`  | KPIs, 4 gráficos SVG, sección de cumplimiento de fechas                       |
| `ChartRenderer`   | Primitivas SVG puras: barra horizontal, donut, barra vertical, línea-área     |
| `SettingsPage`    | UI de configuración: workspace, integraciones, notificaciones, datos          |
| `IntegrationCard` | Tarjeta reutilizable para estado/conexión de servicios externos               |

### Paleta de colores (AWS-inspired)

| Token          | Valor               | Uso                                            |
| -------------- | ------------------- | ---------------------------------------------- |
| Primario       | `hsl(264 100% 64%)` | Botones, enlaces, estados activos              |
| Acento / Hover | `#FF9900`           | Efectos hover, call-to-action, prioridad media |
| Oscuro         | `#252F3E`           | Navbar, sidebar, footer                        |
| Alta prioridad | `#D91515`           | Tareas atrasadas, errores, prioridad alta      |
| Éxito / Bajo   | `#037F0C`           | Tareas completadas, prioridad baja             |
| Fondo          | `#FAFAFA`           | Fondo de página                                |
| Cards          | `#FFFFFF`           | Fondos de cards con sombra sutil               |

### Gestión de estado

- Sin librería de estado: todo en `App.tsx` con `useState` / `useEffect`.
- Las actualizaciones por drag-and-drop son optimistas: el estado local cambia inmediatamente y se revierte si falla la llamada al servidor.
- Los datos se cargan en paralelo al montar (`fetchTasks`, `fetchCategories`, `fetchPriorities`).

---

## 10. Tests

```bash
# Desde task-manager/
bun test
```

Suite actual: **65 tests — 0 fallos**.

| Archivo                              | Tests | Descripción                                                            |
| ------------------------------------ | ----- | ---------------------------------------------------------------------- |
| `statsCalculator.test.ts`            | 38    | 32 unitarios + 6 property tests (fast-check, 100 ejecuciones cada uno) |
| `crypto.test.ts`                     | 6     | Cifrado/descifrado AES-GCM, derivación de clave PBKDF2                 |
| `linearClient.test.ts`               | 8     | Cliente GraphQL: retry, timeout, taxonomía de errores                  |
| `settingsHandlers.connect.test.ts`   | 4     | Conexión/desconexión de Linear (cubre R5–R8)                           |
| `settingsHandlers.property.test.ts`  | 3     | Invariante de seguridad: la API key nunca aparece en ninguna respuesta |
| `settingsHandlers.deleteAll.test.ts` | 3     | Eliminación masiva de tareas                                           |
| `settingsHandlers.export.test.ts`    | 3     | Exportación del workspace                                              |

Los property tests usan `fast-check` con `numRuns: 100`. El test de propiedad más crítico verifica que para cualquier string con formato `^lin_api_[A-Za-z0-9]{40,}$`, la respuesta JSON nunca contiene ese valor en ningún campo (R7 de FEAT-005).

---

## 11. Convenciones del proyecto

Las convenciones detalladas están en `.kiro/steering/`:

- **`tech.md`** — Bun-native, TypeScript strict, Prettier (comillas dobles, 2 espacios, 100 chars), ESM modules.
- **`structure.md`** — Estructura de directorios, `function` declarations para componentes, named exports, sin barrel files.
- **`ux-design.md`** — Paleta de colores, border-radius 8px, fuente system-ui, sombra de card, accesibilidad.
- **`product.md`** — Interfaz en español, prioridades y categorías predefinidas.

### Reglas de código clave

- Componentes: `function` declarations con named export (excepto `App.tsx`, que usa default export).
- Archivos de componentes: PascalCase. Archivos de utilidades: camelCase.
- Props interfaces co-localizadas con el componente, no en `types.ts`.
- Tipos compartidos (usados por más de un módulo) en `src/types.ts`.
- Lógica pura en `utils/`, tests co-localizados junto al módulo (`*.test.ts`).
- No tocar `infra/` ni `task-manager/server.ts`/`task-manager/db/` salvo que la tarea lo requiera explícitamente.
- No añadir polyfills de Node ni dependencias con rangos de versión abiertos.

---

## 12. Historial de features

Todos los features están en estado `done`. Los specs completos (requirements, design, tasks) viven en `.kiro/specs/<feature>/`.

| ID       | Feature                | Descripción                                                                                       |
| -------- | ---------------------- | ------------------------------------------------------------------------------------------------- |
| FEAT-001 | `task-manager-home`    | Página de inicio con resumen, accesos rápidos y shell de navegación                               |
| FEAT-002 | `kanban-drag-and-drop` | Tablero Kanban con drag-and-drop HTML5 y rollback optimista                                       |
| FEAT-003 | `kiro-home-assets`     | Mascota Kiro animada, gradiente hero y assets visuales de la home                                 |
| FEAT-004 | `statistics-dashboard` | Dashboard de productividad con KPIs, 4 gráficos SVG nativos y property tests                      |
| FEAT-005 | `settings-page`        | Configuración del workspace, integración con Linear (cifrada), exportación y eliminación de datos |

---

## 13. Flujo de desarrollo (Harness SDD)

Este proyecto implementa el framework **Harness SDD** para el desarrollo dirigido por specs.

```
pending → [spec-author] → spec_ready → ⏸ APROBACIÓN HUMANA → in_progress → [implementer → reviewer] → done
```

Para añadir una nueva feature:

1. Añadir la entrada en `feature_list.json` con `"sdd": true` y `"status": "pending"`.
2. El agente `spec-author` produce `.kiro/specs/<feature>/{requirements,design,tasks}.md` en notación EARS.
3. El spec pasa a `spec_ready` y espera aprobación humana.
4. Tras la aprobación, el agente `implementer` (o `frontend-engineer` para trabajo de frontend puro) ejecuta `tasks.md` tarea a tarea.
5. El agente `reviewer` verifica trazabilidad R↔test, ejecuta `./check.sh` y marca `done` si todo pasa.

El manifiesto canónico está en `.agents/agentic.json`. Los roles están en `.agents/subagents/`. Los slash commands están en `.agents/commands/`. Para más detalle, ver `AGENTS.md`.

---

> **Estado actual:** 5/5 features `done`. `./check.sh` verde. Tests: **65 pass / 0 fail**. Build: 1.24 MB.
