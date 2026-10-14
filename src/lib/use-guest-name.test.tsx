import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useGuestName } from './use-guest-name'

const STORAGE_KEY = 'wedding-guest-name'

describe('useGuestName', () => {
  afterEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('starts empty when nothing was remembered', () => {
    const { result } = renderHook(() => useGuestName())
    expect(result.current.name).toBe('')
  })

  it('prefills the name remembered on this device', () => {
    window.localStorage.setItem(STORAGE_KEY, 'Anna')
    const { result } = renderHook(() => useGuestName())
    expect(result.current.name).toBe('Anna')
  })

  it('lets the guest change the prefilled name', () => {
    window.localStorage.setItem(STORAGE_KEY, 'Anna')
    const { result } = renderHook(() => useGuestName())

    act(() => result.current.setName('Ben'))
    expect(result.current.name).toBe('Ben')
  })

  it('keeps an emptied field empty instead of prefilling it again', () => {
    window.localStorage.setItem(STORAGE_KEY, 'Anna')
    const { result } = renderHook(() => useGuestName())

    act(() => result.current.setName(''))
    expect(result.current.name).toBe('')
  })

  it('remembers a name for the next form, trimmed and capped at 60 characters', () => {
    const { result } = renderHook(() => useGuestName())

    act(() => result.current.remember(`  ${'A'.repeat(70)}  `))
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('A'.repeat(60))
  })

  it('does not overwrite the remembered name with an empty one', () => {
    window.localStorage.setItem(STORAGE_KEY, 'Anna')
    const { result } = renderHook(() => useGuestName())

    act(() => result.current.remember('   '))
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('Anna')
  })

  it('shows a name remembered by another form on the same page without a reload', () => {
    const first = renderHook(() => useGuestName())
    const second = renderHook(() => useGuestName())

    act(() => first.result.current.remember('Lena'))
    expect(second.result.current.name).toBe('Lena')
  })

  it('works when the browser refuses storage (private mode)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    const { result } = renderHook(() => useGuestName())

    expect(result.current.name).toBe('')
    act(() => result.current.setName('Anna'))
    expect(() => act(() => result.current.remember('Anna'))).not.toThrow()
    expect(result.current.name).toBe('Anna')
  })
})
