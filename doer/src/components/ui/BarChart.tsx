'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface BarChartData {
  category: string
  value: number
  subValues?: Record<string, number>
}

interface BarChartProps {
  data: BarChartData[]
  xKey?: string
  yKey?: string
  title?: string
  stacked?: boolean
  colors?: string[]
  onBarClick?: (category: string) => void
  className?: string
}

export function BarChart({
  data,
  xKey = 'category',
  yKey = 'value',
  title,
  stacked = false,
  colors = ['#22c55e', '#f59e0b', '#ef4444', '#3b82f6'],
  onBarClick,
  className
}: BarChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  if (data.length === 0) {
    return (
      <div className={cn('p-8 text-center text-[#d7d2cb]/50', className)}>
        No data available
      </div>
    )
  }

  const maxValue = Math.max(...data.map(d => {
    if (stacked && d.subValues) {
      return Object.values(d.subValues).reduce((sum, val) => sum + val, 0)
    }
    return d[yKey as keyof BarChartData] as number
  }))

  const barWidth = 100 / data.length
  const barHeight = 60

  const hoveredData = hoveredIndex !== null ? data[hoveredIndex] : null

  return (
    <div className={cn('relative', className)}>
      {title && (
        <h3 className="text-sm font-semibold text-[#d7d2cb] mb-4">{title}</h3>
      )}

      <div className="relative" style={{ height: `${barHeight + 40}px` }}>
        <svg width="100%" height={barHeight + 40} viewBox={`0 0 100 ${barHeight + 40}`} className="overflow-visible">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = barHeight * (1 - ratio)
            const value = maxValue * ratio
            return (
              <g key={ratio}>
                <line
                  x1={0}
                  y1={y}
                  x2={100}
                  y2={y}
                  stroke="rgba(255, 255, 255, 0.05)"
                  strokeWidth="0.5"
                />
                <text
                  x={0}
                  y={y + 3}
                  fill="rgba(215, 210, 203, 0.4)"
                  fontSize="8"
                  textAnchor="start"
                >
                  {Math.round(value)}
                </text>
              </g>
            )
          })}

          {/* Bars */}
          {data.map((item, index) => {
            const value = item[yKey as keyof BarChartData] as number
            const height = (value / maxValue) * barHeight
            const x = index * barWidth + barWidth * 0.1
            const width = barWidth * 0.8
            const isHovered = hoveredIndex === index

            if (stacked && item.subValues) {
              // Stacked bars
              let currentY = barHeight
              const subEntries = Object.entries(item.subValues)
              const totalValue = subEntries.reduce((sum, [, val]) => sum + val, 0)

              return (
                <g key={index}>
                  {subEntries.map(([key, subValue], subIndex) => {
                    const subHeight = (subValue / maxValue) * barHeight
                    currentY -= subHeight
                    const color = colors[subIndex % colors.length]

                    return (
                      <motion.rect
                        key={key}
                        x={x}
                        y={currentY}
                        width={width}
                        height={subHeight}
                        fill={color}
                        rx="2"
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        onClick={() => onBarClick?.(item[xKey as keyof BarChartData] as string)}
                        animate={{
                          scaleY: isHovered ? 1.05 : 1,
                          transformOrigin: 'bottom'
                        }}
                        transition={{ duration: 0.2 }}
                        style={{ cursor: onBarClick ? 'pointer' : 'default' }}
                      />
                    )
                  })}
                </g>
              )
            } else {
              // Single bar
              const color = colors[0]
              return (
                <g key={index}>
                  <motion.rect
                    x={x}
                    y={barHeight - height}
                    width={width}
                    height={height}
                    fill={color}
                    rx="2"
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={() => onBarClick?.(item[xKey as keyof BarChartData] as string)}
                    animate={{
                      scaleY: isHovered ? 1.05 : 1,
                      transformOrigin: 'bottom'
                    }}
                    transition={{ duration: 0.2 }}
                    style={{ cursor: onBarClick ? 'pointer' : 'default' }}
                  />
                </g>
              )
            }
          })}

          {/* Category labels */}
          {data.map((item, index) => {
            const x = index * barWidth + barWidth / 2
            return (
              <text
                key={index}
                x={x}
                y={barHeight + 15}
                fill="rgba(215, 210, 203, 0.6)"
                fontSize="8"
                textAnchor="middle"
                transform={`rotate(-45 ${x} ${barHeight + 15})`}
              >
                {item[xKey as keyof BarChartData] as string}
              </text>
            )
          })}
        </svg>

        {/* Tooltip */}
        <AnimatePresence>
          {hoveredData && hoveredIndex !== null && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bg-[#0a0a0a] border border-white/20 rounded-lg p-3 shadow-xl pointer-events-none z-10"
              style={{
                left: `${(hoveredIndex * barWidth + barWidth / 2)}%`,
                top: '-80px',
                transform: 'translateX(-50%)'
              }}
            >
              <div className="text-xs font-semibold text-[#d7d2cb] mb-2">
                {hoveredData[xKey as keyof BarChartData] as string}
              </div>
              {stacked && hoveredData.subValues ? (
                <div className="space-y-1">
                  {Object.entries(hoveredData.subValues).map(([key, value], i) => (
                    <div key={key} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: colors[i % colors.length] }}
                        />
                        <span className="text-xs text-[#d7d2cb]/70">{key}</span>
                      </div>
                      <span className="text-xs font-semibold text-[#d7d2cb]">{Math.round(value)}</span>
                    </div>
                  ))}
                  <div className="pt-1 mt-1 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#d7d2cb]">Total</span>
                      <span className="text-xs font-bold text-[#d7d2cb]">
                        {Math.round(Object.values(hoveredData.subValues).reduce((sum, val) => sum + val, 0))}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm font-bold" style={{ color: colors[0] }}>
                  {Math.round(hoveredData[yKey as keyof BarChartData] as number)}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

