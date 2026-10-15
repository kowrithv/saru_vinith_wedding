import type Database from 'better-sqlite3'
import { whoQuestions, whoGameOptions } from './who-game-content'

export interface VoteResult {
  tally: Record<string, number>
  /** Dieses Gerät hatte für die Frage schon abgestimmt. */
  alreadyVoted: boolean
  /** Die Stimme wurde geändert (andere Antwort als vorher). */
  changed: boolean
}

function emptyTallyForQuestion(): Record<string, number> {
  return Object.fromEntries(whoGameOptions.map((option) => [option, 0]))
}

function tallyForQuestion(db: Database.Database, questionId: string): Record<string, number> {
  const tally = emptyTallyForQuestion()
  const rows = db
    .prepare('SELECT option, COUNT(*) as n FROM who_votes WHERE question_id = ? GROUP BY option')
    .all(questionId) as { option: string; n: number }[]
  for (const row of rows) {
    tally[row.option] = row.n
  }
  return tally
}

export function getTally(db: Database.Database): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {}
  for (const question of whoQuestions) {
    result[question.id] = tallyForQuestion(db, question.id)
  }
  return result
}

/**
 * Eine Stimme je Frage und Gerät. Wer noch einmal abstimmt, ändert seine
 * Stimme: sie wandert zur neuen Antwort und zählt weiter nur einmal.
 */
export function castVote(
  db: Database.Database,
  questionId: string,
  voterId: string,
  option: string
): VoteResult {
  if (!whoQuestions.some((q) => q.id === questionId)) {
    throw new Error('Unbekannte Frage.')
  }
  if (!whoGameOptions.includes(option)) {
    throw new Error('Unbekannte Antwort.')
  }

  // Lesen und Schreiben in einer Transaktion: gleichzeitige Anfragen desselben
  // Geräts (mehrere Tabs, Wiederholung nach einem Netzfehler) sehen einander.
  const apply = db.transaction((): { alreadyVoted: boolean; changed: boolean } => {
    const existing = db
      .prepare('SELECT option FROM who_votes WHERE question_id = ? AND voter_id = ?')
      .get(questionId, voterId) as { option: string } | undefined

    if (!existing) {
      db.prepare('INSERT INTO who_votes (question_id, voter_id, option) VALUES (?, ?, ?)').run(
        questionId,
        voterId,
        option
      )
      return { alreadyVoted: false, changed: false }
    }
    if (existing.option === option) {
      return { alreadyVoted: true, changed: false }
    }
    db.prepare('UPDATE who_votes SET option = ? WHERE question_id = ? AND voter_id = ?').run(
      option,
      questionId,
      voterId
    )
    return { alreadyVoted: true, changed: true }
  })

  const outcome = apply()
  return { tally: tallyForQuestion(db, questionId), ...outcome }
}
