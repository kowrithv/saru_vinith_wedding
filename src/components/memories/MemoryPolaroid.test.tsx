import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MemoryPolaroid from './MemoryPolaroid'
import { createPolaroidBlob } from '@/lib/polaroid-image'

vi.mock('@/lib/polaroid-image', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/polaroid-image')>()),
  createPolaroidBlob: vi.fn(),
}))

const photo = {
  thumbUrl: 'https://fotos.example.de/gallery/p1/thumb.jpg',
  originalUrl: 'https://fotos.example.de/gallery/p1/original.jpg',
}

describe('MemoryPolaroid', () => {
  beforeEach(() => {
    vi.mocked(createPolaroidBlob).mockReset()
    URL.createObjectURL = vi.fn(() => 'blob:polaroid')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the photo, opening the original', () => {
    render(<MemoryPolaroid guestName="Lena" photo={photo} />)

    const image = screen.getByAltText('Foto von Lena')
    expect(image).toHaveAttribute('src', photo.thumbUrl)
    expect(image.closest('a')).toHaveAttribute('href', photo.originalUrl)
  })

  // Aufbau nach dem Beispiel von Vinith: Anlass, Namen, Datum, Zierlinie.
  it('writes the occasion, the names of the couple and the date below the photo', () => {
    render(<MemoryPolaroid guestName="Lena" photo={photo} />)

    expect(screen.getByText('Standesamtliche Hochzeit')).toBeInTheDocument()
    expect(screen.getByText('Saruga & Vinith')).toHaveClass('font-script')
    expect(screen.getByText('17.10.2026')).toBeInTheDocument()
    expect(screen.getByTestId('polaroid-heart')).toBeInTheDocument()
  })

  it('has no bordeaux banner and no flowers, like the example', () => {
    const { container } = render(<MemoryPolaroid guestName="Lena" photo={photo} />)
    expect(container.querySelector('.bg-bordeaux')).toBeNull()
    expect(container.querySelector('figure svg:not([data-testid="polaroid-heart"])')).toBeNull()
  })

  it('names the guest in a small line', () => {
    render(<MemoryPolaroid guestName="Lena" photo={photo} />)
    expect(screen.getByText('Erinnerung von Lena')).toBeInTheDocument()
  })

  it('says that the photo is also in the gallery', () => {
    render(<MemoryPolaroid guestName="Lena" photo={photo} />)
    expect(screen.getByText(/auch in der galerie/i)).toBeInTheDocument()
  })

  it('saves the finished polaroid as an image file', async () => {
    vi.mocked(createPolaroidBlob).mockResolvedValue(new Blob(['png'], { type: 'image/png' }))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<MemoryPolaroid guestName="Lena Müller" photo={photo} />)

    await userEvent.click(screen.getByRole('button', { name: /als polaroid speichern/i }))

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1))
    expect(createPolaroidBlob).toHaveBeenCalledWith({
      photoUrl: photo.thumbUrl,
      guestName: 'Lena Müller',
      coupleName: 'Saruga & Vinith',
      occasion: 'Standesamtliche Hochzeit',
      date: '17.10.2026',
    })
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:polaroid')
  })

  it('offers the finished polaroid through the share menu on a phone', async () => {
    vi.mocked(createPolaroidBlob).mockResolvedValue(new Blob(['png'], { type: 'image/png' }))
    const share = vi.fn(async () => {})
    vi.stubGlobal('navigator', { canShare: () => true, share })
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('coarse'), media: query }))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<MemoryPolaroid guestName="Lena Müller" photo={photo} />)

    await userEvent.click(screen.getByRole('button', { name: /als polaroid speichern/i }))

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
    const [data] = share.mock.calls[0] as unknown as [{ files: File[]; title: string }]
    expect(data.files[0].name).toBe('polaroid-saruga-vinith-lena-muller.png')
    expect(data.title).toBe('Polaroid von Lena Müller')
    expect(click).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('names the downloaded file after the guest', async () => {
    vi.mocked(createPolaroidBlob).mockResolvedValue(new Blob(['png']))
    let downloadName = ''
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloadName = this.download
    })
    render(<MemoryPolaroid guestName="Lena Müller" photo={photo} />)

    await userEvent.click(screen.getByRole('button', { name: /als polaroid speichern/i }))

    await waitFor(() => expect(downloadName).toBe('polaroid-saruga-vinith-lena-muller.png'))
  })

  it('reports a failure without crashing and allows another try', async () => {
    vi.mocked(createPolaroidBlob).mockRejectedValue(new Error('offline'))
    render(<MemoryPolaroid guestName="Lena" photo={photo} />)

    await userEvent.click(screen.getByRole('button', { name: /als polaroid speichern/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/nicht erstellt/i)
    expect(screen.getByRole('button', { name: /als polaroid speichern/i })).toBeEnabled()
  })

  it('offers the original as a plain link too', () => {
    render(<MemoryPolaroid guestName="Lena" photo={photo} />)
    expect(screen.getByRole('link', { name: /original/i })).toHaveAttribute('href', photo.originalUrl)
  })
})
