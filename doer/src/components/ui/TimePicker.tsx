'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock } from 'lucide-react'

interface TimePickerProps {
  value: string // HH:MM format
  onChange: (value: string) => void
  theme: 'dark' | 'light'
  id?: string
  className?: string
  timeFormat?: '12h' | '24h'
  disabled?: boolean
}

export function TimePicker({ value, onChange, theme, id, className = '', timeFormat = '12h', disabled = false }: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  // Track which fields have been explicitly selected in the current session
  const [selectedFields, setSelectedFields] = useState<{ hour: boolean; minute: boolean; period: boolean }>({
    hour: false,
    minute: false,
    period: false
  })

  // Parse the time value (HH:MM format from input)
  const parseTime = (timeStr: string) => {
    if (!timeStr) return { hour: null, minute: null, period: 'AM', hour24: null }
    
    const [hours, minutes] = timeStr.split(':').map(Number)
    const hour24 = isNaN(hours) ? null : hours
    const minute = isNaN(minutes) ? null : minutes
    
    if (hour24 === null) {
      return { hour: null, minute: null, period: 'AM', hour24: null }
    }
    
    if (timeFormat === '24h') {
      return { hour: hour24, minute, period: 'AM', hour24 }
    }

    // 12-hour
    let hour12 = hour24
    let period: 'AM' | 'PM' = 'AM'
    if (hour24 === 0) { hour12 = 12; period = 'AM' }
    else if (hour24 < 12) { hour12 = hour24; period = 'AM' }
    else if (hour24 === 12) { hour12 = 12; period = 'PM' }
    else { hour12 = hour24 - 12; period = 'PM' }
    return { hour: hour12, minute, period, hour24 }
  }

  const { hour, minute, period, hour24 } = parseTime(value)
  

  // Format time for display
  const formatDisplayTime = () => {
    if (hour === null || minute === null) {
      return 'Select time'
    }
    const hourVal = timeFormat === '24h' ? hour : hour
    const hourStr = hourVal.toString().padStart(2, '0')
    const minuteStr = minute.toString().padStart(2, '0')
    return timeFormat === '24h' ? `${hourStr}:${minuteStr}` : `${hourStr}:${minuteStr} ${period}`
  }

  // Convert to 24-hour format for onChange
  const convertTo24Hour = (hour12: number, period: 'AM' | 'PM'): number => {
    if (period === 'AM') {
      return hour12 === 12 ? 0 : hour12
    } else {
      return hour12 === 12 ? 12 : hour12 + 12
    }
  }

  // Check if all required fields are selected
  const isTimeComplete = () => {
    if (timeFormat === '24h') {
      return hour !== null && minute !== null
    } else {
      return hour !== null && minute !== null && period !== null
    }
  }

  const handleHourChange = (newHour: number) => {
    const hour24Value = timeFormat === '24h' ? newHour : convertTo24Hour(newHour, period as 'AM' | 'PM')
    const minuteStr = (minute !== null ? minute : 0).toString().padStart(2, '0')
    const newValue = `${hour24Value.toString().padStart(2, '0')}:${minuteStr}`
    onChange(newValue)
    
    // Mark hour as selected in this session
    const newSelectedFields = { ...selectedFields, hour: true }
    setSelectedFields(newSelectedFields)
    
    // Only close if all required fields have been explicitly selected in this session
    const allSelected = timeFormat === '24h' 
      ? newSelectedFields.hour && newSelectedFields.minute
      : newSelectedFields.hour && newSelectedFields.minute && newSelectedFields.period
    if (allSelected) {
      setIsOpen(false)
    }
  }

  const handleMinuteChange = (newMinute: number) => {
    const hourStr = (hour24 !== null ? hour24 : 9).toString().padStart(2, '0')
    const newValue = `${hourStr}:${newMinute.toString().padStart(2, '0')}`
    onChange(newValue)
    
    // Mark minute as selected in this session
    const newSelectedFields = { ...selectedFields, minute: true }
    setSelectedFields(newSelectedFields)
    
    // Only close if all required fields have been explicitly selected in this session
    const allSelected = timeFormat === '24h'
      ? newSelectedFields.hour && newSelectedFields.minute
      : newSelectedFields.hour && newSelectedFields.minute && newSelectedFields.period
    if (allSelected) {
      setIsOpen(false)
    }
  }

  const handlePeriodChange = (newPeriod: 'AM' | 'PM') => {
    const newHour24 = convertTo24Hour(hour !== null ? hour : 9, newPeriod)
    const minuteStr = (minute !== null ? minute : 0).toString().padStart(2, '0')
    const newValue = `${newHour24.toString().padStart(2, '0')}:${minuteStr}`
    onChange(newValue)
    
    // Mark period as selected in this session
    const newSelectedFields = { ...selectedFields, period: true }
    setSelectedFields(newSelectedFields)
    
    // Only close if all required fields have been explicitly selected in this session
    // For 12h format: hour, minute, and period must all be selected
    if (newSelectedFields.hour && newSelectedFields.minute && newSelectedFields.period) {
      setIsOpen(false)
    }
  }

  // Reset selected fields when dropdown opens
  useEffect(() => {
    if (isOpen) {
      // Reset tracking when dropdown opens - user must select all fields in this session
      setSelectedFields({ hour: false, minute: false, period: false })
    }
  }, [isOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Generate hour options based on format
  const hours = timeFormat === '24h'
    ? Array.from({ length: 24 }, (_, i) => i)
    : Array.from({ length: 12 }, (_, i) => i + 1)
  
  // Generate minute options (0-59 in 1-minute increments)
  const minutes = Array.from({ length: 60 }, (_, i) => i)

  const scrollToSelected = (elementId: string) => {
    const element = document.getElementById(elementId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (hour !== null) scrollToSelected(`hour-${hour}`)
        if (minute !== null) scrollToSelected(`minute-${minute}`)
        scrollToSelected(`period-${period}`)
      }, 100)
    }
  }, [isOpen, hour, minute, period])

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input Display */}
      <button
        type="button"
        id={id}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[var(--primary)] flex items-center gap-2 bg-[var(--input)] border-[var(--border)] text-[var(--foreground)] transition-colors ${
          disabled 
            ? 'opacity-50 cursor-not-allowed' 
            : 'hover:bg-[var(--secondary)]'
        }`}
      >
        <Clock className="w-4 h-4 text-[var(--muted-foreground)]" />
        <span className={`flex-1 text-left ${
          hour === null || minute === null 
            ? theme === 'dark' ? 'text-[#d7d2cb]/50' : 'text-[var(--muted-foreground)]'
            : ''
        }`}>
          {formatDisplayTime()}
        </span>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && !disabled && (
          <>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute z-50 mt-1 rounded-lg border shadow-lg bg-[var(--background)] border-[var(--border)]"
              style={{ minWidth: '280px' }}
            >
              <div className="flex">
                {/* Hours Column */}
                <div className="flex-1 border-r border-[var(--border)]">
                  <div className="p-2 text-xs font-medium text-center border-b border-[var(--border)] text-[var(--muted-foreground)]">
                    Hour
                  </div>
                  <div className="max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--primary)]/20 scrollbar-track-transparent">
                    {hours.map((h) => (
                      <button
                        key={h}
                        id={`hour-${h}`}
                        type="button"
                        onClick={() => {
                          handleHourChange(h)
                        }}
                        className={`w-full px-3 py-2 text-sm text-center transition-colors ${
                          h === hour
                            ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                            : 'text-[var(--foreground)] hover:bg-[var(--secondary)]'
                        }`}
                      >
                        {h.toString().padStart(2, '0')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Minutes Column */}
                <div className="flex-1 border-r border-[var(--border)]">
                  <div className="p-2 text-xs font-medium text-center border-b border-[var(--border)] text-[var(--muted-foreground)]">
                    Minute
                  </div>
                  <div className="max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--primary)]/20 scrollbar-track-transparent">
                    {minutes.map((m) => (
                      <button
                        key={m}
                        id={`minute-${m}`}
                        type="button"
                        onClick={() => {
                          handleMinuteChange(m)
                        }}
                        className={`w-full px-3 py-2 text-sm text-center transition-colors ${
                          m === minute
                            ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                            : 'text-[var(--foreground)] hover:bg-[var(--secondary)]'
                        }`}
                      >
                        {m.toString().padStart(2, '0')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* AM/PM Column (12h only) */}
                {timeFormat === '12h' && (
                <div className="flex-1">
                  <div className="p-2 text-xs font-medium text-center border-b border-[var(--border)] text-[var(--muted-foreground)]">
                    Period
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {(['AM', 'PM'] as const).map((p) => (
                      <button
                        key={p}
                        id={`period-${p}`}
                        type="button"
                        onClick={() => {
                          handlePeriodChange(p)
                        }}
                        className={`w-full px-3 py-2 text-sm text-center transition-colors ${
                          p === period
                            ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                            : 'text-[var(--foreground)] hover:bg-[var(--secondary)]'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
