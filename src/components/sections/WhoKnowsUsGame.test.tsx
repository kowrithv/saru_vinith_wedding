import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WhoKnowsUsGame from './WhoKnowsUsGame'
import { whoQuestions, whoGameOptions } from '@/lib/who-game-content'

let capturedPoll: (() => void) | undefined

vi.mock('@/lib/use-polling', () => ({
  usePolling: (fn: () => void) => {
    capturedPoll = fn
  },
}))

vi.mock('@/lib/device-id', () => ({
  getDeviceId: () => 'test-device-id',
}))

function emptyTallyResponse() {
  return {
    questions: Object.fromEntries(
      whoQuestions.map((q) => [q.id, Object.fromEntries(whoGameOptions.map((o) => [o, 0]))])
    ),
  }
}

describe('WhoKnowsUsGame', () => {
  beforeEach(() => {
    capturedPoll = undefined
    window.localStorage.clear()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => emptyTallyResponse() })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the first question with all three options', () => {
    render(<WhoKnowsUsGame />)
    expect(screen.getByText(whoQuestions[0].question)).toBeInTheDocument()
    whoGameOptions.forEach((option) => {
      expect(screen.getByRole('button', { name: option })).toBeInTheDocument()
    })
  })

  it('casts a vote and shows live results for that question', async () => {
    const voteResponse = {
      tally: Object.fromEntries(whoGameOptions.map((o, i) => [o, i === 0 ? 1 : 0])),
      alreadyVoted: false,
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => voteResponse })
    )

    render(<WhoKnowsUsGame />)
    await userEvent.click(screen.getByRole('button', { name: whoGameOptions[0] }))

    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument())
  })

  it('disables voting again on a question that was already answered', async () => {
    const voteResponse = {
      tally: Object.fromEntries(whoGameOptions.map((o, i) => [o, i === 0 ? 1 : 0])),
      alreadyVoted: false,
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => voteResponse })
    )

    render(<WhoKnowsUsGame />)
    await userEvent.click(screen.getByRole('button', { name: whoGameOptions[0] }))
    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument())

    expect(screen.queryByRole('button', { name: whoGameOptions[1] })).not.toBeInTheDocument()
  })

  it('does not mark the question as answered when the vote request fails, so the guest can retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    render(<WhoKnowsUsGame />)
    await userEvent.click(screen.getByRole('button', { name: whoGameOptions[0] }))

    // Die Abstimmungs-Buttons müssen weiterhin da sein - kein lokal
    // vermerktes "schon abgestimmt", wenn der Server es nie bestätigt hat.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: whoGameOptions[0] })).toBeInTheDocument()
    })
    whoGameOptions.forEach((option) => {
      expect(screen.getByRole('button', { name: option })).toBeInTheDocument()
    })
  })

  it('does not mark the question as answered when the server responds with an error status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }))

    render(<WhoKnowsUsGame />)
    await userEvent.click(screen.getByRole('button', { name: whoGameOptions[0] }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: whoGameOptions[0] })).toBeInTheDocument()
    })
  })

  it('shows the server error message when voting is locked', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 423,
        json: async () => ({ error: 'Abstimmen ist derzeit vorübergehend gesperrt.' }),
      })
    )

    render(<WhoKnowsUsGame />)
    await userEvent.click(screen.getByRole('button', { name: whoGameOptions[0] }))

    await waitFor(() =>
      expect(screen.getByText('Abstimmen ist derzeit vorübergehend gesperrt.')).toBeInTheDocument()
    )
  })

  it('shows a generic error message when the vote request fails over the network', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    render(<WhoKnowsUsGame />)
    await userEvent.click(screen.getByRole('button', { name: whoGameOptions[0] }))

    await waitFor(() =>
      expect(screen.getByText(/abstimmen fehlgeschlagen/i)).toBeInTheDocument()
    )
  })

  it('advances to the next question and shows a finish screen after the last one', async () => {
    render(<WhoKnowsUsGame />)
    for (let i = 0; i < whoQuestions.length; i++) {
      await userEvent.click(screen.getByRole('button', { name: /weiter|fertig/i }))
    }
    expect(screen.getByText(/danke/i)).toBeInTheDocument()
  })

  it('updates the shown tally when a poll returns new data', async () => {
    // Die Ergebnisdarstellung erscheint erst, nachdem abgestimmt wurde
    // (gleiches Verhalten wie die alte App) - also zuerst abstimmen, dann
    // einen Poll mit aktualisierten Zahlen simulieren.
    const voteResponse = {
      tally: Object.fromEntries(whoGameOptions.map((o, i) => [o, i === 0 ? 1 : 0])),
      alreadyVoted: false,
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => voteResponse })
    )

    render(<WhoKnowsUsGame />)
    await userEvent.click(screen.getByRole('button', { name: whoGameOptions[0] }))
    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument())

    const updated = {
      questions: {
        ...emptyTallyResponse().questions,
        [whoQuestions[0].id]: Object.fromEntries(
          whoGameOptions.map((o, i) => [o, i === 0 ? 5 : 0])
        ),
      },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => updated }))

    capturedPoll?.()
    await waitFor(() => expect(screen.getByText('5')).toBeInTheDocument())
  })
})
