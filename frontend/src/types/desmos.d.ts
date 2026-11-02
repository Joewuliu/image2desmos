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

interface DesmosScreenshotOptions {
  width?: number
  height?: number
  targetPixelRatio?: number
  format?: 'png' | 'svg'
  mode?: 'contain' | 'stretch' | 'preserveX' | 'preserveY'
  mathBounds?: DesmosMathBounds
}

interface DesmosCalculator {
  /** Opaque, JSON-serialisable calculator state. */
  getState(): unknown
  setState(state: unknown, options?: { allowUndo?: boolean; remapColors?: boolean }): void
  screenshot(options?: DesmosScreenshotOptions): string
  asyncScreenshot(options: DesmosScreenshotOptions, callback: (data: string) => void): void
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
