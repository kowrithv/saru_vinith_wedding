// @vitest-environment node
import { describe, expect, it } from 'vitest'
import nextConfig from './next.config'

describe('next.config', () => {
  // Die Seite nutzt kein next/image (Fotos sind <img> von der Foto-Domain). Der
  // Bild-Optimierer unter /_next/image bliebe trotzdem erreichbar und wäre nur
  // Angriffsfläche (CPU, frühere Lücken im Bild-Decoder): abgeschaltet.
  it('switches the image optimizer off', () => {
    expect(nextConfig.images?.unoptimized).toBe(true)
  })

  it('does not allow any remote image source', () => {
    expect(nextConfig.images?.remotePatterns ?? []).toEqual([])
  })

  it('sends the security headers on every page', async () => {
    const rules = (await nextConfig.headers?.()) ?? []
    const all = rules.find((rule) => rule.source === '/:path*')
    const names = (all?.headers ?? []).map((header) => header.key)
    expect(names).toEqual(expect.arrayContaining(['X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy']))
  })
})
