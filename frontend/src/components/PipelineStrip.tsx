import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { curvePathData, polygonPoints, viewBoxFromBounds } from '../lib/geometry'
import { strokeColor } from '../lib/strokes'
import type { ImageMetadata, ProcessResponse } from '../lib/types'

export type Stage = 'source' | 'edges' | 'contours' | 'curves' | 'graph'

const STAGES: { id: Stage; label: string }[] = [
  { id: 'source', label: 'Source' },
  { id: 'edges', label: 'Edges' },
  { id: 'contours', label: 'Contours' },
  { id: 'curves', label: 'Curves' },
  { id: 'graph', label: 'Graph' },
]

interface PipelineStripProps {
  stage: Stage
  onStage: (stage: Stage) => void
  previewUrl: string | null
  metadata: ImageMetadata | null
  result: ProcessResponse | null
  /** Expressions the Graph stage is showing, which an imported state can change. */
  graphCount: number
  /** The Graph stage shows an imported state, not these curves. */
  imported: boolean
  /** A saved state is open with no image behind it, so only Graph has anything to show. */
  graphOnly?: boolean
}

function detail(
  id: Stage,
  metadata: ImageMetadata | null,
  result: ProcessResponse | null,
  graphCount: number,
  graphOnly: boolean,
): string {
  if (id === 'source') return metadata ? `${metadata.width} × ${metadata.height}` : 'No image'
  if (!result && !(id === 'graph' && graphOnly)) return '—'
  if (id === 'edges') return `${result?.stats.edge_pixel_count.toLocaleString()} px`
  if (id === 'contours') return `${result?.stats.point_count.toLocaleString()} points`
  if (id === 'curves') return `${result?.fit.segment_count.toLocaleString()} segments`
  return `${graphCount.toLocaleString()} ${graphCount === 1 ? 'expression' : 'expressions'}`
}

function Thumb({ children }: { children?: ReactNode }) {
  return (
    <span className="relative hidden h-9 w-12 flex-none overflow-hidden border border-line bg-surface @3xl:block">
      {children}
    </span>
  )
}

function thumbnail(
  id: Stage,
  previewUrl: string | null,
  result: ProcessResponse | null,
  imported: boolean,
) {
  const image = 'absolute inset-0 size-full object-contain'
  if (id === 'source') return previewUrl ? <img src={previewUrl} alt="" className={image} /> : null
  if (!result) return null
  // Downscaling washes out one-pixel edges, so push them back to dark.
  if (id === 'edges') {
    return <img src={result.edge_image} alt="" className={`${image} [filter:brightness(0.55)_contrast(20)]`} />
  }
  const box = { viewBox: viewBoxFromBounds(result.bounds), className: 'absolute inset-0 size-full', 'aria-hidden': true }
  if (id === 'contours') {
    return (
      <svg {...box}>
        {result.contours.map((contour, i) => (
          <polygon key={i} points={polygonPoints(contour)} fill="none" stroke="var(--color-accent)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
    )
  }
  return (
    <svg {...box}>
      {id === 'graph' && (
        <path d="M-99,0H99M0,-99V99" stroke="var(--color-line-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      )}
      {!(id === 'graph' && imported) && result.curves.map((curve, i) => (
        <path key={i} d={curvePathData(curve)} fill="none" stroke={strokeColor(i)} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  )
}

export function PipelineStrip({
  stage,
  onStage,
  previewUrl,
  metadata,
  result,
  graphCount,
  imported,
  graphOnly = false,
}: PipelineStripProps) {
  const tabs = useRef(new Map<Stage, HTMLButtonElement>())
  const enabled = STAGES.filter((s) =>
    s.id === 'source' ? previewUrl !== null : result !== null || (graphOnly && s.id === 'graph'),
  )

  const handleKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (step === 0 || enabled.length === 0) return
    event.preventDefault()
    const index = enabled.findIndex((s) => s.id === stage)
    const next = enabled[(index + step + enabled.length) % enabled.length]
    onStage(next.id)
    tabs.current.get(next.id)?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label="Pipeline"
      className="@container flex h-[3.3125rem] flex-none overflow-hidden border-t border-line bg-gutter"
    >
      {STAGES.map((s, i) => {
        const selected = s.id === stage
        const disabled = !enabled.includes(s)
        return (
          <button
            key={s.id}
            ref={(node) => {
              if (node) tabs.current.set(s.id, node)
            }}
            type="button"
            role="tab"
            aria-label={s.label}
            aria-description={detail(s.id, metadata, result, graphCount, graphOnly)}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => onStage(s.id)}
            onKeyDown={handleKey}
            className={`group relative flex min-w-0 flex-1 items-center gap-2 px-1 text-left sm:px-2.5 transition-colors outline-offset-[-2px] ${
              i > 0 ? 'border-l border-line' : ''
            } ${selected ? 'bg-surface shadow-[inset_0_2px_0_var(--color-accent)]' : 'enabled:hover:bg-surface'} disabled:cursor-not-allowed`}
          >
            <Thumb>{thumbnail(s.id, previewUrl, result, imported)}</Thumb>
            {i > 0 && (
              <svg viewBox="0 0 6 10" aria-hidden="true" className="absolute top-1/2 -left-[3.5px] z-10 hidden h-2.5 w-1.5 -translate-y-1/2 @xl:block">
                <path d="M0 0 6 5 0 10Z" fill="var(--color-line-strong)" />
              </svg>
            )}
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-center text-xs leading-4 @xl:text-left @xl:text-ui ${disabled ? 'text-ink-muted' : 'font-medium text-ink'}`}>
                {s.label}
              </span>
              <span className="hidden truncate text-center text-2xs text-ink-muted tabular-nums @xl:block @xl:text-left">
                {detail(s.id, metadata, result, graphCount, graphOnly)}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
