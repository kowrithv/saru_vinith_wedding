import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GET } from './route'
import { whoQuestions, whoGameOptions } from '@/lib/who-game-content'

describe('GET /api/who-votes', () => {
  const originalPath = process.env.DATABASE_PATH

  beforeEach(() => {
    delete globalThis.__appDb
    process.env.DATABASE_PATH = ':memory:'
  })

  afterEach(() => {
    globalThis.__appDb?.close()
    delete globalThis.__appDb
    process.env.DATABASE_PATH = originalPath
  })

  it('returns a zero-initialized tally for every question before any vote', async () => {
    const response = await GET()
    expect(response.status).toBe(200)
    const body = await response.json()

    expect(Object.keys(body.questions)).toHaveLength(whoQuestions.length)
    expect(body.questions['1'][whoGameOptions[0]]).toBe(0)
  })
})
