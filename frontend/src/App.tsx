import { Dropzone } from './components/Dropzone'
import { ImagePreview } from './components/ImagePreview'
import { useImageUpload } from './hooks/useImageUpload'

const STEPS = ['Upload', 'Trace', 'Fit curves', 'Graph'] as const

function App() {
  const { status, previewUrl, metadata, error, select, reset, reportError } = useImageUpload()

  return (
    <div className="graph-paper min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-8 sm:py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <p className="font-display text-xl tracking-tight text-ink">
            Image<span className="text-vermilion">2</span>Desmos
          </p>
          <ol className="flex items-center gap-4 font-mono text-xs tracking-wide uppercase" aria-label="Progress">
            {STEPS.map((step, i) => (
              <li
                key={step}
                aria-current={i === 0 ? 'step' : undefined}
                className={`flex items-center gap-1.5 ${i === 0 ? 'text-ink' : 'text-ink/35'}`}
              >
                <span className={i === 0 ? 'text-vermilion' : ''}>{String(i + 1).padStart(2, '0')}</span>
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
              Upload black-and-white line art. Every stroke is traced and fitted with plain
              mathematics — no AI involved — then plotted as a Desmos graph.
            </p>
          </div>

          {previewUrl ? (
            <ImagePreview
              previewUrl={previewUrl}
              metadata={metadata}
              uploading={status === 'uploading'}
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
