import type { ChangeEvent, RefObject } from 'react'
import { formatBytes } from '../lib/format'
import type { ImageMetadata } from '../lib/types'

interface AppHeaderProps {
  metadata: ImageMetadata | null
  /** Name of the saved state being shown, when there is no image. */
  savedName?: string
  hasImage: boolean
  busy: 'tracing' | 'updating' | null
  controlsOpen: boolean
  equationsOpen: boolean
  onToggleControls: () => void
  onToggleEquations: () => void
  /** Phones keep these in the Controls sheet, where there is room. */
  showImageActions: boolean
  replaceInput: RefObject<HTMLInputElement | null>
  onReplace: (file: File) => void
  onRemove: () => void
}

/** A curve between its two anchor points. The tab icon in public/favicon.svg matches. */
function Mark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5.5 flex-none" fill="none" aria-hidden="true">
      <path d="M5 19C15 19 9 5 19 5" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
      <circle cx="5" cy="19" r="3" fill="var(--color-shell-muted)" />
      <circle cx="19" cy="5" r="3" fill="var(--color-shell-muted)" />
    </svg>
  )
}

export function AppHeader({
  metadata,
  savedName,
  hasImage,
  busy,
  controlsOpen,
  equationsOpen,
  onToggleControls,
  onToggleEquations,
  showImageActions,
  replaceInput: inputRef,
  onReplace,
  onRemove,
}: AppHeaderProps) {

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onReplace(file)
  }

  return (
    <header className="flex h-11 flex-none items-center gap-2 bg-shell px-3 text-white max-sm:h-14 max-sm:gap-1 max-sm:px-1.5">
      <button
        type="button"
        className="btn btn-shell"
        aria-expanded={controlsOpen}
        onClick={onToggleControls}
      >
        Controls
      </button>

      <h1 className="ml-1.5 flex items-center gap-2 text-[15px] font-semibold whitespace-nowrap max-sm:ml-0.5">
        <Mark />
        <span>Image2Desmos</span>
      </h1>

      {metadata && (
        <p
          className="ml-2 hidden min-w-0 truncate text-ui text-shell-muted tabular-nums md:block"
          title={metadata.filename}
        >
          {metadata.filename} · {metadata.width} × {metadata.height} px · {formatBytes(metadata.size_bytes)}
        </p>
      )}

      {savedName && (
        <p className="ml-2 hidden min-w-0 truncate text-ui text-shell-muted md:block" title={savedName}>
          {savedName}
        </p>
      )}

      <div className="flex-1" />

      <span role="status" className="text-ui whitespace-nowrap text-shell-muted max-sm:sr-only">
        {busy === 'tracing' && 'Tracing…'}
        {busy === 'updating' && 'Updating…'}
      </span>

      {hasImage && (
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          onChange={handleChange}
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose a replacement image"
          data-testid="replace-input"
        />
      )}
      {hasImage && showImageActions && (
        <>
          <button type="button" className="btn btn-shell" onClick={() => inputRef.current?.click()}>
            Replace
          </button>
          <button type="button" className="btn btn-shell" onClick={onRemove}>
            Remove
          </button>
        </>
      )}

      <button
        type="button"
        className="btn btn-shell sm:ml-2"
        aria-expanded={equationsOpen}
        onClick={onToggleEquations}
      >
        Equations
      </button>
    </header>
  )
}
