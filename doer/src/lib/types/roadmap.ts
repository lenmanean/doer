import type { ActivePlanData, ProgressStats } from '@/lib/roadmap-client'

/**
 * Roadmap data structure returned by useUserRoadmap hook
 */
export interface RoadmapData extends ActivePlanData {
  stats: ProgressStats
}

/**
 * Plan data structure for onboarding review page
 */
export interface ReviewPlanData {
  id: string
  goal_text: string
  start_date: string
  end_date: string
  timeline_days: number
  plan_summary?: string
  summary_data?: {
    total_duration_days?: number
    goal_title?: string
    goal_summary?: string
    goal_text?: string
    plan_summary?: string
  }
  [key: string]: unknown
}

