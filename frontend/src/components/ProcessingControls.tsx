import { useId } from 'react'
import { DEFAULT_PARAMS, type ProcessingParams } from '../lib/types'

interface ProcessingControlsProps {
  params: ProcessingParams
  onChange: (params: ProcessingParams) => void
}

interface SliderSpec {
  key: keyof ProcessingParams
  label: string
  hint: string
  min: number
  max: number
  step: number
  low: string
  high: string
  unit?: string
  group: 'tracing' | 'fitting'
}

const SLIDERS: SliderSpec[] = [
  {
    group: 'tracing',
    key: 'edge_sensitivity',
    label: 'Edge sensitivity',
    hint: 'How faint a line can be and still count as an edge.',
    min: 0,
    max: 100,
    step: 1,
    low: 'Bold only',
    high: 'Faint too',
  },
  {
    group: 'tracing',
    key: 'blur_sigma',
    label: 'Blur',
    hint: 'Smooths out speckle and paper texture before detecting edges.',
    min: 0,
    max: 5,
    step: 0.5,
    low: 'Sharp',
    high: 'Smooth',
  },
  {
    group: 'tracing',
    key: 'simplify',
    label: 'Simplification',
    hint: 'Replaces wiggly outlines with fewer straight segments.',
    min: 0,
    max: 10,
    step: 0.5,
    low: 'Exact',
    high: 'Coarse',
  },
  {
    group: 'fitting',
    key: 'fit_tolerance',
    label: 'Fitting accuracy',
    hint: 'How far a curve may stray from the traced outline. Tighter fits need more segments.',
    min: 0.5,
    max: 5,
    step: 0.1,
    low: 'Precise',
    high: 'Loose',
    unit: ' px',
  },
  {
    group: 'fitting',
    key: 'min_contour_size',
    label: 'Minimum contour size',
    hint: 'Drops specks and fragments smaller than this share of the image.',
    min: 0,
    max: 20,
    step: 0.5,
    low: 'Keep all',
    high: 'Large only',
    unit: '%',
  },
]

const GROUPS: { id: SliderSpec['group']; title: string }[] = [
  { id: 'tracing', title: 'Tracing' },
  { id: 'fitting', title: 'Curve fitting' },
]

function Slider({ spec, value, onChange }: { spec: SliderSpec; value: number; onChange: (v: number) => void }) {
  const id = useId()
  const hintId = useId()
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {spec.label}
        </label>
        <output htmlFor={id} className="font-mono text-sm text-vermilion-deep tabular-nums">
          {value}
          {spec.unit}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={value}
        aria-describedby={hintId}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink/15 accent-vermilion focus-visible:ring-2 focus-visible:ring-vermilion focus-visible:ring-offset-2 focus-visible:ring-offset-paper-raised focus-visible:outline-none"
      />
      <div className="mt-1 flex justify-between font-mono text-[11px] tracking-wide text-ink/45 uppercase">
        <span>{spec.low}</span>
        <span>{spec.high}</span>
      </div>
      <p id={hintId} className="mt-1 text-xs text-ink-muted">
        {spec.hint}
      </p>
    </div>
  )
}

export function ProcessingControls({ params, onChange }: ProcessingControlsProps) {
  const isDefault = SLIDERS.every((s) => params[s.key] === DEFAULT_PARAMS[s.key])
  return (
    <section aria-label="Processing controls" className="space-y-6">
      {GROUPS.map((group, index) => (
        <div key={group.id} className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs tracking-wide text-ink-muted uppercase">{group.title}</p>
            {index === 0 && (
              <button
                type="button"
                disabled={isDefault}
                onClick={() => onChange(DEFAULT_PARAMS)}
                className="text-xs font-medium text-ink underline underline-offset-4 hover:text-vermilion-deep disabled:cursor-default disabled:text-ink/30 disabled:no-underline"
              >
                Reset
              </button>
            )}
          </div>
          {SLIDERS.filter((spec) => spec.group === group.id).map((spec) => (
            <Slider
              key={spec.key}
              spec={spec}
              value={params[spec.key]}
              onChange={(v) => onChange({ ...params, [spec.key]: v })}
            />
          ))}
        </div>
      ))}
    </section>
  )
}
