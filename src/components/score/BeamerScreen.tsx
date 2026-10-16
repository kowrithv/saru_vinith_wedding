'use client'

import { useLiveScore } from '@/lib/use-live-score'
import { useWakeLock } from '@/lib/use-wake-lock'
import ScoreBoard from './ScoreBoard'
import ScoreLoading from './ScoreLoading'
import ScoreLoginForm from './ScoreLoginForm'

/** Die Seite für den Beamer: zeigt den Stand und aktualisiert sich selbst, sobald jemand Punkte vergibt. */
export default function BeamerScreen() {
  const { score, status, reconnect } = useLiveScore()
  useWakeLock()

  if (status === 'login') {
    return <ScoreLoginForm title="Beamer" variant="beamer" onSuccess={reconnect} />
  }
  // Noch unklar, ob eine Anmeldung gilt: nur der Hintergrund, nicht erst die Anzeige und dann das Anmeldefenster.
  if (status === 'connecting' && score === null) return <ScoreLoading variant="beamer" />
  return <ScoreBoard score={score} status={status} />
}
