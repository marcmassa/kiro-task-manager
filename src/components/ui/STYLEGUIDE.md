# Guía de Estilos — Biblioteca de Componentes UI

Esta guía cataloga **todos** los componentes reutilizables del Sistema de Diseño
del Task Manager. Cada entrada documenta el propósito del componente, su interfaz
de props (nombre, tipo y si es requerida u opcional), sus variantes disponibles
y al menos un ejemplo de uso en TypeScript con todas sus props requeridas
asignadas.

Los componentes encapsulan la identidad visual de la aplicación (tema oscuro,
paleta AWS) reutilizando los Design Token existentes
(`surface`, `accent`, `success`, `warning`, `danger`, `muted`) mediante clases
de Tailwind. No usan literales hexadecimales en el JSX ni dependen del dominio
de tareas, de modo que pueden reutilizarse en cualquier página futura.

## Convención de ubicación e imports (R11.4, R13.4)

- **Ubicación:** todos los componentes reutilizables viven en
  `src/components/ui/`. Cada componente define su interfaz de props en el mismo
  archivo, se exporta como **named export** mediante una `function` declaration y
  usa tipos explícitos en TypeScript estricto (sin `any`).
- **Imports directos, sin barrel files:** se importa cada componente
  directamente desde su archivo fuente. **No** existe ni debe crearse un
  `index.ts` que reexporte la biblioteca.

```typescript
// ✅ Correcto — import directo desde el archivo fuente
import { Button } from "./ui/Button";
import { StatCard } from "./ui/StatCard";

// ❌ Prohibido — barrel file (no existe ui/index.ts)
import { Button, StatCard } from "./ui";
```

> Al añadir un nuevo componente a la biblioteca, **es obligatorio** incorporar su
> entrada a esta guía con propósito, props, variantes y ejemplo (R13.4).

---

## Button

**Archivo:** `src/components/ui/Button.tsx`

### Propósito

Botón de acción reutilizable que unifica la apariencia y el comportamiento de
todas las acciones de la aplicación. Ofrece variantes visuales, soporte de
ícono, estado deshabilitado que inhibe el `onClick`, foco visible por teclado y
validación en desarrollo del `aria-label` para botones solo-ícono.

### Interfaz de props

| Prop         | Tipo                                               | Requerida                                             |
| ------------ | -------------------------------------------------- | ----------------------------------------------------- |
| `variant`    | `"primary" \| "secondary" \| "danger" \| "ghost"`  | Opcional (default `"primary"`)                        |
| `icon`       | `React.ReactNode`                                  | Opcional                                              |
| `disabled`   | `boolean`                                          | Opcional (default `false`)                            |
| `onClick`    | `(e: React.MouseEvent<HTMLButtonElement>) => void` | Opcional                                              |
| `type`       | `"button" \| "submit" \| "reset"`                  | Opcional (default `"button"`)                         |
| `aria-label` | `string`                                           | Opcional (obligatoria de facto en botones solo-ícono) |
| `children`   | `React.ReactNode`                                  | Opcional                                              |

### Variantes

- `primary` (por defecto) — acción primaria, token `accent`.
- `secondary` — acción secundaria, fondo `white/5` con borde.
- `danger` — acción destructiva, token `danger`.
- `ghost` — acción discreta, fondo transparente con hover `white/5`.

Un valor de `variant` ausente o no reconocido cae a `primary` como reserva.

### Ejemplo de uso

```tsx
import { Button } from "./ui/Button";
import { PlusIcon } from "../Icons";

function CrearTareaButton() {
  return (
    <Button variant="primary" icon={<PlusIcon size={16} />} onClick={() => crearTarea()}>
      Nueva tarea
    </Button>
  );
}

// Botón solo-ícono: requiere aria-label no vacío en español
function CerrarButton() {
  return <Button variant="ghost" aria-label="Cerrar el modal" onClick={() => cerrar()} />;
}
```

