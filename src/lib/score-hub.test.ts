import { afterEach, describe, expect, it, vi } from 'vitest'
import { publishScore, scoreSubscriberCount, subscribeScore } from './score-hub'

const snapshot = { bride: 1, groom: 2, rev: 3 }

describe('score hub', () => {
  afterEach(() => {
    delete globalThis.__scoreHub
  })

  it('hands a published score to every subscriber', () => {
    const first = vi.fn()
    const second = vi.fn()
    subscribeScore(first)
    subscribeScore(second)
    publishScore(snapshot)
    expect(first).toHaveBeenCalledWith(snapshot)
    expect(second).toHaveBeenCalledWith(snapshot)
  })

  it('stops delivering after unsubscribing and forgets the subscriber', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeScore(listener)
    expect(scoreSubscriberCount()).toBe(1)
    unsubscribe()
    publishScore(snapshot)
    expect(listener).not.toHaveBeenCalled()
    expect(scoreSubscriberCount()).toBe(0)
  })

  it('keeps delivering to the others when one subscriber throws', () => {
    const broken = vi.fn(() => {
      throw new Error('Verbindung weg')
    })
    const healthy = vi.fn()
    subscribeScore(broken)
    subscribeScore(healthy)
    publishScore(snapshot)
    expect(healthy).toHaveBeenCalledWith(snapshot)
  })

  it('shares the subscribers through globalThis (separate route bundles)', () => {
    const listener = vi.fn()
    subscribeScore(listener)
    expect(globalThis.__scoreHub?.size).toBe(1)
  })
})
