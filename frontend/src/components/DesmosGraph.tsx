import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { DESMOS_API_KEY, HEAVY_EXPRESSION_COUNT } from '../lib/config'
import { loadDesmos } from '../lib/desmos'
import {
  dimmedColor,
  LINE_WIDTH,
  MAX_DIMMED_EXPRESSIONS,
  SELECTED_LINE_WIDTH,
  strokeColor,
} from '../lib/strokes'
import type { Bounds, DesmosExpression } from '../lib/types'
import { fitViewport } from '../lib/viewport'

const FALLBACK_ASPECT = 4 / 3

interface DesmosGraphProps {
  expressions: readonly DesmosExpression[]
  bounds: Bounds
  apiKey?: string
  /** Called with the live calculator once it is drawn, and with null when it is torn down. */
  onCalculator?: (calculator: DesmosCalculator | null) => void
  /** Bump to redraw the generated equations (discarding an imported state). */
  restoreKey?: number
  /** Expression to emphasise, by id. */
  selectedId?: string | null
  /** False while an imported state is showing: our ids do not apply to it. */
  highlight?: boolean
  /** Show this saved calculator state instead of drawing `expressions`. */
  state?: object
  /** Desmos refused `state`. */
  onStateError?: () => void
  /** A click on the graph, in math coordinates, with the reach of a few pixels. */
  onGraphClick?: (x: number, y: number, tolerance: number) => void
}

const CLICK_SLOP_PX = 4
const CLICK_REACH_PX = 8

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="graph-ground absolute inset-0 flex items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-3 border border-line bg-surface px-6 py-5 text-center text-sm text-ink-muted">
        {children}
      </div>
    </div>
  )
}

