import { useId, useState, type CSSProperties } from 'react'
import { DEFAULT_PARAMS, type ProcessingParams } from '../lib/types'
import { MathText } from './MathText'

interface ProcessingControlsProps {
  params: ProcessingParams
  onChange: (params: ProcessingParams) => void
  /** Puts every control back to its default. */
  onReset: () => void
  disabled?: boolean
  /** Why the controls are off, when that is worth saying. */
  note?: string
}

interface SliderSpec {
  key: keyof ProcessingParams
  label: string
  /** LaTeX symbol shown with the value, where a conventional one exists. */
  symbol?: string
  hint: string
  min: number
  max: number
  step: number
  low: string
  high: string
  /** LaTeX unit shown after a symbolic value. */
  unit?: string
  /** Unit shown after a plain value. */
  plainUnit?: string
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
    symbol: String.raw`\sigma`,
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
    symbol: String.raw`\delta`,
    hint: 'Target distance between a curve and the traced outline. Tighter targets need more segments.',
    min: 0.5,
    max: 5,
    step: 0.1,
    low: 'Precise',
    high: 'Loose',
    unit: String.raw`\,\text{px}`,
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
    plainUnit: '%',
  },
]

const GROUPS: { id: SliderSpec['group']; title: string }[] = [
  { id: 'tracing', title: 'Tracing' },
  { id: 'fitting', title: 'Curve fitting' },
]

interface SliderProps {
  spec: SliderSpec
  value: number
  disabled: boolean
  onChange: (value: number) => void
  onHint: (hint: string | null) => void
}

function Slider({ spec, value, disabled, onChange, onHint }: SliderProps) {
  const id = useId()
  return (
    <div
      className="border-b border-line px-3 pt-1.5 pb-1"
      onPointerEnter={() => onHint(spec.hint)}
      onPointerLeave={() => onHint(null)}
    >
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-ui text-ink">
          {spec.label}
        </label>
        <output htmlFor={id} className={spec.symbol ? 'text-[15px] text-ink' : 'text-ui text-ink tabular-nums'}>
          {spec.symbol ? (
            <MathText latex={`${spec.symbol}=${value}${spec.unit ?? ''}`} />
          ) : (
            `${value}${spec.plainUnit ?? ''}`
          )}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={value}
        disabled={disabled}
        aria-description={spec.hint}
        onFocus={() => onHint(spec.hint)}
        onBlur={() => onHint(null)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="slider"
        style={{ '--fill': `${((value - spec.min) / (spec.max - spec.min)) * 100}%` } as CSSProperties}
      />
      <div className="flex justify-between text-2xs text-ink-muted">
        <span>{spec.low}</span>
        <span>{spec.high}</span>
      </div>
    </div>
  )
}

export function ProcessingControls({ params, onChange, onReset, disabled = false, note }: ProcessingControlsProps) {
  const [hint, setHint] = useState<string | null>(null)
  const isDefault = SLIDERS.every((s) => params[s.key] === DEFAULT_PARAMS[s.key])
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {GROUPS.map((group, index) => (
          <div key={group.id}>
            <div className="panel-head">
              <h2>{group.title}</h2>
              {index === 0 && (
                <button
                  type="button"
                  disabled={isDefault || disabled}
                  onClick={onReset}
                  className="btn btn-link"
                >
                  Reset all
                </button>
              )}
            </div>
            {SLIDERS.filter((spec) => spec.group === group.id).map((spec) => (
              <Slider
                key={spec.key}
                spec={spec}
                value={params[spec.key]}
                disabled={disabled}
                onHint={setHint}
                onChange={(v) => onChange({ ...params, [spec.key]: v })}
              />
            ))}
          </div>
        ))}
        {!disabled && (
          <p className="px-3 py-2 text-xs text-ink-muted sm:hidden">
            Images are processed in memory and never stored. No AI. Not affiliated with Desmos.
          </p>
        )}
      </div>
      <p
        className={`flex h-[3.3125rem] flex-none items-center border-t border-line bg-gutter px-3 text-xs text-ink-muted ${
          disabled || hint ? '' : 'max-sm:hidden'
        }`}
      >
        {note ?? hint ?? 'Images are processed in memory and never stored. No AI. Not affiliated with Desmos.'}
      </p>
    </>
  )
}
