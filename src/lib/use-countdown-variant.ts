import { useSyncExternalStore } from 'react'

export type CountdownVariant = 'gross' | 'kacheln' | 'ringe' | 'ruhig'

const VARIANTS: ReadonlySet<string> = new Set<CountdownVariant>(['gross', 'kacheln', 'ringe', 'ruhig'])

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange)
  return () => window.removeEventListener('popstate', onChange)
}

function getRequested(): string | null {
  try {
    return new URLSearchParams(window.location.search).get('countdown')
  } catch {
    return null
  }
}

function getServerRequested(): null {
  return null
}

/**
 * Zum Vergleichen der Countdown-Gestaltungen: `?countdown=gross|kacheln|ringe|ruhig`.
 * `requested` ist null, solange nichts angefordert wurde (auch beim Server-
 * Rendering und Hydrieren, daher kein Mismatch). `variant` fällt bei
 * unbekannten Werten auf die große Darstellung zurück.
 */
export function useCountdownVariant(): { variant: CountdownVariant; requested: string | null } {
  const requested = useSyncExternalStore(subscribe, getRequested, getServerRequested)
  const variant: CountdownVariant = requested !== null && VARIANTS.has(requested) ? (requested as CountdownVariant) : 'gross'
  return { variant, requested }
}
