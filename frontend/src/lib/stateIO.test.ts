import { describe, expect, it } from 'vitest'
import { MAX_STATE_BYTES, parseStateText, readStateFile, serializeState } from './stateIO'

const validState = {
  version: 11,
  graph: { viewport: { xmin: -10, xmax: 10, ymin: -7, ymax: 7 } },
  expressions: { list: [{ type: 'expression', id: 'e1', latex: 'x^2+y^2=1' }] },
}

describe('parseStateText', () => {
  it('accepts a state exported by Desmos', () => {
    const result = parseStateText(JSON.stringify(validState))
    expect(result).toMatchObject({ ok: true, expressionCount: 1 })
    expect(result.ok && result.state).toEqual(validState)
  })

  it('accepts an empty graph', () => {
    expect(parseStateText('{"expressions":{"list":[]}}')).toMatchObject({ ok: true, expressionCount: 0 })
  })

  it.each([
    ['empty text', '', /empty/i],
    ['whitespace', '   \n ', /empty/i],
    ['broken JSON', '{"expressions": ', /not valid json/i],
    ['plain text', 'hello', /not valid json/i],
    ['an array', '[1,2,3]', /json object/i],
    ['null', 'null', /json object/i],
    ['a number', '42', /json object/i],
    ['an unrelated object', '{"name":"x"}', /does not look like a desmos/i],
    ['expressions without a list', '{"expressions":{}}', /does not look like a desmos/i],
    ['expressions as an array', '{"expressions":[]}', /does not look like a desmos/i],
    ['a non-array list', '{"expressions":{"list":"nope"}}', /does not look like a desmos/i],
    ['junk list entries', '{"expressions":{"list":[1,"a",null]}}', /not valid expressions/i],
  ])('rejects %s with a clear message', (_name, text, message) => {
    const result = parseStateText(text)
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toMatch(message)
  })
})

describe('readStateFile', () => {
  it('reads and validates a file', async () => {
    const file = new File([JSON.stringify(validState)], 'state.json', { type: 'application/json' })
    expect(await readStateFile(file)).toMatchObject({ ok: true, expressionCount: 1 })
  })

  it('reports invalid file contents', async () => {
    const result = await readStateFile(new File(['not json'], 'x.json'))
    expect(result).toMatchObject({ ok: false })
  })

  it('refuses files over the size limit without reading them', async () => {
    const huge = new File(['{}'], 'huge.json')
    Object.defineProperty(huge, 'size', { value: MAX_STATE_BYTES + 1 })
    const result = await readStateFile(huge)
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toMatch(/larger than 25 MB/)
  })
})

describe('serializeState', () => {
  it('round-trips through parseStateText', () => {
    const parsed = parseStateText(serializeState(validState))
    expect(parsed.ok && parsed.state).toEqual(validState)
  })
})
