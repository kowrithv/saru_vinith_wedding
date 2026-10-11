import SectionTitle from '@/components/ui/SectionTitle'
import MemoryGame from '@/components/sections/MemoryGame'

export default function MemorySpielPage() {
  return (
    <div className="pt-24 pb-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <SectionTitle
          title="Gästespiel: Liebes-Memory"
          subtitle="Findet alle Pärchen! Deckt zwei Karten auf – passen die Fotos zusammen, bleiben sie offen."
        />
        <MemoryGame />
      </div>
    </div>
  )
}
