/**
 * Ermittelt den Rate-Limit-Schlüssel für einen Request.
 *
 * Die App läuft hinter einem Reverse-Proxy (Caddy auf dem Host). Der Proxy
 * setzt `X-Forwarded-For` für nicht vertraute Quellen selbst auf die
 * Verbindungsadresse, der erste Eintrag ist also die echte Gast-IP. `CF-Connecting-IP` dagegen setzt bei einer Website
 * ohne Cloudflare-Proxy ("DNS only") jeder Client selbst - ein Angreifer könnte
 * damit jede Anfrage unter einer anderen Adresse zählen lassen und die
 * Rate-Limiter beliebig umgehen. Der Header wird deshalb nur ausgelesen, wenn
 * ausdrücklich `CLIENT_IP_HEADER=cf-connecting-ip` gesetzt ist (Website hinter
 * dem Cloudflare-Proxy, der den Header selbst setzt und Fremdwerte entfernt).
 */
// IPv6: ein Anschluss bekommt ein ganzes /64-Netz. Gezählt wird deshalb das
// Netz, nicht die einzelne Adresse (sonst ließen sich alle Grenzen mit einer
// neuen Adresse je Anfrage umgehen). IPv4 und nicht lesbare Werte bleiben wie sie sind.
function normalizeAddress(raw: string): string {
  let address = raw.trim()
  if (address.startsWith('[')) {
    const end = address.indexOf(']')
    if (end > 0) address = address.slice(1, end)
  }
  const zone = address.indexOf('%')
  if (zone !== -1) address = address.slice(0, zone)

  if (!address.includes(':')) return address
  // IPv4 mit Port ("198.51.100.9:443")
  const withPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/.exec(address)
  if (withPort) return withPort[1]
  // IPv4 in IPv6-Schreibweise
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(address)
  if (mapped) return mapped[1]

  const halves = address.toLowerCase().split('::')
  if (halves.length > 2) return address
  const groups = (part: string) => (part === '' ? [] : part.split(':'))
  const left = groups(halves[0])
  const right = halves.length === 2 ? groups(halves[1]) : []
  const missing = 8 - left.length - right.length
  if (halves.length === 1 ? left.length !== 8 : missing < 0) return address
  const full = halves.length === 1 ? left : [...left, ...Array<string>(missing).fill('0'), ...right]
  if (!full.every((group) => /^[0-9a-f]{1,4}$/.test(group))) return address

  return `${full.slice(0, 4).map((group) => group.replace(/^0+(?=.)/, '')).join(':')}::/64`
}

export function getClientKey(request: Request): string {
  const header = process.env.CLIENT_IP_HEADER?.trim().toLowerCase()

  if (header === 'cf-connecting-ip') {
    const cfConnectingIp = request.headers.get('cf-connecting-ip')
    if (cfConnectingIp) {
      return normalizeAddress(cfConnectingIp)
    }
  }

  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return normalizeAddress(forwardedFor.split(',')[0])
  }

  return 'local'
}
