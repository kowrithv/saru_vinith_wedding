/**
 * Ermittelt den Rate-Limit-Schlüssel für einen Request.
 *
 * Die App läuft hinter Traefik. Traefik setzt `X-Forwarded-For` für nicht
 * vertraute Quellen selbst auf die Verbindungsadresse, der erste Eintrag ist
 * also die echte Gast-IP. `CF-Connecting-IP` dagegen setzt bei einer Website
 * ohne Cloudflare-Proxy ("DNS only") jeder Client selbst - ein Angreifer könnte
 * damit jede Anfrage unter einer anderen Adresse zählen lassen und die
 * Rate-Limiter beliebig umgehen. Der Header wird deshalb nur ausgelesen, wenn
 * ausdrücklich `CLIENT_IP_HEADER=cf-connecting-ip` gesetzt ist (Website hinter
 * dem Cloudflare-Proxy, der den Header selbst setzt und Fremdwerte entfernt).
 */
export function getClientKey(request: Request): string {
  const header = process.env.CLIENT_IP_HEADER?.trim().toLowerCase()

  if (header === 'cf-connecting-ip') {
    const cfConnectingIp = request.headers.get('cf-connecting-ip')
    if (cfConnectingIp) {
      return cfConnectingIp.trim()
    }
  }

  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  return 'local'
}
