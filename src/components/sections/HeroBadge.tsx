'use client'

import { useNowSecond } from '@/lib/use-now-second'
import { receptionEvent } from '@/lib/event-info'

const EVENT_START_MS = Date.parse(receptionEvent.startsAt)

// Der Hero ist eine Server-Komponente und kennt die Uhrzeit nicht: Der Server
// liefert immer "Wir heiraten!", ab dem Empfangsbeginn wechselt der Browser auf
// "Wir sind verheiratet!" (wie der Countdown darunter).
export default function HeroBadge() {
  const nowSecond = useNowSecond(EVENT_START_MS)
  const hasStarted = nowSecond !== null && nowSecond * 1000 >= EVENT_START_MS
  return <>{hasStarted ? 'Wir sind verheiratet!' : 'Wir heiraten!'}</>
}
