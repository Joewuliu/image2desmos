import { describe, expect, it } from 'vitest'
import { MAX_UPLOAD_BYTES } from './config'
import { validateFile } from './validateFile'

function fileOf(type: string, size: number, name = 'a.png'): File {
  return new File([new Uint8Array(size)], name, { type })
}

describe('validateFile', () => {
  it('accepts PNG and JPEG', () => {
    expect(validateFile(fileOf('image/png', 10))).toBeNull()
    expect(validateFile(fileOf('image/jpeg', 10, 'a.jpg'))).toBeNull()
  })

  it('rejects other types', () => {
    expect(validateFile(fileOf('image/gif', 10))?.code).toBe('unsupported_type')
    expect(validateFile(fileOf('application/pdf', 10))?.code).toBe('unsupported_type')
    expect(validateFile(fileOf('', 10))?.code).toBe('unsupported_type')
  })

  it('rejects empty files', () => {
    expect(validateFile(fileOf('image/png', 0))?.code).toBe('empty_file')
  })

  it('enforces the 10 MB limit', () => {
    expect(validateFile(fileOf('image/png', MAX_UPLOAD_BYTES))).toBeNull()
    expect(validateFile(fileOf('image/png', MAX_UPLOAD_BYTES + 1))?.code).toBe('file_too_large')
  })
})
