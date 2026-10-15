import { normalizeResultsCode } from './who-results-code'

// Das Wort für die DJ-Seite tippt der DJ auf /dj ein oder bringt es als
// `#k=<Wort>` im Link mit. Das Fragment geht nicht an den Server und nicht in
// den Referer; wie beim QR-Link wird es sofort aus der Adresszeile entfernt.
// Der Browser merkt sich das Wort, damit ein Neuladen oder ein späterer
// Besuch nicht wieder danach fragt.

const KEY_PARAM = 'k'
const STORAGE_KEY = 'who-results-code'

const listeners = new Set<() => void>()

function takeFromAddress(): string | null {
  const { hash, pathname, search } = window.location
  if (!hash.startsWith('#')) return null

  const params = new URLSearchParams(hash.slice(1))
  const raw = params.get(KEY_PARAM)
  if (raw === null) return null

  params.delete(KEY_PARAM)
  const rest = params.toString()
  // history.state unverändert lassen: der Next.js-Router hängt seinen Zustand daran.
  window.history.replaceState(window.history.state, '', `${pathname}${search}${rest ? `#${rest}` : ''}`)
  return normalizeResultsCode(raw)
}

function readStored(): string | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value ? normalizeResultsCode(value) : null
  } catch {
    return null
  }
}

function store(code: string | null): void {
  try {
    if (code) window.localStorage.setItem(STORAGE_KEY, code)
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ohne Speicher gilt das Wort bis zum Neuladen
  }
}

let cached: string | null | undefined

function notify(): void {
  listeners.forEach((listener) => listener())
}

/** Für useSyncExternalStore: meldet, wenn ein Wort eingegeben oder verworfen wurde. */
export function subscribeResultsKey(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Das Wort aus dem Link oder dem Browser (null: keines); der Adressteil wird dabei entfernt. */
export function takeResultsKey(): string | null {
  if (typeof window === 'undefined') return null
  if (cached !== undefined) return cached

  const fromAddress = takeFromAddress()
  if (fromAddress) store(fromAddress)
  cached = fromAddress ?? readStored()
  return cached
}

/** Merkt sich ein eingegebenes Wort. Liefert false, wenn es kein Wort aus Buchstaben sein kann. */
export function rememberResultsKey(input: string): boolean {
  const code = normalizeResultsCode(input)
  if (!code) return false
  store(code)
  cached = code
  notify()
  return true
}

/** Verwirft das Wort, z. B. weil der Server es abgewiesen hat. */
export function clearResultsKey(): void {
  store(null)
  cached = null
  notify()
}

/** Nur für Tests: den gemerkten Stand im Speicher vergessen. */
export function forgetResultsKey(): void {
  cached = undefined
}
