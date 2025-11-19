'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Target } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Badge } from './Badge'
import { Progress } from './Progress'
import { cn } from '@/lib/utils'
import { parseDateFromDB, formatDateForDisplay } from '@/lib/date-utils'

interface Plan {
  id: string
  goal_text: string
  status: 'active' | 'paused' | 'completed' | 'archived'
  start_date: string
  end_date: string | null
  task_count?: number
  created_at: string
}

interface PlansPanelProps {
  className?: string
}

export function PlansPanel({ className }: PlansPanelProps) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/plans/list')
        if (response.ok) {
          const data = await response.json()
          setPlans(data.plans || [])
        }
      } catch (error) {
        console.error('Error fetching plans:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPlans()
  }, [])


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'paused':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'completed':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'archived':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  const calculateProgress = (plan: Plan): number => {
    if (!plan.end_date) return 0
    const start = parseDateFromDB(plan.start_date)
    const end = parseDateFromDB(plan.end_date)
    const today = new Date()
    const total = end.getTime() - start.getTime()
    const elapsed = today.getTime() - start.getTime()
    return Math.max(0, Math.min(100, (elapsed / total) * 100))
  }

  return (
    <Card className={cn('bg-white/5 border-white/10', className)}>
      <CardHeader>
        <div>
          <CardTitle className="text-lg font-semibold text-[#d7d2cb]">
            Plans
          </CardTitle>
          <p className="text-[#d7d2cb]/70 mt-1">
            View and manage your active plans and their progress
          </p>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-[#d7d2cb]/50">
            Loading plans...
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-8 text-[#d7d2cb]/50">
            No plans
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {plans.map((plan) => {
              const progress = calculateProgress(plan)
              const isActive = plan.status === 'active'

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                  onClick={() => {
                    if (isActive) {
                      router.push('/dashboard')
                    }
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-[#d7d2cb] truncate mb-1">
                        {plan.goal_text}
                      </h4>
                      <Badge className={cn('text-xs', getStatusColor(plan.status))}>
                        {plan.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-4 text-xs text-[#d7d2cb]/60">
                      {plan.start_date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {formatDateForDisplay(parseDateFromDB(plan.start_date), {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                      )}
                      {plan.task_count !== undefined && (
                        <div className="flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          <span>{plan.task_count} tasks</span>
                        </div>
                      )}
                    </div>

                    {isActive && plan.end_date && (
                      <div>
                        <div className="flex items-center justify-between text-xs text-[#d7d2cb]/60 mb-1">
                          <span>Progress</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <Progress value={progress} className="h-1" />
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

