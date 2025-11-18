'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  value: number
  trend?: number
  sparklineData?: number[]
  description?: string
  color?: string
  formatValue?: (value: number) => string
  className?: string
}

export function MetricCard({
  title,
  value,
  trend,
  sparklineData = [],
  description,
  color = '#22c55e',
  formatValue = (v) => `${Math.round(v)}%`,
  className
}: MetricCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  // Generate sparkline path
  const generateSparkline = (data: number[]) => {
    if (data.length === 0) return ''
    const width = 100
    const height = 20
    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * width
      const y = height - (d / 100) * height
      return `${x},${y}`
    })
    return `M ${points.join(' L ')}`
  }

  const trendColor = trend && trend > 0 ? 'text-green-400' : trend && trend < 0 ? 'text-red-400' : 'text-[#d7d2cb]/60'

  return (
    <motion.div
      className={cn('relative bg-white/5 border border-white/10 rounded-lg p-4 cursor-pointer', className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-[#d7d2cb]/70 mb-1">{title}</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#d7d2cb]" style={{ color }}>
              {formatValue(value)}
            </span>
            {trend !== undefined && trend !== 0 && (
              <div className={cn('flex items-center text-xs font-medium', trendColor)}>
                {trend > 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                <span className="ml-1">{Math.abs(Math.round(trend))}%</span>
              </div>
            )}
          </div>
          {description && (
            <p className="text-xs text-[#d7d2cb]/50 mt-1">{description}</p>
          )}
        </div>
      </div>

      {/* Sparkline */}
      {sparklineData.length > 0 && (
        <div className="mt-3 h-5">
          <svg width="100%" height="20" viewBox="0 0 100 20" className="overflow-visible">
            {sparklineData.length > 1 && (
              <motion.path
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.8, ease: 'easeInOut' }}
                d={generateSparkline(sparklineData)}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {sparklineData.map((point, i) => {
              const x = sparklineData.length === 1 ? 50 : (i / (sparklineData.length - 1)) * 100
              const y = 20 - (point / 100) * 20
              return (
                <motion.circle
                  key={i}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1 * i }}
                  cx={x}
                  cy={y}
                  r="1.5"
                  fill={color}
                />
              )
            })}
          </svg>
        </div>
      )}

      {/* Expanded view on hover */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute inset-0 bg-[#0a0a0a]/95 backdrop-blur-sm rounded-lg border border-white/20 p-4 z-10"
          >
            <div className="text-center">
              <h4 className="text-lg font-semibold text-[#d7d2cb] mb-2">{title}</h4>
              <div className="text-4xl font-bold mb-2" style={{ color }}>
                {formatValue(value)}
              </div>
              {description && (
                <p className="text-sm text-[#d7d2cb]/70">{description}</p>
              )}
              {trend !== undefined && trend !== 0 && (
                <div className={cn('flex items-center justify-center gap-1 text-sm mt-2', trendColor)}>
                  {trend > 0 ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  <span>{trend > 0 ? 'Up' : 'Down'} {Math.abs(Math.round(trend))}% from last period</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

