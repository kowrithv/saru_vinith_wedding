'use client'

import { useState } from 'react'
import type { ScoreSnapshot, ScoreTeam } from '@/lib/score'

// Nur der Typ kommt aus score.ts: die Datei hängt an der Datenbank und gehört nicht ins Browser-Bündel.
const TEAMS: readonly ScoreTeam[] = ['bride', 'groom']

// Mehr Punkte auf einmal sind kein Tippen mehr, sondern Nachholen (die Verbindung war weg):
// dann springt nur die Zahl, und es schwebt nichts Falsches über dem Team.
const MAX_BUMP = 3

export interface ScoreBump {
  /** Zählt je Team hoch: ein neuer Wert startet die Animation von vorn. */
  id: number
  delta: number
}

export type ScoreBumps = Record<ScoreTeam, ScoreBump | null>

const NONE: ScoreBumps = { bride: null, groom: null }

/**
 * Erkennt, welches Team gerade Punkte bekommen hat, für das schwebende "+1" der Beamer-Anzeige.
 * Der erste Stand, Verringern, Zurücksetzen und gleiche oder ältere Antworten lösen nichts aus.
 * Der Eintrag bleibt bis zum nächsten Punkt stehen; die Animation blendet ihn von selbst aus.
 */
export function useScoreBumps(score: ScoreSnapshot | null): ScoreBumps {
  const [seen, setSeen] = useState<ScoreSnapshot | null>(score)
  const [bumps, setBumps] = useState<ScoreBumps>(NONE)

  // Aus dem vorigen Stand ableiten, direkt beim Rendern (kein Effect): so steht das "+1" im selben Bild wie die neue Zahl.
  if (score !== seen) {
    setSeen(score)
    if (seen && score && score.rev > seen.rev) {
      const next = { ...bumps }
      let changed = false
      for (const team of TEAMS) {
        const delta = score[team] - seen[team]
        if (delta >= 1 && delta <= MAX_BUMP) {
          next[team] = { id: (bumps[team]?.id ?? 0) + 1, delta }
          changed = true
        }
      }
      if (changed) setBumps(next)
    }
  }

  return bumps
}
