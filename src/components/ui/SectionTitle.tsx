import { cn } from '@/lib/utils'

interface SectionTitleProps {
  title: string
  subtitle?: string
  className?: string
  titleClassName?: string
  centered?: boolean
  light?: boolean
}

export default function SectionTitle({
  title,
  subtitle,
  className,
  titleClassName,
  centered = true,
  light = false,
}: SectionTitleProps) {
  return (
    <div className={cn('mb-10 md:mb-14', centered && 'text-center', className)}>
      {/* Top decorative element */}
      <div className={cn('flex items-center gap-3 mb-4', centered && 'justify-center')}>
        <div className={cn('h-px w-8', light ? 'bg-white/30' : 'bg-gold/40')} />
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className={cn(light ? 'text-white/60' : 'text-gold')}
        >
          <path
            d="M8 0L9.5 6.5L16 8L9.5 9.5L8 16L6.5 9.5L0 8L6.5 6.5L8 0Z"
            fill="currentColor"
          />
        </svg>
        <div className={cn('h-px w-8', light ? 'bg-white/30' : 'bg-gold/40')} />
      </div>

      {/* Title */}
      <h2
        className={cn(
          'font-serif text-3xl sm:text-4xl md:text-5xl font-semibold leading-tight',
          light ? 'text-white' : 'text-dark-blue',
          titleClassName
        )}
      >
        {title}
      </h2>

      {/* Subtitle */}
      {subtitle && (
        <p
          className={cn(
            'mt-4 text-base md:text-lg leading-relaxed max-w-2xl',
            centered && 'mx-auto',
            light ? 'text-white/80' : 'text-gray-600'
          )}
        >
          {subtitle}
        </p>
      )}

      {/* Bottom decorative divider */}
      <div className={cn('flex items-center gap-2 mt-5', centered && 'justify-center')}>
        <div className={cn('h-px w-12', light ? 'bg-white/20' : 'bg-champagne-dark')} />
        <div className={cn('h-px w-4', light ? 'bg-white/40' : 'bg-gold/50')} />
        <svg
          width="8"
          height="8"
          viewBox="0 0 8 8"
          className={cn(light ? 'text-white/50' : 'text-gold')}
        >
          <rect x="2" y="0" width="4" height="4" transform="rotate(45 4 4)" fill="currentColor" />
        </svg>
        <div className={cn('h-px w-4', light ? 'bg-white/40' : 'bg-gold/50')} />
        <div className={cn('h-px w-12', light ? 'bg-white/20' : 'bg-champagne-dark')} />
      </div>
    </div>
  )
}
