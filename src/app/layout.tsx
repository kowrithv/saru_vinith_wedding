import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Playfair_Display, Inter } from 'next/font/google'
import './globals.css'
import Navigation from '@/components/layout/Navigation'
import Footer from '@/components/layout/Footer'
import MotionProvider from '@/components/layout/MotionProvider'

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

export const metadata: Metadata = {
  title: 'Saruga & Vinith',
  description: 'Alles rund um unsere Hochzeit am 17. Oktober 2026.',
  robots: { index: false, follow: false },
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="de" className={`${playfair.variable} ${inter.variable}`}>
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
