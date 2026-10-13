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
})
