import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderToString } from 'react-dom/server'
import TimePreviewBanner from './TimePreviewBanner'
import { previewKey } from '@/lib/time-preview'

describe('TimePreviewBanner', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  afterEach(() => {
    window.sessionStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('shows nothing without a preview (and nothing in the server HTML)', () => {
    const { container } = render(<TimePreviewBanner />)
    expect(container).toBeEmptyDOMElement()
    expect(renderToString(<TimePreviewBanner />)).toBe('')
  })

  it('says which day the page is showing, so nobody mistakes it for the real state', () => {
    window.history.replaceState(null, '', '/?zeit=danach')
    render(<TimePreviewBanner />)
    expect(screen.getByRole('status')).toHaveTextContent(/vorschau/i)
    expect(screen.getByRole('status')).toHaveTextContent(/nach der hochzeit/i)
  })

  it('describes the three previews differently', () => {
    window.history.replaceState(null, '', '/?zeit=heute')
    const { unmount } = render(<TimePreviewBanner />)
    expect(screen.getByRole('status')).toHaveTextContent(/vor dem empfang/i)
    unmount()

    window.sessionStorage.clear()
    window.history.replaceState(null, '', '/?zeit=feier')
    render(<TimePreviewBanner />)
    expect(screen.getByRole('status')).toHaveTextContent(/feier läuft/i)
  })

  it('ends the preview with one tap', async () => {
    window.history.replaceState(null, '', '/?zeit=heute')
    render(<TimePreviewBanner />)

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /beenden/i }))
    })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(previewKey()).toBeNull()
  })
})
