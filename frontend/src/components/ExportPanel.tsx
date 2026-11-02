import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { dataUrlToBlob, downloadBlob, downloadText, exportFileName } from '../lib/download'
import { expressionsToText } from '../lib/expressions'
import { readStateFile, serializeState } from '../lib/stateIO'
import type { DesmosOutput } from '../lib/types'

type ActionId = 'txt' | 'state' | 'png' | 'import'
type Phase = 'idle' | 'working' | 'success' | 'error'
interface Status {
  phase: Phase
  message: string
}
type Pending =
  | { kind: 'state' }
  | { kind: 'png' }
  | { kind: 'import'; state: object; name: string; expressionCount: number }

interface ExportPanelProps {
  desmos: DesmosOutput
  /** Name of the uploaded image, used to name downloads. */
  sourceName?: string
  hasApiKey: boolean
  /** The live calculator, once the Desmos tab has drawn it. */
  calculator: DesmosCalculator | null
  /** Opens the Desmos tab so a calculator exists. */
  onNeedGraph: () => void
  /** Redraws the generated equations, discarding an imported state. */
  onRestore: () => void
  /** Above this many expressions, exports warn that they may be slow. */
  largeThreshold?: number
}

const IDLE: Status = { phase: 'idle', message: '' }
const nextFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

function StatusLine({ status }: { status: Status }) {
  if (status.phase === 'idle') return null
  const tone =
    status.phase === 'error'
      ? 'text-vermilion-deep'
      : status.phase === 'success'
        ? 'text-emerald-800'
        : 'text-ink-muted'
  return (
    <p
      role={status.phase === 'error' ? 'alert' : 'status'}
      className={`mt-2 flex items-center gap-2 text-xs ${tone}`}
    >
      {status.phase === 'working' && (
        <span className="size-3 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
      )}
      {status.message}
    </p>
  )
}

const buttonClass =
  'rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink/85 focus-visible:ring-2 focus-visible:ring-vermilion focus-visible:ring-offset-2 focus-visible:ring-offset-paper focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-ink/25'
const secondaryButtonClass =
  'rounded-lg border border-ink/25 px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-vermilion hover:text-vermilion-deep focus-visible:ring-2 focus-visible:ring-vermilion focus-visible:ring-offset-2 focus-visible:ring-offset-paper focus-visible:outline-none disabled:cursor-not-allowed disabled:border-ink/10 disabled:text-ink/30 disabled:hover:border-ink/10 disabled:hover:text-ink/30'

function Row({
  title,
  description,
  status,
  children,
}: {
  title: string
  description: string
  status: Status
  children: React.ReactNode
}) {
  return (
    <div className="px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-60">
          <h3 className="text-sm font-medium text-ink">{title}</h3>
          <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">{children}</div>
      </div>
      <StatusLine status={status} />
    </div>
  )
}

