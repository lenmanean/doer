'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface TrendChartData {
  date: string
  value: number
}

interface TrendChartProps {
  data: TrendChartData[]
  xKey?: string
  yKey?: string
  title?: string
  color?: string
  timeRange?: '7d' | '30d' | '90d' | 'all'
  onTimeRangeChange?: (range: '7d' | '30d' | '90d' | 'all') => void
  className?: string
}

export function TrendChart({
  data,
  xKey = 'date',
  yKey = 'value',
  title,
  color = '#22c55e',
  timeRange = '30d',
  onTimeRangeChange,
  className
}: TrendChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  // Filter data based on time range
  const filteredData = useMemo(() => {
    if (timeRange === 'all') return data
    
    const today = new Date()
    const daysAgo = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
    const cutoffDate = new Date(today)
    cutoffDate.setDate(cutoffDate.getDate() - daysAgo)
    
    return data.filter(item => {
      const itemDate = new Date(item[xKey as keyof TrendChartData] as string)
      return itemDate >= cutoffDate
    })
  }, [data, timeRange, xKey])

  if (filteredData.length === 0) {
    return (
      <div className={cn('p-8 text-center text-[#d7d2cb]/50', className)}>
        No data available
      </div>
    )
  }

  const maxValue = Math.max(...filteredData.map(d => d[yKey as keyof TrendChartData] as number))
  const minValue = Math.min(...filteredData.map(d => d[yKey as keyof TrendChartData] as number))
  const range = maxValue - minValue || 1

  const width = 800
  const height = 300
  const padding = 40

  // Generate path for line
  const generatePath = () => {
    if (filteredData.length === 0) return ''
    if (filteredData.length === 1) {
      const x = padding + (width - padding * 2) / 2
      const y = padding + (height - padding * 2) * (1 - ((filteredData[0][yKey as keyof TrendChartData] as number) - minValue) / range)
      return `M ${x},${y} L ${x},${y}`
    }

    const points = filteredData.map((d, i) => {
      const x = padding + ((i / (filteredData.length - 1)) * (width - padding * 2))
      const value = d[yKey as keyof TrendChartData] as number
      const y = padding + (height - padding * 2) * (1 - (value - minValue) / range)
      return `${x},${y}`
    })

    return `M ${points.join(' L ')}`
  }

  const hoveredData = hoveredIndex !== null ? filteredData[hoveredIndex] : null

  return (
    <div className={cn('relative', className)}>
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[#d7d2cb]">{title}</h3>
          {onTimeRangeChange && (
            <div className="flex gap-1">
              {(['7d', '30d', '90d', 'all'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => onTimeRangeChange(range)}
                  className={cn(
                    'px-2 py-1 text-xs rounded transition-colors',
                    timeRange === range
                      ? 'bg-white/10 text-[#d7d2cb]'
                      : 'text-[#d7d2cb]/50 hover:text-[#d7d2cb] hover:bg-white/5'
                  )}
                >
                  {range === 'all' ? 'All' : range}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="relative w-full" style={{ height: `${height + 60}px`, minHeight: '300px' }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height + 60}`} preserveAspectRatio="xMidYMid meet" className="overflow-visible">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padding + (height - padding * 2) * (1 - ratio)
            const value = minValue + range * ratio
            return (
              <g key={ratio}>
                <line
                  x1={padding}
                  y1={y}
                  x2={width - padding}
                  y2={y}
                  stroke="rgba(255, 255, 255, 0.05)"
                  strokeWidth="0.5"
                />
                <text
                  x={0}
                  y={y + 5}
                  fill="var(--muted-foreground)"
                  fontSize="12"
                  textAnchor="start"
                  className="text-[var(--muted-foreground)]"
                >
                  {Math.round(value)}
                </text>
              </g>
            )
          })}

          {/* Line path */}
          {filteredData.length > 1 && (
            <motion.path
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1, ease: 'easeInOut' }}
              d={generatePath()}
              fill="none"
              stroke={color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data points */}
          {filteredData.map((d, i) => {
            const x = padding + ((i / Math.max(1, filteredData.length - 1)) * (width - padding * 2))
            const value = d[yKey as keyof TrendChartData] as number
            const y = padding + (height - padding * 2) * (1 - (value - minValue) / range)
            const isHovered = hoveredIndex === i

            return (
              <g key={i}>
                <motion.circle
                  cx={x}
                  cy={y}
                  r={isHovered ? 6 : 3}
                  fill={color}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  animate={{ r: isHovered ? 6 : 3 }}
                  transition={{ duration: 0.2 }}
                  style={{ cursor: 'pointer' }}
                />
                {/* Invisible larger hit area */}
                <circle
                  cx={x}
                  cy={y}
                  r={10}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  style={{ cursor: 'pointer' }}
                />
              </g>
            )
          })}

          {/* X-axis labels (dates) */}
          {filteredData.length > 0 && (() => {
            const labelCount = Math.min(5, filteredData.length)
            const step = Math.max(1, Math.floor(filteredData.length / labelCount))
            return filteredData
              .filter((_, i) => i % step === 0 || i === filteredData.length - 1)
              .map((d, i) => {
                const originalIndex = filteredData.findIndex(item => item === d)
                const x = padding + ((originalIndex / Math.max(1, filteredData.length - 1)) * (width - padding * 2))
                return (
                  <text
                    key={i}
                    x={x}
                    y={height + 25}
                    fill="var(--muted-foreground)"
                    fontSize="11"
                    textAnchor="middle"
                    className="text-[var(--muted-foreground)]"
                  >
                    {new Date(d[xKey as keyof TrendChartData] as string).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </text>
                )
              })
          })()}
        </svg>

        {/* Tooltip */}
        {hoveredData && hoveredIndex !== null && (() => {
          const x = padding + ((hoveredIndex / Math.max(1, filteredData.length - 1)) * (width - padding * 2))
          const value = hoveredData[yKey as keyof TrendChartData] as number
          const y = padding + (height - padding * 2) * (1 - (value - minValue) / range)
          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bg-[#0a0a0a] border border-white/20 rounded-lg p-2 shadow-xl pointer-events-none z-10"
              style={{
                left: `${(x / width) * 100}%`,
                top: `${(y / (height + 60)) * 100}%`,
                transform: 'translate(-50%, -100%)',
                marginTop: '-8px'
              }}
            >
            <div className="text-xs font-semibold text-[#d7d2cb]">
              {new Date(hoveredData[xKey as keyof TrendChartData] as string).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              })}
            </div>
            <div className="text-sm font-bold" style={{ color }}>
              {Math.round(hoveredData[yKey as keyof TrendChartData] as number)}%
            </div>
          </motion.div>
          )
        })()}
      </div>
    </div>
  )
}

