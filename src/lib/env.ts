const REQUIRED_KEYS = [
  'ADMIN_PASSWORD',
  'GUEST_PASSWORD',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_BASE_URL',
] as const

// Nur für Buckets, die mit einer Jurisdiktion angelegt wurden (EU): der
// S3-Endpoint enthält sie, sonst findet die App den Bucket nicht.
export const R2_JURISDICTIONS = ['eu', 'fedramp'] as const

// Quelle der Client-IP für die Rate-Limiter (siehe client-ip.ts).
export const CLIENT_IP_HEADERS = ['x-forwarded-for', 'cf-connecting-ip'] as const

/** Das Gäste-Kennwort (Galerie, Gästebuch, Erinnerungen, Upload). */
export function getGuestPassword(
  source: Record<string, string | undefined> = process.env
): string | undefined {
  return source.GUEST_PASSWORD || undefined
}

export class InvalidEnvError extends Error {
  readonly variable: string

  constructor(variable: string, message: string) {
    super(message)
    this.name = 'InvalidEnvError'
    this.variable = variable
  }
}

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
  guestPassword: string
  r2AccountId: string
  r2AccessKeyId: string
  r2SecretAccessKey: string
  r2BucketName: string
  r2PublicBaseUrl: string
  r2Jurisdiction?: string
  /** Nur für lokale Tests: ein Ersatz-Server statt R2 (siehe README). */
  r2Endpoint?: string
  clientIpHeader?: string
}

export function validateEnv(
  source: Record<string, string | undefined> = process.env
): AppEnv {
  const missing = REQUIRED_KEYS.filter((key) =>
    key === 'GUEST_PASSWORD' ? !getGuestPassword(source) : !source[key]
  )
  if (missing.length > 0) {
    throw new MissingEnvError(missing)
  }
  const jurisdiction = source.R2_JURISDICTION?.trim().toLowerCase() || undefined
  if (jurisdiction && !(R2_JURISDICTIONS as readonly string[]).includes(jurisdiction)) {
    throw new InvalidEnvError(
      'R2_JURISDICTION',
      `Ungültiger Wert für R2_JURISDICTION: "${source.R2_JURISDICTION}" - erlaubt sind ${R2_JURISDICTIONS.join(', ')} oder leer.`
    )
  }
  const r2Endpoint = source.R2_ENDPOINT?.trim() || undefined
  if (r2Endpoint && !/^https?:\/\/[^\s/]+/i.test(r2Endpoint)) {
    throw new InvalidEnvError(
      'R2_ENDPOINT',
      `Ungültiger Wert für R2_ENDPOINT: "${source.R2_ENDPOINT}" - erwartet wird eine http(s)-Adresse oder leer.`
    )
  }
  const clientIpHeader = source.CLIENT_IP_HEADER?.trim().toLowerCase() || undefined
  if (clientIpHeader && !(CLIENT_IP_HEADERS as readonly string[]).includes(clientIpHeader)) {
    throw new InvalidEnvError(
      'CLIENT_IP_HEADER',
      `Ungültiger Wert für CLIENT_IP_HEADER: "${source.CLIENT_IP_HEADER}" - erlaubt sind ${CLIENT_IP_HEADERS.join(', ')} oder leer.`
    )
  }
  return {
    adminPassword: source.ADMIN_PASSWORD as string,
    guestPassword: getGuestPassword(source) as string,
    r2AccountId: source.R2_ACCOUNT_ID as string,
    r2AccessKeyId: source.R2_ACCESS_KEY_ID as string,
    r2SecretAccessKey: source.R2_SECRET_ACCESS_KEY as string,
    r2BucketName: source.R2_BUCKET_NAME as string,
    r2PublicBaseUrl: source.R2_PUBLIC_BASE_URL as string,
    r2Jurisdiction: jurisdiction,
    r2Endpoint,
    clientIpHeader,
  }
}
