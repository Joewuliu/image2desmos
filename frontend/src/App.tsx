import { useState } from 'react'
import { Dropzone } from './components/Dropzone'
import { ImagePreview } from './components/ImagePreview'
import { useImageUpload } from './hooks/useImageUpload'
import { useProcessing } from './hooks/useProcessing'
import { DEFAULT_PARAMS, type ProcessingParams } from './lib/types'

const STEPS = ['Upload', 'Trace', 'Fit curves', 'Graph'] as const

function App() {
  const { status, file, previewUrl, metadata, error, select, reset, reportError } = useImageUpload()
  const [params, setParams] = useState<ProcessingParams>(DEFAULT_PARAMS)
  const processing = useProcessing(status === 'success' ? file : null, params)

  const current = previewUrl ? 1 : 0

  return (
    <div className="graph-paper min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-8 sm:py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <p className="font-display text-xl tracking-tight text-ink">
            Image<span className="text-vermilion">2</span>Desmos
          </p>
          <ol className="flex items-center gap-4 font-mono text-xs tracking-wide uppercase" aria-label="Progress">
            {STEPS.map((step, i) => (
              <li
                key={step}
                aria-current={i === current ? 'step' : undefined}
                className={`flex items-center gap-1.5 ${i === current ? 'text-ink' : 'text-ink/35'}`}
              >
                <span className={i === current ? 'text-vermilion' : ''}>{String(i + 1).padStart(2, '0')}</span>
                <span className="hidden sm:inline">{step}</span>
              </li>
            ))}
          </ol>
        </header>

        <main className="flex flex-1 flex-col justify-center py-10 sm:py-14">
          <div className="mb-8 max-w-2xl sm:mb-10">
            <h1 className="font-display text-4xl leading-[1.08] tracking-tight text-ink sm:text-6xl">
              Turn a drawing into <em className="text-vermilion not-italic">equations.</em>
            </h1>
            <p className="mt-4 max-w-xl text-base text-ink-muted sm:text-lg">
              Upload black-and-white line art. Every stroke is traced with classical computer
              vision and plain mathematics — no AI involved — on its way to a Desmos graph.
            </p>
          </div>

          {previewUrl ? (
            <ImagePreview
              previewUrl={previewUrl}
              metadata={metadata}
              uploading={status === 'uploading'}
              processing={processing}
              params={params}
              onParamsChange={setParams}
              onReplace={select}
              onRemove={reset}
            />
          ) : (
            <Dropzone
              onFile={select}
              onMultiple={() => reportError('Please upload one image at a time.')}
              error={status === 'error' ? error : null}
            />
          )}

          {previewUrl && error && (
            <p role="alert" className="mt-4 text-sm text-vermilion-deep">
              {error}
            </p>
          )}
        </main>

        <footer className="font-mono text-xs text-ink/50">
          Images are checked in memory and never stored.
        </footer>
      </div>
    </div>
  )
}

export default App
