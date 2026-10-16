import type Database from 'better-sqlite3'
import { getConfigValue, setConfigValue } from './app-config'

// Punktestand "Team Bride gegen Team Groom" für die Beamer-Anzeige. Er liegt in
// app_config (keine eigene Tabelle) und übersteht damit einen Neustart.
export const SCORE_TEAMS = ['bride', 'groom'] as const
export type ScoreTeam = (typeof SCORE_TEAMS)[number]

export const MAX_SCORE = 999

export interface ScoreSnapshot {
  bride: number
  groom: number
  /** Zählt bei jeder Änderung hoch (auch beim Zurücksetzen): so erkennt eine Seite veraltete Antworten. */
  rev: number
}

const SCORE_KEYS: Record<ScoreTeam, string> = { bride: 'score_bride', groom: 'score_groom' }
const REV_KEY = 'score_rev'

function readNumber(db: Database.Database, key: string): number {
  const parsed = Number.parseInt(getConfigValue(db, key) ?? '', 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

export function getScore(db: Database.Database): ScoreSnapshot {
  return {
    bride: Math.min(readNumber(db, SCORE_KEYS.bride), MAX_SCORE),
    groom: Math.min(readNumber(db, SCORE_KEYS.groom), MAX_SCORE),
    rev: readNumber(db, REV_KEY),
  }
}

/**
 * Ändert den Stand um `delta`, immer relativ zum gespeicherten Wert: tippen zwei
 * Handys gleichzeitig, gehen beide Punkte ein (ein "setze auf 5" würde einen überschreiben).
 */
export function changeScore(db: Database.Database, team: ScoreTeam, delta: number): ScoreSnapshot {
  return db.transaction(() => {
    const current = getScore(db)
    const next = Math.min(Math.max(current[team] + delta, 0), MAX_SCORE)
    setConfigValue(db, SCORE_KEYS[team], String(next))
    setConfigValue(db, REV_KEY, String(current.rev + 1))
    return getScore(db)
  })()
}

export function resetScore(db: Database.Database): ScoreSnapshot {
  return db.transaction(() => {
    const current = getScore(db)
    setConfigValue(db, SCORE_KEYS.bride, '0')
    setConfigValue(db, SCORE_KEYS.groom, '0')
    setConfigValue(db, REV_KEY, String(current.rev + 1))
    return getScore(db)
  })()
}
