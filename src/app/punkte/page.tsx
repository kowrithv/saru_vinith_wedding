import type { Metadata } from 'next'
import ScoreRemote from '@/components/score/ScoreRemote'

// Nicht für Gäste: kein Menüpunkt, für Suchmaschinen gesperrt (auch in robots.ts), Zugang nur mit dem Beamer-Kennwort.
export const metadata: Metadata = {
  title: 'Punktestand',
  robots: { index: false, follow: false },
}

export default function ScorePage() {
  return <ScoreRemote />
}
