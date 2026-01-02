'use client'

import { Check, X } from 'lucide-react'
import { calculatePasswordStrength, PasswordStrength } from '@/lib/password-security'
import { cn } from '@/lib/utils'

interface PasswordStrengthMeterProps {
  password: string
  className?: string
}

export function PasswordStrengthMeter({ password, className }: PasswordStrengthMeterProps) {
  if (!password) {
    return null
  }

  const strength: PasswordStrength = calculatePasswordStrength(password)

  const getStrengthLabel = (level: PasswordStrength['level']) => {
    switch (level) {
      case 'weak':
        return 'Weak'
      case 'fair':
        return 'Fair'
      case 'good':
        return 'Good'
      case 'strong':
        return 'Strong'
      case 'very-strong':
        return 'Very Strong'
      default:
        return ''
    }
  }

  const requirements = [
    { key: 'length' as const, label: 'At least 8 characters' },
    { key: 'lowercase' as const, label: 'One lowercase letter' },
    { key: 'uppercase' as const, label: 'One uppercase letter' },
    { key: 'number' as const, label: 'One number' },
    { key: 'specialChar' as const, label: 'One special character' },
  ]

  return (
    <div className={cn('space-y-2', className)}>
      {/* Strength Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600 dark:text-gray-400">Password strength</span>
          <span className={cn(
            'font-medium',
            strength.level === 'weak' && 'text-red-500',
            strength.level === 'fair' && 'text-orange-500',
            strength.level === 'good' && 'text-yellow-500',
            strength.level === 'strong' && 'text-green-500',
            strength.level === 'very-strong' && 'text-green-600'
          )}>
            {getStrengthLabel(strength.level)}
          </span>
        </div>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div 
            className="h-full transition-all duration-300 rounded-full"
            style={{ 
              width: `${strength.score}%`,
              backgroundColor: strength.level === 'weak' ? '#ef4444' :
                             strength.level === 'fair' ? '#f97316' :
                             strength.level === 'good' ? '#eab308' :
                             strength.level === 'strong' ? '#22c55e' :
                             '#16a34a'
            }}
          />
        </div>
      </div>

      {/* Requirements Checklist */}
      <div className="space-y-1.5">
        {requirements.map((req) => {
          const met = strength.requirements[req.key]
          return (
            <div 
              key={req.key} 
              className="flex items-center gap-2 text-xs"
            >
              {met ? (
                <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
              ) : (
                <X className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
              )}
              <span className={cn(
                met 
                  ? 'text-gray-600 dark:text-gray-400' 
                  : 'text-gray-500 dark:text-gray-500'
              )}>
                {req.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

