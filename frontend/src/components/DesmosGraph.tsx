import { useCallback, useEffect, useRef, useState } from 'react'
import { DESMOS_API_KEY, HEAVY_EXPRESSION_COUNT } from '../lib/config'
import { loadDesmos } from '../lib/desmos'
import type { Bounds, DesmosExpression } from '../lib/types'
import { fitViewport } from '../lib/viewport'

const CURVE_COLOR = '#1b4f8f'
const FALLBACK_ASPECT = 4 / 3

interface DesmosGraphProps {
  expressions: readonly DesmosExpression[]
  bounds: Bounds
  apiKey?: string
  /** Called with the live calculator once it is drawn, and with null when it is torn down. */
  onCalculator?: (calculator: DesmosCalculator | null) => void
  /** Bump to redraw the generated equations (discarding an imported state). */
  restoreKey?: number
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-ink/25 bg-paper-raised px-6 py-10 text-center text-sm text-ink-muted">
      {children}
    </div>
  )
}

export function DesmosGraph({
  expressions,
  bounds,
  apiKey = DESMOS_API_KEY,
  onCalculator,
  restoreKey = 0,
}: DesmosGraphProps) {
  const onCalculatorRef = useRef(onCalculator)
  useEffect(() => {
    onCalculatorRef.current = onCalculator
  }, [onCalculator])
  const hostRef = useRef<HTMLDivElement>(null)
  const calculatorRef = useRef<DesmosCalculator | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [approvedHeavy, setApprovedHeavy] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const heavy = expressions.length > HEAVY_EXPRESSION_COUNT
  const canRender = apiKey !== '' && expressions.length > 0 && (!heavy || approvedHeavy)
  const status = error ? 'error' : ready ? 'ready' : 'loading'

  const fitView = useCallback(() => {
    const calculator = calculatorRef.current
    const host = hostRef.current
    if (!calculator || !host) return
    const aspect = host.clientHeight > 0 ? host.clientWidth / host.clientHeight : FALLBACK_ASPECT
    calculator.setMathBounds(fitViewport(bounds, aspect))
  }, [bounds])

  // Create (and later destroy) the calculator.
  useEffect(() => {
    if (!canRender) return
    let cancelled = false
    let created: DesmosCalculator | null = null

    loadDesmos(apiKey)
      .then((Desmos) => {
        if (cancelled || !hostRef.current) return
        created = Desmos.GraphingCalculator(hostRef.current, {
          expressions: false,
          keypad: false,
          settingsMenu: false,
          zoomButtons: true,
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
      onCalculatorRef.current?.(null)
      setReady(false)
    }
  }, [canRender, apiKey, attempt])

  // Draw the real equations and frame them.
  useEffect(() => {
    const calculator = calculatorRef.current
    if (status !== 'ready' || !calculator) return
    calculator.setBlank()
    calculator.setExpressions(
      expressions.map((e) => ({ id: e.id, latex: e.latex, color: CURVE_COLOR })),
    )
    fitView()
    onCalculatorRef.current?.(calculator)
  }, [status, expressions, fitView, restoreKey])

  if (apiKey === '') {
    return (
      <Notice>
        <p className="font-medium text-ink">A Desmos API key is needed for the live graph.</p>
        <p>
          Get a key at{' '}
          <a
            href="https://www.desmos.com/my-api"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-ink underline underline-offset-4"
          >
            desmos.com/my-api
          </a>
          , put it in <code className="font-mono text-xs">frontend/.env.local</code> as{' '}
          <code className="font-mono text-xs">VITE_DESMOS_API_KEY</code>, then restart the dev server.
          The Equations tab works without a key.
        </p>
      </Notice>
    )
  }

  if (expressions.length === 0) {
    return <Notice>There are no equations to plot yet. Try different tracing or fitting settings.</Notice>
  }

  if (heavy && !approvedHeavy) {
    return (
      <Notice>
        <p className="font-medium text-ink">
          This graph has {expressions.length.toLocaleString()} expressions.
        </p>
        <p>Desmos can be slow with that many. Raising simplification or fitting tolerance reduces them.</p>
        <button
          type="button"
          onClick={() => setApprovedHeavy(true)}
          className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-ink/85 focus-visible:ring-2 focus-visible:ring-vermilion focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Render anyway
        </button>
      </Notice>
    )
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl border border-ink/15 bg-white">
        <div ref={hostRef} data-testid="desmos-host" className="h-[28rem] w-full sm:h-[32rem]" />
        {status === 'loading' && (
          <div role="status" className="absolute inset-0 flex items-center justify-center bg-white/80 text-sm text-ink-muted">
            Loading Desmos…
          </div>
        )}
        {status === 'error' && (
          <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white px-6 text-center text-sm text-vermilion-deep">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => {
                setError(null)
                setAttempt((n) => n + 1)
              }}
              className="rounded-lg border border-ink/25 px-4 py-2 font-medium text-ink hover:border-vermilion"
            >
              Try again
            </button>
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between gap-4 text-xs text-ink-muted">
        <p>Drag to pan, scroll to zoom. Plotted as {expressions.length.toLocaleString()} equations.</p>
        <button
          type="button"
          disabled={status !== 'ready'}
          onClick={fitView}
          className="font-medium text-ink underline underline-offset-4 hover:text-vermilion-deep disabled:cursor-default disabled:text-ink/30 disabled:no-underline"
        >
          Fit to image
        </button>
      </div>
    </div>
  )
}
