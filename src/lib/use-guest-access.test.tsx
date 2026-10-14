import { StrictMode, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useGuestAccess } from './use-guest-access'
import { bodyOf, callsTo, mockFetchRoutes as mockFetch } from '@/test-utils/mock-fetch'

describe('useGuestAccess', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/gallery')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts as checking and becomes unlocked when the server knows the session', async () => {
    mockFetch({ '/api/access': { body: { unlocked: true } } })
    const { result } = renderHook(() => useGuestAccess())
    expect(result.current.status).toBe('checking')
    await waitFor(() => expect(result.current.status).toBe('unlocked'))
  })

  it('becomes locked when there is no session', async () => {
    mockFetch({ '/api/access': { body: { unlocked: false } } })
    const { result } = renderHook(() => useGuestAccess())
    await waitFor(() => expect(result.current.status).toBe('locked'))
    expect(result.current.linkRejected).toBe(false)
  })

  it('treats an unreachable server as locked (the field is harmless)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const { result } = renderHook(() => useGuestAccess())
    await waitFor(() => expect(result.current.status).toBe('locked'))
  })

  it('unlocks with the key from the address, removes it from the address and skips the access check', async () => {
    window.history.replaceState(null, '', '/gallery#k=Hochzeit')
    const fetchMock = mockFetch({ '/api/gallery/unlock': { body: { success: true } } })

    const { result } = renderHook(() => useGuestAccess())
    await waitFor(() => expect(result.current.status).toBe('unlocked'))

    expect(window.location.hash).toBe('')
    expect(window.location.pathname).toBe('/gallery')
    expect(bodyOf(callsTo(fetchMock, '/api/gallery/unlock')[0])).toEqual({ password: 'Hochzeit' })
    expect(callsTo(fetchMock, '/api/access')).toHaveLength(0)
  })

  it('decodes a percent-encoded key', async () => {
    window.history.replaceState(null, '', '/gallery#k=F%C3%BCr%20uns')
    const fetchMock = mockFetch({ '/api/gallery/unlock': { body: { success: true } } })

    const { result } = renderHook(() => useGuestAccess())
    await waitFor(() => expect(result.current.status).toBe('unlocked'))

    expect(bodyOf(callsTo(fetchMock, '/api/gallery/unlock')[0])).toEqual({ password: 'Für uns' })
  })

  it('keeps other fragment parameters and the query string', async () => {
    window.history.replaceState(null, '', '/gallery?x=1#foo=bar&k=Hochzeit')
    mockFetch({ '/api/gallery/unlock': { body: { success: true } } })

    const { result } = renderHook(() => useGuestAccess())
    await waitFor(() => expect(result.current.status).toBe('unlocked'))

    expect(window.location.search).toBe('?x=1')
    expect(window.location.hash).toBe('#foo=bar')
  })

  it('reports a rejected link, stays locked and still removes the key from the address', async () => {
    window.history.replaceState(null, '', '/gallery#k=Altes-Wort')
    mockFetch({ '/api/gallery/unlock': { status: 401, body: { error: 'Falsches Kennwort.' } } })

    const { result } = renderHook(() => useGuestAccess())
    await waitFor(() => expect(result.current.status).toBe('locked'))

    expect(result.current.linkRejected).toBe(true)
    expect(window.location.hash).toBe('')
  })

  it('does not send the key twice under React strict mode', async () => {
    window.history.replaceState(null, '', '/gallery#k=Hochzeit')
    const fetchMock = mockFetch({ '/api/gallery/unlock': { body: { success: true } } })
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>

    const { result } = renderHook(() => useGuestAccess(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('unlocked'))

    expect(callsTo(fetchMock, '/api/gallery/unlock')).toHaveLength(1)
    expect(callsTo(fetchMock, '/api/access')).toHaveLength(0)
  })

  it('unlock() with the right password unlocks and with a wrong one keeps the server message', async () => {
    let correct = false
    mockFetch({
      '/api/access': { body: { unlocked: false } },
      '/api/gallery/unlock': () =>
        correct ? { body: { success: true } } : { status: 401, body: { error: 'Falsches Kennwort.' } },
    })
    const { result } = renderHook(() => useGuestAccess())
    await waitFor(() => expect(result.current.status).toBe('locked'))

    let outcome: Awaited<ReturnType<typeof result.current.unlock>> | undefined
    await act(async () => {
      outcome = await result.current.unlock('falsch')
    })
    expect(outcome).toEqual({ ok: false, error: 'Falsches Kennwort.' })
    expect(result.current.status).toBe('locked')

    correct = true
    await act(async () => {
      outcome = await result.current.unlock('Hochzeit')
    })
    expect(outcome).toEqual({ ok: true })
    expect(result.current.status).toBe('unlocked')
  })

  it('markUnlocked() and markLocked() switch the state', async () => {
    mockFetch({ '/api/access': { body: { unlocked: false } } })
    const { result } = renderHook(() => useGuestAccess())
    await waitFor(() => expect(result.current.status).toBe('locked'))

    act(() => result.current.markUnlocked())
    expect(result.current.status).toBe('unlocked')

    act(() => result.current.markLocked())
    expect(result.current.status).toBe('locked')
  })
})
