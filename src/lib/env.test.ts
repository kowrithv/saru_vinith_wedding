import { describe, expect, it } from 'vitest'
import { MissingEnvError, validateEnv } from './env'

const allSet = {
  ADMIN_PASSWORD: 'secret',
  UPLOAD_PASSWORD_EMPFANG: 'empfang-secret',
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
      uploadPasswordEmpfang: 'empfang-secret',
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
        'UPLOAD_PASSWORD_EMPFANG',
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

  it('still requires ADMIN_PASSWORD and UPLOAD_PASSWORD_EMPFANG', () => {
    expect(() => validateEnv({ ...allSet, ADMIN_PASSWORD: undefined })).toThrow(/ADMIN_PASSWORD/)
    expect(() => validateEnv({ ...allSet, UPLOAD_PASSWORD_EMPFANG: undefined })).toThrow(/UPLOAD_PASSWORD_EMPFANG/)
  })
})
