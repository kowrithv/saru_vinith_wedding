import { describe, expect, it } from 'vitest'
import { createDb } from './db'
import { GALLERY_COOKIE_NAME, createGallerySessionCookieValue, isGalleryUnlocked } from './gallery-auth'
import { ADMIN_COOKIE_NAME, getOrCreateAdminSecret, isAdminRequest } from './admin-auth'

function requestWithCookie(cookieValue?: string): Request {
  const headers = new Headers()
  if (cookieValue !== undefined) {
    headers.set('cookie', `${GALLERY_COOKIE_NAME}=${cookieValue}`)
  }
  return new Request('http://localhost/api/gallery', { headers })
}

describe('gallery session', () => {
  it('is not unlocked without a cookie', () => {
    const db = createDb(':memory:')
    expect(isGalleryUnlocked(requestWithCookie(), db)).toBe(false)
    db.close()
  })

  it('is unlocked with a freshly created session cookie', () => {
    const db = createDb(':memory:')
    const cookieValue = createGallerySessionCookieValue(db)
    expect(isGalleryUnlocked(requestWithCookie(cookieValue), db)).toBe(true)
    db.close()
  })

  it('is not unlocked with a tampered cookie value', () => {
    const db = createDb(':memory:')
    const cookieValue = createGallerySessionCookieValue(db)
    const tampered = cookieValue.slice(0, -1) + (cookieValue.endsWith('a') ? 'b' : 'a')
    expect(isGalleryUnlocked(requestWithCookie(tampered), db)).toBe(false)
    db.close()
  })

  it('is not unlocked with an expired cookie', () => {
    const db = createDb(':memory:')
    const cookieValue = createGallerySessionCookieValue(db, Date.now() - 8 * 24 * 60 * 60 * 1000)
    expect(isGalleryUnlocked(requestWithCookie(cookieValue), db)).toBe(false)
    db.close()
  })

  it('a gallery session cookie value does not also work as an admin cookie', () => {
    const db = createDb(':memory:')
    getOrCreateAdminSecret(db)
    const galleryCookieValue = createGallerySessionCookieValue(db)

    const headers = new Headers()
    headers.set('cookie', `${ADMIN_COOKIE_NAME}=${galleryCookieValue}`)
    const requestWithGalleryValueAsAdminCookie = new Request('http://localhost/api/admin/gallery-mode', { headers })

    expect(isAdminRequest(requestWithGalleryValueAsAdminCookie, db)).toBe(false)
    db.close()
  })
})
