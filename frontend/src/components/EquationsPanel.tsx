import { useState } from 'react'
import { copyText, expressionsToText } from '../lib/expressions'
import type { DesmosOutput } from '../lib/types'

const VISIBLE_ROWS = 200

type CopyState = 'idle' | 'copied' | 'failed'

export function EquationsPanel({ desmos }: { desmos: DesmosOutput }) {
  const [copy, setCopy] = useState<CopyState>('idle')
  const { expressions, count, skipped_count: skipped } = desmos

  const handleCopy = async () => {
    const ok = await copyText(expressionsToText(expressions))
    setCopy(ok ? 'copied' : 'failed')
  }

  if (count === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink/25 bg-paper-raised px-6 py-10 text-center text-sm text-ink-muted">
        {skipped > 0
          ? `None of the ${skipped} fitted segments could be written as a valid equation.`
          : 'No equations yet. Adjust the tracing or fitting settings to produce some.'}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-ink/15 bg-paper-raised">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-4 py-3">
        <p className="text-sm text-ink">
          <span className="font-display text-xl tabular-nums" data-testid="equation-count">
            {count.toLocaleString()}
          </span>{' '}
          {count === 1 ? 'expression' : 'expressions'}
        </p>
        <div className="flex items-center gap-3">
          <span role="status" className="text-xs text-ink-muted">
            {copy === 'copied' && `Copied ${count.toLocaleString()} ${count === 1 ? 'expression' : 'expressions'}`}
            {copy === 'failed' && 'Copy failed — select the text below instead.'}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink/85 focus-visible:ring-2 focus-visible:ring-vermilion focus-visible:ring-offset-2 focus-visible:ring-offset-paper focus-visible:outline-none"
          >
            Copy Expressions
          </button>
        </div>
      </div>

      {skipped > 0 && (
        <p className="border-b border-ink/10 bg-vermilion/5 px-4 py-2 text-xs text-vermilion-deep">
          {skipped} {skipped === 1 ? 'segment was' : 'segments were'} skipped because{' '}
          {skipped === 1 ? 'it has' : 'they have'} no valid geometry.
        </p>
      )}

      <ol aria-label="Desmos expressions" className="max-h-96 divide-y divide-ink/5 overflow-auto font-mono text-xs">
        {expressions.slice(0, VISIBLE_ROWS).map((e, i) => (
          <li key={e.id} className="flex gap-3 px-4 py-2">
            <span className="w-8 shrink-0 text-right text-ink/40 tabular-nums">{i + 1}</span>
            <span className="w-14 shrink-0 text-vermilion-deep">{e.type}</span>
            <code className="min-w-0 break-all text-ink select-all">{e.latex}</code>
          </li>
        ))}
      </ol>
      {count > VISIBLE_ROWS && (
        <p className="border-t border-ink/10 px-4 py-2 text-xs text-ink-muted">
          Showing the first {VISIBLE_ROWS} of {count.toLocaleString()}. Copy Expressions copies all of them.
        </p>
      )}
    </div>
  )
}
