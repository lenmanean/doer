'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart, Plus, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sidebar } from '@/components/ui/Sidebar'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useOnboardingProtection } from '@/lib/useOnboardingProtection'
import { fetchHealthMetrics, fetchHealthInsights, fetchHealthHistory } from '@/lib/analytics'
import { useUserRoadmap } from '@/hooks/useUserRoadmap'
import { PulseOrb } from '@/components/ui/PulseOrb'

export default function HealthPage() {
  const router = useRouter()
  const { user, profile, loading, handleSignOut } = useOnboardingProtection()
  const { roadmapData, loading: roadmapLoading } = useUserRoadmap(user?.id || null)
  const [isClient, setIsClient] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Health metrics state
  const [healthScore, setHealthScore] = useState(100)
  const [hasScheduledTasks, setHasScheduledTasks] = useState(false)
  const [progress, setProgress] = useState(0)
  const [consistency, setConsistency] = useState(0)
  const [efficiency, setEfficiency] = useState<number | null>(null)
  const [currentStreak, setCurrentStreak] = useState(0)
  const [penalties, setPenalties] = useState({
    lateCompletions: 0,
    overdueTasks: 0,
    consistencyGaps: 0,
    progressLag: 0
  })
  const [bonuses, setBonuses] = useState({
    ontimeCompletions: 0,
    earlyCompletions: 0,
    streakBonus: 0
  })
  const [loadingMetrics, setLoadingMetrics] = useState(true)
  
  // Analytics state
  const [healthInsight, setHealthInsight] = useState<{
    trend: 'improving' | 'declining' | 'neutral'
    message: string
    change: number
  } | null>(null)
  const [healthHistory, setHealthHistory] = useState<any[]>([])
  const [metricTrends, setMetricTrends] = useState<{
    progress: 'up' | 'down' | 'stable'
    consistency: 'up' | 'down' | 'stable'
    efficiency: 'up' | 'down' | 'stable'
  }>({ progress: 'stable', consistency: 'stable', efficiency: 'stable' })
  
  // Track hover state for each orb to pause animations
  const [hoveredOrb, setHoveredOrb] = useState<'progress' | 'consistency' | 'efficiency' | null>(null)
  
  // Track hover state for overall orb
  const [isOverallOrbHovered, setIsOverallOrbHovered] = useState(false)
  
  // Track if hover effects are enabled (delayed on expand to prevent accidental hovers)
  const [hoverEffectsEnabled, setHoverEffectsEnabled] = useState(false)
  


  useEffect(() => {
    setIsClient(true)
  }, [])

  // Enable/disable hover effects with delay when expanded view changes
  useEffect(() => {
    if (isExpanded) {
      // Delay enabling hover effects by 1 second when expanding
      const timer = setTimeout(() => {
        setHoverEffectsEnabled(true)
      }, 1000)
      return () => clearTimeout(timer)
    } else {
      // Disable hover effects immediately when collapsing
      setHoverEffectsEnabled(false)
      setHoveredOrb(null)
    }
  }, [isExpanded])

  // Load health metrics and analytics
  useEffect(() => {
    const load = async () => {
      if (!user?.id) return
      setLoadingMetrics(true)
      try {
        const planId = roadmapData?.plan?.id
        if (!planId) {
          setLoadingMetrics(false)
          return
        }
        
        // Fetch current metrics
        const metrics = await fetchHealthMetrics(user.id, planId)
        
        setHealthScore(metrics.healthScore)
        setHasScheduledTasks(metrics.hasScheduledTasks)
        setProgress(metrics.progressVal)
        setConsistency(metrics.consistencyVal)
        setEfficiency(metrics.efficiencyVal)
        setCurrentStreak(metrics.currentStreakDays)
        setPenalties(metrics.penalties)
        setBonuses(metrics.bonuses)
        
        // Fetch analytics insights
        try {
          const insights = await fetchHealthInsights(user.id, planId)
          setHealthInsight(insights as { trend: 'improving' | 'declining' | 'neutral', message: string, change: number })
        } catch (e) {
          console.log('No insights available yet:', e)
        }
        
        // Fetch recent history for sparklines
        try {
          const history = await fetchHealthHistory(user.id, planId, 7)
          setHealthHistory(history)
          
          // Calculate trends for each metric
          if (history.length >= 2) {
            const latest = history[history.length - 1]
            const previous = history[history.length - 2]
            
            const trends = {
              progress: latest.progress > previous.progress ? 'up' as const : 
                       latest.progress < previous.progress ? 'down' as const : 'stable' as const,
              consistency: latest.consistency > previous.consistency ? 'up' as const : 
                          latest.consistency < previous.consistency ? 'down' as const : 'stable' as const,
              efficiency: (latest.efficiency ?? 0) > (previous.efficiency ?? 0) ? 'up' as const : 
                         (latest.efficiency ?? 0) < (previous.efficiency ?? 0) ? 'down' as const : 'stable' as const
            }
            setMetricTrends(trends)
          }
        } catch (e) {
          console.log('No history available yet:', e)
        }
        
      } catch (e) {
        console.error('Failed to load health metrics', e)
      } finally {
        setLoadingMetrics(false)
      }
    }

    if (isClient && user?.id && !roadmapLoading) {
      load()
    }
  }, [isClient, user?.id, roadmapLoading, roadmapData?.plan?.id])

  // Helper function to render mini sparkline
  const renderSparkline = (metricKey: 'progress' | 'consistency' | 'efficiency') => {
    if (healthHistory.length < 2) return null
    
    const points = healthHistory.map(h => metricKey === 'efficiency' ? (h.efficiency ?? 0) : h[metricKey])
    const max = Math.max(...points, 1)
    const width = 60
    const height = 20
    const step = width / (points.length - 1)
    
    const path = points.map((value, i) => {
      const x = i * step
      const y = height - (value / max) * height
      return `${i === 0 ? 'M' : 'L'} ${x},${y}`
    }).join(' ')
    
    return (
      <svg width={width} height={height} className="opacity-60">
        <path d={path} fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    )
  }

  // Helper function to get trend icon
  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-400" />
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-400" />
    return <Minus className="w-4 h-4 text-[#d7d2cb]/40" />
  }

  // Show loading while checking auth
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-[#d7d2cb]">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Sidebar user={profile || { email: user?.email || '' }} onSignOut={handleSignOut} currentPath="/health" />
      
      {/* Insights Banner */}
      {healthInsight && healthInsight.trend !== 'neutral' && !isExpanded && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50"
        >
          <div className={`px-6 py-3 rounded-full border backdrop-blur-sm ${
            healthInsight.trend === 'improving' 
              ? 'bg-green-500/10 border-green-500/30' 
              : 'bg-red-500/10 border-red-500/30'
          }`}>
            <div className="flex items-center gap-2">
              {healthInsight.trend === 'improving' ? (
                <TrendingUp className="w-5 h-5 text-green-400" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-400" />
              )}
              <span className={`font-medium ${
                healthInsight.trend === 'improving' ? 'text-green-300' : 'text-red-300'
              }`}>
                {healthInsight.message}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      <main className="min-h-screen flex items-center justify-center">
        {!roadmapData?.plan && !roadmapLoading ? (
          <div className="w-[400px] h-[400px]">
            <PulseOrb
              progress={0}
              consistency={0}
              efficiency={null}
              hasScheduledTasks={false}
              healthScore={0}
              noPlan={true}
            />
          </div>
        ) : loadingMetrics ? (
          <div className="text-[#d7d2cb]/60">Loading...</div>
        ) : (
          <AnimatePresence mode="wait">
            {!isExpanded ? (
              <div className="relative">
                <motion.div 
                  key="collapsed"
                  className="w-[400px] h-[400px]"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  onMouseEnter={() => setIsOverallOrbHovered(true)}
                  onMouseLeave={() => setIsOverallOrbHovered(false)}
                >
            <PulseOrb
              progress={progress}
              consistency={consistency}
              efficiency={efficiency}
              hasScheduledTasks={hasScheduledTasks}
              healthScore={healthScore}
              expandable={true}
                    onExpand={() => {
                      setIsOverallOrbHovered(false)
                      setTimeout(() => setIsExpanded(true), 200)
                    }}
                  />
                </motion.div>

                {/* Stats Panel - Right Side (collapsed view, only on hover) */}
                <AnimatePresence>
                  {isOverallOrbHovered && (
                    <motion.div
                      className="absolute top-1/2 -translate-y-1/2 left-[calc(100%+120px)] w-72 space-y-4"
                      initial={{ opacity: 0, x: -30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -30 }}
                      transition={{ duration: 0.3 }}
                    >
                  {/* Overall Health Score */}
                  <div className="bg-white/20 backdrop-blur-xl rounded-xl p-4 border border-white/20">
                    <div className="text-[#d7d2cb]/60 text-xs mb-2 uppercase tracking-wide">Overall Health</div>
                    <div className="flex items-end gap-2">
                      <div className="text-4xl font-bold text-green-300">{healthScore}%</div>
                      {healthInsight && healthInsight.trend !== 'neutral' && (
                        <div className={`text-xs mb-2 flex items-center gap-1 ${
                          healthInsight.trend === 'improving' ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {healthInsight.trend === 'improving' ? '↗' : '↘'} {Math.abs(healthInsight.change)}%
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Penalties Breakdown */}
                  <div className="bg-white/20 backdrop-blur-xl rounded-xl p-4 border border-white/20">
                    <div className="text-[#d7d2cb]/60 text-xs mb-3 uppercase tracking-wide">Penalties</div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-[#d7d2cb]/60">Late Completions</span>
                        <span className="text-red-400 font-medium">{penalties.lateCompletions}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[#d7d2cb]/60">Overdue Tasks</span>
                        <span className="text-red-400 font-medium">{penalties.overdueTasks}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[#d7d2cb]/60">Consistency Gaps</span>
                        <span className="text-red-400 font-medium">{penalties.consistencyGaps}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[#d7d2cb]/60">Progress Lag</span>
                        <span className="text-red-400 font-medium">{penalties.progressLag}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bonuses Breakdown */}
                  <div className="bg-white/20 backdrop-blur-xl rounded-xl p-4 border border-white/20">
                    <div className="text-[#d7d2cb]/60 text-xs mb-3 uppercase tracking-wide">Bonuses</div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-[#d7d2cb]/60">On-time</span>
                        <span className="text-green-400 font-medium">+{bonuses.ontimeCompletions}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[#d7d2cb]/60">Early</span>
                        <span className="text-green-400 font-medium">+{bonuses.earlyCompletions}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[#d7d2cb]/60">Streak</span>
                        <span className="text-green-400 font-medium">+{bonuses.streakBonus}</span>
                      </div>
                    </div>
                  </div>

                      {/* Current Streak */}
                      <div className="bg-white/20 backdrop-blur-xl rounded-xl p-4 border border-white/20">
                        <div className="text-[#d7d2cb]/60 text-xs mb-2 uppercase tracking-wide">Current Streak</div>
                        <div className="flex items-baseline gap-2">
                          <div className="text-3xl font-bold text-[#d7d2cb]">{currentStreak}</div>
                          <div className="text-[#d7d2cb]/60 text-sm">days</div>
                        </div>
                        {currentStreak > 0 && (
                          <div className="text-xs text-green-400 mt-2">🔥 Keep it up!</div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
          <motion.div 
                key="expanded"
            className="relative w-full h-full flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.1 }}
          >
            {/* Expanded view with 3 glowing orbs */}
            <div className="relative w-[800px] h-[800px]">
              {/* Progress Orb - Top */}
              <motion.div 
                className="absolute"
                style={{
                  left: '50%',
                  top: '50%',
                }}
                initial={{ x: '-50%', y: '-50%', scale: 2.5, opacity: 0 }}
                animate={{ 
                  x: '-50%', 
                  y: 'calc(-50% - 200px)',
                  scale: 1,
                  opacity: hoveredOrb && hoveredOrb !== 'progress' ? 0.3 : 1,
                  filter: hoveredOrb && hoveredOrb !== 'progress' ? 'blur(4px)' : 'blur(0px)',
                }}
                exit={{ 
                  x: '-50%', 
                  y: '-50%',
                  scale: 0.3,
                  opacity: 0
                }}
                transition={{ 
                  duration: 0.3,
                  ease: "easeInOut"
                }}
              >
                <div 
                  className="relative group cursor-pointer"
                  onMouseEnter={() => hoverEffectsEnabled && setHoveredOrb('progress')}
                  onMouseLeave={() => hoverEffectsEnabled && setHoveredOrb(null)}
                >
                  {/* Outer glow layers */}
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `radial-gradient(circle, rgba(34, 197, 94, 0.3) 0%, transparent 70%)`,
                      width: '180px',
                      height: '180px',
                      transform: 'translate(-50%, -50%)',
                      left: '50%',
                      top: '50%',
                      filter: 'blur(20px)',
                    }}
                    animate={{
                      opacity: [0.5, 0.8, 0.5],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                  
                  {/* Core orb */}
                  <motion.div
                    className="relative w-32 h-32 rounded-full flex items-center justify-center border-2"
                    style={{
                      background: `radial-gradient(circle at 30% 30%, rgba(34, 197, 94, 0.4), rgba(34, 197, 94, 0.1))`,
                      borderColor: 'rgba(34, 197, 94, 0.5)',
                    }}
                    animate={{
                      boxShadow: [
                        '0 0 40px rgba(34, 197, 94, 0.6), inset 0 0 20px rgba(34, 197, 94, 0.3)',
                        '0 0 60px rgba(34, 197, 94, 0.8), inset 0 0 30px rgba(34, 197, 94, 0.5)',
                        '0 0 40px rgba(34, 197, 94, 0.6), inset 0 0 20px rgba(34, 197, 94, 0.3)',
                      ],
                      scale: hoveredOrb === 'progress' ? 1.1 : 1
                    }}
                    transition={{
                      boxShadow: {
                        duration: 3,
                      repeat: Infinity,
                        repeatType: "loop",
                      ease: "easeInOut",
                      },
                      scale: {
                        duration: 0.2,
                        ease: "easeOut"
                      }
                    }}
                  >
                    <div className="text-center z-10 flex flex-col items-center">
                      <div className="flex items-center gap-2 mb-1">
                        {getTrendIcon(metricTrends.progress)}
                      <div className="text-3xl font-bold text-green-300">{Math.round(progress)}%</div>
                      </div>
                      <div className="text-[10px] text-[#d7d2cb]/60 mb-1">Progress</div>
                      <div className="text-green-300">
                        {renderSparkline('progress')}
                      </div>
                    </div>
                  </motion.div>
                </div>
              </motion.div>

              {/* Consistency Orb - Bottom Left */}
              <motion.div 
                className="absolute"
                style={{
                  left: '50%',
                  top: '50%',
                }}
                initial={{ x: '-50%', y: '-50%', scale: 2.5, opacity: 0 }}
                animate={{ 
                  x: 'calc(-50% - 173px)', 
                  y: 'calc(-50% + 100px)',
                  scale: 1,
                  opacity: hoveredOrb && hoveredOrb !== 'consistency' ? 0.3 : 1,
                  filter: hoveredOrb && hoveredOrb !== 'consistency' ? 'blur(4px)' : 'blur(0px)',
                }}
                exit={{ 
                  x: '-50%', 
                  y: '-50%',
                  scale: 0.3,
                  opacity: 0
                }}
                transition={{ 
                  duration: 0.3,
                  ease: "easeInOut"
                }}
              >
                <div 
                  className="relative group cursor-pointer"
                  onMouseEnter={() => hoverEffectsEnabled && setHoveredOrb('consistency')}
                  onMouseLeave={() => hoverEffectsEnabled && setHoveredOrb(null)}
                >
                  {/* Outer glow layers */}
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `radial-gradient(circle, rgba(34, 197, 94, 0.3) 0%, transparent 70%)`,
                      width: '180px',
                      height: '180px',
                      transform: 'translate(-50%, -50%)',
                      left: '50%',
                      top: '50%',
                      filter: 'blur(20px)',
                    }}
                    animate={{
                      opacity: [0.5, 0.8, 0.5],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 0.5,
                    }}
                  />
                  
                  {/* Core orb */}
                  <motion.div
                    className="relative w-32 h-32 rounded-full flex items-center justify-center border-2"
                    style={{
                      background: `radial-gradient(circle at 30% 30%, rgba(34, 197, 94, 0.4), rgba(34, 197, 94, 0.1))`,
                      borderColor: 'rgba(34, 197, 94, 0.5)',
                    }}
                    animate={{
                      boxShadow: [
                        '0 0 40px rgba(34, 197, 94, 0.6), inset 0 0 20px rgba(34, 197, 94, 0.3)',
                        '0 0 60px rgba(34, 197, 94, 0.8), inset 0 0 30px rgba(34, 197, 94, 0.5)',
                        '0 0 40px rgba(34, 197, 94, 0.6), inset 0 0 20px rgba(34, 197, 94, 0.3)',
                      ],
                      scale: hoveredOrb === 'consistency' ? 1.1 : 1
                    }}
                    transition={{
                      boxShadow: {
                        duration: 3,
                      repeat: Infinity,
                        repeatType: "loop",
                      ease: "easeInOut",
                      delay: 0.5,
                      },
                      scale: {
                        duration: 0.2,
                        ease: "easeOut"
                      }
                    }}
                  >
                    <div className="text-center z-10 flex flex-col items-center">
                      <div className="flex items-center gap-2 mb-1">
                        {getTrendIcon(metricTrends.consistency)}
                      <div className="text-3xl font-bold text-green-300">{Math.round(consistency)}%</div>
                      </div>
                      <div className="text-[10px] text-[#d7d2cb]/60 mb-1">Consistency</div>
                      <div className="text-green-300">
                        {renderSparkline('consistency')}
                      </div>
                    </div>
                  </motion.div>
                </div>
              </motion.div>

              {/* Efficiency Orb - Bottom Right */}
              <motion.div 
                className="absolute"
                style={{
                  left: '50%',
                  top: '50%',
                }}
                initial={{ x: '-50%', y: '-50%', scale: 2.5, opacity: 0 }}
                animate={{ 
                  x: 'calc(-50% + 173px)', 
                  y: 'calc(-50% + 100px)',
                  scale: 1,
                  opacity: hoveredOrb && hoveredOrb !== 'efficiency' ? 0.3 : 1,
                  filter: hoveredOrb && hoveredOrb !== 'efficiency' ? 'blur(4px)' : 'blur(0px)',
                }}
                exit={{ 
                  x: '-50%', 
                  y: '-50%',
                  scale: 0.3,
                  opacity: 0
                }}
                transition={{ 
                  duration: 0.3,
                  ease: "easeInOut"
                }}
              >
                <div 
                  className="relative group cursor-pointer"
                  onMouseEnter={() => hoverEffectsEnabled && setHoveredOrb('efficiency')}
                  onMouseLeave={() => hoverEffectsEnabled && setHoveredOrb(null)}
                >
                  {/* Outer glow layers */}
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `radial-gradient(circle, rgba(34, 197, 94, 0.3) 0%, transparent 70%)`,
                      width: '180px',
                      height: '180px',
                      transform: 'translate(-50%, -50%)',
                      left: '50%',
                      top: '50%',
                      filter: 'blur(20px)',
                    }}
                    animate={{
                      opacity: [0.5, 0.8, 0.5],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 1,
                    }}
                  />
                  
                  {/* Core orb */}
                  <motion.div
                    className="relative w-32 h-32 rounded-full flex items-center justify-center border-2"
                    style={{
                      background: `radial-gradient(circle at 30% 30%, rgba(34, 197, 94, 0.4), rgba(34, 197, 94, 0.1))`,
                      borderColor: 'rgba(34, 197, 94, 0.5)',
                    }}
                    animate={{
                      boxShadow: [
                        '0 0 40px rgba(34, 197, 94, 0.6), inset 0 0 20px rgba(34, 197, 94, 0.3)',
                        '0 0 60px rgba(34, 197, 94, 0.8), inset 0 0 30px rgba(34, 197, 94, 0.5)',
                        '0 0 40px rgba(34, 197, 94, 0.6), inset 0 0 20px rgba(34, 197, 94, 0.3)',
                      ],
                      scale: hoveredOrb === 'efficiency' ? 1.1 : 1
                    }}
                    transition={{
                      boxShadow: {
                        duration: 3,
                      repeat: Infinity,
                        repeatType: "loop",
                      ease: "easeInOut",
                      delay: 1,
                      },
                      scale: {
                        duration: 0.2,
                        ease: "easeOut"
                      }
                    }}
                  >
                    <div className="text-center z-10 flex flex-col items-center">
                      <div className="flex items-center gap-2 mb-1">
                        {getTrendIcon(metricTrends.efficiency)}
                      <div className="text-3xl font-bold text-green-300">
                        {efficiency !== null ? `${Math.round(efficiency)}%` : 'N/A'}
                        </div>
                      </div>
                      <div className="text-[10px] text-[#d7d2cb]/60 mb-1">Efficiency</div>
                      <div className="text-green-300">
                        {renderSparkline('efficiency')}
                      </div>
                    </div>
                  </motion.div>
                </div>
              </motion.div>

              {/* Metric Panels - Stacked vertically on the right */}
              <motion.div
                className="absolute top-1/2 -translate-y-1/2 w-80 space-y-4"
                style={{ right: '-350px' }}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                transition={{ duration: 0.3 }}
              >
                {/* Progress Panel */}
                <motion.div
                  className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10"
                  animate={{ 
                    opacity: hoveredOrb && hoveredOrb !== 'progress' ? 0.3 : 1,
                    filter: hoveredOrb && hoveredOrb !== 'progress' ? 'blur(4px)' : 'blur(0px)',
                    boxShadow: hoveredOrb === 'progress' 
                      ? '0 0 40px rgba(34, 197, 94, 0.4), 0 0 80px rgba(34, 197, 94, 0.2)' 
                      : '0 0 0px rgba(34, 197, 94, 0)',
                  }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="text-[#d7d2cb]/60 text-xs mb-3 uppercase tracking-wide">Progress</div>
                  <div className="flex items-end gap-3 mb-4">
                    <div className="text-4xl font-bold text-green-300">{Math.round(progress)}%</div>
                    {getTrendIcon(metricTrends.progress)}
                  </div>
                  <div className="mb-4">
                    {renderSparkline('progress')}
                  </div>
                  <div className="text-xs text-[#d7d2cb]/60">
                    Measures your completion rate against the plan timeline
                  </div>
                </motion.div>

                {/* Consistency Panel */}
                <motion.div
                  className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10"
                  animate={{ 
                    opacity: hoveredOrb && hoveredOrb !== 'consistency' ? 0.3 : 1,
                    filter: hoveredOrb && hoveredOrb !== 'consistency' ? 'blur(4px)' : 'blur(0px)',
                    boxShadow: hoveredOrb === 'consistency' 
                      ? '0 0 40px rgba(34, 197, 94, 0.4), 0 0 80px rgba(34, 197, 94, 0.2)' 
                      : '0 0 0px rgba(34, 197, 94, 0)',
                  }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="text-[#d7d2cb]/60 text-xs mb-3 uppercase tracking-wide">Consistency</div>
                  <div className="flex items-end gap-3 mb-4">
                    <div className="text-4xl font-bold text-green-300">{Math.round(consistency)}%</div>
                    {getTrendIcon(metricTrends.consistency)}
                  </div>
                  <div className="mb-4">
                    {renderSparkline('consistency')}
                  </div>
                  <div className="text-xs text-[#d7d2cb]/60">
                    Tracks your daily engagement and task completion rhythm
                  </div>
                </motion.div>

                {/* Efficiency Panel */}
                <motion.div
                  className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10"
                  animate={{ 
                    opacity: hoveredOrb && hoveredOrb !== 'efficiency' ? 0.3 : 1,
                    filter: hoveredOrb && hoveredOrb !== 'efficiency' ? 'blur(4px)' : 'blur(0px)',
                    boxShadow: hoveredOrb === 'efficiency' 
                      ? '0 0 40px rgba(34, 197, 94, 0.4), 0 0 80px rgba(34, 197, 94, 0.2)' 
                      : '0 0 0px rgba(34, 197, 94, 0)',
                  }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="text-[#d7d2cb]/60 text-xs mb-3 uppercase tracking-wide">Efficiency</div>
                  <div className="flex items-end gap-3 mb-4">
                    <div className="text-4xl font-bold text-green-300">
                      {efficiency !== null ? `${Math.round(efficiency)}%` : 'N/A'}
                    </div>
                    {getTrendIcon(metricTrends.efficiency)}
                  </div>
                  <div className="mb-4">
                    {renderSparkline('efficiency')}
                  </div>
                  <div className="text-xs text-[#d7d2cb]/60">
                    Measures how quickly you complete tasks relative to their deadlines
                  </div>
                </motion.div>
              </motion.div>

              {/* Close button - top right of panels column */}
              <motion.button
                onClick={() => setIsExpanded(false)}
                className="absolute text-[#d7d2cb]/60 hover:text-[#d7d2cb] transition-colors p-2 bg-white/5 rounded-lg hover:bg-white/10"
                style={{ 
                  right: '-350px',
                  top: 'calc(50% - 380px)',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </motion.button>
            </div>
          </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>
    </div>
  )
}