---

## Badge

**Archivo:** `src/components/ui/Badge.tsx`

### Propósito

Etiqueta compacta reutilizable para mostrar estados, prioridades o conteos con
color semántico. La clase base `badge` se aplica siempre; el contenido nunca se
trunca y puede ajustarse en varias líneas.

### Interfaz de props

| Prop       | Tipo                                                          | Requerida                      |
| ---------- | ------------------------------------------------------------- | ------------------------------ |
| `variant`  | `"neutral" \| "accent" \| "success" \| "warning" \| "danger"` | Opcional (default `"neutral"`) |
| `children` | `React.ReactNode`                                             | Requerida                      |

### Variantes

- `neutral` (por defecto) — gris neutro sobre `white/5`.
- `accent` — token `accent`.
- `success` — token `success`.
- `warning` — token `warning`.
- `danger` — token `danger`.

Un valor de `variant` ausente o no reconocido cae a `neutral` como reserva.

### Ejemplo de uso

```tsx
import { Badge } from "./ui/Badge";

function EstadoVencidas({ count }: { count: number }) {
  return <Badge variant="danger">{count} vencidas</Badge>;
}
```

---

## Card

**Archivo:** `src/components/ui/Card.tsx`

### Propósito

Contenedor de superficie elevada reutilizable. Replica los atributos de
superficie de `home-card` (fondo de superficie semitransparente, desenfoque,
borde sutil `white/5`, esquinas redondeadas, elevación y resalte de borde en
hover) y delega el padding a la prop `padding`. Permite escoger el elemento HTML
de renderizado mediante `as`.

### Interfaz de props

| Prop          | Tipo                          | Requerida                       |
| ------------- | ----------------------------- | ------------------------------- |
| `padding`     | `"estandar" \| "compacto"`    | Opcional (default `"estandar"`) |
| `as`          | `keyof JSX.IntrinsicElements` | Opcional (default `"div"`)      |
| `interactive` | `boolean`                     | Opcional                        |
| `className`   | `string`                      | Opcional (default `""`)         |
| `children`    | `React.ReactNode`             | Opcional                        |

### Variantes

Sin variantes de color. La única dimensión configurable es el padding:
`estandar` (`p-6`) y `compacto` (`p-4`); un valor inválido cae a `estandar`.

### Ejemplo de uso

```tsx
import { Card } from "./ui/Card";

function PanelResumen() {
  return (
    <Card as="section" padding="compacto">
      <h2 className="text-white">Resumen</h2>
      <p className="text-muted-400">Contenido del panel.</p>
    </Card>
  );
}
```

---

## StatCard

**Archivo:** `src/components/ui/StatCard.tsx`

### Propósito

Tarjeta de métrica reutilizable que presenta un valor principal, una etiqueta
descriptiva en español y un ícono con color semántico, sobre la superficie
`home-stat-card`. Expone un `aria-label` legible y, opcionalmente, compone un
`ProgressBar` cuando se provee `progressPercent`.

### Interfaz de props

| Prop              | Tipo                                             | Requerida |
| ----------------- | ------------------------------------------------ | --------- |
| `value`           | `string \| number`                               | Requerida |
| `label`           | `string`                                         | Requerida |
| `icon`            | `React.ReactNode`                                | Requerida |
| `color`           | `"accent" \| "success" \| "warning" \| "danger"` | Requerida |
| `progressPercent` | `number`                                         | Opcional  |
| `aria-label`      | `string`                                         | Requerida |

### Variantes

No expone una prop `variant`. La intención semántica se controla mediante la
prop `color`: `accent`, `success`, `warning` y `danger`.

### Ejemplo de uso

```tsx
import { StatCard } from "./ui/StatCard";
import { KanbanIcon } from "../Icons";

function TotalTareasCard({ total }: { total: number }) {
  return (
    <StatCard
      value={total}
      label="Total tareas"
      icon={<KanbanIcon size={20} />}
      color="accent"
      aria-label={`Total de tareas: ${total}`}
    />
  );
}
```

