'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, Target, Check } from 'lucide-react'

interface Milestone {
  id: string
  title: string
  description: string
  day: number
  status: 'completed' | 'in_progress' | 'not_started'
}

interface InteractiveRoadmapProps {
  milestones: Milestone[]
  totalDays: number
  currentDay: number
  endDate: string
  getMilestoneStatus?: (milestone: Milestone) => 'completed' | 'in_progress' | 'not_started'
  hideCountdown?: boolean
}

const InteractiveRoadmap = ({ 
  milestones, 
  totalDays, 
  currentDay,
  endDate,
  getMilestoneStatus,
  hideCountdown = false
}: InteractiveRoadmapProps) => {
  const [timeLeft, setTimeLeft] = useState({
    months: '00',
    days: '00',
    hours: '00',
    minutes: '00',
    seconds: '00'
  })
  const [hoveredMilestone, setHoveredMilestone] = useState<Milestone | null>(null)
  const [hoveredNodePosition, setHoveredNodePosition] = useState<{x: number, y: number} | null>(null)
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null)
  const [animationTime, setAnimationTime] = useState(0)
  const [hasInteracted, setHasInteracted] = useState(false)
  const [showScrollHint, setShowScrollHint] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, scroll: 0 })
  const [scrollPosition, setScrollPosition] = useState(0)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Countdown timer
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date()
      const end = new Date(endDate)
      const difference = end.getTime() - now.getTime()

      if (difference > 0) {
        const totalSeconds = Math.floor(difference / 1000)
        const totalMinutes = Math.floor(totalSeconds / 60)
        const totalHours = Math.floor(totalMinutes / 60)
        const totalDays = Math.floor(totalHours / 24)
        
        let months = 0
        let remainingDays = totalDays
        
        let currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        while (currentDate < end) {
          const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, currentDate.getDate())
          if (nextMonth <= end) {
            months++
            currentDate = nextMonth
          } else {
            const timeDiff = end.getTime() - currentDate.getTime()
            remainingDays = Math.floor(timeDiff / (1000 * 60 * 60 * 24))
            break
          }
        }

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

  // Show scroll hint after delay
  useEffect(() => {
    if (!hasInteracted) {
      const timer = setTimeout(() => {
        setShowScrollHint(true)
        setTimeout(() => setShowScrollHint(false), 3000)
      }, 3000)
      
      return () => clearTimeout(timer)
    }
  }, [hasInteracted])

  // Animation loop
  useEffect(() => {
    const startTime = Date.now()
    
    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = (elapsed % 30000) / 30000
      setAnimationTime(progress)
      requestAnimationFrame(animate)
    }
    
    requestAnimationFrame(animate)
  }, [])

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX, scroll: scrollPosition })
    setHasInteracted(true)
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return
    
    const deltaX = dragStart.x - e.clientX
    const newScroll = Math.max(0, Math.min(dragStart.scroll + deltaX, (totalDays - 1) * 120))
    setScrollPosition(newScroll)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragStart, totalDays])

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    setIsDragging(true)
    setDragStart({ x: touch.clientX, scroll: scrollPosition })
    setHasInteracted(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return
    
    const touch = e.touches[0]
    const deltaX = dragStart.x - touch.clientX
    const newScroll = Math.max(0, Math.min(dragStart.scroll + deltaX, (totalDays - 1) * 120))
    setScrollPosition(newScroll)
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  // Get milestone for a specific day
  const getMilestoneForDay = (day: number) => {
    return milestones.find(milestone => milestone.day === day)
  }

  // Handle milestone hover with proper timeout management
  const handleMilestoneHover = (milestone: Milestone | null, dayNumber?: number) => {
    // Clear any existing timeout
    if (hoverTimeout) {
      clearTimeout(hoverTimeout)
      setHoverTimeout(null)
    }

    if (milestone && dayNumber) {
      setHoveredMilestone(milestone)
      setHoveredNodePosition({
        x: (dayNumber - 1) * 120 + 60 - scrollPosition, // Center of day container minus scroll offset
        y: -60 // Fixed distance above the timeline
      })
    } else {
      // Set a timeout to hide the popup after a delay
      const timeout = setTimeout(() => {
        setHoveredMilestone(null)
        setHoveredNodePosition(null)
        setHoverTimeout(null)
      }, 150)
      setHoverTimeout(timeout)
    }
  }

  // Clear hover immediately (for when user clicks away or scrolls)
  const clearHover = () => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout)
      setHoverTimeout(null)
    }
    setHoveredMilestone(null)
    setHoveredNodePosition(null)
  }

  const getTooltipPosition = () => {
    if (hoveredNodePosition) {
      return hoveredNodePosition
    }
    return { x: 0, y: 0 }
  }

  // Calculate animated sweep position
  const getSweepPosition = () => {
    const sweepProgress = Math.sin(animationTime * Math.PI * 2) * 0.5 + 0.5
    return sweepProgress * 100
  }

  return (
    <div className="mb-6">
      {/* Countdown Timer */}
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
              <Clock className="w-5 h-5 text-[var(--primary)]" />
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

      {/* Interactive Timeline */}
      <div className="relative h-40 overflow-hidden pt-8 mt-2 pl-16 pr-16">
        {/* Fade overlays at edges */}
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
            {/* Scroll hint */}
            <div 
              className="absolute z-30 pointer-events-none transition-opacity duration-700"
              style={{ 
                left: '60px',
                top: '2px',
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
            
            {/* Main timeline bar */}
            <div className="absolute top-1/2 h-1.5 bg-[var(--border)] transform -translate-y-1/2 z-0 rounded-full" style={{ left: '60px', width: `${(totalDays - 1) * 120}px` }} />
            
            {/* Progress bar */}
            <motion.div
              className="absolute top-1/2 h-1.5 bg-[var(--primary)] transform -translate-y-1/2 z-[1] rounded-full shadow-lg"
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
              const isLastDay = day === totalDays
              const isMilestone = !!milestone

              return (
                <div
                  key={day}
                  className="relative flex flex-col items-center justify-center"
                  style={{ minWidth: '120px' }}
                >
                  {/* Milestone tooltip - positioned outside but with proper centering */}
                  {(milestone || day === 1) && (
                    <AnimatePresence>
                      {hoveredMilestone && hoveredMilestone.id === (milestone?.id || 'day1') && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.9 }}
                          animate={{ opacity: 1, y: -10, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.9 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                          className="absolute -top-16 z-[100] whitespace-nowrap flex justify-center pointer-events-none"
                          style={{ width: '120px', left: '0' }}
                        >
                          <div className="bg-black/90 border border-white/20 rounded-lg p-3 shadow-xl">
                            {hoveredMilestone.id === 'day1' ? (
                              <span className="text-sm font-semibold text-[#d7d2cb]">
                                And so it begins...
                              </span>
                            ) : (
                              <>
                                <div className="flex items-center gap-2 mb-1">
                                  <Target className="w-4 h-4 text-purple-400" />
                                  <span className="text-sm font-semibold text-[#d7d2cb]">
                                    {hoveredMilestone.title}
                                  </span>
                                </div>
                                {hoveredMilestone.description && (
                                  <p className="text-xs text-[#d7d2cb]/70 leading-relaxed">
                                    {hoveredMilestone.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-1 mt-2">
                                  <div className={`w-2 h-2 rounded-full ${
                                    hoveredMilestone.status === 'completed' ? 'bg-green-500' :
                                    hoveredMilestone.status === 'in_progress' ? 'bg-[#ff7f00]' :
                                    'bg-gray-400'
                                  }`} />
                                  <span className="text-xs text-[#d7d2cb]/70">
                                    {hoveredMilestone.status === 'completed' ? 'Completed' :
                                     hoveredMilestone.status === 'in_progress' ? 'In Progress' :
                                     'Not Started'}
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}
                  
                  {/* Single hover area that covers both node and popup space */}
                  {(milestone || day === 1) && (
                    <div
                      className="absolute z-20 cursor-pointer"
                      style={{ 
                        width: '120px', // Full width of day container
                        height: '120px', // Extended height to include popup space
                        left: '0', 
                        top: '-60px' // Start above the node to include popup area
                      }}
                      onMouseEnter={() => {
                        if (day === 1) {
                          handleMilestoneHover({ 
                            id: 'day1', 
                            title: 'And so it begins...', 
                            description: 'The beginning of your journey', 
                            day: 1, 
                            status: 'completed' as const 
                          }, day)
                        } else if (milestone) {
                          handleMilestoneHover(milestone, day)
                        }
                      }}
                      onMouseLeave={() => {
                        handleMilestoneHover(null)
                      }}
                    />
                  )}

                  {/* Day node */}
                  <div className="relative flex items-center justify-center">
                    {/* Pulsing ring for current day */}
                    {isCurrent && (
                      <div className="absolute inset-0 rounded-full ring-3 ring-[var(--primary)]/40 animate-pulse"></div>
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
                          ? 'w-10 h-10 bg-[var(--primary)] border-[var(--primary)] text-white'
                          : isCompleted
                          ? 'w-10 h-10 bg-[var(--primary)] border-[var(--primary)] text-white'
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