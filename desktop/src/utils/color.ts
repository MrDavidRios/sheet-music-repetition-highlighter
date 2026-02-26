// Solid colors for SVG coloring
export const COLORS_SOLID = [
  "rgb(0, 129, 175)",
  "rgb(167, 127, 53)",
  "rgb(161, 77, 160)",
  "rgb(98, 139, 72)",
  "rgb(195, 60, 84)",
  "rgb(29, 51, 84)",
  "rgb(114, 169, 143)",
  "rgb(142, 127, 116)",
];

// Transparent colors for div overlays
const opacity = 0.6;
export const COLORS_ALPHA = COLORS_SOLID.map((color) =>
  color.replace(")", `, ${opacity})`)
);

// Semi-opaque colors for rectangle overlays
const rectOpacity = 0.25;
export const COLORS_RECT = COLORS_SOLID.map((color) =>
  color.replace("rgb(", "rgba(").replace(")", `, ${rectOpacity})`)
);

export function getPatternColor(patternId: number, solid = false): string {
  const colors = solid ? COLORS_SOLID : COLORS_ALPHA;
  return colors[patternId % colors.length];
}

export function getPatternRectColor(patternId: number): string {
  return COLORS_RECT[patternId % COLORS_RECT.length];
}
