export interface EquationLine {
  label: string | null
  latex: string
}

const PARAMETRIC = /^\\left\((.+),(.+)\\right\)\\left\\\{0\\le t\\le1\\right\\\}$/

/**
 * Display form of a serialized expression. A parametric point becomes separate
 * x(t) and y(t) lines, which fit a sidebar and read better than one long
 * point. Anything else is shown as written. This never changes the expression
 * that is plotted or copied.
 */
export function equationLines(latex: string): EquationLine[] {
  const parametric = PARAMETRIC.exec(latex)
  if (!parametric) return [{ label: null, latex }]
  return [
    { label: 'x(t)', latex: parametric[1] },
    { label: 'y(t)', latex: parametric[2] },
  ]
}
