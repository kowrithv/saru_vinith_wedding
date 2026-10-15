import { createHmac, timingSafeEqual } from 'node:crypto'

export interface TicketPayload {
  photoId: string
  thumbKey: string
  originalKey: string
  thumbMaxSize: number
  originalSize: number
  expiresAt: number
  category: string
  isOfficial: boolean
}

export function signUploadTicket(payload: TicketPayload, secret: string): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const signature = createHmac('sha256', secret).update(encoded).digest('hex')
  return `${encoded}.${signature}`
}

export function verifyUploadTicket(
  ticket: string,
  secret: string,
  now: number = Date.now()
): TicketPayload | null {
  const separatorIndex = ticket.indexOf('.')
  if (separatorIndex === -1) return null

  const encoded = ticket.slice(0, separatorIndex)
  const signature = ticket.slice(separatorIndex + 1)

  // Format strikt prüfen: Buffer.from(x, 'hex') schneidet ab dem ersten
  // Nicht-Hex-Zeichen ab und ließe Anhänge hinter der Signatur durch.
  if (!/^[0-9a-f]{64}$/.test(signature)) return null

  const expectedSignature = createHmac('sha256', secret).update(encoded).digest('hex')
  const expectedBuffer = Buffer.from(expectedSignature, 'hex')
  const actualBuffer = Buffer.from(signature, 'hex')
  if (expectedBuffer.length !== actualBuffer.length) return null
  if (!timingSafeEqual(expectedBuffer, actualBuffer)) return null

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TicketPayload
    if (payload.expiresAt <= now) return null
    return payload
  } catch {
    return null
  }
}
