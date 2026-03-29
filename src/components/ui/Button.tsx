import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'gold'
  size?: 'sm' | 'md' | 'lg'
  href?: string
  asChild?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    const baseClasses =
      'inline-flex items-center justify-center gap-2 font-medium rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dark-blue focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]'

    const variants = {
      primary:
        'bg-dark-blue text-white hover:bg-dark-blue-light shadow-md hover:shadow-lg',
      secondary:
        'border-2 border-dark-blue text-dark-blue hover:bg-dark-blue hover:text-white',
      ghost:
        'text-dark-blue hover:bg-champagne/50',
      gold:
        'bg-gold text-white hover:bg-gold-dark shadow-md hover:shadow-lg',
    }

    const sizes = {
      sm: 'text-sm px-4 py-2',
      md: 'text-sm px-6 py-2.5',
      lg: 'text-base px-8 py-3.5',
    }

    return (
      <button
        ref={ref}
        className={cn(baseClasses, variants[variant], sizes[size], className)}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export default Button
