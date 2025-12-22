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
  const containerRef = useRef<HTMLDivElement>(null)
  const barRefs = useRef<Map<number, SVGRectElement>>(new Map())
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null)

  // Chart constants (don't depend on data.length)
  const chartWidth = 800
  const chartHeight = 300
  const padding = 40

  // Calculate tooltip position when hovered index changes
  useEffect(() => {
    if (hoveredIndex === null || data.length === 0 || !containerRef.current) {
      setTooltipPosition(null)
      return
    }

    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      if (!containerRef.current || hoveredIndex === null || data.length === 0) {
        setTooltipPosition(null)
        return
      }

      const container = containerRef.current
      const bar = barRefs.current.get(hoveredIndex)
      
      if (!bar) {
        setTooltipPosition(null)
        return
      }

      // Get the bar's bounding rect and container rect
      const barRect = bar.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()

      // Calculate the bar's center in viewport coordinates
      const barCenterXViewport = (barRect.left + barRect.right) / 2
      const barTopYViewport = barRect.top

      // Convert to container-relative coordinates
      const barCenterX = barCenterXViewport - containerRect.left
      const barTopY = barTopYViewport - containerRect.top

      // Position tooltip above the bar, centered horizontally
      const estimatedTooltipHeight = 60
      const tooltipLeft = barCenterX
      const tooltipTop = barTopY - estimatedTooltipHeight - 8

      setTooltipPosition({ top: tooltipTop, left: tooltipLeft })
    })
  }, [hoveredIndex, data])

  // Refine tooltip position after it renders to get exact height
  useEffect(() => {
    if (!tooltipPosition || hoveredIndex === null || !containerRef.current) {
      return
    }

    // Wait for tooltip to render
    const timeoutId = setTimeout(() => {
      if (!tooltipRef.current || !containerRef.current || hoveredIndex === null) {
        return
      }

      const container = containerRef.current
      const tooltip = tooltipRef.current
      const bar = barRefs.current.get(hoveredIndex)

      if (!bar) return

      const tooltipRect = tooltip.getBoundingClientRect()
      const barRect = bar.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()

      // Recalculate bar center position
      const barCenterXViewport = (barRect.left + barRect.right) / 2
      const barTopYViewport = barRect.top

      // Convert to container-relative coordinates
      const barCenterX = barCenterXViewport - containerRect.left
      const barTopY = barTopYViewport - containerRect.top

      // Adjust position with actual tooltip height
      const tooltipLeft = barCenterX
      const tooltipTop = barTopY - tooltipRect.height - 8

      setTooltipPosition({ top: tooltipTop, left: tooltipLeft })
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [hoveredIndex])

  // Early return after all hooks
  if (data.length === 0) {
    return (
      <div className={cn('p-8 text-center text-[var(--muted-foreground)]', className)}>
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

  const barWidth = (chartWidth - padding * 2) / data.length
  const barHeight = chartHeight - padding * 2

  const hoveredData = hoveredIndex !== null ? data[hoveredIndex] : null

  return (
    <div className={cn('relative', className)}>
      {title && (
        <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">{title}</h3>
      )}

      <div ref={containerRef} className="relative w-full" style={{ height: `${chartHeight + 60}px`, minHeight: '300px' }}>
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
                  fill="currentColor"
                  fontSize="12"
                  textAnchor="end"
                  className="text-[var(--muted-foreground)]"
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
                        ref={(el) => {
                          // Store ref for the top segment (last one rendered) only
                          const isTopSegment = subIndex === subEntries.length - 1
                          if (el && isTopSegment) {
                            barRefs.current.set(index, el)
                          } else if (!el && isTopSegment) {
                            barRefs.current.delete(index)
                          }
                        }}
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
                    ref={(el) => {
                      if (el) barRefs.current.set(index, el)
                      else barRefs.current.delete(index)
                    }}
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
                fill="currentColor"
                fontSize="12"
                textAnchor="middle"
                transform={`rotate(-45 ${x} ${chartHeight + 20})`}
                className="text-[var(--muted-foreground)]"
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
              className="absolute bg-[var(--background)] border border-[var(--border)] rounded-lg p-3 shadow-xl pointer-events-none z-10"
              style={{
                left: `${tooltipPosition.left}px`,
                top: `${tooltipPosition.top}px`,
                transform: 'translateX(-50%)'
              }}
            >
              <div className="text-xs font-semibold text-[var(--foreground)] mb-2">
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
                        <span className="text-xs text-[var(--muted-foreground)]">{key}</span>
                      </div>
                      <span className="text-xs font-semibold text-[var(--foreground)]">{Math.round(value)}</span>
                    </div>
                  ))}
                  <div className="pt-1 mt-1 border-t border-[var(--border)]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--foreground)]">Total</span>
                      <span className="text-xs font-bold text-[var(--foreground)]">
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

