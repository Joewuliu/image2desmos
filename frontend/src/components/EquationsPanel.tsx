import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { equationLines } from '../lib/equations'
import { copyText, expressionsToText } from '../lib/expressions'
import { strokeColor } from '../lib/strokes'
import type { DesmosExpression, DesmosOutput } from '../lib/types'
import { MathText } from './MathText'

const PAGE_ROWS = 200
const COPY_NOTICE_MS = 3000
const TYPE_LABEL: Record<DesmosExpression['type'], string> = {
  line: 'line',
  bezier: 'Bézier',
  circle: 'circle',
  other: 'equation',
}

type CopyState = 'idle' | 'copied' | 'failed'

interface EquationsPanelProps {
  desmos: DesmosOutput
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** The list shows an imported state: no contours, and nothing to select. */
  imported?: boolean
  /** A new trace is running, so these equations are about to be replaced. */
  updating?: boolean
}

function Dot({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className="size-2.5 flex-none rounded-full ring-1 ring-ink/25"
      style={{ background: color }}
    />
  )
}

interface EquationRowProps {
  expression: DesmosExpression
  index: number
  selected: boolean
  tabbable: boolean
  onSelect: (id: string | null) => void
}

function EquationCells({ expression, index, selected }: { expression: DesmosExpression; index: number; selected: boolean }) {
  return (
    <>
      <span className={`flex flex-col px-2 py-1.5 text-2xs text-ink-muted tabular-nums ${selected ? '' : 'bg-gutter'}`}>
        <span className="flex items-center justify-between">
          <span className={selected ? 'font-semibold text-ink' : ''}>{index + 1}</span>
          <Dot color={expression.color ?? strokeColor(expression.curve)} />
        </span>
        <span className={selected ? 'text-ink' : ''}>{TYPE_LABEL[expression.type]}</span>
      </span>
      <span className="flex min-w-0 flex-col justify-center gap-0.5 overflow-x-auto px-2.5 py-1.5 text-sm text-ink">
        {equationLines(expression.latex).map((line) => (
          <MathText key={line.latex} latex={line.label ? `${line.label}=${line.latex}` : line.latex} />
        ))}
      </span>
    </>
  )
}

const ROW_GRID = 'grid w-full grid-cols-[3rem_minmax(0,1fr)] text-left'

function EquationRow({ expression, index, selected, tabbable, onSelect }: EquationRowProps) {
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView?.({ block: 'nearest' })
  }, [selected])

  return (
    <li className="border-b border-line">
      <button
        ref={ref}
        type="button"
        aria-pressed={selected}
        tabIndex={tabbable ? 0 : -1}
        onClick={() => onSelect(selected ? null : expression.id)}
        className={`${ROW_GRID} scroll-mt-7 outline-offset-[-2px] ${
          selected ? 'bg-selected' : 'hover:bg-gutter/60'
        }`}
      >
        <EquationCells expression={expression} index={index} selected={selected} />
      </button>
    </li>
  )
}

