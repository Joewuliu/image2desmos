import { useEffect, useState } from 'react'
import { processImage } from '../lib/api'
import { UploadError, type ProcessResponse, type ProcessingParams } from '../lib/types'

export type ProcessingStatus = 'idle' | 'processing' | 'ready' | 'error'

export interface ProcessingState {
  status: ProcessingStatus
  result: ProcessResponse | null
  error: string | null
}

interface Settled {
  file: File
  key: string
  result: ProcessResponse | null
  error: string | null
}

const DEBOUNCE_MS = 300

/**
 * Re-runs server-side processing whenever the file or any parameter changes.
 * Requests are debounced and superseded ones are aborted. The previous result
 * for the same file stays visible while a new one loads so the preview doesn't
 * flicker; a result for a different file is never shown.
 */
export function useProcessing(
  file: File | null,
  params: ProcessingParams,
  debounceMs: number = DEBOUNCE_MS,
): ProcessingState {
  const [settled, setSettled] = useState<Settled | null>(null)
  const { blur_sigma, edge_sensitivity, simplify, fit_tolerance, min_contour_size } = params
  const key = [blur_sigma, edge_sensitivity, simplify, fit_tolerance, min_contour_size].join('|')

  useEffect(() => {
    if (!file) return
    const controller = new AbortController()

    const timer = setTimeout(() => {
      processImage(
        file,
        { blur_sigma, edge_sensitivity, simplify, fit_tolerance, min_contour_size },
        controller.signal,
      )
        .then((result) => {
          if (!controller.signal.aborted) setSettled({ file, key, result, error: null })
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return
          const error =
            err instanceof UploadError ? err.message : 'Processing failed. Please try again.'
          setSettled((prev) => ({
            file,
            key,
            result: prev?.file === file ? prev.result : null,
            error,
          }))
        })
    }, debounceMs)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [file, key, blur_sigma, edge_sensitivity, simplify, fit_tolerance, min_contour_size, debounceMs])

  if (!file) return { status: 'idle', result: null, error: null }

  const current = settled?.file === file ? settled : null
  const result = current?.result ?? null
  if (current?.key === key) {
    return current.error
      ? { status: 'error', result, error: current.error }
      : { status: 'ready', result, error: null }
  }
  return { status: 'processing', result, error: null }
}
