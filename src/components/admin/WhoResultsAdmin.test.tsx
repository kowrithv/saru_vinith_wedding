import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WhoResultsAdmin from './WhoResultsAdmin'

const KEY = 'kirsche'

function stubFetch(
  initial: { released: boolean } = { released: false },
  post: { status: number; body: unknown } | null = null
) {
  const fn = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      const requested = JSON.parse(String(init.body)) as { released: boolean }
      const { status, body } = post ?? { status: 200, body: { released: requested.released, key: KEY } }
      return { ok: status < 400, status, json: async () => body }
    }
    return { ok: true, status: 200, json: async () => ({ released: initial.released, key: KEY }) }
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('WhoResultsAdmin', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('shows the state and the link for the DJ', async () => {
    stubFetch()
    render(<WhoResultsAdmin />)

    expect(await screen.findByText(/verborgen/i)).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /auflösung für gäste freigeben/i })).not.toBeChecked()
    expect(screen.getByTestId('dj-word')).toHaveTextContent(KEY)
    expect(screen.getByTestId('dj-address')).toHaveTextContent(`${window.location.host}/dj`)
  })

  it('anchors the switch knob to the left edge so it can slide', async () => {
    stubFetch()
    render(<WhoResultsAdmin />)

    const knob = (await screen.findByRole('switch')).firstElementChild
    expect(knob).toHaveClass('left-0')
  })

  it('shows the address without protocol, short enough to type', async () => {
    stubFetch()
    render(<WhoResultsAdmin />)

    const address = await screen.findByTestId('dj-address')
    expect(address.textContent).not.toMatch(/^https?:/)
    expect(address.textContent).toMatch(/\/dj$/)
    expect(screen.getByTestId('dj-word').textContent).toBe(KEY)
  })

  it('releases the results after a confirmation', async () => {
    const fetchMock = stubFetch()
    render(<WhoResultsAdmin />)
    await userEvent.click(await screen.findByRole('switch'))

    await screen.findByText(/für gäste freigegeben/i)
    expect(window.confirm).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('switch')).toBeChecked()
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ released: true })
  })

  it('does nothing when the confirmation is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const fetchMock = stubFetch()
    render(<WhoResultsAdmin />)
    await userEvent.click(await screen.findByRole('switch'))

    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
    expect(screen.getByRole('switch')).not.toBeChecked()
  })

  it('hides the results again without a confirmation', async () => {
    stubFetch({ released: true })
    render(<WhoResultsAdmin />)
    await screen.findByText(/für gäste freigegeben/i)

    await userEvent.click(screen.getByRole('switch'))

    await screen.findByText(/verborgen/i)
    expect(window.confirm).not.toHaveBeenCalled()
  })

  it('says so when switching failed and keeps the old state', async () => {
    stubFetch({ released: false }, { status: 500, body: {} })
    render(<WhoResultsAdmin />)
    await userEvent.click(await screen.findByRole('switch'))

    expect(await screen.findByRole('alert')).toHaveTextContent(/umschalten fehlgeschlagen/i)
    expect(screen.getByRole('switch')).not.toBeChecked()
  })

  it('copies the link', async () => {
    stubFetch()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<WhoResultsAdmin />)
    await userEvent.click(await screen.findByRole('button', { name: /link kopieren/i }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining(`/dj#k=${KEY}`)))
    expect(await screen.findByText('Link kopiert.')).toBeInTheDocument()
  })

  it('reports when the state cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })))
    render(<WhoResultsAdmin />)

    expect(await screen.findByRole('alert')).toHaveTextContent(/nicht geladen/i)
  })
})
