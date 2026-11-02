import { useId, useState, type ChangeEvent, type DragEvent } from 'react'

interface DropzoneProps {
  onFile: (file: File) => void
  onMultiple: () => void
  error: string | null
}

export function Dropzone({ onFile, onMultiple, error }: DropzoneProps) {
  const inputId = useId()
  const errorId = useId()
  const [dragging, setDragging] = useState(false)

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setDragging(false)
    const files = event.dataTransfer.files
    if (files.length > 1) onMultiple()
    else if (files.length === 1) onFile(files[0])
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onFile(file)
  }

  return (
    <div>
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        data-dragging={dragging}
        className={`group relative flex min-h-80 cursor-pointer flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors focus-within:ring-2 focus-within:ring-vermilion focus-within:ring-offset-2 focus-within:ring-offset-paper ${
          dragging
            ? 'border-vermilion bg-vermilion/5'
            : error
              ? 'border-vermilion/60 bg-paper-raised hover:border-vermilion'
              : 'border-ink/25 bg-paper-raised hover:border-ink/60'
        }`}
      >
        <input
          id={inputId}
          type="file"
          accept="image/png,image/jpeg"
          onChange={handleChange}
          aria-describedby={error ? errorId : undefined}
          className="sr-only"
        />

        <svg
          viewBox="0 0 64 64"
          className={`size-16 transition-transform ${dragging ? 'scale-110 text-vermilion' : 'text-ink/70 group-hover:text-ink'}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M8 56V8M8 56h48" />
          <path d="M14 46C22 46 24 18 32 18s10 28 18 28" />
          <path d="M44 12v14M37 19l7-7 7 7" className="text-vermilion" />
        </svg>

        <div className="space-y-1.5">
          <p className="font-display text-2xl text-ink">
            {dragging ? 'Release to upload' : 'Drop a line drawing here'}
          </p>
          <p className="text-sm text-ink-muted">
            or <span className="font-medium text-ink underline underline-offset-4">browse your files</span>
          </p>
        </div>

        <p className="font-mono text-xs tracking-wide text-ink-muted uppercase">
          PNG or JPEG · up to 10 MB
        </p>
      </label>

      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-lg border border-vermilion/30 bg-vermilion/8 px-4 py-3 text-sm text-vermilion-deep"
        >
          <svg viewBox="0 0 20 20" className="mt-0.5 size-4 shrink-0" fill="currentColor" aria-hidden="true">
            <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm-.75 4h1.5v5h-1.5V6Zm0 6.5h1.5V14h-1.5v-1.5Z" />
          </svg>
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}
