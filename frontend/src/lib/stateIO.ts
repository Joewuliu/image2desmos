/** Largest Desmos state file we will read (Desmos states are plain JSON). */
export const MAX_STATE_BYTES = 25 * 1024 * 1024

export type ParsedState = { ok: true; state: object; expressionCount: number } | { ok: false; error: string }

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
    return { ok: false, error: 'This is not valid JSON, so it cannot be a Desmos state.' }
  }

  if (!isPlainObject(data)) {
    return { ok: false, error: 'Expected a JSON object containing a Desmos calculator state.' }
  }
  const expressions = data.expressions
  if (!isPlainObject(expressions) || !Array.isArray(expressions.list)) {
    return {
      ok: false,
      error: 'This JSON does not look like a Desmos calculator state (no expressions list found).',
    }
  }
  if (!expressions.list.every(isPlainObject)) {
    return { ok: false, error: 'The expressions list contains entries that are not valid expressions.' }
  }
  return { ok: true, state: data, expressionCount: expressions.list.length }
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
