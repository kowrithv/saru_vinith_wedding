import { createHash } from 'node:crypto'

// Die offenen Listen (Galerie, Gästebuch, Erinnerungen) fragen alle 30 Sekunden nach
// Neuem. Ohne Änderung soll das fast nichts kosten: die Antwort trägt einen ETag, und
// kommt er als If-None-Match zurück, antwortet der Server mit 304 und ohne Liste. Der
// ETag enthält alles, wovon die Antwort abhängt (z. B. ob der Aufrufer entsperrt ist),
// damit niemand mit einem fremden ETag eine Liste bekommt, die er nicht sehen darf.

export function etagFor(parts: (string | number | boolean)[]): string {
  const hash = createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 24)
  return `"${hash}"`
}

/** Hat der Aufrufer genau diesen Stand schon (If-None-Match)? */
export function hasEtag(request: Request | undefined, etag: string): boolean {
  return request?.headers.get('if-none-match') === etag
}

/** Die Antwort "nichts geändert": 304, ohne Inhalt. */
export function notModified(etag: string, headers: Record<string, string>): Response {
  return new Response(null, { status: 304, headers: { ...headers, ETag: etag } })
}
