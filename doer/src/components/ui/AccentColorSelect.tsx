'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

type AccentColor = 'default' | 'blue' | 'green' | 'yellow' | 'pink' | 'orange' | 'purple'

interface AccentColorSelectProps {
  value: AccentColor
  onChange: (color: AccentColor) => void
}

const accentColorOptions: { value: AccentColor; label: string; color: string }[] = [
  { value: 'default', label: 'Default', color: '#949aa5' },
  { value: 'blue', label: 'Blue', color: '#4387f6' },
  { value: 'green', label: 'Green', color: '#51e889' },
  { value: 'yellow', label: 'Yellow', color: '#f7b442' },
  { value: 'pink', label: 'Pink', color: '#ec4d9c' },
  { value: 'orange', label: 'Orange', color: '#ff9c3a' },
  { value: 'purple', label: 'Purple', color: '#7a44f5' }
]

export function AccentColorSelect({ value, onChange }: AccentColorSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const selectedOption = accentColorOptions.find(opt => opt.value === value) || accentColorOptions[5] // Default to orange

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return

      if (event.key === 'Escape') {
        setIsOpen(false)
        buttonRef.current?.focus()
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        const currentIndex = accentColorOptions.findIndex(opt => opt.value === value)
        const nextIndex = (currentIndex + 1) % accentColorOptions.length
        onChange(accentColorOptions[nextIndex].value)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        const currentIndex = accentColorOptions.findIndex(opt => opt.value === value)
        const prevIndex = (currentIndex - 1 + accentColorOptions.length) % accentColorOptions.length
        onChange(accentColorOptions[prevIndex].value)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, value, onChange])

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] flex items-center justify-between hover:bg-[var(--secondary)] transition-colors"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full border border-[var(--border)]"
            style={{ backgroundColor: selectedOption.color }}
          />
          <span>{selectedOption.label}</span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-[var(--muted-foreground)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            {/* Dropdown Menu */}
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute z-50 w-full mt-1 bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-lg overflow-hidden"
              role="listbox"
            >
              {accentColorOptions.map((option) => {
                const isSelected = option.value === value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value)
                      setIsOpen(false)
                    }}
                    className={`w-full px-4 py-2 text-left flex items-center gap-2 hover:bg-[var(--secondary)] transition-colors ${
                      isSelected
                        ? 'bg-[var(--primary)]/20 border-l-2 border-[var(--primary)]'
                        : 'text-[var(--foreground)]'
                    }`}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div
                      className="w-4 h-4 rounded-full border border-[var(--border)] flex-shrink-0"
                      style={{ backgroundColor: option.color }}
                    />
                    <span className="flex-1">{option.label}</span>
                    {isSelected && (
                      <Check className="w-4 h-4 text-[var(--primary)] flex-shrink-0" />
                    )}
                  </button>
                )
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

