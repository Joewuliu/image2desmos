import { describe, expect, it } from 'vitest'
import { MAX_STATE_BYTES, parseStateText, readStateFile, serializeState, stateExpressions } from './stateIO'

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
    ['broken JSON', '{"expressions": ', /isn.t a saved image2desmos state/i],
    ['plain text', 'hello', /isn.t a saved image2desmos state/i],
    ['an array', '[1,2,3]', /isn.t a saved image2desmos state/i],
    ['null', 'null', /isn.t a saved image2desmos state/i],
    ['a number', '42', /isn.t a saved image2desmos state/i],
    ['an unrelated object', '{"name":"x"}', /isn.t a saved image2desmos state/i],
    ['expressions without a list', '{"expressions":{}}', /isn.t a saved image2desmos state/i],
    ['expressions as an array', '{"expressions":[]}', /isn.t a saved image2desmos state/i],
    ['a non-array list', '{"expressions":{"list":"nope"}}', /isn.t a saved image2desmos state/i],
    ['junk list entries', '{"expressions":{"list":[1,"a",null]}}', /isn.t a saved image2desmos state/i],
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

describe('stateExpressions', () => {
  it('lists what the state really contains, with its colours and kinds', () => {
    const out = stateExpressions({
      expressions: {
        list: [
          { type: 'expression', id: 'a', latex: String.raw`\left(3t+1,2\right)\left\{0\le t\le1\right\}`, color: '#123456' },
          { type: 'expression', id: 'b', latex: String.raw`\left(t^3,t\right)\left\{0\le t\le1\right\}` },
          { type: 'expression', id: 'c', latex: String.raw`\left(x-1\right)^2+y^2=4^2` },
          { type: 'expression', id: 'd', latex: 'y=x' },
          { type: 'text', id: 'e', text: 'a note' },
          { type: 'expression', id: 'f' },
          { type: 'expression', id: 'g', latex: '  ' },
        ],
      },
    })
    expect(out.count).toBe(4)
    expect(out.expressions.map((e) => e.type)).toEqual(['line', 'bezier', 'circle', 'other'])
    expect(out.expressions[0].color).toBe('#123456')
    expect(out.expressions.map((e) => e.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('handles an empty graph', () => {
    expect(stateExpressions({ expressions: { list: [] } }).count).toBe(0)
  })
})

describe('serializeState', () => {
  it('round-trips through parseStateText', () => {
    const parsed = parseStateText(serializeState(validState))
    expect(parsed.ok && parsed.state).toEqual(validState)
  })
})
