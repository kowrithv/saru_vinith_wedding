import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ResultsPage from './page'
import { whoQuestions, whoGameOptions } from '@/lib/who-game-content'
import { forgetResultsKey } from '@/lib/who-results-key'

const KEY = 'kirsche'

function tally() {
  return Object.fromEntries(
    whoQuestions.map((q) => [q.id, Object.fromEntries(whoGameOptions.map((o, i) => [o, i === 0 ? 4 : 0]))])
  )
}

function respond(status: number, body: unknown) {
  return { ok: status < 400, status, json: async () => body }
}

describe('DJ results page', () => {
  beforeEach(() => {
    forgetResultsKey()
    window.localStorage.clear()
    window.history.replaceState(null, '', '/dj')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    forgetResultsKey()
    window.localStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  describe('without a word', () => {
    it('asks for the word and asks the server nothing', async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      render(<ResultsPage />)

      expect(await screen.findByLabelText('Wort')).toBeInTheDocument()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('sends the typed word as a header and shows the live counts', async () => {
      const fetchMock = vi.fn(async () => respond(200, { phase: 'voting', released: false, questions: tally() }))
      vi.stubGlobal('fetch', fetchMock)
      render(<ResultsPage />)

      await userEvent.type(await screen.findByLabelText('Wort'), 'Kirsche')
      await userEvent.click(screen.getByRole('button', { name: /ergebnisse anzeigen/i }))

      expect(await screen.findByText(whoQuestions[0].question)).toBeInTheDocument()
      expect(screen.getByText(/für die gäste noch verborgen/i)).toBeInTheDocument()
      const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]
      expect(init.headers).toMatchObject({ 'x-results-key': KEY })
    })

    it('says what is wrong when the input cannot be a word, without asking the server', async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      render(<ResultsPage />)

      await userEvent.type(await screen.findByLabelText('Wort'), 'k1')
      await userEvent.click(screen.getByRole('button', { name: /ergebnisse anzeigen/i }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/nur buchstaben/i)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('goes back to the form with a note when the server does not know the word', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => respond(200, { phase: 'voting', released: false, questions: null })))
      render(<ResultsPage />)

      await userEvent.type(await screen.findByLabelText('Wort'), 'zebra')
      await userEvent.click(screen.getByRole('button', { name: /ergebnisse anzeigen/i }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/dieses wort gilt nicht/i)
      expect(screen.getByLabelText('Wort')).toBeInTheDocument()
      expect(window.localStorage.getItem('who-results-code')).toBeNull()
    })

    it('stops asking and says so when the server reports too many wrong words', async () => {
      const fetchMock = vi.fn(async () => respond(429, { error: 'Zu viele falsche Wörter.' }))
      vi.stubGlobal('fetch', fetchMock)
      render(<ResultsPage />)

      await userEvent.type(await screen.findByLabelText('Wort'), 'zebra')
      await userEvent.click(screen.getByRole('button', { name: /ergebnisse anzeigen/i }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/zu viele falsche wörter/i)
      const calls = fetchMock.mock.calls.length
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(fetchMock.mock.calls.length).toBe(calls)
    })
  })

  describe('with the word from the link', () => {
    it('shows the live counts before the release and does not ask for a word', async () => {
      window.history.replaceState(null, '', `/dj#k=${KEY}`)
      vi.stubGlobal('fetch', vi.fn(async () => respond(200, { phase: 'voting', released: false, questions: tally() })))

      render(<ResultsPage />)

      expect(await screen.findByText(whoQuestions[0].question)).toBeInTheDocument()
      expect(screen.queryByLabelText('Wort')).not.toBeInTheDocument()
      expect(window.location.hash).toBe('')
    })

    it('tells when the voting is closed and the results are not yet released', async () => {
      window.history.replaceState(null, '', `/dj#k=${KEY}`)
      vi.stubGlobal('fetch', vi.fn(async () => respond(200, { phase: 'closed', released: false, questions: tally() })))

      render(<ResultsPage />)

      expect(await screen.findByText(/abstimmung ist beendet.*noch verborgen/i)).toBeInTheDocument()
      expect(screen.getByText(whoQuestions[0].question)).toBeInTheDocument()
    })

    it('tells when the results are released for the guests', async () => {
      window.history.replaceState(null, '', `/dj#k=${KEY}`)
      vi.stubGlobal('fetch', vi.fn(async () => respond(200, { phase: 'released', released: true, questions: tally() })))

      render(<ResultsPage />)

      expect(await screen.findByText(/für die gäste freigegeben/i)).toBeInTheDocument()
    })

    it('remembers the word for the next visit', async () => {
      window.history.replaceState(null, '', `/dj#k=${KEY}`)
      vi.stubGlobal('fetch', vi.fn(async () => respond(200, { phase: 'voting', released: false, questions: tally() })))

      render(<ResultsPage />)
      await screen.findByText(whoQuestions[0].question)

      await waitFor(() => expect(window.localStorage.getItem('who-results-code')).toBe(KEY))
    })
  })
})
