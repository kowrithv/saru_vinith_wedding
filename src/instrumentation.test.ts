import { afterEach, describe, expect, it, vi } from 'vitest'
import { register } from './instrumentation'

const ENV_KEYS = [
  'ADMIN_PASSWORD',
  'UPLOAD_PASSWORD_EMPFANG',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_BASE_URL',
] as const

describe('register', () => {
  const originalValues = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalValues[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = originalValues[key]
      }
    }
    vi.restoreAllMocks()
  })

  it('does not exit when required env vars are present', () => {
    for (const key of ENV_KEYS) {
      process.env[key] = 'test-value'
    }
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit should not be called')
    })
    expect(() => register()).not.toThrow()
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('logs a German error and exits with code 1 when ADMIN_PASSWORD is missing', () => {
    for (const key of ENV_KEYS) {
      process.env[key] = 'test-value'
    }
    delete process.env.ADMIN_PASSWORD
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never)

    register()

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Fehlende Pflicht-Umgebungsvariablen')
    )
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('logs a German error and exits with code 1 when UPLOAD_PASSWORD_EMPFANG is missing', () => {
    for (const key of ENV_KEYS) {
      process.env[key] = 'test-value'
    }
    delete process.env.UPLOAD_PASSWORD_EMPFANG
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never)

    register()

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Fehlende Pflicht-Umgebungsvariablen')
    )
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('logs a German error and exits with code 1 when an R2 variable is missing', () => {
    for (const key of ENV_KEYS) {
      process.env[key] = 'test-value'
    }
    delete process.env.R2_BUCKET_NAME
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never)

    register()

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('R2_BUCKET_NAME'))
    expect(exitSpy).toHaveBeenCalledWith(1)
  })
})
