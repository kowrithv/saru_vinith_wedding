import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GalleryPage from './page'

function mockFetchSequence(responses: { status?: number; body: unknown }[]) {
  const fn = vi.fn()
  responses.forEach(({ status = 200, body }) => {
    fn.mockResolvedValueOnce({ ok: status < 400, status, json: async () => body })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

const samplePhoto = {
  id: 'p1',
  uploaderName: 'Anna',
  category: 'Hochzeit',
  isOfficial: false,
  createdAt: '2026-10-12T10:00:00.000Z',
  thumbUrl: 'https://fotos.example.de/p1/thumb.jpg',
  originalUrl: 'https://fotos.example.de/p1/original.jpg',
}

describe('GalleryPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the gallery grid directly when the gallery is public', async () => {
    mockFetchSequence([{ body: { mode: 'public', unlocked: true, photos: [samplePhoto] } }])
    render(<GalleryPage />)
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1))
  })

  it('shows the password form when the gallery is locked', async () => {
    mockFetchSequence([{ body: { mode: 'password', unlocked: false, photos: null } }])
    render(<GalleryPage />)
    await waitFor(() => expect(screen.getByLabelText(/kennwort/i)).toBeInTheDocument())
  })

  it('shows the gallery after a successful unlock', async () => {
    const fetchMock = mockFetchSequence([
      { body: { mode: 'password', unlocked: false, photos: null } },
      { body: { success: true } },
      { body: { mode: 'password', unlocked: true, photos: [samplePhoto] } },
    ])
    render(<GalleryPage />)
    await waitFor(() => expect(screen.getByLabelText(/kennwort/i)).toBeInTheDocument())

    await userEvent.type(screen.getByLabelText(/kennwort/i), 'empfang-secret')
    await userEvent.click(screen.getByRole('button', { name: /galerie ansehen/i }))

    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1))
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('shows an error and stays locked when the password is wrong', async () => {
    mockFetchSequence([
      { body: { mode: 'password', unlocked: false, photos: null } },
      { status: 401, body: { error: 'Falsches Kennwort.' } },
    ])
    render(<GalleryPage />)
    await waitFor(() => expect(screen.getByLabelText(/kennwort/i)).toBeInTheDocument())

    await userEvent.type(screen.getByLabelText(/kennwort/i), 'falsch')
    await userEvent.click(screen.getByRole('button', { name: /galerie ansehen/i }))

    await waitFor(() => expect(screen.getByText('Falsches Kennwort.')).toBeInTheDocument())
    expect(screen.getByLabelText(/kennwort/i)).toBeInTheDocument()
  })

  it('carries its own top offset below the fixed navigation', async () => {
    mockFetchSequence([{ body: { mode: 'public', unlocked: true, photos: [] } }])
    const { container } = render(<GalleryPage />)
    await waitFor(() => expect(container.firstChild).toHaveClass('pt-24'))
  })
})
