'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'

// Beamer (`/beamer`) und Steuerung (`/punkte`) sind Vollbild-Seiten für den Bediener, keine Gästeseiten:
// ohne Menü, Fußzeile und Zeit-Hinweis, und nichts liegt darunter (sonst hätte die Seite dahinter eine
// eigene Scrollleiste, und die Tab-Taste käme in die unsichtbare Navigation). Genau diese Pfade, als
// Set, damit ein ähnlich beginnender Pfad nicht versehentlich mitgenommen wird.
const BARE_PATHS: ReadonlySet<string> = new Set(['/beamer', '/punkte'])

interface SiteChromeProps {
  navigation: ReactNode
  footer: ReactNode
  banner: ReactNode
  children: ReactNode
}

export default function SiteChrome({ navigation, footer, banner, children }: SiteChromeProps) {
  const pathname = usePathname() ?? '/'
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  if (BARE_PATHS.has(path)) return <>{children}</>

  return (
    <>
      {navigation}
      {/* Die Navigation ist "fixed" und überlagert daher den Seitenanfang -
          jede Seite ist dafür verantwortlich, selbst genug Abstand nach
          oben zu lassen (Konvention: pt-24 pb-16 auf dem äußersten
          Element der Seite, siehe src/app/info/page.tsx). Ausnahme ist
          die Startseite: der Hero füllt den Bildschirm und bringt sein
          eigenes pt-20 mit. Hier KEIN pt-* ergänzen, sonst doppelter
          Abstand. */}
      <main className="min-h-screen">{children}</main>
      {footer}
      {banner}
    </>
  )
}
