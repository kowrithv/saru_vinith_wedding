import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WhoResultsAdmin from './WhoResultsAdmin'

const KEY = 'kirsche'

type Phase = 'voting' | 'closed' | 'released'

function stubFetch(initial: Phase = 'voting', post: { status: number; body: unknown } | null = null) {
  const fn = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      const requested = JSON.parse(String(init.body)) as { phase: Phase }
      const { status, body } = post ?? { status: 200, body: { phase: requested.phase, key: KEY } }
      return { ok: status < 400, status, json: async () => body }
    }
    return { ok: true, status: 200, json: async () => ({ phase: initial, key: KEY }) }
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

function posted(fn: ReturnType<typeof stubFetch>) {
  return fn.mock.calls
    .filter(([, init]) => init?.method === 'POST')
    .map(([, init]) => JSON.parse(String(init?.body)) as { phase: Phase })
}

describe('WhoResultsAdmin', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('the three steps', () => {
    it('shows Abstimmen, Beendet and Freigegeben with the current one pressed', async () => {
      stubFetch('closed')
      render(<WhoResultsAdmin />)

      expect(await screen.findByRole('button', { name: 'Beendet', pressed: true })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Abstimmen', pressed: false })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Freigegeben', pressed: false })).toBeInTheDocument()
    })

    it('says in words what each step means', async () => {
      stubFetch('voting')
      render(<WhoResultsAdmin />)
      expect(await screen.findByText(/die gäste stimmen ab/i)).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'Beendet' }))
      expect(await screen.findByText(/abstimmung ist beendet.*noch verborgen/i)).toBeInTheDocument()
    })

    it('closes the voting without a confirmation', async () => {
      const fn = stubFetch('voting')
      render(<WhoResultsAdmin />)
      await userEvent.click(await screen.findByRole('button', { name: 'Beendet' }))

      await screen.findByRole('button', { name: 'Beendet', pressed: true })
      expect(window.confirm).not.toHaveBeenCalled()
      expect(posted(fn)).toEqual([{ phase: 'closed' }])
    })

    it('releases only after a confirmation', async () => {
      const fn = stubFetch('closed')
      render(<WhoResultsAdmin />)
      await userEvent.click(await screen.findByRole('button', { name: 'Freigegeben' }))

      await screen.findByRole('button', { name: 'Freigegeben', pressed: true })
      expect(window.confirm).toHaveBeenCalledTimes(1)
      expect(posted(fn)).toEqual([{ phase: 'released' }])
    })

    it('does nothing when the release is not confirmed', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      const fn = stubFetch('closed')
      render(<WhoResultsAdmin />)
      await userEvent.click(await screen.findByRole('button', { name: 'Freigegeben' }))

      expect(posted(fn)).toEqual([])
      expect(screen.getByRole('button', { name: 'Beendet', pressed: true })).toBeInTheDocument()
    })

    it('can go back from released to voting', async () => {
      const fn = stubFetch('released')
      render(<WhoResultsAdmin />)
      await userEvent.click(await screen.findByRole('button', { name: 'Abstimmen' }))

      await screen.findByRole('button', { name: 'Abstimmen', pressed: true })
      expect(posted(fn)).toEqual([{ phase: 'voting' }])
    })

    it('sends nothing when the current step is pressed again', async () => {
      const fn = stubFetch('voting')
      render(<WhoResultsAdmin />)
      await userEvent.click(await screen.findByRole('button', { name: 'Abstimmen' }))

      expect(posted(fn)).toEqual([])
    })

    it('says so when switching failed and keeps the old step', async () => {
      stubFetch('voting', { status: 500, body: {} })
      render(<WhoResultsAdmin />)
      await userEvent.click(await screen.findByRole('button', { name: 'Beendet' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/umschalten fehlgeschlagen/i)
      expect(screen.getByRole('button', { name: 'Abstimmen', pressed: true })).toBeInTheDocument()
    })
  })

  describe('link for the DJ', () => {
    it('shows the whole link in a field', async () => {
      stubFetch()
      render(<WhoResultsAdmin />)

      const field = (await screen.findByLabelText('Link')) as HTMLInputElement
      expect(field.value).toBe(`${window.location.origin}/dj#k=${KEY}`)
      expect(field).toHaveAttribute('readonly')
    })

    it('shows the link in every step', async () => {
      for (const phase of ['voting', 'closed', 'released'] as const) {
        stubFetch(phase)
        const { unmount } = render(<WhoResultsAdmin />)
        expect(await screen.findByLabelText('Link')).toBeInTheDocument()
        unmount()
      }
    })

    it('also shows address and word for typing', async () => {
      stubFetch()
      render(<WhoResultsAdmin />)

      const address = await screen.findByTestId('dj-address')
      expect(address.textContent).not.toMatch(/^https?:/)
      expect(address.textContent).toMatch(/\/dj$/)
      expect(screen.getByTestId('dj-word').textContent).toBe(KEY)
    })

    it('copies the link', async () => {
      stubFetch()
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
      render(<WhoResultsAdmin />)
      await userEvent.click(await screen.findByRole('button', { name: /link kopieren/i }))

      await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/dj#k=${KEY}`))
      expect(await screen.findByText('Link kopiert.')).toBeInTheDocument()
    })

    it('tells how to continue when the clipboard is not available', async () => {
      stubFetch()
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
        configurable: true,
      })
      render(<WhoResultsAdmin />)
      await userEvent.click(await screen.findByRole('button', { name: /link kopieren/i }))

      expect(await screen.findByText(/kopieren hat nicht geklappt/i)).toBeInTheDocument()
    })
  })

  it('reports when the state cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })))
    render(<WhoResultsAdmin />)

    expect(await screen.findByRole('alert')).toHaveTextContent(/nicht geladen/i)
  })
})
