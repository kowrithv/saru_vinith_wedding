import { afterEach, describe, expect, it } from 'vitest'
import { saveDeleteToken, getDeleteToken, removeDeleteToken } from './gallery-delete-tokens'

describe('gallery delete tokens', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('returns undefined for a photo with no saved token', () => {
    expect(getDeleteToken('unknown-id')).toBeUndefined()
  })

  it('saves and retrieves a token for a specific photo', () => {
    saveDeleteToken('photo-1', 'token-abc')
    expect(getDeleteToken('photo-1')).toBe('token-abc')
  })

  it('keeps tokens for different photos independent', () => {
    saveDeleteToken('photo-1', 'token-1')
    saveDeleteToken('photo-2', 'token-2')
    expect(getDeleteToken('photo-1')).toBe('token-1')
    expect(getDeleteToken('photo-2')).toBe('token-2')
  })

  it('removes a token, after which it is no longer returned', () => {
    saveDeleteToken('photo-1', 'token-1')
    removeDeleteToken('photo-1')
    expect(getDeleteToken('photo-1')).toBeUndefined()
  })
})
