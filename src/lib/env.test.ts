import { describe, expect, it } from 'vitest'
import { MissingEnvError, validateEnv } from './env'

describe('validateEnv', () => {
  it('returns the parsed env when both required variables are set', () => {
    const result = validateEnv({
      ADMIN_PASSWORD: 'secret',
      UPLOAD_PASSWORD_EMPFANG: 'empfang-secret',
    })
    expect(result.adminPassword).toBe('secret')
    expect(result.uploadPasswordEmpfang).toBe('empfang-secret')
  })

  it('throws MissingEnvError listing every missing key', () => {
    expect(() => validateEnv({})).toThrowError(MissingEnvError)
    try {
      validateEnv({})
    } catch (error) {
      expect(error).toBeInstanceOf(MissingEnvError)
      expect((error as MissingEnvError).missing).toEqual([
        'ADMIN_PASSWORD',
        'UPLOAD_PASSWORD_EMPFANG',
      ])
    }
  })

  it('requires UPLOAD_PASSWORD_EMPFANG even when ADMIN_PASSWORD is set', () => {
    expect(() => validateEnv({ ADMIN_PASSWORD: 'secret' })).toThrow(
      /UPLOAD_PASSWORD_EMPFANG/
    )
  })

  it('requires ADMIN_PASSWORD even when UPLOAD_PASSWORD_EMPFANG is set', () => {
    expect(() => validateEnv({ UPLOAD_PASSWORD_EMPFANG: 'empfang-secret' })).toThrow(
      /ADMIN_PASSWORD/
    )
  })
})
