import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NextResponse } from 'next/server'
import { createDb } from './db'
import {
  SCORE_COOKIE_NAME,
  SCORE_SESSION_DURATION_MS,
  createScoreSessionCookieValue,
  hasScoreAccess,
  isScoreConfigured,
  setScoreSessionCookie,
  verifyScorePassword,
} from './score-auth'
import { ADMIN_COOKIE_NAME, adminCookieSecret, getOrCreateAdminSecret, isAdminRequest, signCookieValue } from './admin-auth'
import { GALLERY_COOKIE_NAME, createGallerySessionCookieValue, isGalleryUnlocked } from './gallery-auth'

function requestWithCookie(name: string, value?: string): Request {
  const headers = new Headers()
  if (value !== undefined) headers.set('cookie', `${name}=${value}`)
  return new Request('http://localhost/api/score', { headers })
}

describe('score access', () => {
  const original = {
    score: process.env.SCORE_PASSWORD,
    guest: process.env.GUEST_PASSWORD,
    admin: process.env.ADMIN_PASSWORD,
  }

  beforeEach(() => {
    process.env.SCORE_PASSWORD = 'Torte'
    process.env.GUEST_PASSWORD = 'Hochzeit'
    process.env.ADMIN_PASSWORD = 'admin-pw'
  })

  afterEach(() => {
    for (const [key, value] of [
      ['SCORE_PASSWORD', original.score],
      ['GUEST_PASSWORD', original.guest],
      ['ADMIN_PASSWORD', original.admin],
    ] as const) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it('knows whether a score password is set', () => {
    expect(isScoreConfigured()).toBe(true)
    delete process.env.SCORE_PASSWORD
    expect(isScoreConfigured()).toBe(false)
    process.env.SCORE_PASSWORD = '   '
    expect(isScoreConfigured()).toBe(false)
  })

  it('accepts the password regardless of case and surrounding spaces', () => {
    expect(verifyScorePassword('Torte')).toBe(true)
    expect(verifyScorePassword('  torte ')).toBe(true)
    expect(verifyScorePassword('Kuchen')).toBe(false)
  })

  it('never accepts anything without a configured password', () => {
    delete process.env.SCORE_PASSWORD
    expect(verifyScorePassword('')).toBe(false)
    expect(verifyScorePassword('Torte')).toBe(false)
  })

  it('does not accept the admin or the guest password', () => {
    expect(verifyScorePassword('admin-pw')).toBe(false)
    expect(verifyScorePassword('Hochzeit')).toBe(false)
  })

  it('opens with a freshly created session cookie', () => {
    const db = createDb(':memory:')
    const value = createScoreSessionCookieValue(db)
    expect(hasScoreAccess(requestWithCookie(SCORE_COOKIE_NAME, value), db)).toBe(true)
    db.close()
  })

  it('stays closed without a cookie, with garbage and with an expired cookie', () => {
    const db = createDb(':memory:')
    expect(hasScoreAccess(requestWithCookie(SCORE_COOKIE_NAME), db)).toBe(false)
    expect(hasScoreAccess(requestWithCookie(SCORE_COOKIE_NAME, 'quatsch'), db)).toBe(false)
    const expired = createScoreSessionCookieValue(db, Date.now() - SCORE_SESSION_DURATION_MS - 1000)
    expect(hasScoreAccess(requestWithCookie(SCORE_COOKIE_NAME, expired), db)).toBe(false)
    db.close()
  })

  it('stays closed when the score password is not configured, even with a signed cookie', () => {
    const db = createDb(':memory:')
    const value = createScoreSessionCookieValue(db)
    delete process.env.SCORE_PASSWORD
    expect(hasScoreAccess(requestWithCookie(SCORE_COOKIE_NAME, value), db)).toBe(false)
    db.close()
  })

  it('ends old sessions when the password changes', () => {
    const db = createDb(':memory:')
    const value = createScoreSessionCookieValue(db)
    process.env.SCORE_PASSWORD = 'Sekt'
    expect(hasScoreAccess(requestWithCookie(SCORE_COOKIE_NAME, value), db)).toBe(false)
    db.close()
  })

  it('does not accept an admin or gallery cookie value under the score cookie name', () => {
    const db = createDb(':memory:')
    const adminValue = signCookieValue(Date.now() + 60_000, adminCookieSecret(getOrCreateAdminSecret(db)))
    const galleryValue = createGallerySessionCookieValue(db)
    expect(hasScoreAccess(requestWithCookie(SCORE_COOKIE_NAME, adminValue), db)).toBe(false)
    expect(hasScoreAccess(requestWithCookie(SCORE_COOKIE_NAME, galleryValue), db)).toBe(false)
    db.close()
  })

  it('never turns a score cookie value into an admin or gallery session', () => {
    const db = createDb(':memory:')
    const value = createScoreSessionCookieValue(db)
    expect(isAdminRequest(requestWithCookie(ADMIN_COOKIE_NAME, value), db)).toBe(false)
    expect(isGalleryUnlocked(requestWithCookie(GALLERY_COOKIE_NAME, value), db)).toBe(false)
    db.close()
  })

  it('sets an http-only session cookie for the whole site', () => {
    const db = createDb(':memory:')
    const response = NextResponse.json({ success: true })
    setScoreSessionCookie(response, db)
    const cookie = response.cookies.get(SCORE_COOKIE_NAME)
    expect(cookie?.httpOnly).toBe(true)
    expect(cookie?.path).toBe('/')
    expect(cookie?.sameSite).toBe('lax')
    expect(hasScoreAccess(requestWithCookie(SCORE_COOKIE_NAME, cookie?.value), db)).toBe(true)
    db.close()
  })
})
