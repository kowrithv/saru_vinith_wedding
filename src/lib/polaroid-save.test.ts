import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { savePolaroidFile } from './polaroid-save'

function phone(options: { canShare: boolean; share?: () => Promise<void> }) {
  const share = vi.fn(options.share ?? (async () => {}))
  vi.stubGlobal('navigator', {
    canShare: options.canShare ? () => true : () => false,
    share,
  })
  return share
}

describe('savePolaroidFile', () => {
  let click: ReturnType<typeof vi.spyOn>
  const blob = new Blob(['png'], { type: 'image/png' })

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:polaroid')
    URL.revokeObjectURL = vi.fn()
    click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    // Handy: der Hauptzeiger ist der Finger
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({ matches: query.includes('coarse'), media: query }))
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('opens the share sheet on a phone, so the picture can go to the photos', async () => {
    const share = phone({ canShare: true })

    const outcome = await savePolaroidFile(blob, 'polaroid-lena.png', 'Polaroid von Lena')

    expect(outcome).toBe('shared')
    expect(share).toHaveBeenCalledTimes(1)
    const [data] = share.mock.calls[0] as unknown as [{ files: File[]; title: string }]
    expect(data.files[0].name).toBe('polaroid-lena.png')
    expect(data.files[0].type).toBe('image/png')
    expect(data.title).toBe('Polaroid von Lena')
    expect(click).not.toHaveBeenCalled()
  })

  it('downloads on a computer, where a share sheet would be unexpected', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({ matches: false, media: query }))
    )
    const share = phone({ canShare: true })

    const outcome = await savePolaroidFile(blob, 'polaroid-lena.png', 'Polaroid von Lena')

    expect(outcome).toBe('downloaded')
    expect(share).not.toHaveBeenCalled()
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('does nothing more when the guest closes the share sheet', async () => {
    phone({
      canShare: true,
      share: async () => {
        throw new DOMException('cancelled', 'AbortError')
      },
    })

    const outcome = await savePolaroidFile(blob, 'polaroid-lena.png', 'Polaroid von Lena')

    expect(outcome).toBe('cancelled')
    expect(click).not.toHaveBeenCalled()
  })

  it('falls back to the download when the browser refuses to share', async () => {
    phone({
      canShare: true,
      share: async () => {
        throw new DOMException('no gesture', 'NotAllowedError')
      },
    })

    const outcome = await savePolaroidFile(blob, 'polaroid-lena.png', 'Polaroid von Lena')

    expect(outcome).toBe('downloaded')
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('downloads when the browser cannot share files at all', async () => {
    phone({ canShare: false })

    const outcome = await savePolaroidFile(blob, 'polaroid-lena.png', 'Polaroid von Lena')

    expect(outcome).toBe('downloaded')
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('names the downloaded file and releases the temporary address', async () => {
    phone({ canShare: false })
    let downloadName = ''
    click.mockImplementation(function (this: HTMLAnchorElement) {
      downloadName = this.download
    })

    await savePolaroidFile(blob, 'polaroid-lena.png', 'Polaroid von Lena')

    expect(downloadName).toBe('polaroid-lena.png')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:polaroid')
  })
})
