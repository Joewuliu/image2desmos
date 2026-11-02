import { useId, useRef, useState, type ChangeEvent, type DragEvent } from 'react'

interface DropzoneProps {
  onFile: (file: File) => void
  onMultiple: () => void
  /** Opens a saved Desmos state; left out when the live graph is unavailable. */
  onSavedState?: (file: File) => void
  error: string | null
}

export function Dropzone({ onFile, onMultiple, onSavedState, error }: DropzoneProps) {
  const inputId = useId()
  const errorId = useId()
  const stateInput = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const take = (file: File) => {
    if (onSavedState && file.name.toLowerCase().endsWith('.json')) onSavedState(file)
    else onFile(file)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    const files = event.dataTransfer.files
    if (files.length > 1) onMultiple()
    else if (files.length === 1) take(files[0])
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onFile(file)
  }

  const handleState = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onSavedState?.(file)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className="graph-ground absolute inset-0 flex flex-col items-center justify-center-safe gap-2 overflow-y-auto p-4 max-sm:gap-0 max-sm:p-2"
    >
      <label htmlFor={inputId} data-dragging={dragging} className="block w-full max-w-md cursor-pointer">
        <input
          id={inputId}
          type="file"
          accept="image/png,image/jpeg"
          onChange={handleChange}
          aria-describedby={error ? errorId : undefined}
          className="peer sr-only"
        />
        <span
          className={`block border px-6 py-7 text-center max-sm:py-3 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-accent ${
            dragging
              ? 'border-accent bg-accent-soft'
              : `bg-surface ${error ? 'border-danger' : 'border-line-strong'}`
          }`}
        >
          <span className="block text-lg font-semibold text-ink">
            {dragging ? 'Release to upload' : 'Drop a line drawing here'}
          </span>
          <span className="mt-1 block text-sm text-ink-muted">
            or <span className="font-medium text-accent underline underline-offset-2">browse your files</span>
          </span>
          <span className="mt-3 block text-xs text-ink-muted">PNG or JPEG, up to 10 MB and 25 megapixels</span>
          <span className="mt-1 block text-xs text-ink-muted">
            Every stroke is traced with classical computer vision and plain mathematics.
          </span>
          {error && (
            <span id={errorId} role="alert" className="mt-4 block border-t border-line pt-3 text-sm text-danger">
              {error}
            </span>
          )}
        </span>
      </label>

      {onSavedState && (
        <>
          <input
            ref={stateInput}
            type="file"
            accept="application/json,.json"
            onChange={handleState}
            className="sr-only"
            tabIndex={-1}
            aria-label="Choose a saved state file"
            data-testid="saved-state-input"
          />
          <button type="button" className="btn btn-link bg-surface" onClick={() => stateInput.current?.click()}>
            Open a saved state
          </button>
        </>
      )}
    </div>
  )
}
