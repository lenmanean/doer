'use client'
import { motion, useSpring, useTransform, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, X } from 'lucide-react'
import { useCountUp } from '@/hooks/useCountUp'

interface HealthHistory {
  progress: Array<{ value: number; snapshot_date: string }>
  consistency: Array<{ value: number; snapshot_date: string }>
  efficiency: Array<{ value: number; snapshot_date: string }>
}

export function PulseOrb({ progress, consistency, efficiency, healthHistory, hasScheduledTasks = true, healthScore = 100, noPlan = false, showHealthTooltip = false, expandable = false, onExpand }: {
  progress: number
  consistency: number
  efficiency: number | null
  healthHistory?: HealthHistory
  hasScheduledTasks?: boolean
  healthScore?: number
  noPlan?: boolean
  showHealthTooltip?: boolean
  expandable?: boolean
  onExpand?: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const [time, setTime] = useState(0)
  const [hoveredTooltip, setHoveredTooltip] = useState<'progress' | 'consistency' | 'efficiency' | null>(null)
  const [expandedMetric, setExpandedMetric] = useState<'progress' | 'consistency' | 'efficiency' | null>(null)
  const [tooltipHovered, setTooltipHovered] = useState(false)

  // Use degrading health model: health score is already 0-100
  // Convert to 0-1 scale for color calculations
  // Gray orb only when no tasks scheduled yet
  const vitality = hasScheduledTasks ? healthScore / 100 : 0

  // Motion springs
  const scale = useSpring(1, { stiffness: 120, damping: 10 })
  const pulse = useSpring(0, { stiffness: 80, damping: 12 })

  // Continuous orbital animation
  useEffect(() => {
    if (!hovered) return
    
    const interval = setInterval(() => {
      setTime(prev => prev + 0.001) // Ultra slow orbital speed
    }, 16) // ~60fps
    
    return () => clearInterval(interval)
  }, [hovered])

  useEffect(() => {
    const pulseInterval = setInterval(() => {
      pulse.set(vitality * 10) // intensity based on vitality
      setTimeout(() => pulse.set(0), 800)
    }, 2500 - vitality * 1000)
    return () => clearInterval(pulseInterval)
  }, [vitality])

  const outerGlow = useTransform(pulse, [0, 10], ['0px', `${30 + vitality * 40}px`])
  
  // Determine color based on vitality score (degrading health model)
  const getOrbColor = (vitality: number, hasScheduledTasks: boolean) => {
    // Gray when no tasks scheduled yet (dormant plan)
    if (!hasScheduledTasks) {
      return `rgba(156, 163, 175, 0.5)` // Gray
    }
    
    // Degrading health bar colors
    if (vitality >= 0.8) {
      // Green for 80-100% (excellent health maintained)
      return `rgba(34, 197, 94, ${0.6 + vitality * 0.3})`
    } else if (vitality >= 0.6) {
      // Yellow/Orange for 60-79% (health degrading, needs attention)
      return `rgba(251, 146, 60, ${0.6 + vitality * 0.3})`
    } else {
      // Red for <60% (critical health, immediate action needed)
      return `rgba(239, 68, 68, ${0.6 + vitality * 0.3})`
    }
  }
  
  const color = getOrbColor(vitality, hasScheduledTasks)

  // Generate improvement insights based on metric value
  const getImprovementInsight = (metricName: string, value: number) => {
    if (value >= 80) {
      return `Outstanding ${metricName.toLowerCase()} performance! Keep up the excellent work.`
    } else if (value >= 60) {
      return `Good ${metricName.toLowerCase()} - you're on the right track. Push a bit harder to reach excellence.`
    } else {
      const suggestions = {
        progress: 'Complete more tasks daily to increase your progress score.',
        consistency: 'Maintain a regular schedule to improve consistency.',
        efficiency: 'Focus on high-priority items to boost efficiency.'
      }
      return suggestions[metricName.toLowerCase() as keyof typeof suggestions] || 'Keep working towards your goals.'
    }
  }

  // Get trend from history
  const getTrend = (metricName: 'progress' | 'consistency' | 'efficiency') => {
    if (!healthHistory) return 0
    const history = healthHistory[metricName]
    if (history.length < 2) return 0
    const current = history[history.length - 1]?.value || 0
    const previous = history[history.length - 2]?.value || 0
    return current - previous
  }

  // Generate sparkline path
  const generateSparkline = (data: Array<{ value: number }>) => {
    if (data.length === 0) return ''
    const width = 100
    const height = 30
    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * width
      const y = height - (d.value / 100) * height
      return `${x},${y}`
    })
    return `M ${points.join(' L ')}`
  }

  // Close panel on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpandedMetric(null)
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [])

  // Get metric data
  const getMetricData = (metricName: 'progress' | 'consistency' | 'efficiency') => {
    const values = { progress, consistency, efficiency: efficiency ?? 0 }
    const colors = {
      progress: '#22c55e',
      consistency: '#eab308',
      efficiency: '#3b82f6'
    }
    return {
      value: values[metricName],
      color: colors[metricName],
      trend: getTrend(metricName),
      history: healthHistory?.[metricName] || [],
      insight: getImprovementInsight(metricName.charAt(0).toUpperCase() + metricName.slice(1), values[metricName])
    }
  }

  return (
    <div
      className="flex flex-col items-center justify-center relative cursor-pointer select-none"
      onMouseEnter={() => { setHovered(true); scale.set(1.1) }}
      onMouseLeave={() => { setHovered(false); scale.set(1) }}
    >
      {/* Outer glow */}
      <motion.div
        style={{
          boxShadow: useTransform(pulse, [0, 10], [
            `0 0 0 rgba(255,255,255,0)`,
            `0 0 ${30 + vitality * 40}px rgba(255,255,255,0.2)`
          ]),
          scale,
        }}
        className="relative w-52 h-52 rounded-full flex items-center justify-center"
      >
        {/* Pulsating outer glow ring */}
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{
            background: color,
            filter: 'blur(20px)',
          }}
        ></motion.div>

        {/* Core orb */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: color,
            filter: `blur(${8 + vitality * 6}px)`,
            boxShadow: `0 0 ${20 + vitality * 30}px ${color}`,
            transform: `scale(${1 + vitality * 0.2})`,
            transition: 'all 0.4s ease',
          }}
        ></motion.div>

        {/* Health status display on hover - Only show when no plan or no tasks scheduled */}
        <AnimatePresence>
          {hovered && !expandedMetric && !hasScheduledTasks && (
            <motion.div
              className="absolute flex flex-col items-center justify-center text-center"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <div className="text-sm text-[#d7d2cb]/70 bg-white/10 px-4 py-2 rounded-lg backdrop-blur-sm border border-white/10">
                {noPlan ? 'No plan' : 'No tasks scheduled yet'}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Health percentage tooltip - Show when hovering with active plan */}
        <AnimatePresence>
          {hovered && !expandedMetric && hasScheduledTasks && showHealthTooltip && (
            <motion.div
              className="absolute flex flex-col items-center justify-center text-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
            >
              <div className="text-lg font-medium text-[#d7d2cb] bg-white/10 px-5 py-2.5 rounded-lg border border-white/10">
                {Math.round(healthScore)}%
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expandable tooltip for health page - Shows health percentage, + on hover */}
        <AnimatePresence>
          {hovered && !expandedMetric && hasScheduledTasks && expandable && (
            <motion.div
              className="absolute flex flex-col items-center justify-center text-center cursor-pointer"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              onClick={() => onExpand?.()}
              onMouseEnter={() => setTooltipHovered(true)}
              onMouseLeave={() => setTooltipHovered(false)}
            >
              <motion.div 
                className="text-xs text-[#d7d2cb] rounded-lg backdrop-blur-sm border border-white/10 overflow-hidden"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.1)'
                }}
                animate={{
                  backgroundColor: tooltipHovered ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)'
                }}
                transition={{ 
                  duration: 0.2,
                  ease: "easeOut"
                }}
              >
                <div className="font-medium flex flex-col items-center px-3 py-1.5">
                  <div>{Math.round(healthScore)}%</div>
                  <motion.div
                    animate={{ 
                      opacity: tooltipHovered ? 1 : 0,
                      height: tooltipHovered ? '14px' : 0,
                      marginTop: tooltipHovered ? '2px' : 0
                    }}
                    transition={{ 
                      duration: 0.2,
                      ease: "easeOut"
                    }}
                    className="text-[10px] text-[#d7d2cb]/60"
                  >
                    +
                  </motion.div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expanded Metric Panel */}
        <AnimatePresence>
          {expandedMetric && (() => {
            const metricData = getMetricData(expandedMetric)
            const animatedValue = metricData.value
            
            return (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 flex items-center justify-center z-50"
                onClick={() => setExpandedMetric(null)}
              >
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/40 backdrop-blur-md rounded-full" />
                
                {/* Panel Content */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="relative bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-6 max-w-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Close Button */}
                  <button
                    onClick={() => setExpandedMetric(null)}
                    className="absolute top-3 right-3 text-[#d7d2cb]/60 hover:text-[#d7d2cb] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  {/* Metric Header */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: metricData.color }}
                      />
                      <h3 className="text-lg font-semibold text-[#d7d2cb]">
                        {expandedMetric.charAt(0).toUpperCase() + expandedMetric.slice(1)}
                      </h3>
                    </div>
                    
                    {/* Large Value */}
                    <div className="flex items-baseline gap-3">
                      <span 
                        className="text-4xl font-bold"
                        style={{ color: metricData.color }}
                      >
                        {Math.round(animatedValue)}%
                      </span>
                      
                      {/* Trend Indicator */}
                      {metricData.trend !== 0 && (
                        <div className={`flex items-center text-sm font-medium ${metricData.trend > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {metricData.trend > 0 ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : (
                            <TrendingDown className="w-4 h-4" />
                          )}
                          <span className="ml-1">{Math.abs(Math.round(metricData.trend))}%</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Mini Sparkline */}
                  {metricData.history.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-[#d7d2cb]/60 mb-2">Last 6 snapshots</p>
                      <svg width="100%" height="40" viewBox="0 0 100 30" className="overflow-visible">
                        {metricData.history.length > 1 && (
                          <motion.path
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 0.8, ease: 'easeInOut' }}
                            d={generateSparkline(metricData.history)}
                            fill="none"
                            stroke={metricData.color}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        )}
                        {/* Data points */}
                        {metricData.history.map((point, i) => {
                          const x = metricData.history.length === 1 ? 50 : (i / (metricData.history.length - 1)) * 100
                          const y = 30 - (point.value / 100) * 30
                          return (
                            <motion.circle
                              key={i}
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: 0.1 * i }}
                              cx={x}
                              cy={y}
                              r="2"
                              fill={metricData.color}
                            />
                          )
                        })}
                      </svg>
                    </div>
                  )}

                  {/* Improvement Insight */}
                  <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                    <p className="text-xs text-[#d7d2cb]/80 leading-relaxed">
                      {metricData.insight}
                    </p>
                  </div>
                </motion.div>
              </motion.div>
            )
          })()}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
