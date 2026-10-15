import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WhoKnowsUsGame from './WhoKnowsUsGame'
import { whoQuestions, whoGameOptions } from '@/lib/who-game-content'

vi.mock('@/lib/device-id', () => ({
  getDeviceId: () => 'test-device-id',
}))

interface ApiOptions {
  phase?: 'voting' | 'closed' | 'released'
  questions?: Record<string, Record<string, number>> | null
  unlocked?: boolean
  voteResponse?: { status: number; body: unknown }
}

function tallyWith(counts: Record<string, number>) {
  return Object.fromEntries(
    whoQuestions.map((q) => [q.id, Object.fromEntries(whoGameOptions.map((o) => [o, counts[o] ?? 0]))])
  )
}

function stubApi({ phase = 'voting', questions = null, unlocked = true, voteResponse }: ApiOptions = {}) {
  const calls: { url: string; init?: RequestInit }[] = []
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    if (url === '/api/who-votes') {
      return { ok: true, status: 200, json: async () => ({ phase, released: phase === 'released', questions }) }
    }
    if (url === '/api/access') {
      return { ok: true, status: 200, json: async () => ({ unlocked }) }
    }
    if (url === '/api/who-votes/vote') {
      const { status, body } = voteResponse ?? { status: 200, body: { alreadyVoted: false } }
      return { ok: status < 400, status, json: async () => body }
    }
    throw new Error(`unexpected request ${url}`)
  })
  vi.stubGlobal('fetch', fn)
  return {
    calls,
    voteBodies: () =>
      calls
        .filter((c) => c.url === '/api/who-votes/vote')
        .map((c) => JSON.parse(String(c.init?.body)) as Record<string, unknown>),
  }
}

