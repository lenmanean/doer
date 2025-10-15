'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface HealthModalProps {
  isOpen: boolean
  onClose: () => void
  progress: number
  consistency: number
  efficiency: number
  history: {
    progress: Array<{ value: number; snapshot_date: string }>
    consistency: Array<{ value: number; snapshot_date: string }>
    efficiency: Array<{ value: number; snapshot_date: string }>
  }
}

export function HealthModal({ isOpen, onClose, progress, consistency, efficiency, history }: HealthModalProps) {
  const router = useRouter()

  // Calculate trends (current vs previous)
  const getTrend = (current: number, historyData: Array<{ value: number }>) => {
    if (historyData.length < 2) return 0
    const previous = historyData[historyData.length - 2]?.value || 0
    return current - previous
  }

  const progressTrend = getTrend(progress, history.progress)
  const consistencyTrend = getTrend(consistency, history.consistency)
  const efficiencyTrend = getTrend(efficiency, history.efficiency)

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

  const metrics = [
    {
      name: 'Progress',
      value: progress,
      trend: progressTrend,
      color: '#fb923c',
      history: history.progress,
    },
    {
      name: 'Consistency',
      value: consistency,
      trend: consistencyTrend,
      color: '#4ade80',
      history: history.consistency,
    },
    {
      name: 'Efficiency',
      value: efficiency,
      trend: efficiencyTrend,
      color: '#a78bfa',
      history: history.efficiency,
    },
  ]

  // Find top improving metric
  const topMetric = [...metrics].sort((a, b) => b.trend - a.trend)[0]

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 p-4"
          >
            <div className="relative rounded-2xl border border-white/10 bg-[#0a0a0a]/95 p-6 shadow-2xl backdrop-blur-md">
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute right-4 top-4 text-[#d7d2cb]/60 transition-colors hover:text-[#d7d2cb]"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Header */}
              <div className="mb-6">
                <h3 className="mb-1 text-2xl font-bold text-[#d7d2cb]">Health Breakdown</h3>
                <p className="text-sm text-[#d7d2cb]/70">Last 6 snapshots across all metrics</p>
              </div>

              {/* Metrics with Sparklines */}
              <div className="mb-6 space-y-4">
                {metrics.map((metric) => (
                  <motion.div
                    key={metric.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="rounded-xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: metric.color }}
                        />
                        <span className="text-sm font-medium text-[#d7d2cb]">{metric.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-[#d7d2cb]">{Math.round(metric.value)}%</span>
                        {metric.trend !== 0 && (
                          <div
                            className={`flex items-center text-xs font-medium ${
                              metric.trend > 0 ? 'text-green-400' : 'text-red-400'
                            }`}
                          >
                            {metric.trend > 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            <span className="ml-1">{Math.abs(Math.round(metric.trend))}%</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Sparkline */}
                    {metric.history.length > 0 && (
                      <svg width="100%" height="30" viewBox="0 0 100 30" className="overflow-visible">
                        {metric.history.length > 1 && (
                          <motion.path
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 0.8, ease: 'easeInOut' }}
                            d={generateSparkline(metric.history)}
                            fill="none"
                            stroke={metric.color}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        )}
                        {/* Data points */}
                        {metric.history.map((point, i) => {
                          // Handle single point or multiple points
                          const x = metric.history.length === 1 ? 50 : (i / (metric.history.length - 1)) * 100
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
                              fill={metric.color}
                            />
                          )
                        })}
                      </svg>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Top Improving Metric */}
              {topMetric.trend > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mb-6 rounded-xl border border-green-500/20 bg-gradient-to-r from-green-500/10 to-emerald-500/10 p-4"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-400" />
                    <span className="text-xs font-semibold text-green-400">TOP IMPROVING</span>
                  </div>
                  <p className="text-sm text-[#d7d2cb]">
                    <span className="font-bold">{topMetric.name}</span> is up{' '}
                    <span className="font-bold text-green-400">+{Math.round(topMetric.trend)}%</span> from last
                    snapshot
                  </p>
                </motion.div>
              )}

              {/* CTA Button */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                onClick={() => {
                  onClose()
                  router.push('/vitality')
                }}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-6 py-3 font-semibold text-white transition-all hover:from-orange-600 hover:to-red-600"
              >
                View Full Vitality
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

