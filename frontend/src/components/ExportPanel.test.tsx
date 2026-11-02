import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ExportPanel } from './ExportPanel'

const desmos = {
  expressions: [{ id: 'e1', latex: 'x^2+y^2=1', type: 'circle' as const, curve: 0, segment: 0 }],
  count: 1,
  skipped: {},
  skipped_count: 0,
}

function renderPanel(props: Partial<React.ComponentProps<typeof ExportPanel>> = {}) {
  const onNeedGraph = vi.fn()
  render(
    <ExportPanel
      desmos={desmos}
      sourceName="ring.png"
      hasApiKey
      calculator={null}
      onNeedGraph={onNeedGraph}
      {...props}
    />,
  )
  return { onNeedGraph }
}

let clicks: string[]

beforeEach(() => {
  clicks = []
  URL.createObjectURL = vi.fn(() => 'blob:x')
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicks.push(this.download)
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ExportPanel without a Desmos API key', () => {
  it('still downloads the .txt but disables the calculator-based exports', async () => {
    const user = userEvent.setup()
    const { onNeedGraph } = renderPanel({ hasApiKey: false })

    expect(screen.getByRole('button', { name: 'Export state JSON' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Import state JSON' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeDisabled()
    expect(screen.getByText(/need the live graph/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Download expressions' }))
    expect(clicks).toEqual(['ring-desmos.txt'])
    expect(screen.getByText('Downloaded 1 expression.')).toBeInTheDocument()
    expect(onNeedGraph).not.toHaveBeenCalled()
  })
})

describe('ExportPanel on a phone', () => {
  it('opens from a bar that stays available above any list length', async () => {
    const user = userEvent.setup()
    renderPanel({ collapsible: true })
    const bar = screen.getByRole('button', { name: 'Export' })
    expect(bar).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: 'Download PNG' })).not.toBeInTheDocument()

    await user.click(bar)
    expect(bar).toHaveAttribute('aria-expanded', 'true')
    await user.click(screen.getByRole('button', { name: 'Download expressions' }))
    expect(clicks).toEqual(['ring-desmos.txt'])
  })
})

describe('ExportPanel with a calculator already open', () => {
  it('exports without asking to open the graph', async () => {
    const user = userEvent.setup()
    const calculator = { getState: vi.fn(() => ({ expressions: { list: [] } })) } as unknown as DesmosCalculator
    const { onNeedGraph } = renderPanel({ calculator })

    await user.click(screen.getByRole('button', { name: 'Export state JSON' }))

    expect(await screen.findByText(/saved the desmos state/i)).toBeInTheDocument()
    expect(clicks).toEqual(['ring-desmos-state.json'])
    expect(onNeedGraph).not.toHaveBeenCalled()
  })

  it('asks for the graph when no calculator exists yet', async () => {
    const user = userEvent.setup()
    const { onNeedGraph } = renderPanel()

    await user.click(screen.getByRole('button', { name: 'Download PNG' }))

    expect(onNeedGraph).toHaveBeenCalledOnce()
    expect(screen.getByText(/waiting for the desmos graph/i)).toBeInTheDocument()
  })
})
