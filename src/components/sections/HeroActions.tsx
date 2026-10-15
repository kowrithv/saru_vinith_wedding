'use client'

import Button from '@/components/ui/Button'
import { eventPhase } from '@/lib/event-phase'
import { useNowSecond } from '@/lib/use-now-second'

// Vor dem Fest: Einladung zum Stöbern. Am Hochzeitstag und danach: die Wege,
// die Gäste dann brauchen. Der Server rendert immer die erste Variante, der
// Browser wechselt nach dem Hydrieren (kein Hydration-Unterschied).
export default function HeroActions() {
  const nowSecond = useNowSecond()
  const phase = nowSecond === null ? 'before' : eventPhase(nowSecond * 1000)

  if (phase === 'today') {
    return (
      <>
        <Button href="/gallery" variant="primary" size="lg">
          Fotos hochladen
        </Button>
        <Button href="/info" variant="secondary" size="lg">
          Ablauf des Tages
        </Button>
      </>
    )
  }
  if (phase === 'after') {
    return (
      <>
        <Button href="/gallery" variant="primary" size="lg">
          Fotos ansehen
        </Button>
        <Button href="/story" variant="secondary" size="lg">
          Unsere Geschichte
        </Button>
      </>
    )
  }
  return (
    <>
      <Button href="/info" variant="primary" size="lg">
        Hochzeitsinfos
      </Button>
      <Button href="/story" variant="secondary" size="lg">
        Unsere Geschichte
      </Button>
    </>
  )
}
