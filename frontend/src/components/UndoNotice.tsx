import { useEffect } from 'react'

export interface UndoAction {
  message: string
  run: () => void
}

const UNDO_WINDOW_MS = 10_000

interface UndoNoticeProps {
  action: UndoAction
  onUndo: () => void
  onExpire: () => void
}

/** Short-lived offer to reverse what the user just did. */
export function UndoNotice({ action, onUndo, onExpire }: UndoNoticeProps) {
  useEffect(() => {
    const timer = setTimeout(onExpire, UNDO_WINDOW_MS)
    return () => clearTimeout(timer)
  }, [action, onExpire])

  return (
    <div
      role="status"
      className="flex flex-none items-center gap-2 border-line-strong bg-surface px-3 py-1 text-ui text-ink max-sm:justify-between max-sm:border-t sm:absolute sm:bottom-3 sm:left-3 sm:z-20 sm:max-w-[calc(100%-1.5rem)] sm:border"
    >
      <span className="min-w-0 truncate">{action.message}</span>
      <button type="button" className="btn btn-link flex-none" onClick={onUndo}>
        Undo
      </button>
    </div>
  )
}
