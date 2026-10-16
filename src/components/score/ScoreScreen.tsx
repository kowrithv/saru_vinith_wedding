import type { ReactNode } from 'react'

// Beamer und Steuerung füllen den ganzen Bildschirm und liegen über Navigation und
// Fußzeile der Seite: sie sind keine Seiten für Gäste und brauchen keinen Rahmen.
export default function ScoreScreen({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#f4f1ea] text-[#1c1c1c]">{children}</div>
  )
}
