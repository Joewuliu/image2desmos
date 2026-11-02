import type { DesmosExpression, DesmosOutput } from './types'

/** Largest Desmos state file we will read (Desmos states are plain JSON). */
export const MAX_STATE_BYTES = 25 * 1024 * 1024

export type ParsedState = { ok: true; state: object; expressionCount: number } | { ok: false; error: string }

const NOT_A_STATE = "This isn't a saved Image2Desmos state. Choose a .json file exported from here."

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Validates text claimed to be a Desmos calculator state exported by this app
 * (the output of `calculator.getState()`).
 *
 * Desmos treats states as opaque, so this only checks the structure every
 * graphing-calculator state has: a JSON object with `expressions.list`, an
 * array of expression objects. It cannot prove Desmos will accept the state;
 * `setState` is still wrapped in error handling by the caller.
 */
export function parseStateText(text: string): ParsedState {
  if (text.trim() === '') return { ok: false, error: 'The file is empty.' }

  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: NOT_A_STATE }
  }

  if (!isPlainObject(data)) {
    return { ok: false, error: NOT_A_STATE }
  }
  const expressions = data.expressions
  if (!isPlainObject(expressions) || !Array.isArray(expressions.list)) {
    return {
      ok: false,
      error: NOT_A_STATE,
    }
  }
  if (!expressions.list.every(isPlainObject)) {
    return { ok: false, error: NOT_A_STATE }
  }
  return { ok: true, state: data, expressionCount: expressions.list.length }
}

// Desmos picks a colour for rows saved without one; a neutral dot claims nothing.
const UNKNOWN_COLOR = '#7b888e'

function classify(latex: string): DesmosExpression['type'] {
  const parametric = latex.endsWith(String.raw`\left\{0\le t\le1\right\}`)
  if (parametric) return latex.includes('t^3') || latex.includes('t^2') ? 'bezier' : 'line'
  return /^(\\left\(x[+-][\d.]+\\right\)|x)\^2\+(\\left\(y[+-][\d.]+\\right\)|y)\^2=/.test(latex)
    ? 'circle'
    : 'other'
}

/**
 * The expressions an already validated state really contains, so the list can
 * describe what the graph shows. Notes, folders and tables have no equation to
 * list, and blank expression rows are skipped.
 */
export function stateExpressions(state: object): DesmosOutput {
  const list = (state as { expressions: { list: Record<string, unknown>[] } }).expressions.list
  const expressions: DesmosExpression[] = []
  list.forEach((item, index) => {
    if ((item.type ?? 'expression') !== 'expression') return
    if (typeof item.latex !== 'string' || item.latex.trim() === '') return
    expressions.push({
      id: typeof item.id === 'string' ? item.id : `imported-${index}`,
      latex: item.latex,
      type: classify(item.latex),
      color: typeof item.color === 'string' ? item.color : UNKNOWN_COLOR,
      curve: 0,
      segment: expressions.length,
    })
  })
  return { expressions, count: expressions.length, skipped: {}, skipped_count: 0 }
}

function readText(file: Blob): Promise<string> {
  if (typeof file.text === 'function') return file.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

/** Reads and validates a user-selected file. */
export async function readStateFile(file: File): Promise<ParsedState> {
  if (file.size > MAX_STATE_BYTES) {
    return { ok: false, error: 'That file is larger than 25 MB, which is too big to be a Desmos state.' }
  }
  let text: string
  try {
    text = await readText(file)
  } catch {
    return { ok: false, error: 'The file could not be read.' }
  }
  return parseStateText(text)
}

export function serializeState(state: unknown): string {
  return JSON.stringify(state)
}
