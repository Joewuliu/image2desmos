import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function freshModule() {
  vi.resetModules()
  return import('./desmos')
}

const scripts = () => Array.from(document.head.querySelectorAll('script'))
const fakeDesmos = (): DesmosNamespace => ({ GraphingCalculator: vi.fn() })

beforeEach(() => {
  delete window.Desmos
  scripts().forEach((s) => s.remove())
})

afterEach(() => {
  delete window.Desmos
})

describe('desmosScriptUrl', () => {
  it('uses the official API URL and encodes the key', async () => {
    const { desmosScriptUrl } = await freshModule()
    expect(desmosScriptUrl('abc 123')).toBe(
      'https://www.desmos.com/api/v1.11/calculator.js?apiKey=abc%20123',
    )
  })
})

describe('loadDesmos', () => {
  it('injects one script, shares the promise, and resolves with window.Desmos', async () => {
    const { loadDesmos } = await freshModule()
    const first = loadDesmos('key')
    const second = loadDesmos('key')
    expect(scripts()).toHaveLength(1)
    expect(scripts()[0].src).toContain('apiKey=key')

    const fake = fakeDesmos()
    window.Desmos = fake
    scripts()[0].onload?.(new Event('load'))
    await expect(first).resolves.toBe(fake)
    await expect(second).resolves.toBe(fake)
  })

  it('resolves immediately when Desmos is already present', async () => {
    const { loadDesmos } = await freshModule()
    const fake = fakeDesmos()
    window.Desmos = fake
    await expect(loadDesmos('key')).resolves.toBe(fake)
    expect(scripts()).toHaveLength(0)
  })

  it('rejects on a network error and can be retried', async () => {
    const { loadDesmos } = await freshModule()
    const failed = loadDesmos('key')
    scripts()[0].onerror?.(new Event('error'))
    await expect(failed).rejects.toThrow(/could not load the desmos calculator/i)

    const retry = loadDesmos('key')
    expect(scripts()).toHaveLength(1) // the failed script was removed and a new one added
    window.Desmos = fakeDesmos()
    scripts()[0].onload?.(new Event('load'))
    await expect(retry).resolves.toBeDefined()
  })

  it('rejects when the script loads but defines nothing', async () => {
    const { loadDesmos } = await freshModule()
    const pending = loadDesmos('key')
    scripts()[0].onload?.(new Event('load'))
    await expect(pending).rejects.toThrow(/did not define/i)
  })
})
