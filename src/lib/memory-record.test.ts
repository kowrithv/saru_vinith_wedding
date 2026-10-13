import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { applySchema, createDb } from './db'
import {
  deleteMemoryResult,
  getMemoryRecord,
  isBetterResult,
  listMemoryResults,
  MAX_MOVES,
  MAX_SECONDS,
  MAX_STORED_RESULTS,
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

  it('ignores a damaged value of the old record format instead of crashing', () => {
    const db = new Database(':memory:')
    applySchema(db)
    db.prepare("INSERT INTO app_config (key, value) VALUES ('memory_record_moves', 'abc')").run()
    db.prepare("INSERT INTO app_config (key, value) VALUES ('memory_record_seconds', '12')").run()

    applySchema(db)

    expect(getMemoryRecord(db)).toBeNull()
    expect(submitMemoryResult(db, { moves: 20, seconds: 99 }).isNewRecord).toBe(true)
    db.close()
  })
})

describe('all submitted results', () => {
  it('keeps every submitted result, ranked by moves and then time', () => {
    const db = createDb(':memory:')
    submitMemoryResult(db, { moves: 14, seconds: 75 })
    submitMemoryResult(db, { moves: 12, seconds: 90 })
    submitMemoryResult(db, { moves: 12, seconds: 80 })
    submitMemoryResult(db, { moves: 20, seconds: 30 })

    const { results, total } = listMemoryResults(db)

    expect(total).toBe(4)
    expect(results.map(({ moves, seconds }) => [moves, seconds])).toEqual([
      [12, 80],
      [12, 90],
      [14, 75],
      [20, 30],
    ])
    expect(results[0]).toEqual(expect.objectContaining({ id: expect.any(Number), createdAt: expect.any(String) }))
    db.close()
  })

  it('keeps worse results too, so removing the best one reveals the next best', () => {
    const db = createDb(':memory:')
    submitMemoryResult(db, { moves: 8, seconds: 4 })
    submitMemoryResult(db, { moves: 14, seconds: 75 })
    const forged = listMemoryResults(db).results[0]

    expect(deleteMemoryResult(db, forged.id)).toBe(true)

    expect(getMemoryRecord(db)).toEqual({ moves: 14, seconds: 75 })
    expect(listMemoryResults(db).total).toBe(1)
    db.close()
  })

  it('reports false when the result to delete does not exist', () => {
    const db = createDb(':memory:')
    expect(deleteMemoryResult(db, 999)).toBe(false)
    db.close()
  })

  it('lets the earlier result keep the record when an equal one comes in', () => {
    const db = createDb(':memory:')
    submitMemoryResult(db, { moves: 14, seconds: 60 })
    const first = listMemoryResults(db).results[0]
    submitMemoryResult(db, { moves: 14, seconds: 60 })

    expect(listMemoryResults(db).results[0].id).toBe(first.id)
    db.close()
  })

  it('limits the list to the requested number of best results but reports the total', () => {
    const db = createDb(':memory:')
    for (let i = 0; i < 5; i += 1) submitMemoryResult(db, { moves: 10 + i, seconds: 50 })

    const { results, total } = listMemoryResults(db, 2)

    expect(results).toHaveLength(2)
    expect(total).toBe(5)
    db.close()
  })

  it('stays bounded: beyond the cap the worst results are dropped, the best are kept', () => {
    const db = createDb(':memory:')
    submitMemoryResult(db, { moves: 9, seconds: 20 })
    for (let i = 0; i < MAX_STORED_RESULTS + 5; i += 1) {
      submitMemoryResult(db, { moves: 100 + (i % 50), seconds: 100 + i })
    }

    const { total } = listMemoryResults(db, 1)

    expect(total).toBe(MAX_STORED_RESULTS)
    expect(getMemoryRecord(db)).toEqual({ moves: 9, seconds: 20 })
    db.close()
  })

  it('clears all results on reset', () => {
    const db = createDb(':memory:')
    submitMemoryResult(db, { moves: 14, seconds: 75 })
    submitMemoryResult(db, { moves: 15, seconds: 70 })

    resetMemoryRecord(db)

    expect(listMemoryResults(db).total).toBe(0)
    expect(getMemoryRecord(db)).toBeNull()
    db.close()
  })

  it('carries a record of the old format over once and removes the old keys', () => {
    const db = new Database(':memory:')
    applySchema(db)
    db.prepare("INSERT INTO app_config (key, value) VALUES ('memory_record_moves', '11')").run()
    db.prepare("INSERT INTO app_config (key, value) VALUES ('memory_record_seconds', '42')").run()

    applySchema(db)
    applySchema(db)

    expect(listMemoryResults(db).total).toBe(1)
    expect(getMemoryRecord(db)).toEqual({ moves: 11, seconds: 42 })
    const leftovers = db.prepare("SELECT COUNT(*) AS n FROM app_config WHERE key LIKE 'memory_record_%'").get() as { n: number }
    expect(leftovers.n).toBe(0)
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
