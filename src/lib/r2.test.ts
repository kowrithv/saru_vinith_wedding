import { beforeEach, describe, expect, it, vi } from 'vitest'
import { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createPresignedPutUrl, headObject, deleteObjects } from './r2'

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(),
  PutObjectCommand: vi.fn(function (input: unknown) {
    return { input }
  }),
  HeadObjectCommand: vi.fn(function (input: unknown) {
    return { input }
  }),
  DeleteObjectsCommand: vi.fn(function (input: unknown) {
    return { input }
  }),
}))
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(),
}))

const mockSend = vi.fn()

beforeEach(() => {
  process.env.R2_ACCOUNT_ID = 'test-account'
  process.env.R2_ACCESS_KEY_ID = 'test-key'
  process.env.R2_SECRET_ACCESS_KEY = 'test-secret'
  process.env.R2_BUCKET_NAME = 'test-bucket'
  vi.mocked(S3Client).mockImplementation(function () {
    return { send: mockSend } as unknown as S3Client
  })
  mockSend.mockReset()
  vi.mocked(getSignedUrl).mockReset()
})

describe('S3 client configuration', () => {
  it('disables automatic request checksums (R2 does not support the AWS SDK v3 default CRC32 header)', async () => {
    vi.mocked(getSignedUrl).mockResolvedValue('https://r2.example/signed-put')
    await createPresignedPutUrl('gallery/abc/original.jpg', 'image/jpeg', 12345)

    expect(S3Client).toHaveBeenCalledWith(
      expect.objectContaining({ requestChecksumCalculation: 'WHEN_REQUIRED' })
    )
  })
})

describe('createPresignedPutUrl', () => {
  it('signs a PUT command with the given key, content type and length', async () => {
    vi.mocked(getSignedUrl).mockResolvedValue('https://r2.example/signed-put')

    const url = await createPresignedPutUrl('gallery/abc/original.jpg', 'image/jpeg', 12345)

    expect(url).toBe('https://r2.example/signed-put')
    expect(PutObjectCommand).toHaveBeenCalledWith({
      Bucket: 'test-bucket',
      Key: 'gallery/abc/original.jpg',
      ContentType: 'image/jpeg',
      ContentLength: 12345,
    })
  })

  it('omits ContentLength when none is given (thumbnail: size unknown until the browser compresses it)', async () => {
    vi.mocked(getSignedUrl).mockResolvedValue('https://r2.example/signed-put')

    await createPresignedPutUrl('gallery/abc/thumb.jpg', 'image/jpeg')

    expect(PutObjectCommand).toHaveBeenCalledWith({
      Bucket: 'test-bucket',
      Key: 'gallery/abc/thumb.jpg',
      ContentType: 'image/jpeg',
    })
  })
})

describe('headObject', () => {
  it('returns the object size when it exists', async () => {
    mockSend.mockResolvedValue({ ContentLength: 999 })

    const result = await headObject('gallery/abc/original.jpg')

    expect(result).toEqual({ size: 999 })
    expect(HeadObjectCommand).toHaveBeenCalledWith({
      Bucket: 'test-bucket',
      Key: 'gallery/abc/original.jpg',
    })
  })

  it('returns null when the object does not exist', async () => {
    mockSend.mockRejectedValue(new Error('NotFound'))

    const result = await headObject('gallery/missing/original.jpg')

    expect(result).toBeNull()
  })
})

describe('deleteObjects', () => {
  it('deletes all given keys in one request', async () => {
    mockSend.mockResolvedValue({})

    await deleteObjects(['gallery/abc/thumb.jpg', 'gallery/abc/original.jpg'])

    expect(DeleteObjectsCommand).toHaveBeenCalledWith({
      Bucket: 'test-bucket',
      Delete: { Objects: [{ Key: 'gallery/abc/thumb.jpg' }, { Key: 'gallery/abc/original.jpg' }] },
    })
  })

  it('does nothing when given an empty list', async () => {
    await deleteObjects([])
    expect(mockSend).not.toHaveBeenCalled()
  })
})
