'use client'

import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface ThemeAwareButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
}

const ThemeAwareButton = forwardRef<HTMLButtonElement, ThemeAwareButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const baseClasses = 'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'
    
    const variantClasses = {
      primary: 'bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 focus:ring-[var(--primary)]',
      secondary: 'bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--secondary)]/80 focus:ring-[var(--secondary)]',
      outline: 'border border-[var(--border)] bg-[var(--accent)] text-[var(--foreground)] hover:bg-[var(--secondary)] focus:ring-[var(--primary)]',
      ghost: 'text-[var(--foreground)] hover:bg-[var(--accent)] focus:ring-[var(--primary)]',
      destructive: 'bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:bg-[var(--destructive)]/90 focus:ring-[var(--destructive)]'
    }
    
    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base'
    }
    
    return (
      <button
        className={cn(
          baseClasses,
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)

ThemeAwareButton.displayName = 'ThemeAwareButton'

export { ThemeAwareButton }









