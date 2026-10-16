import type { ScoreSnapshot } from './score'

export type ScoreListener = (score: ScoreSnapshot) => void

// Wer gerade den Stream offen hat (Beamer, Steuer-Seiten). Die App läuft als ein
// einziger Prozess, der Verteiler lebt deshalb im Arbeitsspeicher. Er hängt an
// globalThis wie die Datenbank: Next kann jede Route als eigenes Bündel laden, und
// ein Modul-Zustand wäre dann je Route getrennt - die Änderung käme beim Stream nie an.
declare global {
  var __scoreHub: Set<ScoreListener> | undefined
}

function hub(): Set<ScoreListener> {
  globalThis.__scoreHub ??= new Set()
  return globalThis.__scoreHub
}

export function subscribeScore(listener: ScoreListener): () => void {
  hub().add(listener)
  return () => {
    hub().delete(listener)
  }
}

export function scoreSubscriberCount(): number {
  return hub().size
}

/** Schickt den neuen Stand sofort an alle offenen Streams. Ein kaputter Empfänger stört die anderen nicht. */
export function publishScore(score: ScoreSnapshot): void {
  for (const listener of [...hub()]) {
    try {
      listener(score)
    } catch {
      hub().delete(listener)
    }
  }
}
