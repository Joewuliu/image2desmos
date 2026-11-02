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
  /** The live calculator, once it has drawn the graph. */
  calculator: DesmosCalculator | null
  /** Opens the Graph stage so a calculator can exist. */
  onNeedGraph: () => void
  /** Runs before the graph is captured, so a selection is not exported. */
  onBeforeCapture?: () => void
  /** On phones the section is a bar that opens, so it is always in reach of a long list. */
  collapsible?: boolean
  /** A new trace is running, so these expressions are about to be replaced. */
  updating?: boolean
  /** Called with the state that replaced the generated graph. */
  onImported?: (state: object) => void
  /** Above this many expressions, exports warn that they may be slow. */
  largeThreshold?: number
}

const IDLE: Status = { phase: 'idle', message: '' }
const SUCCESS_NOTICE_MS = 6000
const nextFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

function StatusLine({ status }: { status: Status }) {
  if (status.phase === 'idle') return null
  const tone =
    status.phase === 'error'
      ? 'text-danger'
      : status.phase === 'success'
        ? 'text-success'
        : 'text-ink-muted'
  return (
    <p
      role={status.phase === 'error' ? 'alert' : 'status'}
      className={`flex items-center gap-1.5 ${tone}`}
    >
      {status.phase === 'working' && (
        <span className="size-3 flex-none animate-spin rounded-full border-2 border-line-strong border-t-accent" />
      )}
      {status.message}
    </p>
  )
}

export function ExportPanel({
  desmos,
  sourceName,
  hasApiKey,
  calculator,
  onNeedGraph,
  onImported,
  onBeforeCapture,
  collapsible = false,
  updating = false,
  largeThreshold = 1500,
}: ExportPanelProps) {
  const [statuses, setStatuses] = useState<Record<ActionId, Status>>({
    txt: IDLE,
    state: IDLE,
    png: IDLE,
    import: IDLE,
  })
  const [lastAction, setLastAction] = useState<ActionId>('txt')
  // A request made before the calculator existed; consumed once it appears.
  const pendingRef = useRef<Pending | null>(null)
  const [waiting, setWaiting] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const importInput = useRef<HTMLInputElement>(null)
  const mounted = useRef(true)
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const setStatus = useCallback((id: ActionId, status: Status) => {
    if (!mounted.current) return
    setLastAction(id)
    setStatuses((prev) => ({ ...prev, [id]: status }))
    clearTimeout(noticeTimer.current)
    if (status.phase === 'success') {
      noticeTimer.current = setTimeout(() => {
        if (mounted.current) setStatuses((prev) => ({ ...prev, [id]: IDLE }))
      }, SUCCESS_NOTICE_MS)
    }
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
        message: `Downloaded ${desmos.count.toLocaleString()} ${desmos.count === 1 ? 'expression' : 'expressions'}.`,
      })
    } catch {
      setStatus('txt', { phase: 'error', message: 'The download could not be started.' })
    }
  }

  const runStateExport = useCallback(
    async (live: DesmosCalculator) => {
      setWaiting(false)
      setStatus('state', { phase: 'working', message: 'Reading the calculator state…' })
      onBeforeCapture?.()
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
    [setStatus, sourceName, onBeforeCapture],
  )

  const runPngExport = useCallback(
    async (live: DesmosCalculator) => {
      setWaiting(false)
      setStatus('png', { phase: 'working', message: 'Rendering the graph…' })
      onBeforeCapture?.()
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
            : 'The screenshot could not be created. Open the Graph stage and try again.',
        })
      }
    },
    [setStatus, sourceName, onBeforeCapture],
  )

  const runImport = useCallback(
    async (live: DesmosCalculator, job: Extract<Pending, { kind: 'import' }>) => {
      setWaiting(false)
      setStatus('import', { phase: 'working', message: `Loading ${job.name}…` })
      await nextFrame()
      try {
        live.setState(job.state, { allowUndo: true })
        onImported?.(job.state)
        setStatus('import', {
          phase: 'success',
          message: `Loaded ${job.name}.`,
        })
      } catch {
        setStatus('import', {
          phase: 'error',
          message: "Desmos couldn't open this file. It may be damaged or come from a different version.",
        })
      }
    },
    [setStatus, onImported],
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

  const blockedReason = !hasApiKey
    ? 'State and image exports need the live graph, which is not set up here.'
    : !hasExpressions
      ? 'There are no equations to export yet.'
      : null

  return (
    <section aria-label="Export" className="flex-none border-t border-line">
      {collapsible ? (
        <h2 className="panel-head p-0!">
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((open) => !open)}
            className="flex min-h-11 w-full items-center justify-between px-3 text-left font-semibold outline-offset-[-2px]"
          >
            Export
            <svg viewBox="0 0 12 12" aria-hidden="true" className={`size-3 ${expanded ? 'rotate-180' : ''}`}>
              <path d="M2 8 6 4l4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </h2>
      ) : (
        <h2 className="panel-head">Export</h2>
      )}
      <div hidden={collapsible && !expanded} className="px-3 pt-2 pb-2.5">
      {large && (
        <p className="mb-1.5 text-xs text-ink-muted">
          {desmos.count.toLocaleString()} expressions, so state and image exports may take a few seconds.
        </p>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" className="btn" disabled={!hasExpressions || updating} onClick={downloadExpressions}>
          Download expressions
        </button>
        <button
          type="button"
          className="btn"
          disabled={calculatorBlocked || busy}
          onClick={() => request({ kind: 'png' })}
        >
          Download PNG
        </button>
        <button
          type="button"
          className="btn"
          disabled={calculatorBlocked || busy}
          onClick={() => request({ kind: 'state' })}
        >
          Export state JSON
        </button>
        <button
          type="button"
          className="btn"
          disabled={calculatorBlocked || busy}
          onClick={() => importInput.current?.click()}
        >
          Import state JSON
        </button>
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
      </div>

      {/* One fixed slot, so the buttons never move under the pointer. */}
      <div className="mt-2 h-8 overflow-hidden text-xs text-ink-muted max-sm:h-auto max-sm:min-h-8">
        {waiting ? (
          <p className="flex items-center justify-between gap-3">
            <span>Waiting for the Desmos graph to finish drawing…</span>
            <button type="button" onClick={cancelPending} className="btn btn-link">
              Cancel
            </button>
          </p>
        ) : statuses[lastAction].phase !== 'idle' ? (
          <StatusLine status={statuses[lastAction]} />
        ) : (
          <p>
            {blockedReason ??
              'State JSON reopens in this app. It is not a graph link or a native Desmos file.'}
          </p>
        )}
      </div>
      </div>
    </section>
  )
}
