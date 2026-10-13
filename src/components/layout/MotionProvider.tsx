'use client'

import type { ReactNode } from 'react'
import { MotionConfig } from 'framer-motion'

// framer-motion beachtet "Bewegung reduzieren" standardmäßig nicht
// (reducedMotion: "never"). "user" übernimmt die Einstellung des Geräts für
// alle Animationen der Seite auf einmal.
export default function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
