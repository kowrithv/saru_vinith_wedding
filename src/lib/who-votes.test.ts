import { describe, expect, it } from 'vitest'
import { createDb } from './db'
import { castVote, getTally } from './who-votes'
import { whoQuestions, whoGameOptions } from './who-game-content'

describe('getTally', () => {
  it('returns every question with every option at 0 before any vote', () => {
    const db = createDb(':memory:')
    const tally = getTally(db)

    expect(Object.keys(tally)).toHaveLength(whoQuestions.length)
    for (const question of whoQuestions) {
      for (const option of whoGameOptions) {
        expect(tally[question.id][option]).toBe(0)
      }
    }
    db.close()
  })

  it('reflects cast votes across questions and options', () => {
    const db = createDb(':memory:')
    castVote(db, '1', 'voter-a', whoGameOptions[0])
    castVote(db, '1', 'voter-b', whoGameOptions[0])
    castVote(db, '2', 'voter-a', whoGameOptions[1])

    const tally = getTally(db)
    expect(tally['1'][whoGameOptions[0]]).toBe(2)
    expect(tally['2'][whoGameOptions[1]]).toBe(1)
    expect(tally['2'][whoGameOptions[0]]).toBe(0)
    db.close()
  })
})

describe('castVote', () => {
  it('records a new vote and returns the updated tally for that question', () => {
    const db = createDb(':memory:')
    const result = castVote(db, '1', 'voter-a', whoGameOptions[0])

    expect(result.alreadyVoted).toBe(false)
    expect(result.tally[whoGameOptions[0]]).toBe(1)
    db.close()
  })

  it('counts one vote per voter and question: a second vote replaces the first', () => {
    const db = createDb(':memory:')
    castVote(db, '1', 'voter-a', whoGameOptions[0])
    const second = castVote(db, '1', 'voter-a', whoGameOptions[1])

    expect(second.alreadyVoted).toBe(true)
    expect(second.changed).toBe(true)
    // Die Stimme wandert zur neuen Antwort, gezählt wird weiter eine.
    expect(second.tally[whoGameOptions[0]]).toBe(0)
    expect(second.tally[whoGameOptions[1]]).toBe(1)

    const row = db
      .prepare('SELECT COUNT(*) as n FROM who_votes WHERE question_id = ? AND voter_id = ?')
      .get('1', 'voter-a') as { n: number }
    expect(row.n).toBe(1)
    db.close()
  })

  it('does not change anything when the same answer is sent again', () => {
    const db = createDb(':memory:')
    castVote(db, '1', 'voter-a', whoGameOptions[0])
    const again = castVote(db, '1', 'voter-a', whoGameOptions[0])

    expect(again.alreadyVoted).toBe(true)
    expect(again.changed).toBe(false)
    expect(again.tally[whoGameOptions[0]]).toBe(1)
    db.close()
  })

  it('reports a first vote as new and unchanged', () => {
    const db = createDb(':memory:')
    const first = castVote(db, '1', 'voter-a', whoGameOptions[2])

    expect(first.alreadyVoted).toBe(false)
    expect(first.changed).toBe(false)
    db.close()
  })

  it('changes only the vote of that voter on that question', () => {
    const db = createDb(':memory:')
    castVote(db, '1', 'voter-a', whoGameOptions[0])
    castVote(db, '1', 'voter-b', whoGameOptions[0])
    castVote(db, '2', 'voter-a', whoGameOptions[0])

    castVote(db, '1', 'voter-a', whoGameOptions[1])

    const tally = getTally(db)
    expect(tally['1'][whoGameOptions[0]]).toBe(1)
    expect(tally['1'][whoGameOptions[1]]).toBe(1)
    expect(tally['2'][whoGameOptions[0]]).toBe(1)
    db.close()
  })

  it('rejects an unknown question id', () => {
    const db = createDb(':memory:')
    expect(() => castVote(db, 'does-not-exist', 'voter-a', whoGameOptions[0])).toThrow()
    db.close()
  })

  it('rejects an unknown option value', () => {
    const db = createDb(':memory:')
    expect(() => castVote(db, '1', 'voter-a', 'Nicht-Existent')).toThrow()
    db.close()
  })
})
