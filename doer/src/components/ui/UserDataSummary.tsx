'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Target, CheckCircle, Calendar, Award, BarChart3 } from 'lucide-react'

interface UserDataSummaryProps {
  userId: string
  className?: string
}

interface UserStats {
  totalTasks: number
  totalCompletions: number
  averageCompletionRate: number
  totalPlans: number
  activePlans: number
  longestStreak: number
  averageTasksPerPlan: number
}

export function UserDataSummary({ userId, className }: UserDataSummaryProps) {
  const [stats, setStats] = useState<UserStats>({
    totalTasks: 0,
    totalCompletions: 0,
    averageCompletionRate: 0,
    totalPlans: 0,
    activePlans: 0,
    longestStreak: 0,
    averageTasksPerPlan: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      if (!userId) return

      try {
        setLoading(true)

        // Fetch all stats in parallel
        const [tasksResult, completionsResult, plansResult, activePlansResult] = await Promise.all([
          supabase
            .from('tasks')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId),
          supabase
            .from('task_completions')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId),
          supabase
            .from('plans')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId),
          supabase
            .from('plans')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'active')
        ])

        const totalTasks = tasksResult.count || 0
        const totalCompletions = completionsResult.count || 0
        const totalPlans = plansResult.count || 0
        const activePlans = activePlansResult.count || 0

        // Calculate average tasks per plan
        const averageTasksPerPlan = totalPlans > 0 ? Math.round(totalTasks / totalPlans) : 0

        // Calculate longest streak - get all unique completion dates
        let longestStreak = 0
        const { data: allCompletions } = await supabase
          .from('task_completions')
          .select('scheduled_date')
          .eq('user_id', userId)
          .order('scheduled_date', { ascending: true })

        if (allCompletions && allCompletions.length > 0) {
          // Get unique dates (in case of multiple completions per day)
          const uniqueDates = new Set<string>()
          allCompletions.forEach(c => {
            const dateStr = c.scheduled_date // Already in YYYY-MM-DD format from database
            uniqueDates.add(dateStr)
          })

          // Convert to sorted array (ascending for streak calculation)
          const sortedDates = Array.from(uniqueDates).sort((a, b) => {
            // Compare as strings (YYYY-MM-DD format sorts correctly)
            return a.localeCompare(b)
          })

          // Find longest consecutive streak
          if (sortedDates.length > 0) {
            let currentStreak = 1
            let maxStreak = 1

            for (let i = 1; i < sortedDates.length; i++) {
              // Parse dates to check if they're consecutive
              const prevDate = new Date(sortedDates[i - 1] + 'T00:00:00')
              const currDate = new Date(sortedDates[i] + 'T00:00:00')
              
              // Calculate difference in days
              const diffTime = currDate.getTime() - prevDate.getTime()
              const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

              if (diffDays === 1) {
                // Consecutive day - increment streak
                currentStreak++
                maxStreak = Math.max(maxStreak, currentStreak)
              } else {
                // Gap found - reset streak
                currentStreak = 1
              }
            }

            longestStreak = maxStreak
          }
        }

        setStats({
          totalTasks,
          totalCompletions,
          averageCompletionRate: 0, // Keep for compatibility but not used
          totalPlans,
          activePlans,
          longestStreak,
          averageTasksPerPlan
        })
      } catch (error) {
        console.error('Error fetching user stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [userId])

  const statCards = [
    {
      title: 'Total Tasks',
      value: stats.totalTasks,
      icon: Target,
      color: '#22c55e'
    },
    {
      title: 'Total Completions',
      value: stats.totalCompletions,
      icon: CheckCircle,
      color: '#3b82f6'
    },
    {
      title: 'Avg Tasks/Plan',
      value: stats.averageTasksPerPlan,
      icon: BarChart3,
      color: '#f59e0b'
    },
    {
      title: 'Total Plans',
      value: stats.totalPlans,
      icon: Calendar,
      color: '#a78bfa'
    },
    {
      title: 'Active Plans',
      value: stats.activePlans,
      icon: Target,
      color: '#ef4444'
    },
    {
      title: 'Longest Streak',
      value: `${stats.longestStreak} days`,
      icon: Award,
      color: '#ec4899'
    }
  ]

  return (
    <Card className={cn('bg-white/5 border-white/10', className)}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-[#d7d2cb]">
          Your Statistics
        </CardTitle>
        <p className="text-[#d7d2cb]/70 mt-1">
          Comprehensive overview of your task and plan statistics
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-[#d7d2cb]/50">
            Loading statistics...
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {statCards.map((stat, index) => {
              const Icon = stat.icon
              return (
                <div
                  key={index}
                  className="p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4" style={{ color: stat.color }} />
                    <span className="text-xs text-[#d7d2cb]/70">{stat.title}</span>
                  </div>
                  <div className="text-xl font-bold text-[#d7d2cb]" style={{ color: stat.color }}>
                    {stat.value}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

