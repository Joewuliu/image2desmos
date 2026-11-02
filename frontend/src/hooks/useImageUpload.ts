import { useCallback, useEffect, useRef, useState } from 'react'
import { uploadImage } from '../lib/api'
import { UploadError, type ImageMetadata } from '../lib/types'
import { validateFile } from '../lib/validateFile'

export type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

export interface ImageUploadState {
  status: UploadStatus
  previewUrl: string | null
  metadata: ImageMetadata | null
  error: string | null
  select: (file: File) => void
  reset: () => void
  reportError: (message: string) => void
}

export function useImageUpload(): ImageUploadState {
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const urlRef = useRef<string | null>(null)

  const releaseUrl = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    releaseUrl()
    setPreviewUrl(null)
    setMetadata(null)
    setError(null)
    setStatus('idle')
  }, [releaseUrl])

  const reportError = useCallback(
    (message: string) => {
      abortRef.current?.abort()
      releaseUrl()
      setPreviewUrl(null)
      setMetadata(null)
      setError(message)
      setStatus('error')
    },
    [releaseUrl],
  )

  const select = useCallback(
    (file: File) => {
      const problem = validateFile(file)
      if (problem) {
        reportError(problem.message)
        return
      }

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      releaseUrl()
      const url = URL.createObjectURL(file)
      urlRef.current = url
      setPreviewUrl(url)
      setMetadata(null)
      setError(null)
      setStatus('uploading')

      uploadImage(file, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return
          setMetadata(result)
          setStatus('success')
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return
          releaseUrl()
          setPreviewUrl(null)
          setError(err instanceof UploadError ? err.message : 'Something went wrong. Please try again.')
          setStatus('error')
        })
    },
    [releaseUrl, reportError],
  )

  useEffect(
    () => () => {
      abortRef.current?.abort()
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    },
    [],
  )

  return { status, previewUrl, metadata, error, select, reset, reportError }
}
