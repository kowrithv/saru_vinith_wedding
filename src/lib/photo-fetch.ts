// Fotos liegen auf einer eigenen Domain (R2 hinter Cloudflare). Angezeigt werden
// sie als <img> ohne Origin-Kopf; das Polaroid und der Download holen sie aber per
// fetch() mit CORS, um sie als Blob zu verwenden.
//
// Beides auf dieselbe Adresse zu legen geht schief: Cloudflare (und der Browser)
// speichern die Antwort des ersten Aufrufs, und das ist die der <img>-Anfrage ohne
// `Access-Control-Allow-Origin`. Der spätere CORS-Aufruf bekommt dieselbe Kopie, und
// der Browser blockiert sie ("No 'Access-Control-Allow-Origin' header").
// `Vary: Origin` ignoriert der Cloudflare-Cache. Ein eigener Parameter macht aus
// dem CORS-Aufruf eine eigene Adresse, also einen eigenen Cache-Eintrag, der immer
// mit Origin geholt wird. R2 ignoriert den Parameter.
const CORS_PARAM = 'cors'

export function corsPhotoUrl(url: string): string {
  const withParam = new URL(url, typeof window === 'undefined' ? 'http://localhost' : window.location.href)
  withParam.searchParams.set(CORS_PARAM, '1')
  return withParam.toString()
}

/** Holt ein Foto von der Foto-Domain als Blob (für Canvas und Download). */
export async function fetchPhotoBlob(url: string): Promise<Blob> {
  const response = await fetch(corsPhotoUrl(url), { mode: 'cors' })
  if (!response.ok) throw new Error('Foto konnte nicht geladen werden.')
  return response.blob()
}
