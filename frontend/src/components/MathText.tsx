import katex from 'katex'
import { memo } from 'react'

/** Renders LaTeX with KaTeX; bad input shows as plain text instead of throwing. */
export const MathText = memo(function MathText({ latex }: { latex: string }) {
  const html = katex.renderToString(latex, { throwOnError: false, output: 'htmlAndMathml' })
  return <span className="math" dangerouslySetInnerHTML={{ __html: html }} />
})
