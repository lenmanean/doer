'use client'

import { useState, useRef, useEffect } from 'react'
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
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null)

  // Chart constants (don't depend on data.length)
  const chartWidth = 800
  const chartHeight = 300
  const padding = 40

  // Calculate tooltip position when hovered index changes
  useEffect(() => {
    if (hoveredIndex === null || data.length === 0) {
      setTooltipPosition(null)
      return
    }

    // Use requestAnimationFrame to ensure tooltip is rendered before calculating
    requestAnimationFrame(() => {
      if (!tooltipRef.current || hoveredIndex === null || data.length === 0) {
        setTooltipPosition(null)
        return
      }

      const tooltip = tooltipRef.current
      const tooltipHeight = tooltip.getBoundingClientRect().height

      // Calculate chart dimensions
      const maxValue = Math.max(...data.map(d => {
        if (stacked && d.subValues) {
          return Object.values(d.subValues).reduce((sum, val) => sum + val, 0)
        }
        return d[yKey as keyof BarChartData] as number
      }))

      const barWidth = (chartWidth - padding * 2) / data.length
      const barHeight = chartHeight - padding * 2

      // Calculate bar position
      const item = data[hoveredIndex]
      const value = item[yKey as keyof BarChartData] as number
      const height = (value / maxValue) * barHeight
      const x = padding + hoveredIndex * barWidth + barWidth / 2
      const barTopY = padding + barHeight - height

      // For stacked bars, use the top of the stack
      let actualBarTopY = barTopY
      let actualBarHeight = height
      if (stacked && item.subValues) {
        const totalHeight = (Object.values(item.subValues).reduce((sum, val) => sum + val, 0) / maxValue) * barHeight
        actualBarTopY = padding + barHeight - totalHeight
        actualBarHeight = totalHeight
      }

      // Center tooltip above bar: bar top - half tooltip height - half bar height
      const tooltipTop = actualBarTopY - (tooltipHeight / 2) - (actualBarHeight / 2)
      const tooltipLeft = (x / chartWidth) * 100

      setTooltipPosition({ top: tooltipTop, left: tooltipLeft })
    })
  }, [hoveredIndex, data, stacked, yKey, chartWidth, chartHeight, padding])

  // Early return after all hooks
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

  const chartWidth = 800
  const chartHeight = 300
  const padding = 40
  const barWidth = (chartWidth - padding * 2) / data.length
  const barHeight = chartHeight - padding * 2

  const hoveredData = hoveredIndex !== null ? data[hoveredIndex] : null

  return (
    <div className={cn('relative', className)}>
      {title && (
        <h3 className="text-sm font-semibold text-[#d7d2cb] mb-4">{title}</h3>
      )}

      <div className="relative w-full" style={{ height: `${chartHeight + 60}px`, minHeight: '300px' }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${chartWidth} ${chartHeight + 60}`} preserveAspectRatio="xMidYMid meet" className="overflow-visible">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padding + barHeight * (1 - ratio)
            const value = maxValue * ratio
            return (
              <g key={ratio}>
                <line
                  x1={padding}
                  y1={y}
                  x2={chartWidth - padding}
                  y2={y}
                  stroke="rgba(255, 255, 255, 0.05)"
                  strokeWidth="1"
                />
                <text
                  x={padding - 10}
                  y={y + 5}
                  fill="rgba(215, 210, 203, 0.4)"
                  fontSize="12"
                  textAnchor="end"
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
            const x = padding + index * barWidth + barWidth * 0.1
            const width = barWidth * 0.8
            const isHovered = hoveredIndex === index

            if (stacked && item.subValues) {
              // Stacked bars
              let currentY = padding + barHeight
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
                        rx="4"
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
                    y={padding + barHeight - height}
                    width={width}
                    height={height}
                    fill={color}
                    rx="4"
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
            const x = padding + index * barWidth + barWidth / 2
            return (
              <text
                key={index}
                x={x}
                y={chartHeight + 20}
                fill="rgba(215, 210, 203, 0.6)"
                fontSize="12"
                textAnchor="middle"
                transform={`rotate(-45 ${x} ${chartHeight + 20})`}
              >
                {item[xKey as keyof BarChartData] as string}
              </text>
            )
          })}
        </svg>

        {/* Tooltip */}
        <AnimatePresence>
          {hoveredData && hoveredIndex !== null && tooltipPosition && (
            <motion.div
              ref={tooltipRef}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bg-[#0a0a0a] border border-white/20 rounded-lg p-3 shadow-xl pointer-events-none z-10"
              style={{
                left: `${tooltipPosition.left}%`,
                top: `${tooltipPosition.top}px`,
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

