import type { Metadata } from 'next'
import BeamerScreen from '@/components/score/BeamerScreen'

// Nicht für Gäste: kein Menüpunkt, für Suchmaschinen gesperrt (auch in robots.ts), Zugang nur mit dem Beamer-Kennwort.
export const metadata: Metadata = {
  title: 'Beamer',
  robots: { index: false, follow: false },
}

export default function BeamerPage() {
  return <BeamerScreen />
}
