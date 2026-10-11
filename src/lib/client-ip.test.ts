import { describe, expect, it } from 'vitest'
import { getClientKey } from './client-ip'

function requestWithHeaders(headers: Record<string, string>): Request {
  return new Request('http://localhost/', { headers })
}

describe('getClientKey', () => {
  it('prefers cf-connecting-ip when present', () => {
    const request = requestWithHeaders({
      'cf-connecting-ip': '203.0.113.5',
      'x-forwarded-for': '198.51.100.9, 10.0.0.1',
    })
    expect(getClientKey(request)).toBe('203.0.113.5')
  })

  it('falls back to the first x-forwarded-for entry when cf-connecting-ip is absent', () => {
    const request = requestWithHeaders({
      'x-forwarded-for': '198.51.100.9, 10.0.0.1',
    })
    expect(getClientKey(request)).toBe('198.51.100.9')
  })

  it('trims whitespace around the first x-forwarded-for entry', () => {
    const request = requestWithHeaders({ 'x-forwarded-for': '  198.51.100.9  ,10.0.0.1' })
    expect(getClientKey(request)).toBe('198.51.100.9')
  })

  it('falls back to "local" when neither header is present', () => {
    const request = requestWithHeaders({})
    expect(getClientKey(request)).toBe('local')
  })
})
