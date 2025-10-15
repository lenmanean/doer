'use client'

import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { TrendingUp, TrendingDown, ExternalLink } from 'lucide-react'

interface AnalyticsModalProps {
  point: any
  onClose: () => void
  router: any
}

export function AnalyticsModal({ point, onClose, router }: AnalyticsModalProps) {
  if (!point) return null

  const getTrendIcon = (value: number) => {
    return value > 50 ? (
      <TrendingUp className="w-4 h-4 text-green-500" />
    ) : (
      <TrendingDown className="w-4 h-4 text-red-500" />
    )
  }

  const getTrendColor = (value: number) => {
    return value > 50 ? 'text-green-500' : 'text-red-500'
  }

  return (
    <Modal
      isOpen={!!point}
      onClose={onClose}
      title={`Analytics for ${point?.date}`}
      size="md"
    >
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => router.push('/vitality')}
          className="text-[#d7d2cb]/60 hover:text-[#d7d2cb] transition-colors"
          title="View detailed vitality metrics"
        >
          <ExternalLink className="w-5 h-5" />
        </button>
      </div>
      
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3">
          <div className="flex items-center justify-between p-3 bg-[#111]/50 rounded-lg border border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-[#22c55e]"></div>
              <span className="text-[#d7d2cb] font-medium">Progress</span>
            </div>
            <div className="flex items-center gap-2">
              {getTrendIcon(point?.progress ?? 0)}
              <span className={`font-semibold ${getTrendColor(point?.progress ?? 0)}`}>
                {point?.progress ?? 0}%
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-[#111]/50 rounded-lg border border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-[#eab308]"></div>
              <span className="text-[#d7d2cb] font-medium">Consistency</span>
            </div>
            <div className="flex items-center gap-2">
              {getTrendIcon(point?.consistency ?? 0)}
              <span className={`font-semibold ${getTrendColor(point?.consistency ?? 0)}`}>
                {point?.consistency ?? 0}%
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-[#111]/50 rounded-lg border border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-[#3b82f6]"></div>
              <span className="text-[#d7d2cb] font-medium">Efficiency</span>
            </div>
            <div className="flex items-center gap-2">
              {getTrendIcon(point?.efficiency ?? 0)}
              <span className={`font-semibold ${getTrendColor(point?.efficiency ?? 0)}`}>
                {point?.efficiency ?? 0}%
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="pt-4 flex justify-end gap-3">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button onClick={() => router.push('/vitality')}>
          View Full Vitality
        </Button>
      </div>
    </Modal>
  )
}
