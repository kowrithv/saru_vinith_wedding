import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NextResponse } from 'next/server'
import { createDb } from './db'
import {
  GALLERY_COOKIE_NAME,
  GALLERY_SESSION_DURATION_MS,
  authorizeGuest,
  createGallerySessionCookieValue,
  hasGuestAccess,
  isGalleryUnlocked,
  setGallerySessionCookie,
} from './gallery-auth'
import { ADMIN_COOKIE_NAME, adminCookieSecret, getOrCreateAdminSecret, isAdminRequest, signCookieValue } from './admin-auth'

function requestWithCookie(cookieValue?: string): Request {
  const headers = new Headers()
  if (cookieValue !== undefined) {
    headers.set('cookie', `${GALLERY_COOKIE_NAME}=${cookieValue}`)
  }
  return new Request('http://localhost/api/gallery', { headers })
}

describe('gallery session', () => {
  const originalPassword = process.env.GUEST_PASSWORD

  beforeEach(() => {
    process.env.GUEST_PASSWORD = 'Hochzeit'
  })

  afterEach(() => {
    process.env.GUEST_PASSWORD = originalPassword
  })

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
    const longAgo = Date.now() - GALLERY_SESSION_DURATION_MS - 60 * 1000
    const cookieValue = createGallerySessionCookieValue(db, longAgo)
    expect(isGalleryUnlocked(requestWithCookie(cookieValue), db)).toBe(false)
    db.close()
  })

  it('stays valid for 30 days', () => {
    expect(GALLERY_SESSION_DURATION_MS).toBe(30 * 24 * 60 * 60 * 1000)
    const db = createDb(':memory:')
    const cookieValue = createGallerySessionCookieValue(db, Date.now() - 29 * 24 * 60 * 60 * 1000)
    expect(isGalleryUnlocked(requestWithCookie(cookieValue), db)).toBe(true)
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

  // Ein Kennwortwechsel (Neustart mit neuem Wert) soll alle bisher
  // ausgestellten Sitzungen entwerten - etwa wenn der Link an Fremde
  // gelangt ist.
  it('is invalidated when the guest password changes', () => {
    const db = createDb(':memory:')
    const cookieValue = createGallerySessionCookieValue(db)
    expect(isGalleryUnlocked(requestWithCookie(cookieValue), db)).toBe(true)

    process.env.GUEST_PASSWORD = 'Anderes-Wort'
    expect(isGalleryUnlocked(requestWithCookie(cookieValue), db)).toBe(false)
    db.close()
  })

  it('survives a change of letter case in the configured password', () => {
    const db = createDb(':memory:')
    const cookieValue = createGallerySessionCookieValue(db)
    process.env.GUEST_PASSWORD = 'HOCHZEIT'
    expect(isGalleryUnlocked(requestWithCookie(cookieValue), db)).toBe(true)
    db.close()
  })
})

describe('hasGuestAccess', () => {
  const originalPassword = process.env.GUEST_PASSWORD

  beforeEach(() => {
    process.env.GUEST_PASSWORD = 'Hochzeit'
  })

  afterEach(() => {
    process.env.GUEST_PASSWORD = originalPassword
  })

  it('is false for a request without any cookie', () => {
    const db = createDb(':memory:')
    expect(hasGuestAccess(requestWithCookie(), db)).toBe(false)
    db.close()
  })

  it('is true with a valid gallery session cookie', () => {
    const db = createDb(':memory:')
    expect(hasGuestAccess(requestWithCookie(createGallerySessionCookieValue(db)), db)).toBe(true)
    db.close()
  })

  it('is true for an admin session', () => {
    const db = createDb(':memory:')
    const adminCookie = signCookieValue(Date.now() + 1000, adminCookieSecret(getOrCreateAdminSecret(db)))
    const headers = new Headers({ cookie: `${ADMIN_COOKIE_NAME}=${adminCookie}` })
    expect(hasGuestAccess(new Request('http://localhost/x', { headers }), db)).toBe(true)
    db.close()
  })
})

describe('authorizeGuest', () => {
  const originalPassword = process.env.GUEST_PASSWORD

  beforeEach(() => {
    process.env.GUEST_PASSWORD = 'Hochzeit'
  })

  afterEach(() => {
    process.env.GUEST_PASSWORD = originalPassword
  })

  it('lets a valid session through without issuing a new cookie', () => {
    const db = createDb(':memory:')
    const request = requestWithCookie(createGallerySessionCookieValue(db))
    expect(authorizeGuest(request, db, undefined)).toEqual({ ok: true, issueSession: false })
    db.close()
  })

  it('lets the correct password through and asks for a session cookie', () => {
    const db = createDb(':memory:')
    expect(authorizeGuest(requestWithCookie(), db, 'hochzeit ')).toEqual({ ok: true, issueSession: true })
    db.close()
  })

  it('rejects a wrong, empty or non-string password', () => {
    const db = createDb(':memory:')
    expect(authorizeGuest(requestWithCookie(), db, 'falsch')).toEqual({ ok: false })
    expect(authorizeGuest(requestWithCookie(), db, '')).toEqual({ ok: false })
    expect(authorizeGuest(requestWithCookie(), db, undefined)).toEqual({ ok: false })
    expect(authorizeGuest(requestWithCookie(), db, 42)).toEqual({ ok: false })
    db.close()
  })

  it('rejects everything when no guest password is configured', () => {
    delete process.env.GUEST_PASSWORD
    const db = createDb(':memory:')
    expect(authorizeGuest(requestWithCookie(), db, '')).toEqual({ ok: false })
    expect(authorizeGuest(requestWithCookie(), db, 'irgendwas')).toEqual({ ok: false })
    db.close()
  })
})

describe('setGallerySessionCookie', () => {
  const originalPassword = process.env.GUEST_PASSWORD

  beforeEach(() => {
    process.env.GUEST_PASSWORD = 'Hochzeit'
  })

  afterEach(() => {
    process.env.GUEST_PASSWORD = originalPassword
  })

  it('sets a httpOnly, lax, site-wide cookie that unlocks the next request', () => {
    const db = createDb(':memory:')
    const response = NextResponse.json({ ok: true })
    setGallerySessionCookie(response, db)

    const header = response.headers.get('set-cookie') ?? ''
    expect(header).toContain(`${GALLERY_COOKIE_NAME}=`)
    expect(header).toContain('HttpOnly')
    expect(header).toContain('SameSite=lax')
    expect(header).toContain('Path=/')

    const value = response.cookies.get(GALLERY_COOKIE_NAME)?.value ?? ''
    expect(isGalleryUnlocked(requestWithCookie(value), db)).toBe(true)
    db.close()
  })
})
