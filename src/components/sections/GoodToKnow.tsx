import { Info } from 'lucide-react'
import Card from '@/components/ui/Card'
import type { GoodToKnowItem } from '@/lib/event-info'

interface GoodToKnowProps {
  items: GoodToKnowItem[]
}

// Kurze Antworten auf die Fragen, die Gäste sonst per Nachricht stellen.
// Ohne Einträge (siehe goodToKnow in event-info.ts) erscheint nichts.
export default function GoodToKnow({ items }: GoodToKnowProps) {
  if (items.length === 0) return null
  return (
    <Card variant="ornate" padding="lg" className="mb-8">
      <h3 className="mb-5 flex items-center gap-2 font-serif text-xl font-semibold text-dark-blue">
        <Info size={18} className="text-gold" />
        Gut zu wissen
      </h3>
      <dl className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.title}>
            <dt className="font-display text-xl font-semibold text-dark-blue">{item.title}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-gray-700">{item.text}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}
