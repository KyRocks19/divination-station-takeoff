export const POSITION_COLORS = [
  { id: "violet",  hex: "#a855f7", label: "Spiritual / Wisdom"       },
  { id: "rose",    hex: "#f43f5e", label: "Challenge / Conflict"      },
  { id: "amber",   hex: "#f59e0b", label: "Outcome / Potential"       },
  { id: "emerald", hex: "#10b981", label: "Growth / Guidance"         },
  { id: "sky",     hex: "#38bdf8", label: "Clarity / Past"            },
  { id: "indigo",  hex: "#6366f1", label: "Subconscious / Hidden"     },
  { id: "teal",    hex: "#14b8a6", label: "Balance / Communication"   },
  { id: "fuchsia", hex: "#e879f9", label: "Emotion / Heart"           },
  { id: "orange",  hex: "#fb923c", label: "Action / Energy"           },
  { id: "yellow",  hex: "#fbbf24", label: "Consciousness / Solar"     },
  { id: "slate",   hex: "#94a3b8", label: "Foundation / Earth"        },
  { id: "purple",  hex: "#7c3aed", label: "Mystery / Default"         },
] as const;

export const DEFAULT_POSITION_COLOR = "#7c3aed";

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
