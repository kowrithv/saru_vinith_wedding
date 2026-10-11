/**
 * Ermittelt den Rate-Limit-Schlüssel für einen Request. Hinter Cloudflare
 * ist `cf-connecting-ip` die zuverlässige Quelle; `x-forwarded-for` ist nur
 * ein Fallback, der hinter einem Proxy, der ihn nicht selbst setzt/überschreibt
 * (z.B. ein noch nicht konfigurierter Caddy `trusted_proxies`), die IP des
 * Edge-Knotens statt der echten Gast-IP liefern kann - siehe Caddyfile.
 */
export function getClientKey(request: Request): string {
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  if (cfConnectingIp) {
    return cfConnectingIp
  }

  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  return 'local'
}
