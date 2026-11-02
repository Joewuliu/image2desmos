import { useCallback, useEffect, useRef, useState } from 'react'
import { uploadImage } from '../lib/api'
import { UploadError, type ImageMetadata } from '../lib/types'
import { validateFile } from '../lib/validateFile'

export type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

export interface ImageUploadState {
  status: UploadStatus
  file: File | null
  previewUrl: string | null
  metadata: ImageMetadata | null
  error: string | null
  /** A replacement is being checked; the current image stays until it passes. */
  isReplacing: boolean
  select: (file: File) => void
  reset: () => void
  reportError: (message: string) => void
  dismissError: () => void
}

export function useImageUpload(): ImageUploadState {
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isReplacing, setIsReplacing] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const urlRef = useRef<string | null>(null)
  const pendingUrlRef = useRef<string | null>(null)

  const releaseUrl = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
  }, [])

  const releasePending = useCallback(() => {
    if (pendingUrlRef.current) URL.revokeObjectURL(pendingUrlRef.current)
    pendingUrlRef.current = null
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    releaseUrl()
    releasePending()
    setIsReplacing(false)
    setFile(null)
    setPreviewUrl(null)
    setMetadata(null)
    setError(null)
    setStatus('idle')
  }, [releaseUrl, releasePending])

  const reportError = useCallback(
    (message: string) => {
      abortRef.current?.abort()
      releaseUrl()
      setFile(null)
      setPreviewUrl(null)
      setMetadata(null)
      setError(message)
      setStatus('error')
    },
    [releaseUrl],
  )

  const select = useCallback(
    (next: File) => {
      // A replacement stays in the wings until it passes, so a bad file costs nothing.
      const replacing = urlRef.current !== null
      const problem = validateFile(next)
      if (problem) {
        if (replacing) setError(problem.message)
        else reportError(problem.message)
        return
      }

      abortRef.current?.abort()
      releasePending()
      const controller = new AbortController()
      abortRef.current = controller

      const url = URL.createObjectURL(next)
      setError(null)
      if (replacing) {
        pendingUrlRef.current = url
        setIsReplacing(true)
      } else {
        urlRef.current = url
        setFile(next)
        setPreviewUrl(url)
        setMetadata(null)
        setStatus('uploading')
      }

      uploadImage(next, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return
          if (replacing) {
            releaseUrl()
            urlRef.current = url
            pendingUrlRef.current = null
            setFile(next)
            setPreviewUrl(url)
            setIsReplacing(false)
          }
          setMetadata(result)
          setStatus('success')
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return
          const message = err instanceof UploadError ? err.message : 'Something went wrong. Please try again.'
          setError(message)
          if (replacing) {
            releasePending()
            setIsReplacing(false)
            return
          }
          releaseUrl()
          setFile(null)
          setPreviewUrl(null)
          setStatus('error')
        })
    },
    [releaseUrl, releasePending, reportError],
  )

  useEffect(
    () => () => {
      abortRef.current?.abort()
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      if (pendingUrlRef.current) URL.revokeObjectURL(pendingUrlRef.current)
    },
    [],
  )

  const dismissError = useCallback(() => setError(null), [])

  return { status, file, previewUrl, metadata, error, isReplacing, select, reset, reportError, dismissError }
}
