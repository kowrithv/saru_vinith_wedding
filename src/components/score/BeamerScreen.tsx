'use client'

import { useLiveScore } from '@/lib/use-live-score'
import { useWakeLock } from '@/lib/use-wake-lock'
import ScoreBoard from './ScoreBoard'
import ScoreLoginForm from './ScoreLoginForm'

/** Die Seite für den Beamer: zeigt den Stand und aktualisiert sich selbst, sobald jemand Punkte vergibt. */
export default function BeamerScreen() {
  const { score, status, reconnect } = useLiveScore()
  useWakeLock()

  if (status === 'login') {
    return <ScoreLoginForm title="Beamer" onSuccess={reconnect} />
  }
  return <ScoreBoard score={score} status={status} />
}
