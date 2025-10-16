'use client'

import { useState, useEffect } from 'react'

interface HealthCountdownTimerProps {
  cronSchedule?: string // e.g., '0 0 * * *' for daily at midnight
  className?: string
}

export function HealthCountdownTimer({ cronSchedule = '0 0 * * *', className = '' }: HealthCountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>('')

  // Parse cron schedule and calculate next run time
  const getNextHealthSnapshotTime = (schedule: string): Date => {
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
    }

    // Initial update
    updateTimer()
    
    // Update every second
    const interval = setInterval(updateTimer, 1000)
    
    return () => clearInterval(interval)
  }, [cronSchedule])

  return (
    <div className={`text-center ${className}`}>
      <p className="text-xs text-[#d7d2cb]/30 font-mono">
        {timeRemaining}
      </p>
    </div>
  )
}
