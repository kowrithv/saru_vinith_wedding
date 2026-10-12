import type nodemailer from 'nodemailer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDb } from './db'
import { DEFAULT_COOLDOWN_MS, readSmtpSettings, sendAlert } from './alerts'

const smtpEnv = {
  SMTP_HOST: 'smtp.example.de',
  SMTP_USER: 'alerts@example.de',
  SMTP_PASSWORD: 'secret',
  SMTP_FROM: 'Hochzeitsseite <alerts@example.de>',
  ALERT_EMAIL_TO: 'a@example.de, b@example.de',
} as unknown as NodeJS.ProcessEnv

describe('readSmtpSettings', () => {
  it('returns null unless host, from and recipient are all set', () => {
    expect(readSmtpSettings({} as NodeJS.ProcessEnv)).toBeNull()
    expect(readSmtpSettings({ SMTP_HOST: 'h', SMTP_FROM: 'f' } as unknown as NodeJS.ProcessEnv)).toBeNull()
  })

  it('defaults to port 587, splits recipients and keeps credentials', () => {
    const settings = readSmtpSettings(smtpEnv)
    expect(settings).toEqual({
      host: 'smtp.example.de',
      port: 587,
      user: 'alerts@example.de',
      password: 'secret',
      from: 'Hochzeitsseite <alerts@example.de>',
      to: ['a@example.de', 'b@example.de'],
    })
  })
})

describe('sendAlert', () => {
  let db: ReturnType<typeof createDb>
  const sendMail = vi.fn()
  const createTransportMock = vi.fn(() => ({ sendMail }))
  const createTransport = createTransportMock as unknown as typeof nodemailer.createTransport
  let nowMs: number

  beforeEach(() => {
    db = createDb(':memory:')
    sendMail.mockReset().mockResolvedValue({})
    createTransportMock.mockClear()
    nowMs = Date.UTC(2026, 9, 17, 12, 0, 0)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    db.close()
    vi.restoreAllMocks()
  })

  const options = () => ({ db, now: () => nowMs, env: smtpEnv, createTransport })

  it('only logs when SMTP is not configured', async () => {
    const result = await sendAlert(
      { key: 'disk-full', subject: 'Platte voll', body: 'Details' },
      { db, now: () => nowMs, env: {} as NodeJS.ProcessEnv, createTransport }
    )
    expect(result).toBe('logged')
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Platte voll'))
    expect(createTransportMock).not.toHaveBeenCalled()
  })

  it('sends one mail to all recipients with a prefixed subject', async () => {
    const result = await sendAlert({ key: 'backup-failed', subject: 'Backup fehlgeschlagen', body: 'Details' }, options())

    expect(result).toBe('sent')
    expect(sendMail).toHaveBeenCalledWith({
      from: 'Hochzeitsseite <alerts@example.de>',
      to: 'a@example.de, b@example.de',
      subject: '[Hochzeitsseite] Backup fehlgeschlagen',
      text: 'Details',
    })
  })

  it('uses TLS settings and timeouts that cannot hang a request', async () => {
    await sendAlert({ key: 'k', subject: 's', body: 'b' }, options())
    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.example.de',
        port: 587,
        secure: false,
        requireTLS: true,
        connectionTimeout: 10_000,
        socketTimeout: 15_000,
      })
    )
  })

  it('suppresses a repeated alert inside the cool-down and allows it afterwards', async () => {
    const input = { key: 'disk-full', subject: 's', body: 'b' }
    expect(await sendAlert(input, options())).toBe('sent')

    nowMs += DEFAULT_COOLDOWN_MS - 1
    expect(await sendAlert(input, options())).toBe('suppressed')

    nowMs += 1
    expect(await sendAlert(input, options())).toBe('sent')
    expect(sendMail).toHaveBeenCalledTimes(2)
  })

  it('keeps the cool-down per key', async () => {
    await sendAlert({ key: 'a', subject: 's', body: 'b' }, options())
    expect(await sendAlert({ key: 'b', subject: 's', body: 'b' }, options())).toBe('sent')
  })

  it('honours a custom cool-down', async () => {
    const input = { key: 'app-started', subject: 's', body: 'b', cooldownMs: 15 * 60 * 1000 }
    await sendAlert(input, options())
    nowMs += 15 * 60 * 1000
    expect(await sendAlert(input, options())).toBe('sent')
  })

  it('swallows a send failure, logs it and does not start a cool-down', async () => {
    sendMail.mockRejectedValueOnce(new Error('connect ETIMEDOUT'))

    const result = await sendAlert({ key: 'k', subject: 's', body: 'b' }, options())

    expect(result).toBe('failed')
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('ETIMEDOUT'))
    expect(await sendAlert({ key: 'k', subject: 's', body: 'b' }, options())).toBe('sent')
  })
})
