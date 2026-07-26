/**
 * Colour swatches for the filter bar. Product colours arrive as free text from
 * whichever boutique they came from, so this maps the common vocabulary onto
 * hexes and falls back to a stable pastel for anything unrecognised.
 */

const SWATCHES: Record<string, string> = {
  black: "#1f2937",
  white: "#fdfdfd",
  ivory: "#f7f1e6",
  cream: "#f5ecd9",
  beige: "#e8d8c3",
  nude: "#e3c1ab",
  tan: "#cfa276",
  camel: "#c19a6b",
  brown: "#8b5e3c",
  chocolate: "#5b3a29",
  taupe: "#a89a8c",
  grey: "#9ca3af",
  gray: "#9ca3af",
  charcoal: "#3f4550",
  silver: "#c7ccd3",
  gold: "#e6c46a",
  "rose gold": "#e0b0a4",
  red: "#dc2626",
  maroon: "#7f1d1d",
  burgundy: "#6b1f36",
  wine: "#722f45",
  rust: "#b7410e",
  orange: "#f97316",
  peach: "#ffcbA4",
  coral: "#ff7f6a",
  pink: "#f472b6",
  "hot pink": "#ec4899",
  blush: "#f8c8d8",
  fuchsia: "#d926a9",
  magenta: "#c026d3",
  purple: "#7c3aed",
  lavender: "#a78bfa",
  lilac: "#c4b0e8",
  mauve: "#b784a7",
  plum: "#6b2d5c",
  navy: "#1e3a5f",
  blue: "#2563eb",
  "sky blue": "#7dd3fc",
  teal: "#0d9488",
  turquoise: "#40c9c9",
  mint: "#a7e8c4",
  green: "#16a34a",
  olive: "#6b7f3a",
  sage: "#a3b18a",
  emerald: "#059669",
  yellow: "#facc15",
  mustard: "#d4a017",
  lemon: "#f4e04d",
  multi: "#f472b6",
  multicolour: "#f472b6",
  multicolor: "#f472b6",
  print: "#f0a6c0",
  floral: "#f0a6c0",
};

/** Deterministic pastel for colours we do not have on file. */
function fallbackSwatch(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 58% 72%)`;
}

export function colorSwatch(name: string | null | undefined): string {
  if (!name) return "#e5e7eb";
  const key = name.trim().toLowerCase();
  if (SWATCHES[key]) return SWATCHES[key];
  // "Dusty Rose Pink" → try the most specific trailing words first.
  const words = key.split(/[\s/&,-]+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    const tail = words.slice(i).join(" ");
    if (SWATCHES[tail]) return SWATCHES[tail];
  }
  for (const word of [...words].reverse()) {
    if (SWATCHES[word]) return SWATCHES[word];
  }
  return fallbackSwatch(key);
}

/** Title-cases a free-text colour for display: "dusty rose" → "Dusty Rose". */
export function colorLabel(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(
      /(^|\s|-)([a-z])/g,
      (_, lead: string, ch: string) => lead + ch.toUpperCase(),
    );
}

/** True when a swatch is so pale it needs a hairline to be visible. */
export function swatchNeedsRing(hex: string): boolean {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return false;
  const value = parseInt(match[1], 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  // Rec. 709 luma
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 226;
}
