import { describe, expect, it } from 'vitest'
import { createDb } from './db'
import { setConfigValue } from './app-config'
import { MAX_SCORE, changeScore, getScore, resetScore } from './score'

describe('score', () => {
  it('starts at 0 to 0 in revision 0', () => {
    const db = createDb(':memory:')
    expect(getScore(db)).toEqual({ bride: 0, groom: 0, rev: 0 })
    db.close()
  })

  it('changes only the chosen team and counts up the revision', () => {
    const db = createDb(':memory:')
    expect(changeScore(db, 'bride', 1)).toEqual({ bride: 1, groom: 0, rev: 1 })
    expect(changeScore(db, 'groom', 1)).toEqual({ bride: 1, groom: 1, rev: 2 })
    expect(changeScore(db, 'bride', 1)).toEqual({ bride: 2, groom: 1, rev: 3 })
    expect(getScore(db)).toEqual({ bride: 2, groom: 1, rev: 3 })
    db.close()
  })

  it('never goes below 0', () => {
    const db = createDb(':memory:')
    expect(changeScore(db, 'groom', -1).groom).toBe(0)
    changeScore(db, 'groom', 2)
    expect(changeScore(db, 'groom', -5).groom).toBe(0)
    db.close()
  })

  it('never goes above the maximum', () => {
    const db = createDb(':memory:')
    setConfigValue(db, 'score_bride', String(MAX_SCORE))
    expect(changeScore(db, 'bride', 1).bride).toBe(MAX_SCORE)
    db.close()
  })

  it('resets both teams to 0 but keeps counting the revision up', () => {
    const db = createDb(':memory:')
    changeScore(db, 'bride', 3)
    changeScore(db, 'groom', 2)
    const after = resetScore(db)
    expect(after).toEqual({ bride: 0, groom: 0, rev: 3 })
    expect(changeScore(db, 'bride', 1).rev).toBe(4)
    db.close()
  })

  it('treats an unreadable stored value as 0', () => {
    const db = createDb(':memory:')
    setConfigValue(db, 'score_bride', 'abc')
    setConfigValue(db, 'score_groom', '-4')
    setConfigValue(db, 'score_rev', 'x')
    expect(getScore(db)).toEqual({ bride: 0, groom: 0, rev: 0 })
    db.close()
  })
})
