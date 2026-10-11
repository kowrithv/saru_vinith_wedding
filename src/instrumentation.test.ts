import { afterEach, describe, expect, it, vi } from 'vitest'
import { register } from './instrumentation'

describe('register', () => {
  const originalAdminPassword = process.env.ADMIN_PASSWORD
  const originalUploadPassword = process.env.UPLOAD_PASSWORD_EMPFANG

  afterEach(() => {
    process.env.ADMIN_PASSWORD = originalAdminPassword
    process.env.UPLOAD_PASSWORD_EMPFANG = originalUploadPassword
    vi.restoreAllMocks()
  })

  it('does not exit when required env vars are present', () => {
    process.env.ADMIN_PASSWORD = 'secret'
    process.env.UPLOAD_PASSWORD_EMPFANG = 'empfang-secret'
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit should not be called')
    })
    expect(() => register()).not.toThrow()
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('logs a German error and exits with code 1 when ADMIN_PASSWORD is missing', () => {
    delete process.env.ADMIN_PASSWORD
    process.env.UPLOAD_PASSWORD_EMPFANG = 'empfang-secret'
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
    process.env.ADMIN_PASSWORD = 'secret'
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
})
