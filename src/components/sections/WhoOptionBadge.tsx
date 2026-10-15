import { whoPortraits } from '@/lib/site-images'
import { cn } from '@/lib/utils'

interface WhoOptionBadgeProps {
  option: string
  /** Kantenlänge der runden Marke in Pixeln. */
  size?: number
  className?: string
}

// Kleines rundes Foto der Antwort für Listen (Ergebnisse). Der Name steht immer
// daneben, das Bild ist nur Schmuck (alt leer). "Beide" zeigt das gemeinsame
// Foto, in der Mitte zugeschnitten.
export default function WhoOptionBadge({ option, size = 40, className }: WhoOptionBadgeProps) {
  const url = whoPortraits.get(option)
  if (!url) return null

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
      className={cn('flex-shrink-0 rounded-full object-cover ring-2 ring-white bg-champagne', className)}
      style={{ width: size, height: size }}
    />
  )
}
