import { describe, expect, it } from 'vitest'
import { InvalidEnvError, MissingEnvError, getScorePassword, validateEnv } from './env'

const allSet = {
  ADMIN_PASSWORD: 'secret',
  GUEST_PASSWORD: 'empfang-secret',
  R2_ACCOUNT_ID: 'acc',
  R2_ACCESS_KEY_ID: 'key',
  R2_SECRET_ACCESS_KEY: 'secretkey',
  R2_BUCKET_NAME: 'bucket',
  R2_PUBLIC_BASE_URL: 'https://fotos.example.de',
}

describe('validateEnv', () => {
  it('returns the parsed env when every required variable is set', () => {
    expect(validateEnv(allSet)).toEqual({
      adminPassword: 'secret',
      guestPassword: 'empfang-secret',
      r2AccountId: 'acc',
      r2AccessKeyId: 'key',
      r2SecretAccessKey: 'secretkey',
      r2BucketName: 'bucket',
      r2PublicBaseUrl: 'https://fotos.example.de',
    })
  })

  it('throws MissingEnvError listing every missing key', () => {
    expect(() => validateEnv({})).toThrowError(MissingEnvError)
    try {
      validateEnv({})
    } catch (error) {
      expect(error).toBeInstanceOf(MissingEnvError)
      expect((error as MissingEnvError).missing).toEqual([
        'ADMIN_PASSWORD',
        'GUEST_PASSWORD',
        'R2_ACCOUNT_ID',
        'R2_ACCESS_KEY_ID',
        'R2_SECRET_ACCESS_KEY',
        'R2_BUCKET_NAME',
        'R2_PUBLIC_BASE_URL',
      ])
    }
  })

  it('requires each R2 variable individually', () => {
    for (const key of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_PUBLIC_BASE_URL']) {
      const partial = { ...allSet, [key]: undefined }
      expect(() => validateEnv(partial)).toThrow(new RegExp(key))
    }
  })

  it('still requires ADMIN_PASSWORD and GUEST_PASSWORD', () => {
    expect(() => validateEnv({ ...allSet, ADMIN_PASSWORD: undefined })).toThrow(/ADMIN_PASSWORD/)
    expect(() => validateEnv({ ...allSet, GUEST_PASSWORD: undefined })).toThrow(/GUEST_PASSWORD/)
  })

  // Der frühere Name UPLOAD_PASSWORD_EMPFANG gilt nicht mehr: ein vergessenes
  // Umbenennen soll beim Start auffallen, nicht stillschweigend weiterlaufen.
  it('no longer reads the former name UPLOAD_PASSWORD_EMPFANG', () => {
    const { GUEST_PASSWORD: _unused, ...withoutNew } = allSet
    void _unused
    const legacy = { ...withoutNew, UPLOAD_PASSWORD_EMPFANG: 'altes-kennwort' }

    expect(() => validateEnv(legacy)).toThrowError(MissingEnvError)
    expect(() => validateEnv(legacy)).toThrow(/GUEST_PASSWORD/)
  })

  it('ignores the former name even when GUEST_PASSWORD is set', () => {
    const both = { ...allSet, GUEST_PASSWORD: 'neu', UPLOAD_PASSWORD_EMPFANG: 'alt' }
    expect(validateEnv(both).guestPassword).toBe('neu')
  })

  it('treats an empty GUEST_PASSWORD as unset', () => {
    expect(() => validateEnv({ ...allSet, GUEST_PASSWORD: '' })).toThrow(/GUEST_PASSWORD/)
  })

  it('exposes an optional R2 jurisdiction, normalised to lower case', () => {
    expect(validateEnv({ ...allSet, R2_JURISDICTION: ' EU ' }).r2Jurisdiction).toBe('eu')
  })

  it('leaves the R2 jurisdiction undefined when it is not set or empty', () => {
    expect(validateEnv(allSet).r2Jurisdiction).toBeUndefined()
    expect(validateEnv({ ...allSet, R2_JURISDICTION: '' }).r2Jurisdiction).toBeUndefined()
  })

  it('rejects an unknown jurisdiction at startup instead of failing uploads at the party', () => {
    expect(() => validateEnv({ ...allSet, R2_JURISDICTION: 'germany' })).toThrowError(InvalidEnvError)
    expect(() => validateEnv({ ...allSet, R2_JURISDICTION: 'germany' })).toThrowError(/R2_JURISDICTION/)
  })

  it('accepts an http(s) URL as R2_ENDPOINT and leaves it out otherwise', () => {
    expect(validateEnv({ ...allSet, R2_ENDPOINT: 'http://127.0.0.1:3199' }).r2Endpoint).toBe('http://127.0.0.1:3199')
    expect(validateEnv({ ...allSet, R2_ENDPOINT: '' }).r2Endpoint).toBeUndefined()
    expect(validateEnv(allSet).r2Endpoint).toBeUndefined()
  })

  it('rejects an R2_ENDPOINT that is not an http(s) URL', () => {
    expect(() => validateEnv({ ...allSet, R2_ENDPOINT: 'localhost:3199' })).toThrowError(InvalidEnvError)
    expect(() => validateEnv({ ...allSet, R2_ENDPOINT: 'ftp://example.org' })).toThrowError(/R2_ENDPOINT/)
  })

  it('accepts the supported client IP headers and normalises them', () => {
    expect(validateEnv({ ...allSet, CLIENT_IP_HEADER: ' CF-Connecting-IP ' }).clientIpHeader).toBe('cf-connecting-ip')
    expect(validateEnv({ ...allSet, CLIENT_IP_HEADER: 'x-forwarded-for' }).clientIpHeader).toBe('x-forwarded-for')
    expect(validateEnv(allSet).clientIpHeader).toBeUndefined()
  })

  it('rejects an unknown client IP header at startup', () => {
    expect(() => validateEnv({ ...allSet, CLIENT_IP_HEADER: 'x-real-ip' })).toThrowError(InvalidEnvError)
    expect(() => validateEnv({ ...allSet, CLIENT_IP_HEADER: 'x-real-ip' })).toThrowError(/CLIENT_IP_HEADER/)
  })
})

describe('getScorePassword', () => {
  it('is undefined when the variable is missing, empty or only spaces', () => {
    expect(getScorePassword({})).toBeUndefined()
    expect(getScorePassword({ SCORE_PASSWORD: '' })).toBeUndefined()
    expect(getScorePassword({ SCORE_PASSWORD: '   ' })).toBeUndefined()
  })

  it('returns the trimmed password', () => {
    expect(getScorePassword({ SCORE_PASSWORD: ' Torte ' })).toBe('Torte')
  })

  it('is not required to start the app', () => {
    expect(() => validateEnv(allSet)).not.toThrow()
  })
})
