/**
 * Theme colours, safe to import from client components.
 *
 * The defaults are the tokens at the top of app/globals.css. site.json stores only the colours an admin
 * changed (`theme.colors`), and the root layout writes them as CSS variables over the defaults.
 */

/** The logo and tab icon used until an admin picks others. */
export const DEFAULT_LOGO = "/quill.svg";
export const DEFAULT_FAVICON = "/icon.svg";

export type ThemeColors = Partial<Record<ColorKey, string>>;
export type Theme = { colors: ThemeColors };

type ColorDef = { label: string; hint: string; value: string; group: "Brand" | "Surfaces" | "Text" | "Callouts" };

export const COLORS = {
  accent: { group: "Brand", label: "Accent", hint: "Links, the current page, focus rings and primary buttons.", value: "#a78bfa" }, // taste-skill-ignore: Quill logo colour, set by the brand
  "accent-strong": { group: "Brand", label: "Accent, darker", hint: "Fills in the home page drawings.", value: "#7c6bb5" },
  "accent-pale": { group: "Brand", label: "Accent, pale", hint: "Hovered primary buttons and highlights.", value: "#ddd6fe" },
  "accent-deep": { group: "Brand", label: "Accent, deep", hint: "Dark accent backgrounds.", value: "#2b2d6e" },
  "accent-ink": { group: "Brand", label: "Text on accent", hint: "Text on primary buttons.", value: "#1e1f4a" },
  ground: { group: "Surfaces", label: "Page background", hint: "Behind everything.", value: "#0e0e0e" },
  panel: { group: "Surfaces", label: "Panels", hint: "Sidebars, cards and code.", value: "#151515" },
  raised: { group: "Surfaces", label: "Raised", hint: "Inputs, buttons and keys.", value: "#1c1c1c" },
  hover: { group: "Surfaces", label: "Hover", hint: "Rows and buttons under the pointer.", value: "#232323" },
  "art-ground": { group: "Surfaces", label: "Card art background", hint: "Behind the home page drawings.", value: "#13121c" },
  line: { group: "Surfaces", label: "Lines", hint: "Dividers and borders.", value: "#2a2a2a" },
  "line-strong": { group: "Surfaces", label: "Strong lines", hint: "Borders that need to stand out.", value: "#3a3a3a" },
  ink: { group: "Text", label: "Text", hint: "Headings and body text.", value: "#f3f3f3" },
  "ink-soft": { group: "Text", label: "Secondary text", hint: "Descriptions and sidebar links.", value: "#a6a6a6" },
  "ink-faint": { group: "Text", label: "Faint text", hint: "Hints and placeholders.", value: "#737373" },
  note: { group: "Callouts", label: "Note", hint: "Note callouts.", value: "#60a5fa" }, // taste-skill-ignore: the existing note colour
  warn: { group: "Callouts", label: "Warning", hint: "Warning callouts and draft badges.", value: "#fbbf24" },
  danger: { group: "Callouts", label: "Important", hint: "Important callouts and errors.", value: "#f87171" },
} satisfies Record<string, ColorDef>;

export type ColorKey = keyof typeof COLORS;
export const COLOR_KEYS = Object.keys(COLORS) as ColorKey[];
export const COLOR_GROUPS = ["Brand", "Surfaces", "Text", "Callouts"] as const;

export const DEFAULT_COLORS = Object.fromEntries(COLOR_KEYS.map((k) => [k, COLORS[k].value])) as Record<ColorKey, string>;

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Lowercase six-digit hex, or null if the value isn't a hex colour. */
export function normalizeHex(value: unknown): string | null {
  if (typeof value !== "string" || !HEX.test(value.trim())) return null;
  const v = value.trim().toLowerCase();
  return v.length === 4 ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}` : v;
}

/**
 * Checks a theme sent by the admin portal or the API. Unknown keys are an error; colours equal to the
 * default are dropped, so site.json only holds real changes. Returns an error message or the clean theme.
 */
export function cleanTheme(input: unknown): Theme | string {
  if (input === null || input === undefined) return { colors: {} };
  if (typeof input !== "object" || Array.isArray(input)) return "theme must be an object like { \"colors\": { \"accent\": \"#a78bfa\" } }."; // taste-skill-ignore: example value
  const colors = (input as { colors?: unknown }).colors ?? {};
  if (typeof colors !== "object" || colors === null || Array.isArray(colors)) return "theme.colors must be an object of colour names to hex values.";
  const out: ThemeColors = {};
  for (const [k, v] of Object.entries(colors)) {
    if (!(k in COLORS)) return `"${k}" is not a theme colour. Use one of: ${COLOR_KEYS.join(", ")}.`;
    const hex = normalizeHex(v);
    if (!hex) return `theme.colors.${k} must be a hex colour such as #a78bfa.`; // taste-skill-ignore: example value
    if (hex !== DEFAULT_COLORS[k as ColorKey]) out[k as ColorKey] = hex;
  }
  return { colors: out };
}

export const resolveColors = (theme?: Theme | null): Record<ColorKey, string> => ({ ...DEFAULT_COLORS, ...(theme?.colors ?? {}) });

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

/** The CSS variables one colour sets: itself, plus the tints and lines made from it. */
export function colorVars(key: ColorKey, hex: string): [string, string][] {
  const c = rgb(hex);
  const out: [string, string][] = [[`--${key}`, hex]];
  if (key === "accent") out.push(["--accent-tint", `rgb(${c} / 0.12)`], ["--accent-line", `rgb(${c} / 0.32)`], ["--selection", `rgb(${c} / 0.35)`]);
  if (key === "note" || key === "warn" || key === "danger") out.push([`--${key}-tint`, `rgb(${c} / 0.1)`], [`--${key}-line`, `rgb(${c} / 0.3)`]);
  return out;
}

/**
 * CSS that applies a theme over the defaults in globals.css. Tints and lines derived from a changed
 * colour are rewritten too. Empty when nothing changed, so the default theme renders exactly as before.
 */
export function themeCss(theme?: Theme | null): string {
  const changed = theme?.colors ?? {};
  const vars = (Object.keys(changed) as ColorKey[]).flatMap((k) => {
    const hex = normalizeHex(changed[k]);
    return hex && k in COLORS ? colorVars(k, hex) : [];
  });
  return vars.length ? `:root{${vars.map(([k, v]) => `${k}:${v}`).join(";")}}` : "";
}
