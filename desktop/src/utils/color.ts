// Solid colors for SVG coloring
export const COLORS_SOLID = [
  "#FF6B6B",
  "#4ECDC4",
  "#FFE66D",
  "#AA80FF",
  "#FFA69E",
  "#80DEEA",
  "#FFB74D",
  "#95AFC0",
];

// Transparent colors for div overlays
export const COLORS_ALPHA = [
  "rgba(255, 107, 107, 0.3)",
  "rgba(78, 205, 196, 0.3)",
  "rgba(255, 230, 109, 0.3)",
  "rgba(170, 128, 255, 0.3)",
  "rgba(255, 166, 158, 0.3)",
  "rgba(128, 222, 234, 0.3)",
  "rgba(255, 183, 77, 0.3)",
  "rgba(149, 175, 192, 0.3)",
];

export function getPatternColor(patternId: number, solid = false): string {
  const colors = solid ? COLORS_SOLID : COLORS_ALPHA;
  return colors[patternId % colors.length];
}
