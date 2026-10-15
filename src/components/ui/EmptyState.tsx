import type { ReactNode } from 'react'
import Lotus from './Lotus'

interface EmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
}

// Leere Listen, Fehlerzustände und die 404-Seite sprechen dieselbe Bildsprache:
// ein Lotus, ein klarer Satz und (wenn möglich) der nächste Schritt.
export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <Lotus size={40} className="text-gold" />
      <p className="font-display text-2xl font-semibold text-dark-blue">{title}</p>
      {description && <p className="max-w-sm text-sm text-gray-600">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
