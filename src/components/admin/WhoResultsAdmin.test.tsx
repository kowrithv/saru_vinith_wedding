import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WhoResultsAdmin from './WhoResultsAdmin'

const KEY = 'kirsche'

type Phase = 'voting' | 'closed' | 'released'

const COUNTS = { votes: 42, voters: 3 }

function stubFetch(
  initial: Phase = 'voting',
  post: { status: number; body: unknown } | null = null,
  counts: { votes: number; voters: number } = COUNTS,
  del: { status: number; body: unknown } | null = null
) {
  const fn = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'DELETE') {
      const { status, body } = del ?? {
        status: 200,
        body: { phase: initial, key: KEY, votes: 0, voters: 0, deleted: counts.votes },
      }
      return { ok: status < 400, status, json: async () => body }
    }
    if (init?.method === 'POST') {
      const requested = JSON.parse(String(init.body)) as { phase: Phase }
      const { status, body } = post ?? { status: 200, body: { phase: requested.phase, key: KEY, ...counts } }
      return { ok: status < 400, status, json: async () => body }
    }
    return { ok: true, status: 200, json: async () => ({ phase: initial, key: KEY, ...counts }) }
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

  describe('resetting all votes', () => {
    const deletes = (fn: ReturnType<typeof stubFetch>) => fn.mock.calls.filter(([, init]) => init?.method === 'DELETE')

    it('shows how many votes and devices there are', async () => {
      stubFetch()
      render(<WhoResultsAdmin />)

      expect(await screen.findByTestId('who-vote-count')).toHaveTextContent('Bisher 42 Stimmen von 3 Geräten.')
    })

    it('uses the singular for one vote from one device', async () => {
      stubFetch('voting', null, { votes: 1, voters: 1 })
      render(<WhoResultsAdmin />)

      expect(await screen.findByTestId('who-vote-count')).toHaveTextContent('Bisher 1 Stimme von 1 Gerät.')
    })

    it('asks first, naming the numbers, and deletes after the confirmation', async () => {
      const fn = stubFetch()
      render(<WhoResultsAdmin />)
      await userEvent.click(await screen.findByRole('button', { name: 'Alle Stimmen löschen' }))

      expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Alle 42 Stimmen von 3 Geräten'))
      expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('nicht rückgängig'))
      expect(await screen.findByText('42 Stimmen gelöscht. Die Abstimmung beginnt von vorn.')).toBeInTheDocument()
      expect(deletes(fn)).toHaveLength(1)
      expect(screen.getByTestId('who-vote-count')).toHaveTextContent('Bisher 0 Stimmen von 0 Geräten.')
    })

    it('deletes nothing when the question is declined', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      const fn = stubFetch()
      render(<WhoResultsAdmin />)
      await userEvent.click(await screen.findByRole('button', { name: 'Alle Stimmen löschen' }))

      expect(deletes(fn)).toHaveLength(0)
      expect(screen.getByTestId('who-vote-count')).toHaveTextContent('42 Stimmen')
    })

    it('has nothing to delete when there are no votes', async () => {
      stubFetch('voting', null, { votes: 0, voters: 0 })
      render(<WhoResultsAdmin />)

      expect(await screen.findByRole('button', { name: 'Alle Stimmen löschen' })).toBeDisabled()
    })

    it('is switched off after the release, with the reason', async () => {
      stubFetch('released')
      render(<WhoResultsAdmin />)

      expect(await screen.findByRole('button', { name: 'Alle Stimmen löschen' })).toBeDisabled()
      expect(screen.getByText(/nach der freigabe nicht möglich/i)).toBeInTheDocument()
    })

    it('works again once the step is set back to Beendet', async () => {
      stubFetch('released')
      render(<WhoResultsAdmin />)
      await userEvent.click(await screen.findByRole('button', { name: 'Beendet' }))

      await waitFor(() => expect(screen.getByRole('button', { name: 'Alle Stimmen löschen' })).toBeEnabled())
    })

    it('shows the answer of the server when it refuses', async () => {
      stubFetch('voting', null, COUNTS, { status: 409, body: { error: 'Die Ergebnisse sind freigegeben.' } })
      render(<WhoResultsAdmin />)
      await userEvent.click(await screen.findByRole('button', { name: 'Alle Stimmen löschen' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Die Ergebnisse sind freigegeben.')
      expect(screen.getByTestId('who-vote-count')).toHaveTextContent('42 Stimmen')
    })

    it('says so when deleting failed', async () => {
      stubFetch('voting', null, COUNTS, { status: 500, body: {} })
      render(<WhoResultsAdmin />)
      await userEvent.click(await screen.findByRole('button', { name: 'Alle Stimmen löschen' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/löschen fehlgeschlagen/i)
    })

    it('says the session ran out on 401', async () => {
      stubFetch('voting', null, COUNTS, { status: 401, body: {} })
      render(<WhoResultsAdmin />)
      await userEvent.click(await screen.findByRole('button', { name: 'Alle Stimmen löschen' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/sitzung abgelaufen/i)
    })
  })
})
