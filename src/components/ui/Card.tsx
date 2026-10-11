import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  padding?: 'sm' | 'md' | 'lg' | 'none'
  variant?: 'default' | 'champagne' | 'dark'
}

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
}

export default function Card({
  children,
  className,
  hover = false,
  padding = 'md',
  variant = 'default',
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl',
        paddingClasses[padding],
        variantClasses[variant],
        hover && 'cursor-pointer transition-shadow hover:shadow-md',
        className
      )}
    >
      {children}
    </div>
  )
}
