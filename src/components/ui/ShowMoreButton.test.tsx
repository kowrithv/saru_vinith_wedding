import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ShowMoreButton from './ShowMoreButton'

type Callback = (entries: { isIntersecting: boolean }[]) => void

describe('ShowMoreButton', () => {
  let callbacks: Callback[]
  const disconnect = vi.fn()
  let options: IntersectionObserverInit[]

  beforeEach(() => {
    callbacks = []
    options = []
    disconnect.mockClear()
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: Callback, init: IntersectionObserverInit = {}) {
          callbacks.push(callback)
          options.push(init)
        }
        observe() {}
        unobserve() {}
        disconnect() {
          disconnect()
        }
      }
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('stays a normal button: tapping it loads more', async () => {
    const onClick = vi.fn()
    render(<ShowMoreButton label="60 weitere Fotos anzeigen" onClick={onClick} />)
    await userEvent.click(screen.getByRole('button', { name: '60 weitere Fotos anzeigen' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  // Infinite scroll: kommt der Knopf in die Nähe des Bildschirms, lädt die
  // Liste von selbst nach.
  it('loads more by itself as soon as the button comes near the screen', () => {
    const onClick = vi.fn()
    render(<ShowMoreButton label="mehr" onClick={onClick} />)

    act(() => callbacks[0]([{ isIntersecting: true }]))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('looks ahead, so the next portion is there before the guest reaches the end', () => {
    render(<ShowMoreButton label="mehr" onClick={() => {}} />)
    expect(options[0].rootMargin).toMatch(/^\d{3,4}px/)
  })

  it('does nothing while the button is still far away', () => {
    const onClick = vi.fn()
    render(<ShowMoreButton label="mehr" onClick={onClick} />)

    act(() => callbacks[0]([{ isIntersecting: false }]))

    expect(onClick).not.toHaveBeenCalled()
  })

  it('loads one portion per appearance, not a flood', () => {
    const onClick = vi.fn()
    render(<ShowMoreButton label="mehr" onClick={onClick} />)

    act(() => {
      callbacks[0]([{ isIntersecting: true }])
      callbacks[0]([{ isIntersecting: true }])
      callbacks[0]([{ isIntersecting: true }])
    })

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('stops watching when it disappears', () => {
    const { unmount } = render(<ShowMoreButton label="mehr" onClick={() => {}} />)
    unmount()
    expect(disconnect).toHaveBeenCalled()
  })

  it('still works as a plain button where the browser has no IntersectionObserver', async () => {
    vi.unstubAllGlobals()
    const onClick = vi.fn()
    render(<ShowMoreButton label="mehr" onClick={onClick} />)
    await userEvent.click(screen.getByRole('button', { name: 'mehr' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
