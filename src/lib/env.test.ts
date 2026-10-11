import { describe, expect, it } from 'vitest'
import { MissingEnvError, validateEnv } from './env'

describe('validateEnv', () => {
  it('returns the parsed env when ADMIN_PASSWORD is set', () => {
    const result = validateEnv({ ADMIN_PASSWORD: 'secret' })
    expect(result.adminPassword).toBe('secret')
  })

  it('throws MissingEnvError listing every missing key', () => {
    expect(() => validateEnv({})).toThrowError(MissingEnvError)
    try {
      validateEnv({})
    } catch (error) {
      expect(error).toBeInstanceOf(MissingEnvError)
      expect((error as MissingEnvError).missing).toEqual(['ADMIN_PASSWORD'])
    }
  })
})
