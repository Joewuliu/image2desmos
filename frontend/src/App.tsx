import { useCallback, useEffect, useRef, useState } from 'react'
import { AppHeader } from './components/AppHeader'
import { Dropzone } from './components/Dropzone'
import { EquationsPanel } from './components/EquationsPanel'
import { ExportPanel } from './components/ExportPanel'
import { PipelineStrip, type Stage } from './components/PipelineStrip'
import { ProcessingControls } from './components/ProcessingControls'
import { ResultStats } from './components/ResultStats'
import { Sidebar } from './components/Sidebar'
import { StageCanvas } from './components/StageCanvas'
import { DesmosGraph } from './components/DesmosGraph'
import { UndoNotice, type UndoAction } from './components/UndoNotice'
import { useImageUpload } from './hooks/useImageUpload'
import { useMediaQuery } from './hooks/useMediaQuery'
import { useProcessing } from './hooks/useProcessing'
import { DESMOS_API_KEY } from './lib/config'
import { readStateFile, stateExpressions } from './lib/stateIO'
import { DEFAULT_PARAMS, type Bounds, type DesmosOutput, type ProcessingParams } from './lib/types'

const WARNING_TEXT: Record<string, string> = {
  no_contours:
    'No outlines were found. Try raising edge sensitivity or lowering blur, or check that the image has visible lines.',
  no_curves:
    'Every outline was smaller than the minimum contour size, so no curves were fitted. Lower the minimum size to keep them.',
}

const hasApiKey = DESMOS_API_KEY !== ''
// A saved state carries its own viewport, so nothing is fitted to these.
const SAVED_STATE_BOUNDS: Bounds = { min_x: -10, max_x: 10, min_y: -10, max_y: 10 }
const SAVED_STATE_FAILED = "Desmos couldn't open this file. It may be damaged or come from a different version."

interface SavedState {
  state: object
  name: string
  desmos: DesmosOutput
}

