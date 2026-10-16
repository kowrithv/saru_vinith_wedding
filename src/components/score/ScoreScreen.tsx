import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { SCORE_CSS_VARS } from '@/lib/score-colors'

interface ScoreScreenProps {
  children: ReactNode
  /** `beamer`: derselbe Hintergrund wie die Anzeige, damit beim Wechsel zwischen Anmeldung, Warten und Anzeige nichts aufblitzt. */
  variant?: 'plain' | 'beamer'
}

// Beamer und Steuerung füllen den ganzen Bildschirm und liegen über Navigation und
// Fußzeile der Seite: sie sind keine Seiten für Gäste und brauchen keinen Rahmen.
export default function ScoreScreen({ children, variant = 'plain' }: ScoreScreenProps) {
  return (
    <div
      style={variant === 'beamer' ? SCORE_CSS_VARS : undefined}
      className={cn(
        'fixed inset-0 z-[100] overflow-y-auto text-[#1c1c1c]',
        variant === 'beamer'
          ? 'bg-[radial-gradient(ellipse_at_center,var(--backdrop-center)_0%,var(--backdrop-edge)_100%)]'
          : 'bg-[#f4f1ea]'
      )}
    >
      {children}
    </div>
  )
}
