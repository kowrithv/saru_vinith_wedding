import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  padding?: 'sm' | 'md' | 'lg' | 'none'
  variant?: 'default' | 'champagne' | 'dark' | 'glass'
}

export default function Card({
  children,
  className,
  hover = false,
  padding = 'md',
  variant = 'default',
}: CardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8 md:p-10',
  }

  const variantClasses = {
    default: 'bg-white border border-gray-100 shadow-sm',
    champagne: 'bg-champagne-light border border-champagne-dark/30',
    dark: 'bg-dark-blue text-white',
    glass: 'glass',
  }

  return (
    <div
      className={cn(
        'rounded-2xl',
        paddingClasses[padding],
        variantClasses[variant],
        hover && 'card-hover cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  )
}
