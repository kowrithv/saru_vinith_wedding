import { createHmac, timingSafeEqual } from 'node:crypto'

export interface TicketPayload {
  photoId: string
  thumbKey: string
  originalKey: string
  thumbMaxSize: number
  originalSize: number
  expiresAt: number
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

  const expectedSignature = createHmac('sha256', secret).update(encoded).digest('hex')
  const expectedBuffer = Buffer.from(expectedSignature, 'hex')
  let actualBuffer: Buffer
  try {
    actualBuffer = Buffer.from(signature, 'hex')
  } catch {
    return null
  }
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
