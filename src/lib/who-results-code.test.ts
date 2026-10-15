import { describe, expect, it } from 'vitest'
import { normalizeResultsCode } from './who-results-code'
import { RESULTS_WORDS } from './who-results-words'

describe('normalizeResultsCode', () => {
  it('accepts a word in any letter case and with spaces around it', () => {
    expect(normalizeResultsCode('kirsche')).toBe('kirsche')
    expect(normalizeResultsCode('Kirsche')).toBe('kirsche')
    expect(normalizeResultsCode('  KIRSCHE ')).toBe('kirsche')
  })

  it('rejects anything that is not a word of letters', () => {
    expect(normalizeResultsCode('')).toBeNull()
    expect(normalizeResultsCode('ab')).toBeNull()
    expect(normalizeResultsCode('kirsche1')).toBeNull()
    expect(normalizeResultsCode('kirsch-baum')).toBeNull()
    expect(normalizeResultsCode('zwei wörter')).toBeNull()
    expect(normalizeResultsCode('kirsche/../')).toBeNull()
  })

  it('accepts every word of the list', () => {
    for (const word of RESULTS_WORDS) {
      expect(normalizeResultsCode(word)).toBe(word)
    }
  })
})

describe('RESULTS_WORDS', () => {
  it('is long enough, without duplicates', () => {
    expect(RESULTS_WORDS.length).toBeGreaterThanOrEqual(200)
    expect(new Set(RESULTS_WORDS).size).toBe(RESULTS_WORDS.length)
  })

  it('holds only easy to type words: lower case letters, 3 to 10 of them', () => {
    for (const word of RESULTS_WORDS) {
      expect(word, word).toMatch(/^[a-z]{3,10}$/)
    }
  })

  it('keeps out the obvious guesses', () => {
    for (const obvious of ['hochzeit', 'liebe', 'love', 'party', 'musik', 'vinith', 'saruga', 'passwort', 'admin', 'dj']) {
      expect(RESULTS_WORDS).not.toContain(obvious)
    }
  })
})
