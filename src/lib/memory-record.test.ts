import { describe, expect, it } from 'vitest'
import { createDb } from './db'
import {
  getMemoryRecord,
  isBetterResult,
  MAX_MOVES,
  MAX_SECONDS,
  MIN_MOVES,
  MIN_SECONDS,
  resetMemoryRecord,
  submitMemoryResult,
} from './memory-record'

describe('isBetterResult', () => {
  it('is better when there is no record yet', () => {
    expect(isBetterResult({ moves: 30, seconds: 300 }, null)).toBe(true)
  })

  it('prefers fewer moves, regardless of time', () => {
    expect(isBetterResult({ moves: 10, seconds: 200 }, { moves: 11, seconds: 20 })).toBe(true)
    expect(isBetterResult({ moves: 12, seconds: 20 }, { moves: 11, seconds: 200 })).toBe(false)
  })

  it('uses the time to break a tie in moves', () => {
    expect(isBetterResult({ moves: 11, seconds: 30 }, { moves: 11, seconds: 31 })).toBe(true)
    expect(isBetterResult({ moves: 11, seconds: 31 }, { moves: 11, seconds: 31 })).toBe(false)
    expect(isBetterResult({ moves: 11, seconds: 32 }, { moves: 11, seconds: 31 })).toBe(false)
  })
})

describe('memory record storage', () => {
  it('starts empty', () => {
    const db = createDb(':memory:')
    expect(getMemoryRecord(db)).toBeNull()
    db.close()
  })

  it('stores the first result as the record', () => {
    const db = createDb(':memory:')
    const outcome = submitMemoryResult(db, { moves: 14, seconds: 75 })

    expect(outcome).toEqual({ record: { moves: 14, seconds: 75 }, isNewRecord: true })
    expect(getMemoryRecord(db)).toEqual({ moves: 14, seconds: 75 })
    db.close()
  })

  it('keeps the record when a worse result comes in and reports it as not new', () => {
    const db = createDb(':memory:')
    submitMemoryResult(db, { moves: 14, seconds: 75 })

    const outcome = submitMemoryResult(db, { moves: 15, seconds: 20 })

    expect(outcome).toEqual({ record: { moves: 14, seconds: 75 }, isNewRecord: false })
    db.close()
  })

  it('replaces the record with a better result, and an equal one is not new', () => {
    const db = createDb(':memory:')
    submitMemoryResult(db, { moves: 14, seconds: 75 })

    expect(submitMemoryResult(db, { moves: 14, seconds: 60 }).isNewRecord).toBe(true)
    expect(submitMemoryResult(db, { moves: 14, seconds: 60 }).isNewRecord).toBe(false)
    expect(getMemoryRecord(db)).toEqual({ moves: 14, seconds: 60 })
    db.close()
  })

  it('stores moves and seconds as one pair, never mixing values of two results', () => {
    const db = createDb(':memory:')
    submitMemoryResult(db, { moves: 12, seconds: 90 })
    submitMemoryResult(db, { moves: 13, seconds: 10 })
    submitMemoryResult(db, { moves: 12, seconds: 80 })

    expect(getMemoryRecord(db)).toEqual({ moves: 12, seconds: 80 })
    db.close()
  })

  it('can be reset', () => {
    const db = createDb(':memory:')
    submitMemoryResult(db, { moves: 14, seconds: 75 })

    resetMemoryRecord(db)

    expect(getMemoryRecord(db)).toBeNull()
    db.close()
  })

  it('ignores a damaged stored value instead of crashing', () => {
    const db = createDb(':memory:')
    db.prepare("INSERT INTO app_config (key, value) VALUES ('memory_record_moves', 'abc')").run()
    db.prepare("INSERT INTO app_config (key, value) VALUES ('memory_record_seconds', '12')").run()

    expect(getMemoryRecord(db)).toBeNull()
    expect(submitMemoryResult(db, { moves: 20, seconds: 99 }).isNewRecord).toBe(true)
    db.close()
  })
})

describe('plausibility limits', () => {
  it('requires at least one move per pair and a few seconds of play', () => {
    expect(MIN_MOVES).toBe(8)
    expect(MIN_SECONDS).toBeGreaterThanOrEqual(4)
    expect(MAX_MOVES).toBeGreaterThan(MIN_MOVES)
    expect(MAX_SECONDS).toBe(5999)
  })
})
