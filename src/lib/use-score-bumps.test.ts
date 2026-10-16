import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useScoreBumps } from './use-score-bumps'
import type { ScoreSnapshot } from './score'

const snap = (bride: number, groom: number, rev: number): ScoreSnapshot => ({ bride, groom, rev })

function setup(first: ScoreSnapshot | null) {
  return renderHook(({ score }) => useScoreBumps(score), { initialProps: { score: first } })
}

describe('useScoreBumps', () => {
  it('shows nothing for the first score that arrives (page just opened)', () => {
    const { result, rerender } = setup(null)
    rerender({ score: snap(7, 12, 19) })
    expect(result.current).toEqual({ bride: null, groom: null })
  })

  it('marks the team whose score went up, and only that team', () => {
    const { result, rerender } = setup(snap(3, 5, 8))
    rerender({ score: snap(4, 5, 9) })
    expect(result.current.bride).toMatchObject({ delta: 1 })
    expect(result.current.groom).toBeNull()
  })

  it('gives every further point a new id so the animation starts again', () => {
    const { result, rerender } = setup(snap(3, 5, 8))
    rerender({ score: snap(4, 5, 9) })
    const first = result.current.bride?.id
    rerender({ score: snap(5, 5, 10) })
    expect(result.current.bride?.id).not.toBe(first)
    expect(result.current.bride).toMatchObject({ delta: 1 })
  })

  it('shows the real difference when a point was missed in between (up to 3)', () => {
    const { result, rerender } = setup(snap(3, 5, 8))
    rerender({ score: snap(3, 7, 10) })
    expect(result.current.groom).toMatchObject({ delta: 2 })
  })

  it('shows nothing for a big catch-up after a lost connection (the number just jumps)', () => {
    const { result, rerender } = setup(snap(3, 5, 8))
    rerender({ score: snap(3, 15, 20) })
    expect(result.current).toEqual({ bride: null, groom: null })
  })

  it('shows nothing when a score goes down or is reset', () => {
    const { result, rerender } = setup(snap(3, 5, 8))
    rerender({ score: snap(2, 5, 9) })
    expect(result.current).toEqual({ bride: null, groom: null })
    rerender({ score: snap(0, 0, 10) })
    expect(result.current).toEqual({ bride: null, groom: null })
  })

  it('shows nothing for an answer with the same points (fallback poll) or an older one', () => {
    const { result, rerender } = setup(snap(3, 5, 8))
    rerender({ score: snap(3, 5, 9) })
    expect(result.current).toEqual({ bride: null, groom: null })
    rerender({ score: snap(2, 5, 7) })
    expect(result.current).toEqual({ bride: null, groom: null })
  })
})
