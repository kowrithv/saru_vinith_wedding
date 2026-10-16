import ScoreScreen from './ScoreScreen'

/**
 * Solange noch unklar ist, ob eine Anmeldung gilt: nur der Hintergrund. Sonst blitzte erst die Anzeige
 * (oder die Steuerung) auf und sprang dann auf das Anmeldefenster.
 */
export default function ScoreLoading({ variant = 'plain' }: { variant?: 'plain' | 'beamer' }) {
  return (
    <ScoreScreen variant={variant}>
      <p role="status" className="sr-only">
        Wird geladen …
      </p>
    </ScoreScreen>
  )
}
