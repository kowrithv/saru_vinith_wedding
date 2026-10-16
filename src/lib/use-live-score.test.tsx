import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { parseScore, useLiveScore } from './use-live-score'
import { callsTo, mockFetchRoutes as mockFetch } from '@/test-utils/mock-fetch'

class FakeEventSource {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 2
  static instances: FakeEventSource[] = []

  readyState = FakeEventSource.CONNECTING
  onmessage: ((event: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  private readonly listeners = new Map<string, Array<() => void>>()

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this)
  }

  addEventListener(type: string, listener: () => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }

  removeEventListener() {}

  close() {
    this.readyState = FakeEventSource.CLOSED
  }

  // Hilfen für den Test
  send(score: object) {
    this.readyState = FakeEventSource.OPEN
    this.onmessage?.({ data: JSON.stringify(score) })
  }

  ping() {
    this.listeners.get('ping')?.forEach((listener) => listener())
  }

  fail() {
    this.onerror?.()
  }

  get open() {
    return this.readyState !== FakeEventSource.CLOSED
  }
}

const flush = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })

const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })

const latest = () => FakeEventSource.instances[FakeEventSource.instances.length - 1]

const start = { bride: 2, groom: 1, rev: 3 }

describe('parseScore', () => {
  it('accepts a complete score', () => {
    expect(parseScore({ bride: 2, groom: 1, rev: 3 })).toEqual({ bride: 2, groom: 1, rev: 3 })
  })

  it.each([null, 'x', {}, { bride: 1, groom: 2 }, { bride: '1', groom: 2, rev: 3 }, { bride: -1, groom: 0, rev: 0 }, { bride: 1.5, groom: 0, rev: 0 }])(
    'rejects %j',
    (value) => {
      expect(parseScore(value)).toBeNull()
    }
  )
})