---

## ProgressBar

**Archivo:** `src/components/ui/ProgressBar.tsx`

### Propósito

Barra de progreso horizontal accesible de presentación pura. Limita el valor al
rango entero [0, 100] y lo usa tanto para el ancho del relleno como para
`aria-valuenow`. Expone siempre los atributos ARIA de `progressbar` y desactiva
la transición animada bajo `prefers-reduced-motion`.

### Interfaz de props

| Prop    | Tipo                                             | Requerida                     |
| ------- | ------------------------------------------------ | ----------------------------- |
| `value` | `number`                                         | Requerida                     |
| `color` | `"accent" \| "success" \| "warning" \| "danger"` | Opcional (default `"accent"`) |

### Variantes

No expone una prop `variant`. El color del relleno se controla mediante la prop
`color`: `accent` (por defecto), `success`, `warning` y `danger`.

### Ejemplo de uso

```tsx
import { ProgressBar } from "./ui/ProgressBar";

function TasaCumplimiento({ rate }: { rate: number }) {
  return <ProgressBar value={rate} color="success" />;
}
```

---

## DataTable

**Archivo:** `src/components/ui/DataTable.tsx`

### Propósito

Tabla de datos tabular semántica y accesible. Renderiza un `<table>` con una
fila de cabecera (`<th scope="col">` por columna) y un `<tbody>` con una fila
por cada fila válida en el orden recibido. Descarta filas con aridad incorrecta,
alinea a la derecha las columnas numéricas y muestra un mensaje en español
cuando no hay filas válidas.

### Interfaz de props

| Prop           | Tipo                                     | Requerida                                        |
| -------------- | ---------------------------------------- | ------------------------------------------------ |
| `columns`      | `DataTableColumn[]`                      | Requerida                                        |
| `rows`         | `Array<Record<string, React.ReactNode>>` | Requerida                                        |
| `emptyMessage` | `string`                                 | Opcional (default `"No hay datos para mostrar"`) |
| `aria-label`   | `string`                                 | Opcional                                         |

Donde `DataTableColumn` es:

| Campo     | Tipo      | Requerido |
| --------- | --------- | --------- |
| `key`     | `string`  | Requerido |
| `header`  | `string`  | Requerido |
| `numeric` | `boolean` | Opcional  |

### Variantes

Sin variantes. El comportamiento por columna se controla con el flag `numeric`
de cada `DataTableColumn` (alineación a la derecha).

### Ejemplo de uso

```tsx
import { DataTable } from "./ui/DataTable";

function DistribucionPorEstado() {
  return (
    <DataTable
      aria-label="Distribución de tareas por estado"
      columns={[
        { key: "estado", header: "Estado" },
        { key: "cantidad", header: "Cantidad", numeric: true },
        { key: "porcentaje", header: "Porcentaje", numeric: true },
      ]}
      rows={[
        { estado: "Por hacer", cantidad: 5, porcentaje: "41.7%" },
        { estado: "En progreso", cantidad: 3, porcentaje: "25.0%" },
        { estado: "Completadas", cantidad: 4, porcentaje: "33.3%" },
      ]}
    />
  );
}
```

---

## LoadingState

**Archivo:** `src/components/ui/StateView.tsx`

### Propósito

Indicador de carga accesible de la familia StateView. Expone `role="status"` y
`aria-live="polite"` para anunciar el estado a lectores de pantalla, muestra un
mensaje en español (por prop o por defecto `"Cargando..."`) y desactiva la
animación de pulso bajo `prefers-reduced-motion`.

### Interfaz de props

| Prop      | Tipo     | Requerida                                                  |
| --------- | -------- | ---------------------------------------------------------- |
| `message` | `string` | Opcional (default `"Cargando..."` si está vacío o ausente) |

