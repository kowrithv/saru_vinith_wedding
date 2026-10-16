// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { etagFor, hasEtag, notModified } from './etag'

describe('etagFor', () => {
  it('is a quoted, short hash that stays the same for the same parts', () => {
    const tag = etagFor(['a', 3, true])
    expect(tag).toMatch(/^"[0-9a-f]{24}"$/)
    expect(etagFor(['a', 3, true])).toBe(tag)
  })

  it('changes when any part changes', () => {
    const base = etagFor(['public', false, 4, 'p1'])
    expect(etagFor(['public', true, 4, 'p1'])).not.toBe(base)
    expect(etagFor(['public', false, 5, 'p1'])).not.toBe(base)
    expect(etagFor(['public', false, 4, 'p2'])).not.toBe(base)
  })
})

describe('hasEtag', () => {
  const request = (tag?: string) =>
    new Request('http://localhost/x', { headers: tag === undefined ? {} : { 'if-none-match': tag } })

  it('is true only for the exact tag', () => {
    expect(hasEtag(request('"abc"'), '"abc"')).toBe(true)
    expect(hasEtag(request('"abd"'), '"abc"')).toBe(false)
    expect(hasEtag(request('*'), '"abc"')).toBe(false)
    expect(hasEtag(request(), '"abc"')).toBe(false)
  })

  it('is false without a request', () => {
    expect(hasEtag(undefined, '"abc"')).toBe(false)
  })
})

describe('notModified', () => {
  it('answers 304 without a body and keeps the tag and the other headers', async () => {
    const response = notModified('"abc"', { 'Cache-Control': 'no-store' })

    expect(response.status).toBe(304)
    expect(await response.text()).toBe('')
    expect(response.headers.get('etag')).toBe('"abc"')
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
})
