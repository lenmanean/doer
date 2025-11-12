'use client'

import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface ThemeAwareInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

const ThemeAwareInput = forwardRef<HTMLInputElement, ThemeAwareInputProps>(
  ({ className, label, error, helperText, ...props }, ref) => {
    return (
      <div className="space-y-2">
        {label && (
          <label className="block text-sm font-medium text-[var(--foreground)]">
            {label}
          </label>
        )}
        <input
          className={cn(
            'w-full px-4 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder-gray-400 dark:placeholder-gray-400 focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors',
            error && 'border-[var(--destructive)] focus:border-[var(--destructive)] focus:ring-[var(--destructive)]',
            className
          )}
          style={{
            accentColor: '#ff7f00',
            ...props.style
          }}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="text-sm text-[var(--destructive)]">{error}</p>
        )}
        {helperText && !error && (
          <p className="text-sm text-[var(--muted-foreground)]">{helperText}</p>
        )}
      </div>
    )
  }
)

ThemeAwareInput.displayName = 'ThemeAwareInput'

export { ThemeAwareInput }