export function DesmosGraph({
  expressions,
  bounds,
  apiKey = DESMOS_API_KEY,
  onCalculator,
  restoreKey = 0,
  selectedId = null,
  highlight = true,
  state,
  onStateError,
  onGraphClick,
}: DesmosGraphProps) {
  const onCalculatorRef = useRef(onCalculator)
  useEffect(() => {
    onCalculatorRef.current = onCalculator
  }, [onCalculator])
  const hostRef = useRef<HTMLDivElement>(null)
  const calculatorRef = useRef<DesmosCalculator | null>(null)
  const drawnIds = useRef(new Set<string>())
  // Once the user pans or zooms, re-tracing and resizing leave their view alone.
  const userMoved = useRef(false)
  const pressAt = useRef<{ x: number; y: number } | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [approvedHeavy, setApprovedHeavy] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const heavy = expressions.length > HEAVY_EXPRESSION_COUNT
  const canRender = apiKey !== '' && expressions.length > 0 && (!heavy || approvedHeavy)
  const status = error ? 'error' : ready ? 'ready' : 'loading'

  const applyFit = useCallback(() => {
    const calculator = calculatorRef.current
    const host = hostRef.current
    if (!calculator || !host) return
    const aspect = host.clientHeight > 0 ? host.clientWidth / host.clientHeight : FALLBACK_ASPECT
    calculator.setMathBounds(fitViewport(bounds, aspect))
  }, [bounds])

  const fitView = () => {
    userMoved.current = false
    applyFit()
  }

  // Create (and later destroy) the calculator.
  useEffect(() => {
    if (!canRender) return
    let cancelled = false
    let created: DesmosCalculator | null = null

    loadDesmos(apiKey)
      .then((Desmos) => {
        if (cancelled || !hostRef.current) return
        created = Desmos.GraphingCalculator(hostRef.current, {
          border: false,
          expressions: false,
          keypad: false,
          settingsMenu: false,
          zoomButtons: true,
          pointsOfInterest: false,
          trace: false,
        })
        calculatorRef.current = created
        setReady(true)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Could not load the Desmos calculator.')
      })

    return () => {
      cancelled = true
      created?.destroy()
      calculatorRef.current = null
      drawnIds.current = new Set()
      onCalculatorRef.current?.(null)
      setReady(false)
    }
  }, [canRender, apiKey, attempt])

  // Draw the real equations and frame them.
  useEffect(() => {
    const calculator = calculatorRef.current
    if (status !== 'ready' || !calculator) return
    if (state) {
      try {
        calculator.setState(state)
        onCalculatorRef.current?.(calculator)
      } catch {
        onStateError?.()
      }
      return
    }
    const kept = userMoved.current ? calculator.graphpaperBounds?.mathCoordinates : undefined
    const view = kept && { left: kept.left, right: kept.right, bottom: kept.bottom, top: kept.top }
    calculator.setBlank()
    calculator.setExpressions(
      expressions.map((e) => ({
        id: e.id,
        latex: e.latex,
        color: strokeColor(e.curve),
        lineOpacity: 1,
      })),
    )
    drawnIds.current = new Set(expressions.map((e) => e.id))
    if (view) calculator.setMathBounds(view)
    else applyFit()
    onCalculatorRef.current?.(calculator)
  }, [status, expressions, applyFit, restoreKey, state, onStateError])

  // Keep the image framed as the panels open and close.
  useEffect(() => {
    const host = hostRef.current
    if (status !== 'ready' || !host || state || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      if (!userMoved.current) applyFit()
    })
    observer.observe(host)
    return () => observer.disconnect()
  }, [status, applyFit, state])

  // Emphasise the selected equation's curve in the graph itself.
  useEffect(() => {
    const calculator = calculatorRef.current
    if (status !== 'ready' || !calculator || !highlight || !selectedId) return
    if (!drawnIds.current.has(selectedId)) return
    const id = selectedId
    const others =
      expressions.length <= MAX_DIMMED_EXPRESSIONS ? expressions.filter((e) => e.id !== id) : []
    calculator.setExpressions(
      others.map((e) => ({ id: e.id, color: dimmedColor(strokeColor(e.curve)) })),
    )
    calculator.setExpression({ id, lineWidth: SELECTED_LINE_WIDTH })
    return () => {
      if (calculatorRef.current !== calculator) return
      calculator.setExpressions(
        others
          .filter((e) => drawnIds.current.has(e.id))
          .map((e) => ({ id: e.id, color: strokeColor(e.curve) })),
      )
      if (drawnIds.current.has(id)) calculator.setExpression({ id, lineWidth: LINE_WIDTH })
    }
  }, [status, selectedId, highlight, expressions, restoreKey])

  if (apiKey === '') {
    return (
      <Notice>
        <p className="font-medium text-ink">The live Desmos graph isn't available here.</p>
        <p>
          You can still look through the other stages, then copy your equations and paste them into{' '}
          <a
            href="https://www.desmos.com/calculator"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-accent underline underline-offset-2"
          >
            desmos.com/calculator
          </a>
          .
        </p>
        <details className="text-xs">
          <summary className="cursor-pointer">Setting up this copy?</summary>
          <p className="mt-1">
            Get a key at{' '}
            <a
              href="https://www.desmos.com/my-api"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-accent underline underline-offset-2"
            >
              desmos.com/my-api
            </a>
            , put it in <code className="font-mono">frontend/.env.local</code> as{' '}
            <code className="font-mono">VITE_DESMOS_API_KEY</code>, then restart the dev server.
          </p>
        </details>
      </Notice>
    )
  }

  if (expressions.length === 0) {
    return (
      <Notice>
        {state
          ? 'This saved state has no equations to plot.'
          : 'There are no equations to plot yet. Try raising Edge sensitivity or lowering Blur.'}
      </Notice>
    )
  }

  if (heavy && !approvedHeavy) {
    return (
      <Notice>
        <p className="font-medium text-ink">
          This graph has {expressions.length.toLocaleString()} expressions.
        </p>
        <p>Desmos can be slow with that many. Raising simplification or the fitting tolerance reduces them.</p>
        <button type="button" onClick={() => setApprovedHeavy(true)} className="btn btn-primary">
          Render anyway
        </button>
      </Notice>
    )
  }

  return (
    <div className="absolute inset-0 bg-surface">
      <div
        ref={hostRef}
        data-testid="desmos-host"
        className="absolute inset-0"
        onPointerDownCapture={(event) => {
          // Desmos's own buttons change the view; a press on the paper may be a click.
          const onControl = (event.target as Element).closest('button, a, [role="button"]') !== null
          if (onControl) userMoved.current = true
          pressAt.current = onControl ? null : { x: event.clientX, y: event.clientY }
        }}
        onPointerUpCapture={(event) => {
          const press = pressAt.current
          const calculator = calculatorRef.current
          const host = hostRef.current
          pressAt.current = null
          if (!press || !calculator || !host) return
          if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > CLICK_SLOP_PX) {
            userMoved.current = true
            return
          }
          const box = host.getBoundingClientRect()
          const x = event.clientX - box.left
          const y = event.clientY - box.top
          const at = calculator.pixelsToMath({ x, y })
          const reach = calculator.pixelsToMath({ x: x + CLICK_REACH_PX, y })
          onGraphClick?.(at.x, at.y, Math.abs(reach.x - at.x))
        }}
        onWheelCapture={() => {
          userMoved.current = true
        }}
      />
      {!state && (
        <button
          type="button"
          disabled={status !== 'ready'}
          onClick={fitView}
          className="btn absolute top-2.5 left-2.5"
        >
          Fit to image
        </button>
      )}
      {status === 'loading' && (
        <div role="status" className="graph-ground absolute inset-0 flex items-center justify-center text-sm text-ink-muted">
          Loading Desmos…
        </div>
      )}
      {status === 'error' && (
        <div role="alert" className="graph-ground absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-sm text-danger">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => {
              setError(null)
              setAttempt((n) => n + 1)
            }}
            className="btn"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  )
}
