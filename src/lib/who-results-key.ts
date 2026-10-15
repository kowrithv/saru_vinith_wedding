// Der Lese-Link für den DJ trägt den Schlüssel im Fragment
// (`/wer-von-uns/ergebnisse#k=<Schlüssel>`): Fragmente gehen nicht an den
// Server und nicht in den Referer. Wie beim QR-Link wird er sofort aus der
// Adresszeile entfernt; für ein Neuladen merkt sich der Tab ihn in der
// Sitzung (sessionStorage, nur dieser Tab).

const KEY_PARAM = 'k'
const STORAGE_KEY = 'who-results-key'
const KEY_PATTERN = /^[0-9a-f]{64}$/

function takeFromAddress(): string | null {
  const { hash, pathname, search } = window.location
  if (!hash.startsWith('#')) return null

  const params = new URLSearchParams(hash.slice(1))
  const key = params.get(KEY_PARAM)
  if (key === null) return null

  params.delete(KEY_PARAM)
  const rest = params.toString()
  // history.state unverändert lassen: der Next.js-Router hängt seinen Zustand daran.
  window.history.replaceState(window.history.state, '', `${pathname}${search}${rest ? `#${rest}` : ''}`)
  return KEY_PATTERN.test(key) ? key : null
}

function readStored(): string | null {
  try {
    const value = window.sessionStorage.getItem(STORAGE_KEY)
    return value && KEY_PATTERN.test(value) ? value : null
  } catch {
    return null
  }
}

function store(key: string): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, key)
  } catch {
    // ohne Speicher gilt der Schlüssel bis zum Neuladen
  }
}

let cached: string | null | undefined

/** Der Schlüssel aus dem Link (oder dem Tab); der Adressteil wird dabei entfernt. */
export function takeResultsKey(): string | null {
  if (typeof window === 'undefined') return null
  if (cached !== undefined) return cached

  const fromAddress = takeFromAddress()
  if (fromAddress) store(fromAddress)
  cached = fromAddress ?? readStored()
  return cached
}

/** Nur für Tests: den gemerkten Wert vergessen. */
export function forgetResultsKey(): void {
  cached = undefined
}
