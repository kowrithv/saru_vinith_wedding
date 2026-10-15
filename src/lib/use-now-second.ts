import { useCallback, useSyncExternalStore } from 'react'
import { previewOffsetMs } from './time-preview'

// Der Takt ist feiner als eine Sekunde: der Schnappschuss (ganze Sekunden)
// ändert sich nur einmal pro Sekunde, React rendert also auch nur dann neu.
// Ein reines 1000-ms-Intervall würde gegenüber dem Sekundenwechsel driften
// und gelegentlich eine Sekunde überspringen.
const TICK_MS = 250

// Mit `?zeit=…` (siehe time-preview.ts) läuft die Uhr der Seite ab einem
// vorgegebenen Zeitpunkt; sonst ist der Versatz 0.
function getNowSecond(): number {
  return Math.floor((Date.now() + previewOffsetMs()) / 1000)
}

// Beim Server-Rendering und beim Hydrieren ist die Uhrzeit unbekannt (null):
// beide Seiten rendern denselben Platzhalter, es gibt keinen Hydration-
// Mismatch. Bei clientseitiger Navigation entfällt die Hydration, der erste
// Render zeigt sofort die echten Werte.
function getServerNowSecond(): null {
  return null
}

/**
 * Aktuelle Zeit in ganzen Sekunden (Unix-Zeit), oder null beim Server-
 * Rendering. Mit `stopAtMs` beendet sich der Takt von selbst, sobald dieser
 * Zeitpunkt erreicht ist - danach ändert sich nichts mehr.
 */
export function useNowSecond(stopAtMs?: number): number | null {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const id = setInterval(() => {
        onChange()
        if (stopAtMs !== undefined && Date.now() >= stopAtMs) clearInterval(id)
      }, TICK_MS)
      return () => clearInterval(id)
    },
    [stopAtMs]
  )
  return useSyncExternalStore(subscribe, getNowSecond, getServerNowSecond)
}
