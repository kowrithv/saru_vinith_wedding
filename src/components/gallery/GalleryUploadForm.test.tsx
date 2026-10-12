import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GalleryUploadForm from './GalleryUploadForm'
import { getDeleteToken } from '@/lib/gallery-delete-tokens'

vi.mock('@/lib/gallery-thumbnail', () => ({
  createThumbnailBlob: vi.fn().mockResolvedValue(new Blob(['thumb'])),
}))

function makeFile(name = 'photo.jpg', type = 'image/jpeg'): File {
  return new File(['x'.repeat(100)], name, { type })
}

describe('GalleryUploadForm', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    window.localStorage.clear()
  })

  it('shows a password field for a guest, but not for an admin', () => {
    const { rerender } = render(<GalleryUploadForm onUploaded={vi.fn()} />)
    expect(screen.getByLabelText(/kennwort/i)).toBeInTheDocument()

    rerender(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)
    expect(screen.queryByLabelText(/kennwort/i)).not.toBeInTheDocument()
  })

  it('requires a name before submitting', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)

    await userEvent.upload(screen.getByLabelText(/fotos ausw/i), makeFile())
    await userEvent.click(screen.getByRole('button', { name: /hochladen/i }))

    expect(screen.getByText(/bitte gib deinen namen ein/i)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('requires a password for a guest upload', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<GalleryUploadForm onUploaded={vi.fn()} />)

    await userEvent.type(screen.getByLabelText(/dein name/i), 'Anna')
    await userEvent.upload(screen.getByLabelText(/fotos ausw/i), makeFile())
    await userEvent.click(screen.getByRole('button', { name: /hochladen/i }))

    expect(screen.getByText(/bitte gib das kennwort vom empfang ein/i)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uploads a file end to end for a guest, saves the delete token before onUploaded, and reports the new photo', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/uploads/request') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            tickets: [
              {
                photoId: 'p1',
                thumbPutUrl: 'https://r2.example/thumb',
                originalPutUrl: 'https://r2.example/original',
                ticket: 'signed-ticket',
              },
            ],
          }),
        })
      }
      if (url === 'https://r2.example/thumb' || url === 'https://r2.example/original') {
        return Promise.resolve({ ok: true })
      }
      if (url === '/api/uploads/complete') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            photo: {
              id: 'p1',
              uploaderName: 'Anna',
              category: 'Kennenlernen',
              isOfficial: false,
              createdAt: '2026-10-12T10:00:00.000Z',
              thumbUrl: 'https://fotos.example.de/p1/thumb.jpg',
              originalUrl: 'https://fotos.example.de/p1/original.jpg',
            },
            deleteToken: 'guest-delete-token',
          }),
        })
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`))
    })
    vi.stubGlobal('fetch', fetchMock)
    const onUploaded = vi.fn((photo: { id: string }) => {
      expect(getDeleteToken(photo.id)).toBe('guest-delete-token')
    })

    render(<GalleryUploadForm onUploaded={onUploaded} />)
    await userEvent.type(screen.getByLabelText(/dein name/i), 'Anna')
    await userEvent.type(screen.getByLabelText(/kennwort/i), 'empfang-secret')
    await userEvent.upload(screen.getByLabelText(/fotos ausw/i), makeFile())
    await userEvent.click(screen.getByRole('button', { name: /hochladen/i }))

    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' })))
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/uploads/request',
      expect.objectContaining({
        body: JSON.stringify({
          password: 'empfang-secret',
          category: 'Kennenlernen',
          files: [{ filename: 'photo.jpg', size: 100, contentType: 'image/jpeg' }],
        }),
      })
    )
  })

  it('uploads without a password field when used as an admin', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/uploads/request') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            tickets: [
              {
                photoId: 'p1',
                thumbPutUrl: 'https://r2.example/thumb',
                originalPutUrl: 'https://r2.example/original',
                ticket: 'signed-ticket',
              },
            ],
          }),
        })
      }
      if (url === '/api/uploads/complete') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            photo: {
              id: 'p1',
              uploaderName: 'Saruga',
              category: 'Kennenlernen',
              isOfficial: true,
              createdAt: '2026-10-12T10:00:00.000Z',
              thumbUrl: 'https://fotos.example.de/p1/thumb.jpg',
              originalUrl: 'https://fotos.example.de/p1/original.jpg',
            },
            deleteToken: 'admin-delete-token',
          }),
        })
      }
      return Promise.resolve({ ok: true })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<GalleryUploadForm isAdmin onUploaded={vi.fn()} />)
    await userEvent.type(screen.getByLabelText(/dein name/i), 'Saruga')
    await userEvent.upload(screen.getByLabelText(/fotos ausw/i), makeFile())
    await userEvent.click(screen.getByRole('button', { name: /hochladen/i }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/uploads/request',
        expect.objectContaining({
          body: JSON.stringify({
            category: 'Kennenlernen',
            files: [{ filename: 'photo.jpg', size: 100, contentType: 'image/jpeg' }],
          }),
        })
      )
    )
  })

  it('marks only the failing file as an error in a multi-file batch, not the others', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/uploads/request') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            tickets: [
              {
                photoId: 'p1',
                thumbPutUrl: 'https://r2.example/thumb1',
                originalPutUrl: 'https://r2.example/original1',
                ticket: 'ticket-1',
              },
              {
                photoId: 'p2',
                thumbPutUrl: 'https://r2.example/thumb2',
                originalPutUrl: 'https://r2.example/original2',
                ticket: 'ticket-2',
              },
            ],
          }),
        })
      }
      if (url === '/api/uploads/complete') {
        const body = JSON.parse(options?.body as string) as { ticket: string }
        if (body.ticket === 'ticket-2') {
          return Promise.resolve({ ok: false, json: async () => ({ error: 'Fehler' }) })
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            photo: {
              id: 'p1',
              uploaderName: 'Anna',
              category: 'Kennenlernen',
              isOfficial: false,
              createdAt: '2026-10-12T10:00:00.000Z',
              thumbUrl: 'https://fotos.example.de/p1/thumb.jpg',
              originalUrl: 'https://fotos.example.de/p1/original.jpg',
            },
            deleteToken: 'token-1',
          }),
        })
      }
      return Promise.resolve({ ok: true })
    })
    vi.stubGlobal('fetch', fetchMock)
    const onUploaded = vi.fn()

    render(<GalleryUploadForm isAdmin onUploaded={onUploaded} />)
    await userEvent.type(screen.getByLabelText(/dein name/i), 'Anna')
    await userEvent.upload(screen.getByLabelText(/fotos ausw/i), [makeFile('a.jpg'), makeFile('b.jpg')])
    await userEvent.click(screen.getByRole('button', { name: /hochladen/i }))

    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1))
    expect(onUploaded).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }))
    expect(screen.getAllByText(/hochladen fehlgeschlagen/i)).toHaveLength(1)
  })
})
