'use client'

import { HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface ThemeAwareCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outlined' | 'elevated'
}

const ThemeAwareCard = forwardRef<HTMLDivElement, ThemeAwareCardProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variantClasses = {
      default: 'bg-[var(--accent)] border border-[var(--border)]',
      outlined: 'bg-[var(--background)] border border-[var(--border)]',
      elevated: 'bg-[var(--accent)] border border-[var(--border)] shadow-lg'
    }
    
    return (
      <div
        className={cn(
          'rounded-lg p-6 text-[var(--foreground)]',
          variantClasses[variant],
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)

ThemeAwareCard.displayName = 'ThemeAwareCard'

export { ThemeAwareCard }









