import { useRef, type ChangeEvent } from 'react'
import type { ProcessingState } from '../hooks/useProcessing'
import { formatBytes } from '../lib/format'
import type { ImageMetadata, ProcessingParams } from '../lib/types'
import { ProcessingControls } from './ProcessingControls'
import { ResultViewer } from './ResultViewer'

interface ImagePreviewProps {
  previewUrl: string
  metadata: ImageMetadata | null
  uploading: boolean
  processing: ProcessingState
  params: ProcessingParams
  onParamsChange: (params: ProcessingParams) => void
  onReplace: (file: File) => void
  onRemove: () => void
}

const WARNING_TEXT: Record<string, string> = {
  no_contours:
    'No outlines were found. Try raising edge sensitivity or lowering blur — or check that the image has visible lines.',
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-paper px-3 py-2.5">
      <dd className="font-display text-2xl text-ink tabular-nums">{value}</dd>
      <dt className="font-mono text-[11px] tracking-wide text-ink-muted uppercase">{label}</dt>
    </div>
  )
}

export function ImagePreview({
  previewUrl,
  metadata,
  uploading,
  processing,
  params,
  onParamsChange,
  onReplace,
  onRemove,
}: ImagePreviewProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { result, status, error } = processing

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onReplace(file)
  }

  const stats = result?.stats
  const warnings = result?.warnings.map((w) => WARNING_TEXT[w]).filter(Boolean) ?? []

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div>
        <ResultViewer
          previewUrl={previewUrl}
          metadata={metadata}
          result={result}
          busy={uploading || status === 'processing'}
        />
        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-vermilion/30 bg-vermilion/8 px-4 py-3 text-sm text-vermilion-deep">
            {error}
          </p>
        )}
        {!error &&
          warnings.map((text) => (
            <p key={text} role="status" className="mt-4 rounded-lg border border-ink/15 bg-paper-raised px-4 py-3 text-sm text-ink-muted">
              {text}
            </p>
          ))}
      </div>

      <div className="flex flex-col gap-6 rounded-2xl border border-ink/15 bg-paper-raised p-6">
        <div>
          <p className="font-mono text-xs tracking-wide text-ink-muted uppercase">Result</p>
          <dl className="mt-3 grid grid-cols-2 gap-2" aria-label="Contour statistics">
            <Stat label="Contours" value={stats ? stats.contour_count.toLocaleString() : '—'} />
            <Stat label="Points" value={stats ? stats.point_count.toLocaleString() : '—'} />
          </dl>
          {metadata && (
            <p className="mt-3 truncate text-xs text-ink-muted" title={metadata.filename}>
              {metadata.filename} · {metadata.width} × {metadata.height} px · {formatBytes(metadata.size_bytes)}
            </p>
          )}
        </div>

        <ProcessingControls params={params} onChange={onParamsChange} />

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