export function ExportPanel({
  desmos,
  sourceName,
  hasApiKey,
  calculator,
  onNeedGraph,
  onRestore,
  largeThreshold = 1500,
}: ExportPanelProps) {
  const [statuses, setStatuses] = useState<Record<ActionId, Status>>({
    txt: IDLE,
    state: IDLE,
    png: IDLE,
    import: IDLE,
  })
  // A request made before the calculator existed; consumed once it appears.
  const pendingRef = useRef<Pending | null>(null)
  const [waiting, setWaiting] = useState(false)
  const [imported, setImported] = useState(false)
  const importInput = useRef<HTMLInputElement>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const setStatus = useCallback((id: ActionId, status: Status) => {
    if (mounted.current) setStatuses((prev) => ({ ...prev, [id]: status }))
  }, [])

  const hasExpressions = desmos.count > 0
  const large = desmos.count > largeThreshold
  const busy = Object.values(statuses).some((s) => s.phase === 'working') || waiting
  const calculatorBlocked = !hasApiKey || !hasExpressions

  // ---- actions -----------------------------------------------------------

  const downloadExpressions = () => {
    try {
      downloadText(
        `${expressionsToText(desmos.expressions)}\n`,
        exportFileName(sourceName, 'desmos', 'txt'),
        'text/plain',
      )
      setStatus('txt', {
        phase: 'success',
        message: `Downloaded ${desmos.count.toLocaleString()} expressions.`,
      })
    } catch {
      setStatus('txt', { phase: 'error', message: 'The download could not be started.' })
    }
  }

  const runStateExport = useCallback(
    async (live: DesmosCalculator) => {
      setWaiting(false)
      setStatus('state', { phase: 'working', message: 'Reading the calculator state…' })
      await nextFrame()
      try {
        const text = serializeState(live.getState())
        downloadText(text, exportFileName(sourceName, 'desmos-state', 'json'), 'application/json')
        setStatus('state', {
          phase: 'success',
          message: `Saved the Desmos state (${(text.length / 1024).toFixed(0)} KB).`,
        })
      } catch {
        setStatus('state', { phase: 'error', message: 'Desmos could not produce its state. Try again.' })
      }
    },
    [setStatus, sourceName],
  )

  const runPngExport = useCallback(
    async (live: DesmosCalculator) => {
      setWaiting(false)
      setStatus('png', { phase: 'working', message: 'Rendering the graph…' })
      await nextFrame()
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('timeout')), 30_000)
          const done = (data: string) => {
            clearTimeout(timer)
            resolve(data)
          }
          try {
            if (live.asyncScreenshot) live.asyncScreenshot({ targetPixelRatio: 2 }, done)
            else done(live.screenshot({ targetPixelRatio: 2 }))
          } catch (err) {
            clearTimeout(timer)
            reject(err instanceof Error ? err : new Error('screenshot failed'))
          }
        })
        downloadBlob(dataUrlToBlob(dataUrl), exportFileName(sourceName, 'desmos', 'png'))
        setStatus('png', { phase: 'success', message: 'Saved a PNG of the Desmos graph.' })
      } catch (err) {
        const timedOut = err instanceof Error && err.message === 'timeout'
        setStatus('png', {
          phase: 'error',
          message: timedOut
            ? 'Desmos took too long to render the image. Try a smaller graph.'
            : 'The screenshot could not be created. Make sure the graph is visible and try again.',
        })
      }
    },
    [setStatus, sourceName],
  )

  const runImport = useCallback(
    async (live: DesmosCalculator, job: Extract<Pending, { kind: 'import' }>) => {
      setWaiting(false)
      setStatus('import', { phase: 'working', message: `Loading ${job.name}…` })
      await nextFrame()
      try {
        live.setState(job.state, { allowUndo: true })
        setImported(true)
        setStatus('import', {
          phase: 'success',
          message: `Loaded ${job.expressionCount.toLocaleString()} expressions from ${job.name}. This replaces the generated graph until you restore it.`,
        })
      } catch {
        setStatus('import', {
          phase: 'error',
          message: 'Desmos rejected this state. It may come from a different calculator version or be damaged.',
        })
      }
    },
    [setStatus],
  )

  // Run an action that was requested before the calculator existed.
  useEffect(() => {
    const job = pendingRef.current
    if (!job || !calculator) return
    pendingRef.current = null
    if (job.kind === 'state') void runStateExport(calculator)
    else if (job.kind === 'png') void runPngExport(calculator)
    else void runImport(calculator, job)
  }, [calculator, runStateExport, runPngExport, runImport])

  const request = (job: Pending) => {
    if (calculator) {
      if (job.kind === 'state') void runStateExport(calculator)
      else if (job.kind === 'png') void runPngExport(calculator)
      else void runImport(calculator, job)
      return
    }
    const id: ActionId = job.kind
    setStatus(id, { phase: 'working', message: 'Opening the Desmos graph first…' })
    pendingRef.current = job
    setWaiting(true)
    onNeedGraph()
  }

  const cancelPending = () => {
    if (pendingRef.current) setStatus(pendingRef.current.kind, IDLE)
    pendingRef.current = null
    setWaiting(false)
  }

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setStatus('import', { phase: 'working', message: `Checking ${file.name}…` })
    const parsed = await readStateFile(file)
    if (!parsed.ok) {
      setStatus('import', { phase: 'error', message: parsed.error })
      return
    }
    request({ kind: 'import', state: parsed.state, name: file.name, expressionCount: parsed.expressionCount })
  }

  const handleRestore = () => {
    onRestore()
    setImported(false)
    setStatus('import', { phase: 'success', message: 'Restored the generated graph.' })
  }

  const blockedReason = !hasApiKey
    ? 'Needs a Desmos API key (see the Desmos tab).'
    : !hasExpressions
      ? 'There are no equations to export yet.'
      : null

  return (
    <section aria-label="Export" className="mt-6 rounded-2xl border border-ink/15 bg-paper-raised">
      <div className="border-b border-ink/10 px-4 py-3">
        <h2 className="font-display text-xl text-ink">Export</h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          These are files you keep or re-import here. None of them is a Desmos graph link, and Desmos
          cannot open them directly.
        </p>
        {large && (
          <p className="mt-2 text-xs text-vermilion-deep">
            This graph has {desmos.count.toLocaleString()} expressions, so state and image exports may take a
            few seconds.
          </p>
        )}
      </div>

      <div className="divide-y divide-ink/10">
        <Row
          title="Expressions (.txt)"
          description="Every equation as Desmos LaTeX, one per line. Paste into a Desmos graph's expression list."
          status={statuses.txt}
        >
          <button type="button" className={buttonClass} disabled={!hasExpressions} onClick={downloadExpressions}>
            Download expressions
          </button>
        </Row>

        <Row
          title="Desmos state (.json)"
          description="The calculator's saved state from Desmos getState(). A backup for re-importing into Image2Desmos; it is not a graph link or a native Desmos file."
          status={statuses.state}
        >
          <button
            type="button"
            className={buttonClass}
            disabled={calculatorBlocked || busy}
            onClick={() => request({ kind: 'state' })}
          >
            Export state JSON
          </button>
        </Row>

        <Row
          title="Import state (.json)"
          description="Load a state file exported above. It is checked before Desmos sees it, and replaces what the graph currently shows."
          status={statuses.import}
        >
          <input
            ref={importInput}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-label="Choose a Desmos state file"
            data-testid="import-input"
            onChange={handleImportFile}
          />
          <button
            type="button"
            className={secondaryButtonClass}
            disabled={calculatorBlocked || busy}
            onClick={() => importInput.current?.click()}
          >
            Import state JSON
          </button>
          {imported && (
            <button type="button" className={secondaryButtonClass} onClick={handleRestore}>
              Restore generated graph
            </button>
          )}
        </Row>

        <Row
          title="Graph image (.png)"
          description="A screenshot of the Desmos graph as currently framed."
          status={statuses.png}
        >
          <button
            type="button"
            className={buttonClass}
            disabled={calculatorBlocked || busy}
            onClick={() => request({ kind: 'png' })}
          >
            Download PNG
          </button>
        </Row>
      </div>

      {waiting && (
        <div className="flex items-center justify-between gap-3 border-t border-ink/10 px-4 py-3 text-xs text-ink-muted">
          <span>Waiting for the Desmos graph to finish drawing…</span>
          <button type="button" onClick={cancelPending} className="font-medium text-ink underline underline-offset-4">
            Cancel
          </button>
        </div>
      )}
      {blockedReason && (
        <p className="border-t border-ink/10 px-4 py-3 text-xs text-ink-muted">{blockedReason}</p>
      )}
    </section>
  )
}
