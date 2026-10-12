import type { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  href?: string
  type?: 'button' | 'submit'
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  className?: string
}

const sizeClasses = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
}

const variantClasses = {
  primary: 'bg-dark-blue text-white hover:bg-dark-blue-light shadow-md hover:shadow-lg',
  secondary: 'border-2 border-dark-blue text-dark-blue hover:bg-dark-blue hover:text-white',
}

export default function Button({
  children,
  onClick,
  href,
  type = 'button',
  variant = 'primary',
  size = 'md',
  disabled = false,
  className,
}: ButtonProps) {
  const classes = cn(
    'inline-flex items-center justify-center gap-2 font-medium rounded-full transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
    sizeClasses[size],
    variantClasses[variant],
    className
  )

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    )
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {children}
    </button>
  )
}
