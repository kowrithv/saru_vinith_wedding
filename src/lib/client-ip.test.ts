import { afterEach, describe, expect, it, vi } from 'vitest'
import { getClientKey } from './client-ip'

function requestWithHeaders(headers: Record<string, string>): Request {
  return new Request('http://localhost/', { headers })
}

describe('getClientKey', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('by default (behind a reverse proxy, website not proxied by Cloudflare)', () => {
    it('uses the first x-forwarded-for entry', () => {
      const request = requestWithHeaders({ 'x-forwarded-for': '198.51.100.9, 10.0.0.1' })
      expect(getClientKey(request)).toBe('198.51.100.9')
    })

    it('trims whitespace around the first entry', () => {
      const request = requestWithHeaders({ 'x-forwarded-for': '  198.51.100.9  ,10.0.0.1' })
      expect(getClientKey(request)).toBe('198.51.100.9')
    })

    it('ignores cf-connecting-ip, which any client can set itself without the Cloudflare proxy', () => {
      const request = requestWithHeaders({
        'cf-connecting-ip': '203.0.113.5',
        'x-forwarded-for': '198.51.100.9',
      })
      expect(getClientKey(request)).toBe('198.51.100.9')
    })

    it('falls back to "local" when there is no forwarding header', () => {
      expect(getClientKey(requestWithHeaders({ 'cf-connecting-ip': '203.0.113.5' }))).toBe('local')
      expect(getClientKey(requestWithHeaders({}))).toBe('local')
    })
  })

  describe('with CLIENT_IP_HEADER=cf-connecting-ip (behind the Cloudflare proxy)', () => {
    it('prefers cf-connecting-ip', () => {
      vi.stubEnv('CLIENT_IP_HEADER', 'cf-connecting-ip')
      const request = requestWithHeaders({
        'cf-connecting-ip': '203.0.113.5',
        'x-forwarded-for': '198.51.100.9, 10.0.0.1',
      })
      expect(getClientKey(request)).toBe('203.0.113.5')
    })

    it('falls back to x-forwarded-for when the header is missing', () => {
      vi.stubEnv('CLIENT_IP_HEADER', 'cf-connecting-ip')
      expect(getClientKey(requestWithHeaders({ 'x-forwarded-for': '198.51.100.9' }))).toBe('198.51.100.9')
    })

    it('tolerates letter case and surrounding whitespace in the setting', () => {
      vi.stubEnv('CLIENT_IP_HEADER', ' CF-Connecting-IP ')
      expect(getClientKey(requestWithHeaders({ 'cf-connecting-ip': '203.0.113.5' }))).toBe('203.0.113.5')
    })
  })

  // Ein Heimanschluss hat ein ganzes /64-Netz (2^64 Adressen): je Adresse zu
  // zählen, ließe die Grenzen unbegrenzt umgehen.
  describe('IPv6 addresses', () => {
    const key = (address: string) => getClientKey(requestWithHeaders({ 'x-forwarded-for': address }))

    it('counts all addresses of one /64 network as one client', () => {
      expect(key('2001:db8:1:2:3:4:5:6')).toBe(key('2001:db8:1:2:ffff:ffff:ffff:ffff'))
      expect(key('2001:db8:1:2::9')).toBe(key('2001:db8:1:2:aaaa::1'))
    })

    it('tells different /64 networks apart', () => {
      expect(key('2001:db8:1:2::1')).not.toBe(key('2001:db8:1:3::1'))
    })

    it('ignores letter case and leading zeros', () => {
      expect(key('2001:DB8:0001:0002::1')).toBe(key('2001:db8:1:2::1'))
    })

    it('treats an IPv4 address in IPv6 notation like the IPv4 address', () => {
      expect(key('::ffff:198.51.100.9')).toBe('198.51.100.9')
    })

    it('leaves IPv4 addresses as they are', () => {
      expect(key('198.51.100.9')).toBe('198.51.100.9')
    })

    it('drops a zone id and the brackets with a port', () => {
      expect(key('fe80::1%eth0')).toBe(key('fe80::2'))
      expect(key('[2001:db8:1:2::1]:51234')).toBe(key('2001:db8:1:2::7'))
    })

    it('keeps an unparseable value as it is instead of failing', () => {
      expect(key('unbekannt')).toBe('unbekannt')
    })
  })
})