### Variantes

Sin variantes.

### Ejemplo de uso

```tsx
import { LoadingState } from "./ui/StateView";

function CargandoEstadisticas() {
  return <LoadingState message="Cargando estadísticas..." />;
}
```

---

## ErrorState

**Archivo:** `src/components/ui/StateView.tsx`

### Propósito

Estado de error de la familia StateView. Muestra un ícono de advertencia, el
mensaje de error en español recibido por prop y un `Button` de reintento
enfocable por teclado con `aria-label` en español, sobre la superficie de
`Card`. El callback `onRetry` es obligatorio: sin él, el componente retorna
`null` y no se renderiza.

### Interfaz de props

| Prop      | Tipo         | Requerida |
| --------- | ------------ | --------- |
| `message` | `string`     | Requerida |
| `onRetry` | `() => void` | Requerida |

### Variantes

Sin variantes.

### Ejemplo de uso

```tsx
import { ErrorState } from "./ui/StateView";

function ErrorEstadisticas({ onRetry }: { onRetry: () => void }) {
  return <ErrorState message="No se pudieron cargar las estadísticas." onRetry={onRetry} />;
}
```

---

## EmptyState

**Archivo:** `src/components/ui/StateView.tsx`

### Propósito

Estado vacío de la familia StateView. Muestra un ícono ilustrativo, un título en
español y un mensaje descriptivo en español, todos recibidos por props, dentro
de la superficie de `Card`.

### Interfaz de props

| Prop      | Tipo              | Requerida |
| --------- | ----------------- | --------- |
| `icon`    | `React.ReactNode` | Requerida |
| `title`   | `string`          | Requerida |
| `message` | `string`          | Requerida |

### Variantes

Sin variantes.

### Ejemplo de uso

```tsx
import { EmptyState } from "./ui/StateView";
import { ChartIcon } from "../Icons";

function SinDatos() {
  return (
    <EmptyState
      icon={<ChartIcon size={32} />}
      title="Sin datos todavía"
      message="Crea tu primera tarea para ver las estadísticas."
    />
  );
}
```

---

## PageHeader

**Archivo:** `src/components/ui/PageHeader.tsx`

### Propósito

Cabecera de página reutilizable. Renderiza un `<header>` semántico con
comportamiento sticky y desenfoque coherente con las cabeceras de la aplicación,
con un `<h1>` para el título y un `<p>` para el subtítulo en español.

### Interfaz de props

| Prop       | Tipo     | Requerida |
| ---------- | -------- | --------- |
| `title`    | `string` | Requerida |
| `subtitle` | `string` | Requerida |

### Variantes

Sin variantes.

### Ejemplo de uso

```tsx
import { PageHeader } from "./ui/PageHeader";

function CabeceraEstadisticas() {
  return <PageHeader title="Estadísticas" subtitle="Análisis de productividad de tu workspace" />;
}
```

---

## SectionHeader

**Archivo:** `src/components/ui/SectionHeader.tsx`

### Propósito

Encabezado de sección reutilizable. Renderiza un punto de color, una etiqueta en
mayúsculas con un `<h2>` semántico y una línea divisoria que separa secciones
sobre fondos oscuros.

### Interfaz de props

| Prop       | Tipo                               | Requerida                        |
| ---------- | ---------------------------------- | -------------------------------- |
| `label`    | `string`                           | Requerida                        |
| `dotColor` | `string` (clase Tailwind de fondo) | Opcional (default `"bg-accent"`) |

### Variantes

Sin variantes. El color del punto se personaliza mediante la prop `dotColor`
(clase Tailwind de fondo basada en un Design Token, por defecto `bg-accent`).

### Ejemplo de uso

```tsx
import { SectionHeader } from "./ui/SectionHeader";

function SeccionPorEstado() {
  return <SectionHeader label="Distribución por estado" dotColor="bg-success" />;
}
```
