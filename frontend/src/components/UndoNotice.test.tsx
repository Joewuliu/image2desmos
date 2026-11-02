import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UndoNotice } from './UndoNotice'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('UndoNotice', () => {
  it('expires after ten seconds', () => {
    const onExpire = vi.fn()
    render(<UndoNotice action={{ message: 'Removed a.png', run: vi.fn() }} onUndo={vi.fn()} onExpire={onExpire} />)
    expect(screen.getByText('Removed a.png')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(9_999)
    })
    expect(onExpire).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(onExpire).toHaveBeenCalledOnce()
  })
})
