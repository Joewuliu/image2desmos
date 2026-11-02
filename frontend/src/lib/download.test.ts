import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dataUrlToBlob, downloadBlob, downloadText, exportFileName } from './download'

export function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
}

describe('exportFileName', () => {
  it('derives a safe name from the uploaded file', () => {
    expect(exportFileName('sketch.png', 'desmos', 'txt')).toBe('sketch-desmos.txt')
    expect(exportFileName('My Cat Drawing (final).JPG', 'desmos-state', 'json')).toBe(
      'My-Cat-Drawing-final-desmos-state.json',
    )
  })

  it('strips path-like and hostile characters', () => {
    expect(exportFileName('../../etc/passwd.png', 'desmos', 'png')).toBe('etc-passwd-desmos.png')
    expect(exportFileName('<script>.png', 'desmos', 'png')).toBe('script-desmos.png')
  })

  it('falls back to "image" and limits length', () => {
    expect(exportFileName(undefined, 'desmos', 'txt')).toBe('image-desmos.txt')
    expect(exportFileName('....png', 'desmos', 'txt')).toBe('image-desmos.txt')
    expect(exportFileName(`${'a'.repeat(200)}.png`, 'd', 'txt').length).toBeLessThan(80)
  })
})

describe('downloads', () => {
  let created: Blob[]
  let clicked: { download: string; href: string }[]

  beforeEach(() => {
    created = []
    clicked = []
    URL.createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob)
      return `blob:test-${created.length}`
    })
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ download: this.download, href: this.href })
    })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('downloads a blob through a temporary link and cleans up', () => {
    downloadBlob(new Blob(['hi']), 'a.txt')
    expect(clicked).toEqual([{ download: 'a.txt', href: 'blob:test-1' }])
    expect(document.querySelector('a[download]')).toBeNull()
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-1')
  })

  it('downloads text with the given type', async () => {
    downloadText('line1\nline2', 'x.txt', 'text/plain')
    expect(created[0].type).toBe('text/plain;charset=utf-8')
    vi.useRealTimers()
    expect(await readBlob(created[0])).toBe('line1\nline2')
  })

  it('still revokes the URL if the click throws', () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => downloadBlob(new Blob(['x']), 'a.txt')).toThrow('blocked')
    vi.advanceTimersByTime(1000)
    expect(URL.revokeObjectURL).toHaveBeenCalled()
  })
})

describe('dataUrlToBlob', () => {
  it('decodes base64 PNG data URIs to the original bytes', async () => {
    const blob = dataUrlToBlob(`data:image/png;base64,${btoa('\u0089PNG-bytes')}`)
    expect(blob.type).toBe('image/png')
    expect(blob.size).toBe(10)
  })

  it('decodes non-base64 data URIs', async () => {
    const blob = dataUrlToBlob('data:text/plain,hello%20world')
    expect(blob.type).toBe('text/plain')
    expect(await readBlob(blob)).toBe('hello world')
  })

  it('rejects things that are not data URLs', () => {
    expect(() => dataUrlToBlob('https://example.com/x.png')).toThrow()
    expect(() => dataUrlToBlob('')).toThrow()
  })
})