describe('WhoKnowsUsGame', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows a loading state until the server has answered', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    render(<WhoKnowsUsGame />)
    expect(screen.getByRole('status')).toHaveTextContent(/geladen/i)
    expect(screen.queryByText(whoQuestions[0].question)).not.toBeInTheDocument()
  })

  it('renders the first question with all three options', async () => {
    stubApi()
    render(<WhoKnowsUsGame />)

    expect(await screen.findByText(whoQuestions[0].question)).toBeInTheDocument()
    whoGameOptions.forEach((option) => {
      expect(screen.getByRole('button', { name: option })).toBeInTheDocument()
    })
    expect(screen.getByText(`Frage 1 von ${whoQuestions.length}`)).toBeInTheDocument()
  })

  it('votes with photos: one photo per answer and no names in the picture', async () => {
    stubApi()
    const { container } = render(<WhoKnowsUsGame />)
    await screen.findByText(whoQuestions[0].question)

    const sources = [...container.querySelectorAll('button img')].map((img) => img.getAttribute('src'))
    expect(sources).toEqual(['/who/saruga.jpg', '/who/vinith.jpg', '/who/beide.jpg'])
    // Die Namen gibt es nur als Beschriftung für Screenreader, nicht als Text im Bild.
    whoGameOptions.forEach((option) => {
      expect(screen.queryByText(option)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: option })).toBeInTheDocument()
    })
  })

  it('confirms a vote with the check mark only, without a sentence after every question', async () => {
    stubApi()
    render(<WhoKnowsUsGame />)
    await userEvent.click(await screen.findByRole('button', { name: whoGameOptions[0] }))

    const status = await screen.findByRole('status')
    expect(status).toHaveClass('sr-only')
    expect(screen.queryByText(/ergebnisse gibt es nach der auflösung/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Weiter' })).toBeInTheDocument()
  })

  it('keeps the same photo elements when the next question comes, only the text changes', async () => {
    stubApi()
    const { container } = render(<WhoKnowsUsGame />)
    await userEvent.click(await screen.findByRole('button', { name: whoGameOptions[0] }))
    await screen.findByRole('button', { name: 'Weiter' })
    const before = [...container.querySelectorAll('button img')]
    expect(before).toHaveLength(3)

    await userEvent.click(screen.getByRole('button', { name: 'Weiter' }))
    await screen.findByText(whoQuestions[1].question)

    const after = [...container.querySelectorAll('button img')]
    expect(after).toHaveLength(3)
    after.forEach((image, position) => expect(image).toBe(before[position]))
  })

  it('reserves the place of the Weiter button before the vote so the card does not grow', async () => {
    stubApi()
    const { container } = render(<WhoKnowsUsGame />)
    await screen.findByText(whoQuestions[0].question)

    // Vor der Stimme ist der Knopf da, aber unsichtbar und für niemanden bedienbar.
    const button = screen.getByText('Weiter', { selector: 'button' }) as HTMLButtonElement
    expect(button).toHaveClass('invisible')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-hidden', 'true')
    expect(button).toHaveAttribute('tabindex', '-1')
    expect(screen.queryByRole('button', { name: 'Weiter' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: whoGameOptions[0] }))

    const same = await screen.findByRole('button', { name: 'Weiter' })
    expect(same).toBe(button)
    expect(same).toBeEnabled()
    expect(same).not.toHaveClass('invisible')
  })

  describe('changing a vote', () => {
    it('sends the new answer when another photo is tapped after voting and moves the check', async () => {
      const api = stubApi()
      render(<WhoKnowsUsGame />)
      await userEvent.click(await screen.findByRole('button', { name: whoGameOptions[0] }))
      await screen.findByRole('button', { name: 'Weiter' })

      await userEvent.click(screen.getByRole('button', { name: whoGameOptions[1] }))

      await waitFor(() => expect(api.voteBodies()).toHaveLength(2))
      expect(api.voteBodies()[1]).toMatchObject({ questionId: whoQuestions[0].id, option: whoGameOptions[1] })
      await waitFor(() =>
        expect(screen.getByRole('button', { name: whoGameOptions[1] })).toHaveAttribute('aria-pressed', 'true')
      )
      expect(screen.getByRole('button', { name: whoGameOptions[0] })).toHaveAttribute('aria-pressed', 'false')
      expect(JSON.parse(window.localStorage.getItem('who-game-votes') as string)).toEqual({
        [whoQuestions[0].id]: whoGameOptions[1],
      })
    })

    it('does not send anything when the chosen photo is tapped again', async () => {
      const api = stubApi()
      render(<WhoKnowsUsGame />)
      await userEvent.click(await screen.findByRole('button', { name: whoGameOptions[0] }))
      await screen.findByRole('button', { name: 'Weiter' })

      await userEvent.click(screen.getByRole('button', { name: whoGameOptions[0] }))

      expect(api.voteBodies()).toHaveLength(1)
    })

    it('keeps the old answer when the change is not confirmed', async () => {
      let call = 0
      const fn = vi.fn(async (url: string) => {
        if (url === '/api/who-votes') return { ok: true, status: 200, json: async () => ({ phase: 'voting', released: false, questions: null }) }
        if (url === '/api/access') return { ok: true, status: 200, json: async () => ({ unlocked: true }) }
        call += 1
        return call === 1
          ? { ok: true, status: 200, json: async () => ({ alreadyVoted: false, changed: false }) }
          : { ok: false, status: 429, json: async () => ({ error: 'Zu viele Stimmen. Bitte später erneut versuchen.' }) }
      })
      vi.stubGlobal('fetch', fn)
      render(<WhoKnowsUsGame />)
      await userEvent.click(await screen.findByRole('button', { name: whoGameOptions[0] }))
      await screen.findByRole('button', { name: 'Weiter' })

      await userEvent.click(screen.getByRole('button', { name: whoGameOptions[2] }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/zu viele stimmen/i)
      expect(screen.getByRole('button', { name: whoGameOptions[0] })).toHaveAttribute('aria-pressed', 'true')
      expect(JSON.parse(window.localStorage.getItem('who-game-votes') as string)).toEqual({
        [whoQuestions[0].id]: whoGameOptions[0],
      })
    })

    it('goes back to the previous question and shows the answer given there', async () => {
      stubApi()
      render(<WhoKnowsUsGame />)
      await userEvent.click(await screen.findByRole('button', { name: whoGameOptions[2] }))
      await userEvent.click(await screen.findByRole('button', { name: 'Weiter' }))
      await screen.findByText(whoQuestions[1].question)

      await userEvent.click(screen.getByRole('button', { name: 'Zurück' }))

      expect(await screen.findByText(whoQuestions[0].question)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: whoGameOptions[2] })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByText(`Frage 1 von ${whoQuestions.length}`)).toBeInTheDocument()
    })

    it('has no Zurück on the first question', async () => {
      stubApi()
      render(<WhoKnowsUsGame />)
      await screen.findByText(whoQuestions[0].question)

      expect(screen.queryByRole('button', { name: 'Zurück' })).not.toBeInTheDocument()
    })

    it('lets the guest review and change the answers from the thank-you page', async () => {
      window.localStorage.setItem(
        'who-game-votes',
        JSON.stringify(Object.fromEntries(whoQuestions.map((q) => [q.id, whoGameOptions[0]])))
      )
      stubApi()
      render(<WhoKnowsUsGame />)
      await screen.findByText('Danke fürs Mitmachen!')

      await userEvent.click(screen.getByRole('button', { name: /antworten ansehen und ändern/i }))

      expect(await screen.findByText(whoQuestions[0].question)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: whoGameOptions[0] })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: 'Weiter' })).toBeEnabled()
    })
  })

  it('marks the chosen photo and lets the others step back', async () => {
    stubApi()
    render(<WhoKnowsUsGame />)
    await userEvent.click(await screen.findByRole('button', { name: whoGameOptions[1] }))

    await screen.findByText(/deine stimme ist gespeichert/i)
    expect(screen.getByRole('button', { name: whoGameOptions[1] })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: whoGameOptions[0] })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: whoGameOptions[2] })).toHaveAttribute('aria-pressed', 'false')
  })

  it('casts a vote with the device id and confirms it without showing any results', async () => {
    const api = stubApi()
    render(<WhoKnowsUsGame />)
    await userEvent.click(await screen.findByRole('button', { name: whoGameOptions[0] }))

    await screen.findByText(/deine stimme ist gespeichert/i)
    expect(api.voteBodies()).toEqual([
      { questionId: whoQuestions[0].id, voterId: 'test-device-id', option: whoGameOptions[0] },
    ])
    expect(screen.queryByText(/\d+ %/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Weiter' })).toBeInTheDocument()
  })

  it('moves on to the next question with Weiter and cannot vote twice on one', async () => {
    stubApi()
    render(<WhoKnowsUsGame />)
    await userEvent.click(await screen.findByRole('button', { name: whoGameOptions[1] }))
    await userEvent.click(await screen.findByRole('button', { name: 'Weiter' }))

    expect(await screen.findByText(whoQuestions[1].question)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: whoGameOptions[0] })).toBeEnabled()
  })

  it('continues at the first unanswered question on a later visit', async () => {
    window.localStorage.setItem(
      'who-game-votes',
      JSON.stringify({ [whoQuestions[0].id]: whoGameOptions[0], [whoQuestions[1].id]: whoGameOptions[2] })
    )
    stubApi()
    render(<WhoKnowsUsGame />)

    expect(await screen.findByText(whoQuestions[2].question)).toBeInTheDocument()
    expect(screen.getByText(`Frage 3 von ${whoQuestions.length}`)).toBeInTheDocument()
  })

  it('thanks the guest after the last question and promises the reveal at the party', async () => {
    window.localStorage.setItem(
      'who-game-votes',
      JSON.stringify(Object.fromEntries(whoQuestions.map((q) => [q.id, whoGameOptions[0]])))
    )
    stubApi()
    render(<WhoKnowsUsGame />)

    expect(await screen.findByText('Danke fürs Mitmachen!')).toBeInTheDocument()
    expect(screen.getByText(/auflösung gibt es bei der feier/i)).toBeInTheDocument()
  })

  it('does not record a vote the server did not confirm', async () => {
    stubApi({ voteResponse: { status: 423, body: { error: 'Die Abstimmung ist beendet.' } } })
    render(<WhoKnowsUsGame />)
    await userEvent.click(await screen.findByRole('button', { name: whoGameOptions[0] }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Die Abstimmung ist beendet.')
    expect(screen.getByRole('button', { name: whoGameOptions[0] })).toBeEnabled()
    expect(window.localStorage.getItem('who-game-votes')).toBeNull()
  })

  describe('guest password', () => {
    it('asks for the password only while the browser is not unlocked', async () => {
      stubApi({ unlocked: true })
      const { unmount } = render(<WhoKnowsUsGame />)
      await screen.findByText(whoQuestions[0].question)
      expect(screen.queryByLabelText(/kennwort/i)).not.toBeInTheDocument()
      unmount()

      stubApi({ unlocked: false })
      render(<WhoKnowsUsGame />)
      expect(await screen.findByLabelText(/kennwort/i)).toBeInTheDocument()
    })

    it('does not send a vote without the password', async () => {
      const api = stubApi({ unlocked: false })
      render(<WhoKnowsUsGame />)
      await screen.findByLabelText(/kennwort/i)

      await userEvent.click(screen.getByRole('button', { name: whoGameOptions[0] }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/kennwort/i)
      expect(api.voteBodies()).toHaveLength(0)
    })

    it('sends the password with the vote and hides the field afterwards', async () => {
      const api = stubApi({ unlocked: false })
      render(<WhoKnowsUsGame />)
      await userEvent.type(await screen.findByLabelText(/kennwort/i), 'love')

      await userEvent.click(screen.getByRole('button', { name: whoGameOptions[0] }))

      await screen.findByText(/deine stimme ist gespeichert/i)
      expect(api.voteBodies()[0]).toMatchObject({ password: 'love', option: whoGameOptions[0] })
      expect(screen.queryByLabelText(/kennwort/i)).not.toBeInTheDocument()
    })

    it('says so when the password is wrong and keeps the question open', async () => {
      stubApi({ unlocked: false, voteResponse: { status: 401, body: { error: 'Falsches Kennwort.' } } })
      render(<WhoKnowsUsGame />)
      await userEvent.type(await screen.findByLabelText(/kennwort/i), 'falsch')

      await userEvent.click(screen.getByRole('button', { name: whoGameOptions[0] }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Falsches Kennwort.')
      expect(window.localStorage.getItem('who-game-votes')).toBeNull()
    })

    it('shows the field again when a remembered session is no longer valid', async () => {
      stubApi({ unlocked: true, voteResponse: { status: 401, body: { error: 'Kennwort erforderlich.' } } })
      render(<WhoKnowsUsGame />)
      await userEvent.click(await screen.findByRole('button', { name: whoGameOptions[0] }))

      expect(await screen.findByLabelText(/kennwort/i)).toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveTextContent(/kennwort/i)
    })
  })

  describe('when the voting is closed but not released', () => {
    it('says the voting is over and shows neither photos nor results', async () => {
      stubApi({ phase: 'closed' })
      const { container } = render(<WhoKnowsUsGame />)

      expect(await screen.findByText('Die Abstimmung ist beendet')).toBeInTheDocument()
      expect(screen.getByText(/auflösung gibt es bei der feier/i)).toBeInTheDocument()
      expect(container.querySelectorAll('button img')).toHaveLength(0)
      expect(screen.queryByText(/\d+ %/)).not.toBeInTheDocument()
      expect(screen.queryByText('Die Auflösung')).not.toBeInTheDocument()
    })
  })

  describe('after the release', () => {
    it('shows the results of all questions and marks the own vote', async () => {
      window.localStorage.setItem('who-game-votes', JSON.stringify({ [whoQuestions[0].id]: whoGameOptions[1] }))
      stubApi({
        phase: 'released',
        questions: tallyWith({ [whoGameOptions[0]]: 3, [whoGameOptions[1]]: 1 }),
      })
      render(<WhoKnowsUsGame />)

      expect(await screen.findByText('Die Auflösung')).toBeInTheDocument()
      expect(screen.getByText(whoQuestions[0].question)).toBeInTheDocument()
      expect(screen.getByText(whoQuestions[whoQuestions.length - 1].question)).toBeInTheDocument()
      expect(screen.getAllByText('3 · 75 %')).toHaveLength(whoQuestions.length)
      expect(screen.getByText(/\(deine stimme\)/i)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: whoGameOptions[0] })).not.toBeInTheDocument()
    })
  })
})
