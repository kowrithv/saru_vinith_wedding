import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { purgeCache } from './cloudflare-purge'

describe('purgeCache', () => {
  const originalToken = process.env.CLOUDFLARE_API_TOKEN
  const originalZone = process.env.CLOUDFLARE_ZONE_ID

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    process.env.CLOUDFLARE_API_TOKEN = originalToken
    process.env.CLOUDFLARE_ZONE_ID = originalZone
  })

  it('does nothing when no Cloudflare credentials are configured', async () => {
    delete process.env.CLOUDFLARE_API_TOKEN
    delete process.env.CLOUDFLARE_ZONE_ID
    await purgeCache(['https://fotos.example.de/a.jpg'])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('calls the purge endpoint when credentials are configured', async () => {
    process.env.CLOUDFLARE_API_TOKEN = 'token'
    process.env.CLOUDFLARE_ZONE_ID = 'zone'
    await purgeCache(['https://fotos.example.de/a.jpg'])
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/zones/zone/purge_cache'),
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('never throws when the purge request itself fails', async () => {
    process.env.CLOUDFLARE_API_TOKEN = 'token'
    process.env.CLOUDFLARE_ZONE_ID = 'zone'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    await expect(purgeCache(['https://fotos.example.de/a.jpg'])).resolves.toBeUndefined()
  })
})
