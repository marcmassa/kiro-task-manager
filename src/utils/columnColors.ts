export type ColumnColorKey =
  | "purple"
  | "indigo"
  | "yellow"
  | "emerald"
  | "rose"
  | "cyan"
  | "orange"
  | "teal"
  | "sky"
  | "pink";

interface ColumnColorTokens {
  dot: string;
  text: string;
  badge: string;
  bar: string;
}

export const COLUMN_COLOR_MAP: Record<ColumnColorKey, ColumnColorTokens> = {
  purple:  { dot: "bg-purple-500",  text: "text-purple-300",  badge: "bg-purple-500/10 text-purple-300",  bar: "bg-purple-500"  },
  indigo:  { dot: "bg-indigo-500",  text: "text-indigo-300",  badge: "bg-indigo-500/10 text-indigo-300",  bar: "bg-indigo-500"  },
  yellow:  { dot: "bg-yellow-500",  text: "text-yellow-300",  badge: "bg-yellow-500/10 text-yellow-300",  bar: "bg-yellow-500"  },
  emerald: { dot: "bg-emerald-500", text: "text-emerald-300", badge: "bg-emerald-500/10 text-emerald-300", bar: "bg-emerald-500" },
  rose:    { dot: "bg-rose-500",    text: "text-rose-300",    badge: "bg-rose-500/10 text-rose-300",    bar: "bg-rose-500"    },
  cyan:    { dot: "bg-cyan-500",    text: "text-cyan-300",    badge: "bg-cyan-500/10 text-cyan-300",    bar: "bg-cyan-500"    },
  orange:  { dot: "bg-orange-500",  text: "text-orange-300",  badge: "bg-orange-500/10 text-orange-300",  bar: "bg-orange-500"  },
  teal:    { dot: "bg-teal-500",    text: "text-teal-300",    badge: "bg-teal-500/10 text-teal-300",    bar: "bg-teal-500"    },
  sky:     { dot: "bg-sky-500",     text: "text-sky-300",     badge: "bg-sky-500/10 text-sky-300",     bar: "bg-sky-500"     },
  pink:    { dot: "bg-pink-500",    text: "text-pink-300",    badge: "bg-pink-500/10 text-pink-300",    bar: "bg-pink-500"    },
};

export const COLUMN_COLOR_KEYS = Object.keys(COLUMN_COLOR_MAP) as ColumnColorKey[];

export function columnColorTokens(color: string): ColumnColorTokens {
  return COLUMN_COLOR_MAP[color as ColumnColorKey] ?? COLUMN_COLOR_MAP.purple;
}
