'use client'

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

  const trendColor = trend && trend > 0 ? 'text-green-400' : trend && trend < 0 ? 'text-red-400' : 'text-[#d7d2cb]/60'

  return (
    <div className={cn('relative bg-white/5 border border-white/10 rounded-lg p-4', className)}>
      <h3 className="text-sm font-medium text-[#d7d2cb]/70 mb-1">{title}</h3>
      <div className="flex items-baseline gap-2 mb-1">
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
        <p className="text-xs text-[#d7d2cb]/50">{description}</p>
      )}
    </div>
  )
}

