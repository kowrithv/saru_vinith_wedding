import type { Metadata, Viewport } from 'next'

const TITLE = 'Saruga & Vinith'
const DESCRIPTION = 'Alles rund um unsere Hochzeit am 17. Oktober 2026.'

// Absolute Adresse für das Vorschaubild (opengraph-image.png in src/app).
// Ein leerer Wert (SITE_URL=) zählt als nicht gesetzt: new URL('') würde werfen.
const SITE_URL = process.env.SITE_URL?.trim() || 'https://vsjourney.de'

export const siteMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  // Suchmaschinen bleiben draußen; Chat-Vorschauen (WhatsApp, iMessage)
  // lesen die Open-Graph-Angaben trotzdem.
  robots: { index: false, follow: false },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
    locale: 'de_DE',
    siteName: TITLE,
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
}

export const siteViewport: Viewport = {
  // Farbe der Adressleiste am Handy: das Dunkelblau der Seite.
  themeColor: '#1e3a5f',
}
