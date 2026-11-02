import { useRef, type ChangeEvent } from 'react'
import { formatBytes, formatMegapixels } from '../lib/format'
import type { ImageMetadata } from '../lib/types'

interface ImagePreviewProps {
  previewUrl: string
  metadata: ImageMetadata | null
  uploading: boolean
  onReplace: (file: File) => void
  onRemove: () => void
}

export function ImagePreview({ previewUrl, metadata, uploading, onReplace, onRemove }: ImagePreviewProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onReplace(file)
  }

  const rows: [string, string][] = metadata
    ? [
        ['File', metadata.filename],
        ['Format', metadata.format],
        ['Dimensions', `${metadata.width} × ${metadata.height} px`],
        ['Resolution', formatMegapixels(metadata.pixel_count)],
        ['Size', formatBytes(metadata.size_bytes)],
        ['Transparency', metadata.has_alpha ? 'Yes' : 'No'],
      ]
    : []

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="checkerboard relative flex min-h-72 items-center justify-center overflow-hidden rounded-2xl border border-ink/15 p-4">
        <img
          src={previewUrl}
          alt="Uploaded image preview"
          className={`max-h-[28rem] w-auto max-w-full object-contain transition-opacity ${uploading ? 'opacity-50' : ''}`}
        />
        {uploading && (
          <div
            role="status"
            className="absolute inset-x-0 bottom-4 mx-auto flex w-fit items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm text-paper"
          >
            <span className="size-3.5 animate-spin rounded-full border-2 border-paper/30 border-t-paper" />
            Checking image…
          </div>
        )}
      </div>

      <div className="flex flex-col justify-between gap-6 rounded-2xl border border-ink/15 bg-paper-raised p-6">
        <div>
          <p className="font-mono text-xs tracking-wide text-ink-muted uppercase">Image details</p>
          {metadata ? (
            <dl className="mt-4 divide-y divide-ink/10 text-sm">
              {rows.map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="text-ink-muted">{label}</dt>
                  <dd className="min-w-0 truncate text-right font-medium text-ink" title={value}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-4 text-sm text-ink-muted">Reading file…</p>
          )}
        </div>

        <div className="flex gap-3">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg"
            onChange={handleChange}
            className="sr-only"
            tabIndex={-1}
            aria-label="Choose a replacement image"
            data-testid="replace-input"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex-1 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink/85 focus-visible:ring-2 focus-visible:ring-vermilion focus-visible:ring-offset-2 focus-visible:ring-offset-paper focus-visible:outline-none"
          >
            Replace
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="flex-1 rounded-lg border border-ink/25 px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-vermilion hover:text-vermilion-deep focus-visible:ring-2 focus-visible:ring-vermilion focus-visible:ring-offset-2 focus-visible:ring-offset-paper focus-visible:outline-none"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  )
}
