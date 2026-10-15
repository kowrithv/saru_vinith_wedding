import { cn } from '@/lib/utils'
import Lotus from '@/components/ui/Lotus'

interface SectionTitleProps {
  title: string
  subtitle?: string
  className?: string
  centered?: boolean
  light?: boolean
}

export default function SectionTitle({
  title,
  subtitle,
  className,
  centered = true,
  light = false,
}: SectionTitleProps) {
  return (
    <div className={cn('mb-10 md:mb-14', centered && 'text-center', className)}>
      <div className={cn('flex items-center gap-3 mb-4', centered && 'justify-center')}>
        <div className={cn('h-px w-8', light ? 'bg-white/30' : 'bg-gold/40')} />
        <Lotus size={20} className={cn(light ? 'text-white/60' : 'text-gold')} />
        <div className={cn('h-px w-8', light ? 'bg-white/30' : 'bg-gold/40')} />
      </div>

      <h2
        className={cn(
          'font-serif text-3xl sm:text-4xl md:text-5xl font-semibold leading-tight',
          light ? 'text-white' : 'text-dark-blue'
        )}
      >
        {title}
      </h2>

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
    </div>
  )
}
