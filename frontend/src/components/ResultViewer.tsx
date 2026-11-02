import { useState } from 'react'
import { boundsAspect, curvePathData, polygonPoints, viewBoxFromBounds } from '../lib/geometry'
import { DESMOS_API_KEY } from '../lib/config'
import { DesmosGraph } from './DesmosGraph'
import { EquationsPanel } from './EquationsPanel'
import { ExportPanel } from './ExportPanel'
import type { ImageMetadata, ProcessResponse } from '../lib/types'

type View = 'original' | 'edges' | 'contours' | 'curves' | 'graph' | 'equations'

const TABS: { id: View; label: string }[] = [
  { id: 'original', label: 'Original' },
  { id: 'edges', label: 'Edges' },
  { id: 'contours', label: 'Contours' },
  { id: 'curves', label: 'Curves' },
  { id: 'graph', label: 'Desmos' },
  { id: 'equations', label: 'Equations' },
]

interface ResultViewerProps {
  previewUrl: string
  metadata: ImageMetadata | null
  result: ProcessResponse | null
  busy: boolean
}

export function ResultViewer({ previewUrl, metadata, result, busy }: ResultViewerProps) {
  const [view, setView] = useState<View>('curves')
  const available = result !== null
  const [calculator, setCalculator] = useState<DesmosCalculator | null>(null)
  const [restoreKey, setRestoreKey] = useState(0)

  const aspect = result
    ? boundsAspect(result.bounds)
    : metadata
      ? metadata.width / metadata.height
      : undefined

  return (
    <div>
      <div role="tablist" aria-label="Preview" className="mb-3 flex flex-wrap gap-1 rounded-lg border border-ink/15 bg-paper-raised p-1 sm:inline-flex">
        {TABS.map((tab) => {
          const disabled = tab.id !== 'original' && !available
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={view === tab.id}
              disabled={disabled}
              onClick={() => setView(tab.id)}
              className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-vermilion focus-visible:outline-none ${
                view === tab.id ? 'bg-ink text-paper' : 'text-ink-muted hover:text-ink'
              } disabled:cursor-not-allowed disabled:text-ink/30 disabled:hover:text-ink/30`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {result && view === 'graph' && (
        <DesmosGraph
          expressions={result.desmos.expressions}
          bounds={result.bounds}
          onCalculator={setCalculator}
          restoreKey={restoreKey}
        />
      )}
      {result && view === 'equations' && <EquationsPanel desmos={result.desmos} />}

      <div
        hidden={view === 'graph' || view === 'equations'}
        className="checkerboard relative flex items-center justify-center overflow-hidden rounded-2xl border border-ink/15 p-3 sm:p-4">
        <div
          className="relative w-full max-w-full"
          style={{ aspectRatio: aspect, maxHeight: '32rem', maxWidth: aspect ? `min(100%, ${32 * aspect}rem)` : undefined }}
        >
          <img
            src={previewUrl}
            alt="Uploaded image preview"
            className={`absolute inset-0 size-full object-fill transition-opacity ${
              view === 'original'
                ? 'opacity-100'
                : view === 'contours' || view === 'curves'
                  ? 'opacity-25'
                  : 'opacity-0'
            }`}
          />

          {result && view === 'edges' && (
            <img
              src={result.edge_image}
              alt="Detected edges"
              className="absolute inset-0 size-full object-fill [image-rendering:pixelated]"
            />
          )}

          {result && view === 'contours' && (
            <svg
              role="img"
              aria-label="Extracted contours"
              viewBox={viewBoxFromBounds(result.bounds)}
              preserveAspectRatio="none"
              className="absolute inset-0 size-full"
            >
              {result.contours.map((contour, i) => (
                <polygon
                  key={i}
                  points={polygonPoints(contour)}
                  fill="none"
                  stroke="var(--color-vermilion)"
                  strokeWidth={1.6}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
          )}

          {result && view === 'curves' && (
            <svg
              role="img"
              aria-label="Fitted curves"
              viewBox={viewBoxFromBounds(result.bounds)}
              preserveAspectRatio="none"
              className="absolute inset-0 size-full"
            >
              {result.curves.map((curve, i) => (
                <path
                  key={i}
                  d={curvePathData(curve)}
                  fill="none"
                  stroke="var(--color-curve)"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
          )}
        </div>

        {busy && (
          <div
            role="status"
            className="absolute inset-x-0 bottom-4 mx-auto flex w-fit items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm text-paper"
          >
            <span className="size-3.5 animate-spin rounded-full border-2 border-paper/30 border-t-paper" />
            {result ? 'Updating…' : 'Tracing…'}
          </div>
        )}
      </div>

      {result && (
        <ExportPanel
          desmos={result.desmos}
          sourceName={result.image.filename}
          hasApiKey={DESMOS_API_KEY !== ''}
          calculator={calculator}
          onNeedGraph={() => setView('graph')}
          onRestore={() => setRestoreKey((n) => n + 1)}
        />
      )}
    </div>
  )
}
