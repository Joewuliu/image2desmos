/** Graph colours, one per stroke, repeating. They match --color-stroke-* in index.css. */
export const STROKE_COLORS = ['#c74440', '#2d70b3', '#388c46', '#6042a6', '#fa7e19', '#000000'] as const

export function strokeColor(curve: number): string {
  return STROKE_COLORS[curve % STROKE_COLORS.length]
}

/** Desmos draws lines 2.5 px wide by default. */
export const LINE_WIDTH = 2.5
export const SELECTED_LINE_WIDTH = 6
/**
 * Pale solid version of a stroke colour for curves behind a selection. Solid,
 * because translucent segments darken where they overlap at their joints.
 */
export function dimmedColor(color: string): string {
  const channels = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16))
  const mixed = channels.map((c) => Math.round(c + (255 - c) * 0.8))
  return `#${mixed.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

/** Above this many expressions, dimming the rest on every selection is too slow. */
export const MAX_DIMMED_EXPRESSIONS = 800
