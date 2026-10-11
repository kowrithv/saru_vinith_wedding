const REQUIRED_KEYS = ['ADMIN_PASSWORD', 'UPLOAD_PASSWORD_EMPFANG'] as const

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
  }
}
