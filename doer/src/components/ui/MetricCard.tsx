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

  return (
    <div className={cn('relative bg-[var(--input)] border border-[var(--border)] rounded-lg p-4 flex flex-col', className)}>
      <h3 className="text-sm font-medium text-[var(--muted-foreground)] mb-1.5">{title}</h3>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl font-bold text-[var(--foreground)]" style={{ color }}>
          {formatValue(value)}
        </span>
        {trend !== undefined && trend !== 0 && (
          <div 
            className="flex items-center text-xs font-medium"
            style={{
              color: trend > 0 
                ? '#22c55e' 
                : trend < 0 
                  ? 'var(--destructive)' 
                  : 'var(--muted-foreground)'
            }}
          >
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
        <p className="text-xs text-[var(--muted-foreground)] leading-tight">{description}</p>
      )}
    </div>
  )
}

