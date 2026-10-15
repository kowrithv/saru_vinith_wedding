import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ResultsPage from './page'
import { whoQuestions, whoGameOptions } from '@/lib/who-game-content'
import { forgetResultsKey } from '@/lib/who-results-key'

const KEY = 'cd'.repeat(12)

function tally() {
  return Object.fromEntries(
    whoQuestions.map((q) => [q.id, Object.fromEntries(whoGameOptions.map((o, i) => [o, i === 0 ? 4 : 0]))])
  )
}

describe('DJ results page', () => {
  beforeEach(() => {
    forgetResultsKey()
    window.sessionStorage.clear()
    window.history.replaceState(null, '', '/dj')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    forgetResultsKey()
    window.history.replaceState(null, '', '/')
  })

  it('explains that the link is incomplete when there is no key', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<ResultsPage />)

    expect(await screen.findByText('Dieser Link ist unvollständig')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends the key as a header and shows the live counts before the release', async () => {
    window.history.replaceState(null, '', `/dj#k=${KEY}`)
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ released: false, questions: tally() }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    render(<ResultsPage />)

    expect(await screen.findByText(whoQuestions[0].question)).toBeInTheDocument()
    expect(screen.getByText(/für die gäste noch verborgen/i)).toBeInTheDocument()
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect(init.headers).toMatchObject({ 'x-results-key': KEY })
  })

  it('says the key is not valid when the server hides the results from it', async () => {
    window.history.replaceState(null, '', `/dj#k=${KEY}`)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ released: false, questions: null }) }))
    )

    render(<ResultsPage />)

    expect(await screen.findByText('Der Schlüssel gilt nicht')).toBeInTheDocument()
  })

  it('tells when the results are released for the guests', async () => {
    window.history.replaceState(null, '', `/dj#k=${KEY}`)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ released: true, questions: tally() }) }))
    )

    render(<ResultsPage />)

    expect(await screen.findByText(/für die gäste freigegeben/i)).toBeInTheDocument()
  })
})
