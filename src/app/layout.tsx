import type { Metadata } from 'next'
import { Playfair_Display, Inter } from 'next/font/google'
import './globals.css'
import Navigation from '@/components/layout/Navigation'
import Footer from '@/components/layout/Footer'
import { Toaster } from 'react-hot-toast'

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
  title: {
    default: 'Saruga & Vinith – Unsere Hochzeit',
    template: '%s | Saruga & Vinith',
  },
  description: 'Wir heiraten! Saruga und Vinith laden euch ein, diesen besonderen Tag mit ihnen zu feiern. Standesamtliche Trauung am 17. Oktober 2026 und traditionelle tamilische Hochzeit 2027.',
  keywords: ['Hochzeit', 'Wedding', 'Saruga', 'Vinith', 'Tamil', 'German', '2026'],
  openGraph: {
    title: 'Saruga & Vinith – Unsere Hochzeit',
    description: 'Wir heiraten! Seid dabei, wenn zwei Welten zu einer werden.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de" className={`${playfair.variable} ${inter.variable}`}>
      <body className="font-sans antialiased bg-white text-gray-900">
        <Navigation />
        <main className="min-h-screen">
          {children}
        </main>
        <Footer />
        <Toaster
          position="bottom-center"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1E3A5F',
              color: '#ffffff',
              borderRadius: '8px',
              padding: '12px 20px',
              fontSize: '14px',
              fontFamily: 'var(--font-inter)',
            },
            success: {
              iconTheme: {
                primary: '#C9A84C',
                secondary: '#ffffff',
              },
            },
          }}
        />
      </body>
    </html>
  )
}
