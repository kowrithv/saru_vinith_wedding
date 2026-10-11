import type Database from 'better-sqlite3'
import { whoQuestions, whoGameOptions } from './who-game-content'

export interface VoteResult {
  tally: Record<string, number>
  alreadyVoted: boolean
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

  try {
    db.prepare(
      'INSERT INTO who_votes (question_id, voter_id, option) VALUES (?, ?, ?)'
    ).run(questionId, voterId, option)
    return { tally: tallyForQuestion(db, questionId), alreadyVoted: false }
  } catch (error) {
    if ((error as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
      // Dieselbe voterId hat für diese Frage schon abgestimmt (z. B. ein
      // erneuter Versuch desselben Clients nach einem Netzwerkfehler, oder
      // mehrere offene Tabs). Schützt NICHT gegen ein Gerät, das
      // localStorage gezielt löscht - dabei entsteht eine neue voterId
      // (device-id.ts), die diese Prüfung nicht greift. Die bestehende
      // Stimme bleibt gültig, es wird nur der aktuelle Stand zurückgegeben.
      return { tally: tallyForQuestion(db, questionId), alreadyVoted: true }
    }
    throw error
  }
}
