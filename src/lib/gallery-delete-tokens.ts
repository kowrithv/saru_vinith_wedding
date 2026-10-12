const STORAGE_KEY = 'gallery-delete-tokens'

function loadDeleteTokens(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveDeleteToken(photoId: string, token: string): void {
  try {
    const tokens = loadDeleteTokens()
    tokens[photoId] = token
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
  } catch {
    // localStorage kann in seltenen Fällen fehlschlagen - das Foto ist
    // serverseitig trotzdem gespeichert, nur lokal nicht als "eigenes"
    // erkennbar (kein Löschen-Button, aber kein Datenverlust).
  }
}

export function getDeleteToken(photoId: string): string | undefined {
  return loadDeleteTokens()[photoId]
}

export function removeDeleteToken(photoId: string): void {
  try {
    const tokens = loadDeleteTokens()
    delete tokens[photoId]
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
  } catch {
    // s.o.
  }
}
