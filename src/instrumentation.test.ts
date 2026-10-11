import { afterEach, describe, expect, it, vi } from 'vitest'
import { register } from './instrumentation'

describe('register', () => {
  const originalAdminPassword = process.env.ADMIN_PASSWORD

  afterEach(() => {
    process.env.ADMIN_PASSWORD = originalAdminPassword
    vi.restoreAllMocks()
  })

  it('does not exit when required env vars are present', () => {
    process.env.ADMIN_PASSWORD = 'secret'
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit should not be called')
    })
    expect(() => register()).not.toThrow()
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('logs a German error and exits with code 1 when a var is missing', () => {
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
})