export function EquationsPanel({
  desmos,
  selectedId,
  onSelect,
  imported = false,
  updating = false,
}: EquationsPanelProps) {
  const [copy, setCopy] = useState<CopyState>('idle')
  const [pages, setPages] = useState(1)
  const { expressions, count, skipped_count: skipped } = desmos

  useEffect(() => {
    if (copy === 'idle') return
    const timer = setTimeout(() => setCopy('idle'), COPY_NOTICE_MS)
    return () => clearTimeout(timer)
  }, [copy])

  const handleCopy = async () => {
    const ok = await copyText(expressionsToText(expressions))
    setCopy(ok ? 'copied' : 'failed')
  }

  // Up and down move between rows, so the list is a single Tab stop.
  const handleKey = (event: KeyboardEvent<HTMLOListElement>) => {
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
    if (step === 0) return
    const rows = [...event.currentTarget.querySelectorAll('button')]
    const next = rows[rows.indexOf(document.activeElement as HTMLButtonElement) + step]
    if (!next) return
    event.preventDefault()
    next.focus()
  }

  if (count === 0) {
    return (
      <div className="flex-1 px-3 py-4 text-ui text-ink-muted">
        {skipped > 0
          ? `None of the ${skipped} fitted segments could be written as a valid equation.`
          : imported
            ? 'This imported state has no equations.'
            : 'No equations yet. Adjust the tracing or fitting settings to produce some.'}
      </div>
    )
  }

  // A curve selected on the canvas must have a row to show, however far down it is.
  const selectedIndex = expressions.findIndex((e) => e.id === selectedId)
  const visible = Math.max(pages * PAGE_ROWS, selectedIndex + 1)
  const noun = `${imported ? 'imported ' : ''}${count === 1 ? 'expression' : 'expressions'}`
  const inContour = (curve: number) => expressions.filter((e) => e.curve === curve).length

  return (
    <>
      <div className="panel-head">
        <span role="status" className={copy === 'copied' ? 'text-success' : copy === 'failed' ? 'text-danger' : ''}>
          {copy === 'idle' && (
            <>
              <span data-testid="equation-count" className="tabular-nums">
                {count.toLocaleString()}
              </span>{' '}
              {noun}
            </>
          )}
          {copy === 'copied' && `Copied ${count.toLocaleString()} ${noun}`}
          {copy === 'failed' && 'Copy failed. Use Download expressions.'}
        </span>
        <button
          type="button"
          disabled={updating}
          onClick={handleCopy}
          className="btn btn-primary flex-none whitespace-nowrap"
        >
          Copy Expressions
        </button>
      </div>

      <p className="flex-none border-b border-line px-3 py-1 text-xs text-ink-muted">
        Paste into a Desmos expression line. Desmos assigns its own colours.
      </p>

      {skipped > 0 && (
        <p className="flex-none border-b border-line bg-danger-soft px-3 py-1.5 text-xs text-danger">
          {skipped} {skipped === 1 ? 'segment was' : 'segments were'} skipped because{' '}
          {skipped === 1 ? 'it has' : 'they have'} no valid geometry.
        </p>
      )}

      <div
        className="min-h-0 flex-1 overflow-y-auto outline-offset-[-2px]"
        {...(imported ? { role: 'region', 'aria-label': 'Imported expressions', tabIndex: 0 } : {})}
      >
        <ol aria-label="Desmos expressions" onKeyDown={handleKey}>
          {expressions.slice(0, visible).map((e, i) => (
            <Fragment key={e.id}>
              {!imported && e.curve !== expressions[i - 1]?.curve && (
                <li
                  role="presentation"
                  className="sticky top-0 z-10 flex items-center gap-1.5 border-b border-line bg-surface px-2 py-1 text-xs font-medium text-ink"
                >
                  <Dot color={strokeColor(e.curve)} />
                  Contour {e.curve + 1}
                  <span className="font-normal text-ink-muted tabular-nums">
                    {inContour(e.curve)} {inContour(e.curve) === 1 ? 'segment' : 'segments'}
                  </span>
                </li>
              )}
              {imported ? (
                <li className={`${ROW_GRID} border-b border-line`}>
                  <EquationCells expression={e} index={i} selected={false} />
                </li>
              ) : (
                <EquationRow
                  expression={e}
                  index={i}
                  selected={e.id === selectedId}
                  tabbable={selectedId ? e.id === selectedId : i === 0}
                  onSelect={onSelect}
                />
              )}
            </Fragment>
          ))}
        </ol>
        {count > visible && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-ink-muted">
            <span>
              Showing the first {visible} of {count.toLocaleString()}.
            </span>
            <button type="button" className="btn btn-link" onClick={() => setPages((n) => n + 1)}>
              Show more
            </button>
          </div>
        )}
      </div>
    </>
  )
}
