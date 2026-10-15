import { cn } from '@/lib/utils'

interface LotusProps {
  size?: number
  className?: string
}

// Hauptzeichen der Gestaltung: acht Blütenblätter, die Farbe kommt per
// `currentColor` (text-gold, text-bordeaux, ...). Rein dekorativ.
const PETAL = 'M0 -4 C-7 -12 -7 -22 0 -28 C7 -22 7 -12 0 -4Z'

export default function Lotus({ size = 24, className }: LotusProps) {
  return (
    <svg
      viewBox="-30 -30 60 60"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      className={cn('flex-shrink-0', className)}
    >
      {[0, 90, 180, 270].map((deg) => (
        <path key={deg} d={PETAL} transform={`rotate(${deg})`} opacity={0.95} />
      ))}
      {[45, 135, 225, 315].map((deg) => (
        <path key={deg} d={PETAL} transform={`rotate(${deg})`} opacity={0.7} />
      ))}
      <circle r={4.5} />
    </svg>
  )
}
