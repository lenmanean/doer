'use client'

import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface HealthCountdownTimerProps {
  cronSchedule?: string // e.g., '0 0 * * *' for daily at midnight
  className?: string
}

export function HealthCountdownTimer({ cronSchedule = '0 0 * * *', className = '' }: HealthCountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>('')
  const [isActive, setIsActive] = useState(true)

  // Parse cron schedule and calculate next run time
  const getNextHealthSnapshotTime = (schedule: string): Date => {
    // Parse cron format: minute hour day month dayOfWeek
    // For now, assuming daily at midnight: '0 0 * * *'
    const parts = schedule.split(' ')
    const minute = parseInt(parts[0])
    const hour = parseInt(parts[1])
    
    const now = new Date()
    const nextRun = new Date()
    nextRun.setHours(hour, minute, 0, 0)
    
    // If the time has passed today, set for tomorrow
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1)
    }
    
    return nextRun
  }

  // Calculate time remaining
  const calculateTimeRemaining = (targetTime: Date): string => {
    const now = new Date()
    const diff = targetTime.getTime() - now.getTime()
    
    if (diff <= 0) {
      return '00:00:00'
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  useEffect(() => {
    const updateTimer = () => {
      const nextRun = getNextHealthSnapshotTime(cronSchedule)
      const timeRemaining = calculateTimeRemaining(nextRun)
      setTimeRemaining(timeRemaining)
      
      // Check if timer has expired (should be rare due to 1-second interval)
      if (timeRemaining === '00:00:00') {
        setIsActive(false)
        // Reset for next day after a brief pause
        setTimeout(() => {
          setIsActive(true)
        }, 2000)
      }
    }

    // Initial update
    updateTimer()
    
    // Update every second
    const interval = setInterval(updateTimer, 1000)
    
    return () => clearInterval(interval)
  }, [cronSchedule])

  const getNextRunTime = (): string => {
    const nextRun = getNextHealthSnapshotTime(cronSchedule)
    return nextRun.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    })
  }

  const getNextRunDate = (): string => {
    const nextRun = getNextHealthSnapshotTime(cronSchedule)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    if (nextRun.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (nextRun.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow'
    } else {
      return nextRun.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric' 
      })
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-3 rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 ${className}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Clock className="w-4 h-4 text-blue-400" />
        <p className="text-xs text-[#d7d2cb]/60">Next Health Snapshot</p>
      </div>
      
      <div className="flex items-center justify-between">
        <div>
          <AnimatePresence mode="wait">
            <motion.div
              key={timeRemaining}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              transition={{ duration: 0.2 }}
              className="text-lg font-mono font-bold text-blue-400"
            >
              {isActive ? timeRemaining : '00:00:00'}
            </motion.div>
          </AnimatePresence>
        </div>
        
        <div className="text-right">
          <p className="text-xs text-[#d7d2cb]/60">
            {getNextRunDate()}
          </p>
          <p className="text-xs text-[#d7d2cb]/60">
            {getNextRunTime()}
          </p>
        </div>
      </div>
      
      {!isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-2 text-center"
        >
          <p className="text-xs text-green-400 animate-pulse">
            Health snapshot in progress...
          </p>
        </motion.div>
      )}
    </motion.div>
  )
}