describe('useLiveScore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeEventSource.instances = []
    vi.stubGlobal('EventSource', FakeEventSource)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('asks for a login when the server does not know the session, and opens no stream', async () => {
    mockFetch({ '/api/score': { status: 401, body: { error: 'Nicht angemeldet.' } } })
    const { result } = renderHook(() => useLiveScore())
    expect(result.current.status).toBe('connecting')
    await flush()
    expect(result.current.status).toBe('login')
    expect(FakeEventSource.instances).toHaveLength(0)
  })

  it('shows the score right away and goes live once the stream delivers', async () => {
    mockFetch({ '/api/score': { body: start } })
    const { result } = renderHook(() => useLiveScore())
    await flush()
    expect(result.current.score).toEqual(start)
    expect(FakeEventSource.instances).toHaveLength(1)
    expect(latest().url).toBe('/api/score/stream')

    act(() => latest().send({ bride: 3, groom: 1, rev: 4 }))
    expect(result.current.status).toBe('live')
    expect(result.current.score).toEqual({ bride: 3, groom: 1, rev: 4 })
  })

  it('ignores an older score that arrives late', async () => {
    mockFetch({ '/api/score': { body: start } })
    const { result } = renderHook(() => useLiveScore())
    await flush()
    act(() => latest().send({ bride: 5, groom: 1, rev: 6 }))
    act(() => latest().send({ bride: 4, groom: 1, rev: 5 }))
    expect(result.current.score?.bride).toBe(5)
  })

  it('takes a lower revision after a reconnect (database restored from a backup)', async () => {
    mockFetch({ '/api/score': { body: { bride: 9, groom: 9, rev: 50 } } })
    const { result } = renderHook(() => useLiveScore())
    await flush()
    act(() => latest().send({ bride: 9, groom: 9, rev: 50 }))
    act(() => latest().fail())
    act(() => latest().send({ bride: 1, groom: 0, rev: 2 }))
    expect(result.current.score).toEqual({ bride: 1, groom: 0, rev: 2 })
  })

  it('polls every three seconds while the stream is down, and stops when it is back', async () => {
    const fetchMock = mockFetch({
      '/api/score': [{ body: start }, { body: start }, { body: { bride: 4, groom: 1, rev: 5 } }],
    })
    const { result } = renderHook(() => useLiveScore())
    await flush()
    act(() => latest().send(start))
    expect(callsTo(fetchMock, '/api/score')).toHaveLength(1)

    act(() => latest().fail())
    expect(result.current.status).toBe('polling')
    await advance(3000)
    expect(callsTo(fetchMock, '/api/score')).toHaveLength(2)
    await advance(3000)
    expect(result.current.score?.bride).toBe(4)

    act(() => latest().send({ bride: 4, groom: 1, rev: 5 }))
    expect(result.current.status).toBe('live')
    await advance(9000)
    expect(callsTo(fetchMock, '/api/score')).toHaveLength(3)
  })

  it('opens a new stream when the old one was closed for good', async () => {
    mockFetch({ '/api/score': { body: start } })
    renderHook(() => useLiveScore())
    await flush()
    const first = latest()
    act(() => {
      first.close()
      first.fail()
    })
    await advance(3000)
    expect(FakeEventSource.instances).toHaveLength(2)
    expect(latest()).not.toBe(first)
  })

  it('asks for a login again when the session ends while polling', async () => {
    mockFetch({ '/api/score': [{ body: start }, { status: 401, body: {} }] })
    const { result } = renderHook(() => useLiveScore())
    await flush()
    act(() => latest().fail())
    await advance(3000)
    expect(result.current.status).toBe('login')
    const fetchCalls = vi.mocked(fetch).mock.calls.length
    await advance(9000)
    expect(vi.mocked(fetch).mock.calls.length).toBe(fetchCalls)
  })

  it('keeps polling when a request fails', async () => {
    let call = 0
    const fetchMock = vi.fn(async () => {
      call += 1
      if (call === 2) throw new Error('offline')
      return { ok: true, status: 200, headers: new Headers(), json: async () => ({ bride: call, groom: 0, rev: call }) } as Response
    })
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useLiveScore())
    await flush()
    act(() => latest().fail())
    await advance(3000)
    expect(result.current.status).toBe('polling')
    await advance(3000)
    expect(result.current.score?.bride).toBe(3)
  })

  it('replaces a silent stream with a new one after 25 seconds', async () => {
    mockFetch({ '/api/score': { body: start } })
    const { result } = renderHook(() => useLiveScore())
    await flush()
    const first = latest()
    act(() => first.send(start))

    await advance(24_000)
    expect(result.current.status).toBe('live')
    await advance(2000)
    expect(result.current.status).toBe('polling')
    expect(first.open).toBe(false)
    expect(FakeEventSource.instances).toHaveLength(2)
  })

  it('stays live as long as pings keep coming', async () => {
    mockFetch({ '/api/score': { body: start } })
    const { result } = renderHook(() => useLiveScore())
    await flush()
    act(() => latest().send(start))
    for (let n = 0; n < 6; n++) {
      await advance(10_000)
      act(() => latest().ping())
    }
    expect(result.current.status).toBe('live')
    expect(FakeEventSource.instances).toHaveLength(1)
  })

  it('applies an answer of its own request only when it is newer', async () => {
    mockFetch({ '/api/score': { body: start } })
    const { result } = renderHook(() => useLiveScore())
    await flush()
    act(() => result.current.accept({ bride: 3, groom: 1, rev: 4 }))
    expect(result.current.score?.bride).toBe(3)
    act(() => result.current.accept({ bride: 2, groom: 1, rev: 3 }))
    expect(result.current.score?.bride).toBe(3)
  })

  it('connects again after a login', async () => {
    mockFetch({ '/api/score': [{ status: 401, body: {} }, { body: start }] })
    const { result } = renderHook(() => useLiveScore())
    await flush()
    expect(result.current.status).toBe('login')

    act(() => result.current.reconnect())
    expect(result.current.status).toBe('connecting')
    await flush()
    expect(result.current.score).toEqual(start)
    expect(FakeEventSource.instances).toHaveLength(1)
  })

  it('closes the stream and stops polling when the page goes away', async () => {
    const fetchMock = mockFetch({ '/api/score': { body: start } })
    const { unmount } = renderHook(() => useLiveScore())
    await flush()
    const source = latest()
    act(() => source.fail())
    unmount()
    expect(source.open).toBe(false)
    const calls = callsTo(fetchMock, '/api/score').length
    await advance(30_000)
    expect(callsTo(fetchMock, '/api/score')).toHaveLength(calls)
  })
})
