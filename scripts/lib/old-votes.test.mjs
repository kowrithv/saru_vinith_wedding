// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { importVotes, parseOldVotes } from './old-votes.mjs'

const tallyZero = { Saruga: 0, Vinith: 0, Beide: 0 }

function oldFile(votes, tallies = {}) {
  return {
    questions: {
      1: { tally: { ...tallyZero, ...(tallies['1'] ?? {}) }, correctAnswer: null, revealed: false },
      2: { tally: { ...tallyZero, ...(tallies['2'] ?? {}) }, correctAnswer: null, revealed: false },
    },
    votes,
  }
}

const twoVotes = [
  { id: 'a1', questionId: '1', option: 'Saruga', voterName: 'Anna', createdAt: '2026-10-01T10:00:00.000Z' },
  { id: 'b2', questionId: '2', option: 'Beide', voterName: 'Ben', createdAt: '2026-10-01T11:00:00.000Z' },
]

describe('parseOldVotes', () => {
  it('turns every vote of the old file into a request with a stable legacy voter id', () => {
    const { votes, problems } = parseOldVotes(oldFile(twoVotes, { 1: { Saruga: 1 }, 2: { Beide: 1 } }))

    expect(problems).toEqual([])
    expect(votes).toEqual([
      { questionId: '1', option: 'Saruga', voterId: 'legacy-a1' },
      { questionId: '2', option: 'Beide', voterId: 'legacy-b2' },
    ])
  })

  it('does not carry the names of the voters over', () => {
    const { votes } = parseOldVotes(oldFile(twoVotes))
    expect(JSON.stringify(votes)).not.toMatch(/Anna|Ben|voterName/)
  })

  it('reports entries it cannot use and skips them', () => {
    const { votes, problems } = parseOldVotes(
      oldFile([
        twoVotes[0],
        { id: 'x', questionId: '', option: 'Saruga' },
        { id: 'y', questionId: '3', option: 42 },
        'kaputt',
      ])
    )

    expect(votes).toHaveLength(1)
    // Drei unbrauchbare Einträge (die Zähler-Abweichung ist ein eigener Hinweis).
    expect(problems.filter((problem) => /unbrauchbar/.test(problem))).toHaveLength(3)
  })

  it('warns when the counters of the old file do not match the list of votes', () => {
    const { problems } = parseOldVotes(oldFile([twoVotes[0]], { 1: { Saruga: 3 } }))
    expect(problems.join(' ')).toMatch(/3.*1|1.*3/)
  })

  it('treats a file without a votes list as empty and says so', () => {
    const { votes, problems } = parseOldVotes({ questions: {} })
    expect(votes).toEqual([])
    expect(problems.length).toBeGreaterThan(0)
  })

  it('falls back to a position based voter id when a vote has no id', () => {
    const { votes } = parseOldVotes(oldFile([{ questionId: '1', option: 'Vinith' }]))
    expect(votes[0].voterId).toBe('legacy-0')
  })
})

describe('importVotes', () => {
  const votes = [
    { questionId: '1', option: 'Saruga', voterId: 'legacy-a1' },
    { questionId: '2', option: 'Beide', voterId: 'legacy-b2' },
  ]

  it('sends nothing in a dry run', async () => {
    const fetchImpl = vi.fn()
    const results = await importVotes({ baseUrl: 'https://example.de', votes, apply: false, fetchImpl })

    expect(fetchImpl).not.toHaveBeenCalled()
    expect(results.map((r) => r.status)).toEqual(['dry-run', 'dry-run'])
  })

  it('posts each vote to the vote route and counts new and already known ones', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ tally: {}, alreadyVoted: false }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ tally: {}, alreadyVoted: true }) })

    const results = await importVotes({ baseUrl: 'https://example.de/', votes, apply: true, fetchImpl })

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://example.de/api/who-votes/vote')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ questionId: '1', voterId: 'legacy-a1', option: 'Saruga' })
    expect(results.map((r) => r.status)).toEqual(['imported', 'already-there'])
  })

  it('reports a locked vote feature and server errors per vote without stopping', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 423, json: async () => ({ error: 'gesperrt' }) })
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))

    const results = await importVotes({ baseUrl: 'https://example.de', votes, apply: true, fetchImpl })

    expect(results[0]).toMatchObject({ status: 'rejected', detail: expect.stringContaining('423') })
    expect(results[1]).toMatchObject({ status: 'failed', detail: expect.stringContaining('ECONNREFUSED') })
  })
})
