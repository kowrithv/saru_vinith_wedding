const REQUIRED_KEYS = [
  'ADMIN_PASSWORD',
  'UPLOAD_PASSWORD_EMPFANG',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_BASE_URL',
] as const

export class MissingEnvError extends Error {
  readonly missing: string[]

  constructor(missing: string[]) {
    super(`Fehlende Pflicht-Umgebungsvariablen: ${missing.join(', ')}`)
    this.name = 'MissingEnvError'
    this.missing = missing
  }
}

export interface AppEnv {
  adminPassword: string
  uploadPasswordEmpfang: string
  r2AccountId: string
  r2AccessKeyId: string
  r2SecretAccessKey: string
  r2BucketName: string
  r2PublicBaseUrl: string
}

export function validateEnv(
  source: Record<string, string | undefined> = process.env
): AppEnv {
  const missing = REQUIRED_KEYS.filter((key) => !source[key])
  if (missing.length > 0) {
    throw new MissingEnvError(missing)
  }
  return {
    adminPassword: source.ADMIN_PASSWORD as string,
    uploadPasswordEmpfang: source.UPLOAD_PASSWORD_EMPFANG as string,
    r2AccountId: source.R2_ACCOUNT_ID as string,
    r2AccessKeyId: source.R2_ACCESS_KEY_ID as string,
    r2SecretAccessKey: source.R2_SECRET_ACCESS_KEY as string,
    r2BucketName: source.R2_BUCKET_NAME as string,
    r2PublicBaseUrl: source.R2_PUBLIC_BASE_URL as string,
  }
}
