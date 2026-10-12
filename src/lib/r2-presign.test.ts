// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import { createPresignedPutUrl } from './r2'

// Bewusst ohne Mocks: Presigning ist eine rein lokale Signatur-Berechnung
// (kein Netzwerk). Nur so lässt sich prüfen, welche Header tatsächlich in
// der Signatur stecken - ein gemocktes getSignedUrl würde das verdecken.
beforeEach(() => {
  process.env.R2_ACCOUNT_ID = 'test-account'
  process.env.R2_ACCESS_KEY_ID = 'AKIATESTEXAMPLE'
  process.env.R2_SECRET_ACCESS_KEY = 'test-secret'
  process.env.R2_BUCKET_NAME = 'test-bucket'
})

function signedHeaders(url: string): string[] {
  const value = new URL(url).searchParams.get('X-Amz-SignedHeaders')
  return (value ?? '').split(';')
}

describe('createPresignedPutUrl signature', () => {
  it('signs the content type, so the uploader cannot store a different type than the validated one', async () => {
    const url = await createPresignedPutUrl('gallery/p1/original.jpg', 'image/jpeg', 1234)
    expect(signedHeaders(url)).toContain('content-type')
  })

  it('signs the exact content length of the original', async () => {
    const url = await createPresignedPutUrl('gallery/p1/original.jpg', 'image/jpeg', 1234)
    expect(signedHeaders(url)).toContain('content-length')
  })

  it('signs the content type of a thumbnail whose size is not known yet', async () => {
    const url = await createPresignedPutUrl('gallery/p1/thumb.jpg', 'image/jpeg')
    expect(signedHeaders(url)).toContain('content-type')
    expect(signedHeaders(url)).not.toContain('content-length')
  })
})
