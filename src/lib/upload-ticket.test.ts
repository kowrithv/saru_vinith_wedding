import { describe, expect, it } from 'vitest'
import { signUploadTicket, verifyUploadTicket, type TicketPayload } from './upload-ticket'

const samplePayload: TicketPayload = {
  photoId: 'abc-123',
  thumbKey: 'gallery/abc-123/thumb.jpg',
  originalKey: 'gallery/abc-123/original.jpg',
  thumbMaxSize: 2 * 1024 * 1024,
  originalSize: 4_000_000,
  expiresAt: Date.now() + 15 * 60 * 1000,
  category: 'Standesamt',
  isOfficial: false,
}

describe('upload ticket signing', () => {
  it('round-trips a valid ticket, including category and isOfficial', () => {
    const ticket = signUploadTicket(samplePayload, 'secret')
    expect(verifyUploadTicket(ticket, 'secret')).toEqual(samplePayload)
  })

  it('round-trips an official ticket', () => {
    const officialPayload: TicketPayload = { ...samplePayload, category: 'Verlobung', isOfficial: true }
    const ticket = signUploadTicket(officialPayload, 'secret')
    expect(verifyUploadTicket(ticket, 'secret')).toEqual(officialPayload)
  })

  it('rejects a ticket signed with a different secret', () => {
    const ticket = signUploadTicket(samplePayload, 'secret')
    expect(verifyUploadTicket(ticket, 'other-secret')).toBeNull()
  })

  it('rejects a ticket whose payload was altered after signing', () => {
    const ticket = signUploadTicket(samplePayload, 'secret')
    const signature = ticket.slice(ticket.indexOf('.') + 1)
    const tamperedPayload: TicketPayload = { ...samplePayload, isOfficial: true }
    const tamperedEncoded = Buffer.from(JSON.stringify(tamperedPayload), 'utf8').toString('base64url')

    expect(verifyUploadTicket(`${tamperedEncoded}.${signature}`, 'secret')).toBeNull()
  })

  it('rejects an expired ticket', () => {
    const expired: TicketPayload = { ...samplePayload, expiresAt: Date.now() - 1000 }
    const ticket = signUploadTicket(expired, 'secret')
    expect(verifyUploadTicket(ticket, 'secret')).toBeNull()
  })

  it('rejects a malformed ticket string', () => {
    expect(verifyUploadTicket('not-a-real-ticket', 'secret')).toBeNull()
  })
})
