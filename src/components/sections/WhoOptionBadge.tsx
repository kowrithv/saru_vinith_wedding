import type { CSSProperties } from 'react'
import { whoPortraits } from '@/lib/site-images'
import { cn } from '@/lib/utils'

interface WhoOptionBadgeProps {
  option: string
  /** Kantenlänge des runden Porträts in Pixeln. */
  size?: number
  className?: string
}

// "Beide" zeigt zwei überlappende Porträts und ist damit breiter als ein
// einzelnes. Alle Marken bekommen diese Breite, damit Namen und Balken in einer
// Liste untereinander beginnen.
const OVERLAP = 12

// Porträts statt Buchstaben: der Name steht immer daneben, das Bild ist nur
// Schmuck (alt leer). "Beide" zeigt beide Porträts überlappt.
function Portrait({
  url,
  size,
  className,
  style,
}: {
  url: string
  size: number
  className?: string
  style?: CSSProperties
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={cn('rounded-full object-cover ring-2 ring-white bg-champagne', className)}
      style={{ width: size, height: size, ...style }}
    />
  )
}

export default function WhoOptionBadge({ option, size = 40, className }: WhoOptionBadgeProps) {
  const single = whoPortraits.get(option)
  const portraits = single ? [single] : [...whoPortraits.values()]
  const width = size * 2 - OVERLAP

  return (
    <span aria-hidden="true" className={cn('flex flex-shrink-0 items-center', className)} style={{ width }}>
      {portraits.map((url, index) => (
        <Portrait
          key={url}
          url={url}
          size={size}
          className="flex-shrink-0"
          style={index > 0 ? { marginLeft: -OVERLAP } : undefined}
        />
      ))}
    </span>
  )
}
