import SectionTitle from '@/components/ui/SectionTitle'
import MemoryGame from '@/components/sections/MemoryGameClient'
import { memoryImages } from '@/lib/memory-content'

export default function MemorySpielPage() {
  return (
    <div className="pt-24 pb-16">
      {/* Das Brett entsteht erst im Browser (ssr: false): die Bilder werden
          schon mit dem HTML angekündigt und laufen parallel zum Skript. */}
      {memoryImages.map((src) => (
        <link key={src} rel="prefetch" as="image" href={src} />
      ))}
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <SectionTitle
          title="Gästespiel: Liebes-Memory"
          subtitle="Findet alle Pärchen! Deckt zwei Karten auf – passen die Fotos zusammen, bleiben sie offen. Die Zeit startet mit der ersten Karte."
        />
        <MemoryGame />
      </div>
    </div>
  )
}
