import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useState } from 'react'
import { useLiveList } from './use-live-list'

interface Item {
  id: number
  photo?: string
}

const body = (items: Item[]) => ({ entries: items })
const ok = (items: Item[], etag?: string) => ({
  ok: true,
  status: 200,
  headers: new Headers(etag ? { etag } : {}),
  json: async () => body(items),
})
const notModified = { ok: false, status: 304, headers: new Headers(), json: async () => ({}) }

function stubFetch(answers: unknown[]) {
  let call = 0
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => answers[Math.min(call++, answers.length - 1)])
  vi.stubGlobal('fetch', fn)
  return fn
}

function useHarness(initial: Item[], options: { enabled?: boolean; onBody?: (body: unknown) => void } = {}) {
  const [shown, setShown] = useState<Item[]>(initial)
  const live = useLiveList<Item>({
    url: '/api/list',
    shown,
    enabled: options.enabled ?? true,
    keyOf: (item) => `${item.id}:${item.photo ?? ''}`,
    parse: (b) => ((b as { entries?: Item[] }).entries ?? null),
    onApply: setShown,
    onBody: options.onBody,
  })
  return { ...live, shown, setShown }
}

async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe('useLiveList', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true })
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('shows what others added after 30 seconds when the guest is at the top', async () => {
    const fetchMock = stubFetch([ok([{ id: 2 }, { id: 1 }], '"v2"')])
    const { result } = renderHook(() => useHarness([{ id: 1 }]))

    await tick(29_000)
    expect(fetchMock).not.toHaveBeenCalled()
    await tick(1_000)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.current.shown.map((i) => i.id)).toEqual([2, 1])
    expect(result.current.newCount).toBe(0)
  })

  it('looks again every 30 seconds and asks with the ETag of the last answer', async () => {
    const fetchMock = stubFetch([ok([{ id: 1 }], '"v1"'), notModified, notModified])
    renderHook(() => useHarness([{ id: 1 }]))

    await tick(30_000)
    await tick(30_000)
    await tick(30_000)

    const tags = fetchMock.mock.calls.map(([, init]) => (init as RequestInit).headers)
    expect(tags).toEqual([undefined, { 'If-None-Match': '"v1"' }, { 'If-None-Match': '"v1"' }])
  })

  it('keeps everything as it is on a 304', async () => {
    stubFetch([ok([{ id: 1 }], '"v1"'), notModified])
    const { result } = renderHook(() => useHarness([{ id: 1 }]))
    await tick(30_000)
    const before = result.current.shown

    await tick(30_000)

    expect(result.current.shown).toBe(before)
    expect(result.current.newCount).toBe(0)
  })

  it('waits when nothing is enabled yet', async () => {
    const fetchMock = stubFetch([ok([{ id: 1 }])])
    renderHook(() => useHarness([], { enabled: false }))

    await tick(120_000)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not look in a hidden tab, but at once when the tab is back', async () => {
    const fetchMock = stubFetch([ok([{ id: 2 }, { id: 1 }])])
    const { result } = renderHook(() => useHarness([{ id: 1 }]))
    Object.defineProperty(document, 'hidden', { value: true, configurable: true })

    await tick(90_000)
    expect(fetchMock).not.toHaveBeenCalled()

    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.current.shown).toHaveLength(2)
  })

  it('ignores an error and tries again in the next round', async () => {
    const fetchMock = stubFetch([{ ok: false, status: 500, headers: new Headers(), json: async () => ({}) }, ok([{ id: 2 }, { id: 1 }])])
    const { result } = renderHook(() => useHarness([{ id: 1 }]))

    await tick(30_000)
    expect(result.current.shown).toHaveLength(1)

    await tick(30_000)
    expect(result.current.shown).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('ignores an answer it cannot read', async () => {
    stubFetch([{ ok: true, status: 200, headers: new Headers(), json: async () => ({ unexpected: true }) }])
    const { result } = renderHook(() => useHarness([{ id: 1 }]))

    await tick(30_000)

    expect(result.current.shown).toEqual([{ id: 1 }])
  })

  it('hands every full answer to onBody', async () => {
    stubFetch([ok([{ id: 1 }], '"v1"')])
    const onBody = vi.fn()
    renderHook(() => useHarness([{ id: 1 }], { onBody }))

    await tick(30_000)

    expect(onBody).toHaveBeenCalledWith({ entries: [{ id: 1 }] })
  })

  it('treats an entry whose details changed (photo gone) as a change', async () => {
    stubFetch([ok([{ id: 1 }])])
    const { result } = renderHook(() => useHarness([{ id: 1, photo: 'p1' }]))

    await tick(30_000)

    expect(result.current.shown).toEqual([{ id: 1 }])
  })

  it('drops an answer that was sent before the page changed the list itself', async () => {
    let release: (value: unknown) => void = () => {}
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise((resolve) => (release = resolve)))
    )
    const { result } = renderHook(() => useHarness([{ id: 1 }]))
    await tick(30_000) // die Anfrage ist unterwegs

    act(() => result.current.setShown([{ id: 9 }, { id: 1 }])) // eigener Eintrag
    await act(async () => {
      // Die alte Antwort kennt den eigenen Eintrag noch nicht, dafür einen fremden.
      release(ok([{ id: 5 }, { id: 1 }]))
    })

    expect(result.current.shown.map((i) => i.id)).toEqual([9, 1])
  })

  describe('when the guest has scrolled down', () => {
    beforeEach(() => {
      window.scrollY = 900
    })

    it('does not move the list but counts what is new', async () => {
      stubFetch([ok([{ id: 3 }, { id: 2 }, { id: 1 }])])
      const { result } = renderHook(() => useHarness([{ id: 1 }]))

      await tick(30_000)

      expect(result.current.shown).toEqual([{ id: 1 }])
      expect(result.current.newCount).toBe(2)
    })

    it('shows the new entries and scrolls to the top on request', async () => {
      stubFetch([ok([{ id: 2 }, { id: 1 }])])
      const { result } = renderHook(() => useHarness([{ id: 1 }]))
      await tick(30_000)

      act(() => result.current.showNew())

      expect(result.current.shown.map((i) => i.id)).toEqual([2, 1])
      expect(result.current.newCount).toBe(0)
      expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }))
    })

    it('does not announce a removed entry', async () => {
      stubFetch([ok([{ id: 1 }])])
      const { result } = renderHook(() => useHarness([{ id: 2 }, { id: 1 }]))

      await tick(30_000)

      expect(result.current.newCount).toBe(0)
      expect(result.current.shown).toHaveLength(2)
    })

    it('does nothing when asked to show without anything waiting', () => {
      stubFetch([ok([{ id: 1 }])])
      const { result } = renderHook(() => useHarness([{ id: 1 }]))

      act(() => result.current.showNew())

      expect(window.scrollTo).not.toHaveBeenCalled()
    })
  })
})
