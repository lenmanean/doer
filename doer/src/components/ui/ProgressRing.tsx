'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ProgressRingProps {
  percentage: number
  size?: number
  strokeWidth?: number
  color?: string
  showBreakdown?: boolean
  breakdown?: { label: string; value: number; color?: string }[]
  className?: string
}

export function ProgressRing({
  percentage,
  size = 80,
  strokeWidth = 8,
  color = '#22c55e',
  showBreakdown = false,
  breakdown = [],
  className
}: ProgressRingProps) {
  const [isHovered, setIsHovered] = useState(false)
  
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      
      {/* Percentage text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold text-[#d7d2cb]" style={{ color }}>
          {Math.round(percentage)}%
        </span>
      </div>

      {/* Breakdown tooltip on hover */}
      <AnimatePresence>
        {isHovered && showBreakdown && breakdown.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="absolute top-full mt-4 left-1/2 -translate-x-1/2 z-20 bg-[#0a0a0a] border border-white/20 rounded-lg p-3 shadow-xl min-w-[200px]"
          >
            <div className="text-xs font-semibold text-[#d7d2cb]/70 mb-2 uppercase tracking-wide">
              Breakdown
            </div>
            <div className="space-y-2">
              {breakdown.map((item, index) => (
                <div key={index} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: item.color || color }}
                    />
                    <span className="text-sm text-[#d7d2cb]/80">{item.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-[#d7d2cb]">
                    {Math.round(item.value)}%
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

