'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, Check, Target } from 'lucide-react'

interface Milestone {
  id: string
  title: string
  description?: string
  day: number
  status: 'not_started' | 'in_progress' | 'completed'
  estimated_date?: string
}

interface TimeLeft {
  months: string
  days: string
  hours: string
  minutes: string
  seconds: string
}

interface InteractiveRoadmapProps {
  milestones: Milestone[]
  totalDays: number
  currentDay: number
  endDate?: string // ISO date string for countdown
  getMilestoneStatus?: (milestone: Milestone) => 'completed' | 'in_progress'
  hideCountdown?: boolean
}

const InteractiveRoadmap = ({ 
  milestones, 
  totalDays, 
  currentDay,
  endDate = '2025-12-24T12:00:00',
  getMilestoneStatus,
  hideCountdown = false
}: InteractiveRoadmapProps) => {
  const [scrollPosition, setScrollPosition] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, scroll: 0 })
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    months: '00',
    days: '00',
    hours: '00',
    minutes: '00',
    seconds: '00'
  })
  const [hoveredMilestone, setHoveredMilestone] = useState<Milestone | null>(null)
  const [animationTime, setAnimationTime] = useState(0)
  const [hasInteracted, setHasInteracted] = useState(false)
  const [showScrollHint, setShowScrollHint] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Calculate progress percentage
  const progressPercentage = Math.min((currentDay / totalDays) * 100, 100)

  // Show scroll hint after a delay if user hasn't interacted
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasInteracted) {
        setShowScrollHint(true)
      }
    }, 3000) // Show after 3 seconds
    
    return () => clearTimeout(timer)
  }, [hasInteracted])

  // Countdown timer
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date()
      const end = new Date(endDate)
      const difference = end.getTime() - now.getTime()

      if (difference > 0) {
        // Calculate total time components
        const totalSeconds = Math.floor(difference / 1000)
        const totalMinutes = Math.floor(totalSeconds / 60)
        const totalHours = Math.floor(totalMinutes / 60)
        const totalDays = Math.floor(totalHours / 24)
        
        // Calculate months and remaining days
        let months = 0
        let remainingDays = totalDays
        
        // Start from current date and add months until we reach or exceed the end date
        let currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        while (currentDate < end) {
          const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, currentDate.getDate())
          if (nextMonth <= end) {
            months++
            currentDate = nextMonth
          } else {
            // Calculate remaining days in the current month
            const timeDiff = end.getTime() - currentDate.getTime()
            remainingDays = Math.floor(timeDiff / (1000 * 60 * 60 * 24))
            break
          }
        }

        // Calculate hours, minutes, seconds from the remaining time
        const remainingHours = totalHours % 24
        const remainingMinutes = totalMinutes % 60
        const remainingSeconds = totalSeconds % 60

        setTimeLeft({
          months: months.toString().padStart(2, '0'),
          days: remainingDays.toString().padStart(2, '0'),
          hours: remainingHours.toString().padStart(2, '0'),
          minutes: remainingMinutes.toString().padStart(2, '0'),
          seconds: remainingSeconds.toString().padStart(2, '0')
        })
      } else {
        setTimeLeft({
          months: '00',
          days: '00',
          hours: '00',
          minutes: '00',
          seconds: '00'
        })
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)

    return () => clearInterval(interval)
  }, [endDate])

  // Handle mouse events for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    setDragStart({
      x: e.clientX,
      scroll: scrollPosition
    })
    setHasInteracted(true)
    setShowScrollHint(false)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Handle touch events for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    setIsDragging(true)
    setDragStart({
      x: e.touches[0].clientX,
      scroll: scrollPosition
    })
    setHasInteracted(true)
    setShowScrollHint(false)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return
    e.preventDefault()
    
    const deltaX = e.touches[0].clientX - dragStart.x
    const maxScroll = Math.max(0, totalDays * 120 - 400)
    const newScroll = Math.max(0, Math.min(dragStart.scroll - deltaX, maxScroll))
    setScrollPosition(newScroll)
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  // Auto-scroll to current day on mount
  useEffect(() => {
    const targetScroll = Math.max(0, (currentDay - 1) * 120 - 200)
    setScrollPosition(targetScroll)
  }, [currentDay])

  // Add global mouse event listeners for dragging
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      e.preventDefault()
      
      const deltaX = e.clientX - dragStart.x
      const maxScroll = Math.max(0, totalDays * 120 - 400)
      const newScroll = Math.max(0, Math.min(dragStart.scroll - deltaX, maxScroll))
      setScrollPosition(newScroll)
    }

    const handleGlobalMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove)
      document.addEventListener('mouseup', handleGlobalMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove)
      document.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [isDragging, dragStart, totalDays])

  // Get milestone for a specific day
  const getMilestoneForDay = (day: number) => {
    const found = milestones.find(milestone => milestone.day === day)
    return found
  }

  const handleMilestoneHover = (milestone: Milestone | null) => {
    setHoveredMilestone(milestone)
  }

  // Automated gradient animation - smoother and more subtle
  useEffect(() => {
    const startTime = Date.now()
    
    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = (elapsed % 30000) / 30000 // 30 second loop - very slow and gentle
      setAnimationTime(progress)
      requestAnimationFrame(animate)
    }
    
    requestAnimationFrame(animate)
  }, [])

  // Calculate animated sweep position
  const getSweepPosition = () => {
    // Create a smooth sweep from left (0%) to right (100%) and back
    const sweepProgress = Math.sin(animationTime * Math.PI * 2) * 0.5 + 0.5 // 0 to 1
    return sweepProgress * 100 // Convert to percentage
  }

  return (
    <div className="mb-6">
      {/* Countdown Timer - Positioned over timeline with glassmorphism panel */}
      {!hideCountdown && (
      <div className="flex flex-col items-end mb-4 relative z-0 pr-16">
        <span className="text-xs font-semibold text-[#d7d2cb]/50 mb-1">(time left)</span>
        <div 
          ref={panelRef}
          className="relative border border-white/35 rounded-xl px-6 py-4 shadow-2xl overflow-hidden min-h-[80px] flex items-center justify-center" 
          style={{
            backgroundImage: (() => {
              const sweepPos = getSweepPosition()
              return `
                linear-gradient(90deg, 
                  rgba(255,255,255,0.02) 0%, 
                  rgba(255,255,255,0.02) ${Math.max(0, sweepPos - 40)}%, 
                  rgba(255,255,255,0.06) ${sweepPos}%, 
                  rgba(255,255,255,0.02) ${Math.min(100, sweepPos + 40)}%, 
                  rgba(255,255,255,0.02) 100%
                )
              `
            })()
          }}
        >
          <div className="flex items-center gap-4 text-[#d7d2cb]/80">
            <Clock className="w-5 h-5 text-[#ff7f00]" />
            <div className="flex items-center gap-1">
              <span className="text-2xl font-bold text-[#d7d2cb]">{timeLeft.months}</span>
              <span className="text-sm text-[#d7d2cb]/60">Months</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-2xl font-bold text-[#d7d2cb]">{timeLeft.days}</span>
              <span className="text-sm text-[#d7d2cb]/60">Days</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-2xl font-bold text-[#d7d2cb]">{timeLeft.hours}</span>
              <span className="text-sm text-[#d7d2cb]/60">Hours</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-2xl font-bold text-[#d7d2cb]">{timeLeft.minutes}</span>
              <span className="text-sm text-[#d7d2cb]/60">Minutes</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-2xl font-bold text-[#d7d2cb]">{timeLeft.seconds}</span>
              <span className="text-sm text-[#d7d2cb]/60">Seconds</span>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Minimal Interactive Timeline */}
      <div className="relative h-40 overflow-hidden pt-8 mt-2 pl-16 pr-16">
        {/* Fade overlays at edges - positioned to be always visible */}
        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#0a0a0a] to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#0a0a0a] to-transparent z-10 pointer-events-none" />
        
        {/* Scrollable timeline container */}
        <div
          ref={containerRef}
          className="relative h-full cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ userSelect: 'none' }}
        >
          <motion.div
            className="flex items-center h-full relative"
            animate={{ x: -scrollPosition }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {/* Scroll hint - positioned above day 1 node and centered - inside motion.div */}
            <div 
              className="absolute z-30 pointer-events-none transition-opacity duration-700"
              style={{ 
                left: '60px',
                top: '-20px',
                opacity: showScrollHint ? 1 : 0,
                transform: 'translateX(-50%)'
              }}
            >
              <div className="flex items-center gap-1 text-xs text-[#d7d2cb]/60 whitespace-nowrap">
                <span>(scroll)</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
            </div>
            
            {/* Main timeline bar - grey background */}
            <div className="absolute top-1/2 h-1 bg-white/20 transform -translate-y-1/2" style={{ left: '60px', width: `${(totalDays - 1) * 120}px` }} />
            
            {/* Progress bar - orange portion */}
            <motion.div
              className="absolute top-1/2 h-1 bg-gradient-to-r from-[#ff7f00] to-orange-400 transform -translate-y-1/2"
              initial={{ width: 0 }}
              animate={{ width: `${(currentDay - 1) * 120}px` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              style={{ left: '60px' }}
            />

            {/* Day nodes */}
            {Array.from({ length: totalDays }, (_, index) => {
              const day = index + 1
              const milestone = getMilestoneForDay(day)
              const isCompleted = day <= currentDay
              const isCurrent = day === currentDay
              const isFuture = day > currentDay
              const isLastDay = day === totalDays
              const isMilestone = !!milestone


              return (
                <div
                  key={day}
                  className="relative flex flex-col items-center justify-center"
                  style={{ minWidth: '120px' }}
                >
                  {/* Invisible hover area for milestones and day 1 */}
                  {(milestone || day === 1) && (
                    <div
                      className="absolute inset-0 z-20 cursor-pointer"
                      style={{ 
                        width: '60px', 
                        height: '60px', 
                        left: '50%', 
                        top: '50%', 
                        transform: 'translate(-50%, -50%)' 
                      }}
                      onMouseEnter={() => {
                        return day === 1 ? handleMilestoneHover({ id: 'day1', title: 'And so it begins...', description: 'The beginning of your journey', day: 1, status: 'completed' as const }) : milestone ? handleMilestoneHover(milestone) : null
                      }}
                      onMouseLeave={() => {
                        handleMilestoneHover(null)
                      }}
                    />
                  )}

                  {/* Day node - completely static */}
                  <div className="relative flex items-center justify-center">
                    {/* Pulsing ring for current day */}
                    {isCurrent && (
                      <div className="absolute inset-0 rounded-full ring-3 ring-[#ff7f00]/40 animate-pulse"></div>
                    )}
                    
                    <div
                      className={`relative rounded-full border-2 flex items-center justify-center z-10 ${
                        isLastDay
                          ? 'w-12 h-12 bg-green-500 border-green-500 text-white'
                          : day === 1
                          ? 'w-10 h-10 bg-orange-600 border-orange-600 text-white'
                          : isMilestone && day === currentDay
                          ? 'w-10 h-10 bg-purple-500 border-purple-500 text-white ring-4 ring-purple-500/30'
                          : isMilestone
                          ? 'w-10 h-10 bg-purple-500 border-purple-500 text-white'
                          : isCurrent
                          ? 'w-10 h-10 bg-[#ff7f00] border-[#ff7f00] text-white'
                          : isCompleted
                          ? 'w-10 h-10 bg-[#ff7f00] border-[#ff7f00] text-white'
                          : 'w-10 h-10 bg-[#1a1a1a] border-white/20 text-[#d7d2cb]/60'
                      }`}
                    >
                    {isLastDay ? (
                      <Check className="w-6 h-6" />
                    ) : (
                      <span className="font-medium text-xs">{day}</span>
                    )}
                  </div>
                  </div>

                  {/* Milestone tooltip */}
                  {(milestone || day === 1) && (
                    <AnimatePresence>
                      {hoveredMilestone && hoveredMilestone.id === (milestone?.id || 'day1') && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.9 }}
                          animate={{ opacity: 1, y: -10, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.9 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                          className="absolute -top-12 left-1/2 transform -translate-x-1/2 z-30 whitespace-nowrap"
                          onMouseEnter={() => milestone ? handleMilestoneHover(milestone) : null}
                          onMouseLeave={() => handleMilestoneHover(null)}
                        >
                          <div className="bg-black/90 border border-white/20 rounded-lg p-3 shadow-xl">
                            {(milestone?.id || 'day1') === 'day1' ? (
                              <span className="text-sm font-semibold text-[#d7d2cb]">
                                And so it begins...
                              </span>
                            ) : (
                              <>
                                <div className="flex items-center gap-2 mb-1">
                                  <Target className="w-4 h-4 text-purple-400" />
                                  <span className="text-sm font-semibold text-[#d7d2cb]">
                                    {milestone?.title}
                                  </span>
                                </div>
                                {milestone?.description && (
                                  <p className="text-xs text-[#d7d2cb]/70 leading-relaxed">
                                    {milestone.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-1 mt-2">
                                  {(() => {
                                    const actualStatus = getMilestoneStatus && milestone ? getMilestoneStatus(milestone) : milestone?.status || 'not_started'
                                    return (
                                      <>
                                        <div className={`w-2 h-2 rounded-full ${
                                          actualStatus === 'completed' ? 'bg-green-500' :
                                          actualStatus === 'in_progress' ? 'bg-[#ff7f00]' :
                                          'bg-white/40'
                                        }`} />
                                        <span className="text-xs text-[#d7d2cb]/60 capitalize">
                                          {actualStatus === 'completed' ? 'Completed' : 'In Progress'}
                                        </span>
                                      </>
                                    )
                                  })()}
                                </div>
                              </>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}
                </div>
              )
            })}
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default InteractiveRoadmap