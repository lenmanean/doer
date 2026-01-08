'use client'

import { Mic, Square } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VoiceInputButtonProps {
  isListening: boolean
  isSupported: boolean
  onClick: () => void
  disabled?: boolean
  className?: string
  size?: 'sm' | 'md' | 'lg'
  error?: string | null
}

const sizeClasses = {
  sm: 'p-2 w-8 h-8',
  md: 'p-3 w-10 h-10',
  lg: 'p-3 w-12 h-12',
}

const iconSizes = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
}

export function VoiceInputButton({
  isListening,
  isSupported,
  onClick,
  disabled = false,
  className,
  size = 'md',
  error,
}: VoiceInputButtonProps) {
  // Don't render if not supported
  if (!isSupported) {
    return null
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick()
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onKeyDown={handleKeyDown}
      aria-label={isListening ? 'Stop recording' : 'Start voice input'}
      aria-pressed={isListening}
      className={cn(
        'flex items-center justify-center rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed',
        'focus:outline-none focus:ring-2 focus:ring-[#ff7f00] focus:ring-offset-2 focus:ring-offset-transparent',
        sizeClasses[size],
        isListening
          ? 'bg-red-500 hover:bg-red-600 text-white'
          : error
          ? 'bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/50 text-yellow-400'
          : 'bg-white/10 hover:bg-white/20 text-white',
        className
      )}
      title={isListening ? 'Stop recording' : 'Start voice input'}
    >
      {isListening ? (
        <Square className={iconSizes[size]} fill="currentColor" aria-hidden="true" />
      ) : (
        <Mic className={iconSizes[size]} aria-hidden="true" />
      )}
    </button>
  )
}

