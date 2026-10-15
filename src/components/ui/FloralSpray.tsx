import { cn } from '@/lib/utils'

interface FloralSprayProps {
  className?: string
}

// Zwei kleine Blüten mit Blättern, als Ecken-Schmuck (z. B. am Polaroid).
// Die Blütenfarbe kommt per currentColor (text-bordeaux), Mitte in Gold.
export default function FloralSpray({ className }: FloralSprayProps) {
  const petals = (cx: number, cy: number, r: number) =>
    [0, 1, 2, 3, 4].map((i) => {
      const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2
      return <circle key={i} cx={cx + Math.cos(angle) * r} cy={cy + Math.sin(angle) * r} r={r * 0.75} />
    })

  return (
    <svg viewBox="0 0 72 72" aria-hidden="true" className={cn('pointer-events-none', className)}>
      <g fill="#7a9a7e">
        <ellipse cx="46" cy="16" rx="14" ry="5.5" transform="rotate(28 46 16)" />
        <ellipse cx="14" cy="46" rx="14" ry="5.5" transform="rotate(62 14 46)" />
      </g>
      <g fill="currentColor">
        {petals(20, 20, 8)}
        {petals(48, 40, 6)}
      </g>
      <circle cx="20" cy="20" r="4.5" fill="#c9a84c" />
      <circle cx="48" cy="40" r="3.4" fill="#c9a84c" />
    </svg>
  )
}
