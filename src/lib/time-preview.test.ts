import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { endPreview, previewKey, previewOffsetMs } from './time-preview'

const at = (iso: string) => Date.parse(iso)

describe('time preview', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    window.history.replaceState(null, '', '/')
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-15T08:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    window.sessionStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('is off by default: no key, no offset', () => {
    expect(previewKey()).toBeNull()
    expect(previewOffsetMs()).toBe(0)
  })

  it.each([
    ['heute', '2026-10-17T12:00:00+02:00'],
    ['feier', '2026-10-17T18:00:00+02:00'],
    ['danach', '2026-10-18T10:00:00+02:00'],
  ])('?zeit=%s shows the site as of %s', (key, instant) => {
    window.history.replaceState(null, '', `/?zeit=${key}`)
    expect(previewKey()).toBe(key)
    expect(Date.now() + previewOffsetMs()).toBe(at(instant))
  })

  it('lets the preview time run on from that moment', () => {
    window.history.replaceState(null, '', '/?zeit=heute')
    expect(Date.now() + previewOffsetMs()).toBe(at('2026-10-17T12:00:00+02:00'))

    vi.advanceTimersByTime(90_000)

    expect(Date.now() + previewOffsetMs()).toBe(at('2026-10-17T12:01:30+02:00'))
  })

  it('stays on while the guest clicks through other pages (no parameter any more)', () => {
    window.history.replaceState(null, '', '/?zeit=danach')
    expect(previewKey()).toBe('danach')

    window.history.replaceState(null, '', '/info')

    expect(previewKey()).toBe('danach')
    expect(Date.now() + previewOffsetMs()).toBe(at('2026-10-18T10:00:00+02:00'))
  })

  it('switches to another preview when another one is requested', () => {
    window.history.replaceState(null, '', '/?zeit=heute')
    previewKey()
    window.history.replaceState(null, '', '/info?zeit=danach')
    expect(previewKey()).toBe('danach')
  })

  it('"aus" ends the preview', () => {
    window.history.replaceState(null, '', '/?zeit=heute')
    expect(previewKey()).toBe('heute')

    window.history.replaceState(null, '', '/?zeit=aus')

    expect(previewKey()).toBeNull()
    expect(previewOffsetMs()).toBe(0)
  })

  it('ignores an unknown value', () => {
    window.history.replaceState(null, '', '/?zeit=gestern')
    expect(previewKey()).toBeNull()
    expect(previewOffsetMs()).toBe(0)
  })

  it('endPreview() turns it off, removes the parameter and tells listeners', () => {
    window.history.replaceState(null, '', '/info?zeit=feier&x=1')
    expect(previewKey()).toBe('feier')
    const listener = vi.fn()
    window.addEventListener('zeit-preview', listener)

    endPreview()

    expect(previewKey()).toBeNull()
    expect(window.location.search).toBe('?x=1')
    expect(listener).toHaveBeenCalledTimes(1)
    window.removeEventListener('zeit-preview', listener)
  })

  it('survives a broken storage', () => {
    window.sessionStorage.setItem('zeit-preview', '{kaputt')
    expect(previewKey()).toBeNull()
    expect(previewOffsetMs()).toBe(0)
  })
})
