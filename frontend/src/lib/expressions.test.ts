import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyText, expressionsToText } from './expressions'
import type { DesmosExpression } from './types'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('expressionsToText', () => {
  it('joins latex with newlines in order', () => {
    const list: DesmosExpression[] = [
      { id: 'e1', latex: 'a', type: 'line', curve: 0, segment: 0 },
      { id: 'e2', latex: 'b', type: 'circle', curve: 1, segment: 0 },
    ]
    expect(expressionsToText(list)).toBe('a\nb')
    expect(expressionsToText([])).toBe('')
  })
})

describe('copyText', () => {
  it('uses the async clipboard when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    expect(await copyText('hello')).toBe(true)
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('falls back to execCommand when the clipboard API throws', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })
    document.execCommand = vi.fn(() => true)
    expect(await copyText('hello')).toBe(true)
    expect(document.execCommand).toHaveBeenCalledWith('copy')
  })

  it('reports failure when nothing works', async () => {
    vi.stubGlobal('navigator', {})
    document.execCommand = vi.fn(() => false)
    expect(await copyText('hello')).toBe(false)
  })
})
