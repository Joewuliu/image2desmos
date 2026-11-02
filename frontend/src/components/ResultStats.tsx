import type { ProcessResponse } from '../lib/types'
import { MathText } from './MathText'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-2xs text-ink-muted">{label}</dt>
      <dd className="text-sm font-medium text-ink tabular-nums">{value}</dd>
    </div>
  )
}

export function ResultStats({ result }: { result: ProcessResponse }) {
  const { stats, fit } = result
  return (
    <div className="flex-none border-b border-line px-3 py-2">
      <dl className="grid grid-cols-4 gap-2" aria-label="Contour statistics">
        <Stat label="Contours" value={stats.contour_count.toLocaleString()} />
        <Stat label="Points" value={stats.point_count.toLocaleString()} />
        <Stat label="Segments" value={fit.segment_count.toLocaleString()} />
        <Stat label="Max error" value={`${fit.max_error_px.toFixed(2)} px`} />
      </dl>
      {fit.segment_count > 0 && (
        <p className="mt-1 text-xs text-ink-muted tabular-nums max-sm:hidden">
          {fit.line_count} {fit.line_count === 1 ? 'line' : 'lines'} · {fit.bezier_count}{' '}
          {fit.bezier_count === 1 ? 'Bézier' : 'Béziers'} · {fit.circle_count}{' '}
          {fit.circle_count === 1 ? 'circle' : 'circles'} · mean error {fit.mean_error_px.toFixed(2)} px
        </p>
      )}
      {fit.segment_count > 0 && (
        <p className="mt-0.5 text-xs text-ink-muted">
          Parametric curves run over <MathText latex={String.raw`0\le t\le 1`} />
        </p>
      )}
    </div>
  )
}
