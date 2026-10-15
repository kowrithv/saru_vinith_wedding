// Vorschau der Tageszustände: Die Seite sieht am 17.10. (vor dem Empfang, während
// der Feier) und ab dem 18.10. anders aus. Damit man das vorher ansehen kann,
// setzt `?zeit=heute|feier|danach` die Uhr der Seite auf einen dieser Zeitpunkte;
// `?zeit=aus` beendet es. Das gilt nur im eigenen Browser-Tab (sessionStorage) und
// betrifft nichts auf dem Server. Alle zeitabhängigen Teile der Seite lesen die
// Zeit über `useNowSecond`, das den Versatz hier abfragt.

export type PreviewKey = 'heute' | 'feier' | 'danach'

export const PREVIEWS: ReadonlyMap<PreviewKey, { instantMs: number; label: string }> = new Map([
  ['heute', { instantMs: Date.parse('2026-10-17T12:00:00+02:00'), label: 'Hochzeitstag, vor dem Empfang' }],
  ['feier', { instantMs: Date.parse('2026-10-17T18:00:00+02:00'), label: 'Hochzeitstag, die Feier läuft' }],
  ['danach', { instantMs: Date.parse('2026-10-18T10:00:00+02:00'), label: 'nach der Hochzeit' }],
])

const STORAGE_KEY = 'zeit-preview'
const PARAM = 'zeit'
export const PREVIEW_EVENT = 'zeit-preview'

interface Stored {
  key: PreviewKey
  /** Echte Uhrzeit (ms), zu der die Vorschau begann: ab da läuft ihre Zeit weiter. */
  startedAt: number
}

function isKey(value: unknown): value is PreviewKey {
  return typeof value === 'string' && PREVIEWS.has(value as PreviewKey)
}

function readStored(): Stored | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Stored>
    if (isKey(parsed.key) && typeof parsed.startedAt === 'number') {
      return { key: parsed.key, startedAt: parsed.startedAt }
    }
  } catch {
    // kaputter oder gesperrter Speicher: keine Vorschau
  }
  return null
}

function writeStored(value: Stored | null): void {
  try {
    if (value) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    else window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ohne Speicher gilt die Vorschau nur für die Seite mit dem Parameter
  }
}

function currentState(): Stored | null {
  if (typeof window === 'undefined') return null
  const requested = new URLSearchParams(window.location.search).get(PARAM)
  const stored = readStored()

  if (requested === 'aus') {
    if (stored) writeStored(null)
    return null
  }
  if (isKey(requested)) {
    // Gleiche Vorschau noch einmal angefordert: die Zeit läuft einfach weiter.
    if (stored?.key === requested) return stored
    const started: Stored = { key: requested, startedAt: Date.now() }
    writeStored(started)
    return started
  }
  return stored
}

/** Die gerade aktive Vorschau, oder null (echte Zeit). */
export function previewKey(): PreviewKey | null {
  return currentState()?.key ?? null
}

/** Millisekunden, die zur echten Zeit addiert werden (0 ohne Vorschau). */
export function previewOffsetMs(): number {
  const state = currentState()
  if (!state) return 0
  const preview = PREVIEWS.get(state.key)
  return preview ? preview.instantMs - state.startedAt : 0
}

/** Beendet die Vorschau: Speicher leeren, Parameter aus der Adresse nehmen. */
export function endPreview(): void {
  if (typeof window === 'undefined') return
  writeStored(null)
  const url = new URL(window.location.href)
  if (url.searchParams.has(PARAM)) {
    url.searchParams.delete(PARAM)
    const search = url.searchParams.toString()
    window.history.replaceState(window.history.state, '', `${url.pathname}${search ? `?${search}` : ''}${url.hash}`)
  }
  window.dispatchEvent(new Event(PREVIEW_EVENT))
}
