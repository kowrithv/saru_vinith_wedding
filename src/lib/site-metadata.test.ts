import { describe, expect, it } from 'vitest'
import { siteMetadata, siteViewport } from './site-metadata'

describe('site metadata', () => {
  it('keeps the page out of search engines', () => {
    expect(siteMetadata.robots).toEqual({ index: false, follow: false })
  })

  // Chat-Vorschau (WhatsApp, iMessage): ohne Open-Graph-Daten erscheint der
  // Link als nackte Adresse. Das Bild liefert src/app/opengraph-image.png.
  it('describes the page for link previews', () => {
    expect(siteMetadata.title).toBe('Saruga & Vinith')
    expect(siteMetadata.openGraph).toMatchObject({
      title: 'Saruga & Vinith',
      type: 'website',
      locale: 'de_DE',
    })
    expect(String(siteMetadata.openGraph?.description)).toMatch(/17\. Oktober 2026/)
  })

  it('resolves relative image URLs against the public domain', () => {
    expect(siteMetadata.metadataBase?.toString()).toMatch(/^https:\/\//)
  })

  it('colors the mobile browser bar in the brand blue', () => {
    expect(siteViewport.themeColor).toBe('#1e3a5f')
  })
})
