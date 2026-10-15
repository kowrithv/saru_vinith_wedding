import type { ReactNode } from 'react'
import { Playfair_Display, Inter, Cormorant_Garamond, Great_Vibes } from 'next/font/google'
import './globals.css'
import Navigation from '@/components/layout/Navigation'
import Footer from '@/components/layout/Footer'
import MotionProvider from '@/components/layout/MotionProvider'
import { siteMetadata, siteViewport } from '@/lib/site-metadata'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['300', '400', '500', '600'],
})

// Große Zeilen (Namen, Datum) in Cormorant, Unterschriften in Schreibschrift.
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  variable: '--font-cormorant',
  display: 'swap',
  weight: ['500', '600'],
})

const greatVibes = Great_Vibes({
  subsets: ['latin'],
  variable: '--font-great-vibes',
  display: 'swap',
  weight: '400',
})

export const metadata = siteMetadata
export const viewport = siteViewport

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="de" className={`${playfair.variable} ${inter.variable} ${cormorant.variable} ${greatVibes.variable}`}>
      <body className="font-sans antialiased bg-white text-gray-900">
        <MotionProvider>
        <Navigation />
        {/* Die Navigation ist "fixed" und überlagert daher den Seitenanfang -
            jede Seite ist dafür verantwortlich, selbst genug Abstand nach
            oben zu lassen (Konvention: pt-24 pb-16 auf dem äußersten
            Element der Seite, siehe src/app/info/page.tsx). Ausnahme ist
            die Startseite: der Hero füllt den Bildschirm und bringt sein
            eigenes pt-20 mit. Hier KEIN pt-* ergänzen, sonst doppelter
            Abstand. */}
        <main className="min-h-screen">{children}</main>
        <Footer />
        </MotionProvider>
      </body>
    </html>
  )
}
