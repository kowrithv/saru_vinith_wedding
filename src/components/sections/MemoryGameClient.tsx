'use client'

import dynamic from 'next/dynamic'

// Das Spielbrett wird bei jedem Laden zufällig gemischt. Würde MemoryGame
// beim statischen Prerendering mitgerendert, würde genau eine zufällige
// Mischung fest ins HTML gebacken und bei jedem Gast anders rehydriert
// (Hydration-Mismatch, falsch zugeordnete Kartenbilder). ssr:false sorgt
// dafür, dass das Mischen ausschließlich im Browser passiert.
const MemoryGame = dynamic(() => import('./MemoryGame'), { ssr: false })

export default MemoryGame
