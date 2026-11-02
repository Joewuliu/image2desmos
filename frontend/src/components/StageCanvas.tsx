import { useMemo } from 'react'
import { DESMOS_API_KEY } from '../lib/config'
import { boundsAspect, curvePathData, polygonPoints, viewBoxFromBounds } from '../lib/geometry'
import { strokeColor } from '../lib/strokes'
import { nearestSegment } from '../lib/hitTest'
import type { ImageMetadata, ProcessResponse } from '../lib/types'
import type { Stage } from './PipelineStrip'
import { DesmosGraph } from './DesmosGraph'

interface StageCanvasProps {
  stage: Stage
  previewUrl: string
  metadata: ImageMetadata | null
  result: ProcessResponse | null
  selectedId: string | null
  onSelect: (id: string | null) => void
  onCalculator: (calculator: DesmosCalculator | null) => void
  restoreKey: number
  /** True while the graph shows the generated equations, not an imported state. */
  generated: boolean
}

export function StageCanvas({
  stage,
  previewUrl,
  metadata,
  result,
  selectedId,
  onSelect,
  onCalculator,
  restoreKey,
  generated,
}: StageCanvasProps) {
  const aspect = result
    ? boundsAspect(result.bounds)
    : metadata
      ? metadata.width / metadata.height
      : 4 / 3

  // Which expression, if any, draws each fitted segment.
  const idBySegment = useMemo(() => {
    const map = new Map<string, string>()
    result?.desmos.expressions.forEach((e) => map.set(`${e.curve}:${e.segment}`, e.id))
    return map
  }, [result])

  // The selected segment, drawn over the stages that have no live curves of their own.
  const selected = result?.desmos.expressions.find((e) => e.id === selectedId)
  const selectedCurve = selected && result?.curves[selected.curve]
  const selectedSegment = selected && selectedCurve?.segments[selected.segment]

  const showGraph = stage === 'graph'

  return (
    <div className="absolute inset-0">
      {/* The calculator stays mounted so exports work from every stage. */}
      {result && (
        <div className={showGraph ? 'absolute inset-0' : 'invisible absolute inset-0'}>
          <DesmosGraph
            apiKey={DESMOS_API_KEY}
            expressions={result.desmos.expressions}
            bounds={result.bounds}
            onCalculator={onCalculator}
            restoreKey={restoreKey}
            selectedId={selectedId}
            highlight={generated}
            onGraphClick={(x, y, tolerance) => {
              if (!generated) return
              const hit = nearestSegment(result.curves, [x, y], tolerance)
              const id = hit ? (idBySegment.get(`${hit.curve}:${hit.segment}`) ?? null) : null
              onSelect(id === selectedId ? null : id)
            }}
          />
        </div>
      )}

      <div hidden={showGraph} className="graph-ground absolute inset-0 p-4 [container-type:size]">
        <div
          className="relative mx-auto border border-line bg-surface"
          style={{
            aspectRatio: aspect,
            width: `min(100cqw, calc(100cqh * ${aspect}))`,
            marginTop: `max(0px, calc((100cqh - 100cqw / ${aspect}) / 2))`,
          }}
        >
          <img
            src={previewUrl}
            alt="Uploaded image preview"
            className={`absolute inset-0 size-full object-fill ${
              stage === 'source'
                ? selected
                  ? 'opacity-30'
                  : ''
                : stage === 'contours' || stage === 'curves'
                  ? 'opacity-10'
                  : 'opacity-0'
            }`}
          />

          {result && stage === 'edges' && (
            <img
              src={result.edge_image}
              alt="Detected edges"
              className={`absolute inset-0 size-full object-fill [image-rendering:pixelated] ${selected ? 'opacity-30' : ''}`}
            />
          )}

          {result && stage === 'contours' && (
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
                  stroke="var(--color-accent)"
                  strokeOpacity={selected ? 0.3 : 1}
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
          )}

          {result && selected && selectedCurve && selectedSegment && stage !== 'curves' && (
            <svg
              aria-hidden="true"
              viewBox={viewBoxFromBounds(result.bounds)}
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 size-full"
            >
              <path
                data-selected-segment={selected.id}
                d={curvePathData({ ...selectedCurve, closed: false, segments: [selectedSegment] })}
                fill="none"
                stroke={strokeColor(selected.curve)}
                strokeWidth={6}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          )}

          {result && stage === 'curves' && (
            <svg
              role="img"
              aria-label="Fitted curves"
              viewBox={viewBoxFromBounds(result.bounds)}
              preserveAspectRatio="none"
              className="absolute inset-0 size-full"
              onClick={(event) => {
                if (event.target === event.currentTarget) onSelect(null)
              }}
            >
              {result.curves.map((curve, i) => (
                <path
                  key={i}
                  data-curve={i}
                  d={curvePathData(curve)}
                  fill="none"
                  stroke={strokeColor(i)}
                  strokeOpacity={selectedId ? 0.25 : 1}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {/* Wide invisible targets; the equation list is the keyboard route. */}
              <g aria-hidden="true" pointerEvents={generated ? undefined : 'none'}>
                {result.curves.flatMap((curve, c) =>
                  curve.segments.map((segment, s) => {
                    const id = idBySegment.get(`${c}:${s}`)
                    if (!id) return null
                    const selected = id === selectedId
                    return (
                      <path
                        key={id}
                        data-expression={id}
                        d={curvePathData({ ...curve, closed: false, segments: [segment] })}
                        fill="none"
                        stroke={strokeColor(c)}
                        strokeOpacity={selected ? 1 : 0}
                        strokeWidth={selected ? 6 : 12}
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                        pointerEvents="stroke"
                        className="cursor-pointer"
                        onClick={() => onSelect(selected ? null : id)}
                      />
                    )
                  }),
                )}
              </g>
            </svg>
          )}
        </div>
      </div>
    </div>
  )
}
