import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

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
    <html lang="de">
      <body>{children}</body>
    </html>
  )
}
