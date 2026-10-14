import { verifyPassword } from './admin-auth'

export { getGuestPassword } from './env'

// Das Gäste-Kennwort ist ein kurzes, merkbares Wort (steht auch im QR-Link).
// Gäste tippen es am Handy: Groß-/Kleinschreibung, Leerzeichen am Rand und
// die Zerlegung von Umlauten sollen deshalb keine Rolle spielen. Das
// Admin-Kennwort bleibt davon unberührt (dort gilt verifyPassword exakt).
export function normalizeGuestPassword(value: string): string {
  return value.normalize('NFC').trim().toLowerCase()
}

export function verifyGuestPassword(candidate: string, expected: string | undefined): boolean {
  const expectedNormalized = expected ? normalizeGuestPassword(expected) : ''
  // Ein leeres Soll darf nie zu einem Treffer führen (auch nicht mit leerem
  // Kandidaten): ohne konfiguriertes Kennwort ist niemand ein Gast.
  if (!expectedNormalized) return false
  return verifyPassword(normalizeGuestPassword(candidate), expectedNormalized)
}
