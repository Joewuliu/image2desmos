// Minimal typings for the parts of the Desmos Graphing Calculator API we use.
// https://www.desmos.com/api/v1.11/docs/index.html

interface DesmosExpressionState {
  id: string
  latex: string
  color?: string
  hidden?: boolean
}

interface DesmosMathBounds {
  left: number
  right: number
  bottom: number
  top: number
}

interface DesmosCalculator {
  setBlank(): void
  setExpressions(expressions: DesmosExpressionState[]): void
  setMathBounds(bounds: DesmosMathBounds): void
  resize(): void
  destroy(): void
}

interface DesmosNamespace {
  GraphingCalculator(element: HTMLElement, options?: Record<string, unknown>): DesmosCalculator
}

interface Window {
  Desmos?: DesmosNamespace
}