function App() {
  const { status, file, previewUrl, metadata, error, isReplacing, select, reset, reportError, dismissError } =
    useImageUpload()
  const [params, setParams] = useState<ProcessingParams>(DEFAULT_PARAMS)
  const processing = useProcessing(status === 'success' ? file : null, params)
  const { result } = processing

  const [chosenStage, setChosenStage] = useState<Stage>(hasApiKey ? 'graph' : 'curves')
  // A saved state opened from the empty screen, with no image behind it.
  const [savedState, setSavedState] = useState<SavedState | null>(null)
  const [savedError, setSavedError] = useState<string | null>(null)
  const [undo, setUndo] = useState<UndoAction | null>(null)
  const clearUndo = useCallback(() => setUndo(null), [])
  const stage: Stage = result ? chosenStage : savedState ? 'graph' : 'source'

  const [calculator, setCalculator] = useState<DesmosCalculator | null>(null)
  const [restoreKey, setRestoreKey] = useState(0)
  // An imported state lasts until the next result redraws the generated equations.
  const [importedState, setImportedState] = useState<{ over: typeof result; desmos: DesmosOutput } | null>(null)
  const imported = result !== null && importedState?.over === result
  const shown = savedState ? savedState.desmos : imported ? importedState.desmos : result?.desmos
  const replaceInput = useRef<HTMLInputElement>(null)

  // A selection only means something for the result it was made in.
  const [selection, setSelection] = useState<{ id: string; result: typeof result } | null>(null)
  const selectedId = selection && selection.result === result ? selection.id : null
  const selectExpression = useCallback(
    (id: string | null) => setSelection(id ? { id, result } : null),
    [result],
  )

  // Sidebars are columns on wide screens and drawers otherwise, each with its own memory.
  const wide = useMediaQuery('(min-width: 1180px)')
  const phone = !useMediaQuery('(min-width: 640px)')
  const [wideOpen, setWideOpen] = useState({ left: true, right: true })
  const [narrowOpen, setNarrowOpen] = useState({ left: false, right: false })
  const open = wide ? wideOpen : narrowOpen
  const narrowRef = useRef(wide ? { left: false, right: false } : narrowOpen)
  useEffect(() => {
    narrowRef.current = wide ? { left: false, right: false } : narrowOpen
  }, [wide, narrowOpen])

  useEffect(() => {
    const clear = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // A narrow-screen drawer closes first, then the selection clears.
      if (narrowRef.current.left || narrowRef.current.right) setNarrowOpen({ left: false, right: false })
      else setSelection(null)
    }
    window.addEventListener('keydown', clear)
    return () => window.removeEventListener('keydown', clear)
  }, [])

  // A curve picked on the canvas has to be able to show its equation.
  const selectFromCanvas = (id: string | null) => {
    selectExpression(id)
    if (!id) return
    if (wide) setWideOpen((o) => ({ ...o, right: true }))
    else setNarrowOpen({ left: false, right: true })
  }

  const chooseFile = (next: File) => {
    setUndo(null)
    setSavedState(null)
    setSavedError(null)
    select(next)
  }

  const openSavedState = async (saved: File) => {
    setUndo(null)
    setSavedError(null)
    const parsed = await readStateFile(saved)
    if (!parsed.ok) {
      setSavedError(parsed.error)
      return
    }
    setSavedState({ state: parsed.state, name: saved.name, desmos: stateExpressions(parsed.state) })
  }

  const handleSavedStateError = useCallback(() => {
    setSavedState(null)
    setSavedError(SAVED_STATE_FAILED)
  }, [])

  const removeImage = () => {
    const removed = file
    reset()
    if (removed) setUndo({ message: `Removed ${removed.name}`, run: () => select(removed) })
  }

  const resetParams = () => {
    const previous = params
    setParams(DEFAULT_PARAMS)
    setUndo({ message: 'Settings reset', run: () => setParams(previous) })
  }

  const changeParams = (next: ProcessingParams) => {
    setUndo(null)
    setParams(next)
  }

  const restoreGenerated = () => {
    setImportedState(null)
    setRestoreKey((n) => n + 1)
  }

  const toggle = (side: 'left' | 'right') => {
    if (wide) setWideOpen((o) => ({ ...o, [side]: !o[side] }))
    else setNarrowOpen((o) => ({ left: false, right: false, [side]: !o[side] }))
  }

  const busy =
    status === 'uploading' || isReplacing || processing.status === 'processing'
      ? result
        ? 'updating'
        : 'tracing'
      : null
  const warnings = result?.warnings.map((w) => WARNING_TEXT[w]).filter(Boolean) ?? []
  const uploadFailed = status === 'error'

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <AppHeader
        metadata={metadata}
        savedName={savedState?.name}
        hasImage={previewUrl !== null}
        busy={busy}
        controlsOpen={open.left}
        equationsOpen={open.right}
        onToggleControls={() => toggle('left')}
        onToggleEquations={() => toggle('right')}
        showImageActions={!phone}
        replaceInput={replaceInput}
        onReplace={chooseFile}
        onRemove={removeImage}
      />

      <div className="flex min-h-0 flex-1 max-sm:flex-col">
        <Sidebar side="left" label="Processing controls" open={open.left}>
          <ProcessingControls
            params={params}
            onChange={changeParams}
            onReset={resetParams}
            disabled={!previewUrl || imported}
            note={
              imported
                ? 'Restore the generated graph to tune again.'
                : savedState
                  ? 'Upload an image to trace and tune it.'
                  : undefined
            }
          />
          {phone && previewUrl && (
            <div className="grid flex-none grid-cols-2 gap-1.5 border-t border-line p-2">
              <button type="button" className="btn" onClick={() => replaceInput.current?.click()}>
                Replace
              </button>
              <button type="button" className="btn" onClick={removeImage}>
                Remove
              </button>
            </div>
          )}
        </Sidebar>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {previewUrl && status === 'success' && error && (
            <div className="flex flex-none items-center justify-between gap-3 border-b border-line bg-danger-soft px-3 py-1 text-ui text-danger">
              <p role="alert">{error} Your current image is unchanged.</p>
              <button type="button" className="btn btn-link flex-none" onClick={dismissError}>
                Dismiss
              </button>
            </div>
          )}
          {processing.error && (
            <div className="flex flex-none items-center justify-between gap-3 border-b border-line bg-danger-soft px-3 py-1 text-ui text-danger">
              <p role="alert">{processing.error}</p>
              <button type="button" className="btn btn-link flex-none" onClick={processing.retry}>
                Retry
              </button>
            </div>
          )}
          {!processing.error &&
            warnings.map((text) => (
              <p key={text} role="status" className="flex-none border-b border-line bg-gutter px-3 py-1.5 text-ui text-ink-muted">
                {text}
              </p>
            ))}

          <div className="relative flex min-h-0 flex-1 flex-col">
          <main className="relative min-h-0 flex-1 overflow-hidden">
            {busy && <div aria-hidden="true" className="busy-bar absolute inset-x-0 top-0 z-10 h-0.5" />}
            {previewUrl ? (
              <StageCanvas
                stage={stage}
                previewUrl={previewUrl}
                metadata={metadata}
                result={result}
                selectedId={selectedId}
                onSelect={selectFromCanvas}
                onCalculator={setCalculator}
                restoreKey={restoreKey}
                generated={!imported}
              />
            ) : savedState ? (
              <DesmosGraph
                apiKey={DESMOS_API_KEY}
                expressions={savedState.desmos.expressions}
                bounds={SAVED_STATE_BOUNDS}
                state={savedState.state}
                onStateError={handleSavedStateError}
                onCalculator={setCalculator}
              />
            ) : (
              <Dropzone
                onFile={chooseFile}
                onMultiple={() => reportError('Please upload one image at a time.')}
                onSavedState={hasApiKey ? openSavedState : undefined}
                error={savedError ?? (uploadFailed ? error : null)}
              />
            )}
          </main>
            {undo && (
              <UndoNotice
                action={undo}
                onExpire={clearUndo}
                onUndo={() => {
                  setUndo(null)
                  undo.run()
                }}
              />
            )}
          </div>

          <PipelineStrip
            stage={stage}
            onStage={setChosenStage}
            previewUrl={previewUrl}
            metadata={metadata}
            result={result}
            graphCount={shown?.count ?? 0}
            imported={imported}
            graphOnly={savedState !== null}
          />
        </div>

        <Sidebar side="right" label="Equations and export" open={open.right}>
          {savedState && shown ? (
            <>
              <div className="flex-none border-b border-line px-3 py-2 text-xs text-ink-muted">
                <p>
                  Showing the saved state <span className="break-all text-ink">{savedState.name}</span>.
                </p>
                <button type="button" className="btn btn-link -ml-1 mt-0.5" onClick={() => setSavedState(null)}>
                  Close saved state
                </button>
              </div>
              <EquationsPanel desmos={shown} selectedId={null} onSelect={selectExpression} imported />
              <ExportPanel
                desmos={shown}
                collapsible={phone}
                sourceName={savedState.name}
                hasApiKey={hasApiKey}
                calculator={calculator}
                onNeedGraph={() => {}}
                onImported={(state) =>
                  setSavedState((current) => current && { ...current, state, desmos: stateExpressions(state) })
                }
              />
            </>
          ) : result && shown ? (
            <>
              {imported ? (
                <div className="flex-none border-b border-line px-3 py-2 text-xs text-ink-muted">
                  <p>Showing an imported Desmos state. The other stages still describe the traced image.</p>
                  <button type="button" className="btn btn-link -ml-1 mt-0.5" onClick={restoreGenerated}>
                    Restore generated graph
                  </button>
                </div>
              ) : (
                <ResultStats result={result} />
              )}
              <EquationsPanel
                desmos={shown}
                selectedId={selectedId}
                onSelect={selectExpression}
                imported={imported}
                updating={busy !== null}
              />
              <ExportPanel
                desmos={shown}
                collapsible={phone}
                updating={busy !== null}
                sourceName={result.image.filename}
                hasApiKey={hasApiKey}
                calculator={calculator}
                onNeedGraph={() => setChosenStage('graph')}
                onImported={(state) => {
                  setImportedState({ over: result, desmos: stateExpressions(state) })
                  setSelection(null)
                  setChosenStage('graph')
                }}
                onBeforeCapture={() => setSelection(null)}
              />
            </>
          ) : (
            <p className="flex-1 px-3 py-4 text-ui text-ink-muted">
              {processing.error
                ? "No equations yet. The trace didn't finish."
                : previewUrl
                  ? 'Tracing the image…'
                  : 'Equations appear here once an image is traced.'}
            </p>
          )}
        </Sidebar>
      </div>
    </div>
  )
}

export default App
