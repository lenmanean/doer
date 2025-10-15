// Database entity schemas aligned with Supabase schema
export interface Plan {
  id: string
  user_id: string
  goal_text: string
  clarifications?: any // jsonb in database
  start_date: string // date in database
  end_date?: string // date in database
  summary_data?: any // jsonb in database
  status: 'active' | 'completed' | 'paused' | 'archived' | string // text in database
  plan_type: 'ai' | 'manual' // text in database
  created_at: string // timestamp with time zone
  archived_at?: string // timestamp with time zone
}

export interface Milestone {
  id: string
  plan_id: string
  idx: number
  name: string
  rationale: string
  target_date?: string // date in database
  created_at: string // timestamp with time zone
}

export interface Task {
  id: string
  plan_id: string
  milestone_id?: string
  idx: number
  name: string
  category?: 'milestone_task' | 'daily_task' | string // text in database
  created_at: string // timestamp with time zone
}

export interface OnboardingResponse {
  id: string
  user_id: string
  plan_id?: string
  goal_text: string
  clarification_1?: string
  clarification_2?: string
  clarification_questions?: any // jsonb in database
  start_date: string // date in database
  created_at: string // timestamp with time zone
  updated_at: string // timestamp with time zone
}

export interface TaskSchedule {
  id: string
  plan_id: string
  task_id: string
  day_index: number
  date: string // date in database
  created_at: string // timestamp with time zone
}

/**
 * @deprecated The analytics_snapshots table has been removed as part of persistence system cleanup.
 * This interface is kept for backwards compatibility but will be replaced by new persistence system.
 */
export interface AnalyticsSnapshot {
  id: string
  user_id: string
  plan_id: string
  metric: 'progress' | 'consistency' | 'efficiency'
  value: number // Stored as decimal (0-1) in DB, converted to percentage (0-100) in code
  snapshot_date: string // date in database
  created_at: string // timestamp with time zone
}

// Component state schemas
export interface RoadmapData {
  startDate: Date
  endDate: Date
  days: number
  milestones: MilestoneData[]
  taskCount: number
}

export interface MilestoneData {
  id: string
  title: string
  date: Date
  description: string
  index?: number
}

export interface CalendarTask {
  date: string
  tasks: string[]
}

// API request/response schemas
export interface GeneratePlanRequest {
  goal_text: string
  clarifications?: {
    clarification_1?: string
    clarification_2?: string
  }
  clarification_questions?: string[]
  start_date: string
}

export interface GeneratePlanResponse {
  success: boolean
  plan: Plan
  milestones: Milestone[]
  tasks: Task[]
  token_count: number
  cost_cents: number
}

export interface ClarifyRequest {
  goal: string
  clarifications?: Record<string, any>
}

export interface ClarifyResponse {
  questions: string[]
  token_count: number
  cost_cents: number
}

// User profile schema
export interface UserProfile {
  id: string
  email: string
  goal_text: string
  clarification_1?: string
  clarification_2?: string
  clarification_questions?: string[]
  start_date: string
}

// Supabase auth types
export interface User {
  id: string
  email?: string
  created_at: string
  updated_at?: string
}

// Form schemas
export interface OnboardingFormData {
  goal: string
  clarification1: string
  clarification2: string
  startDate: string
}

export interface AIQuestions {
  question1: string
  question2: string
}

// Calendar and scheduling types
export interface CategorizedDates {
  startDate: Date
  milestones: Date[]
  completionDate: Date
}

// Error types
export interface APIError {
  error: string
  message?: string
  status?: number
}

// Loading states
export interface LoadingState {
  isGenerating: boolean
  isSubmitting: boolean
  isNavigating: boolean
}

// Scheduler types
export interface TaskInput {
  id?: string
  est_days?: number // Optional - kept for backwards compatibility but not used in DB
  estimated_duration_hours?: number // Optional - kept for backwards compatibility but not used in DB
  dependency_ids?: string[]
  category?: string
  milestone_id?: string | null
}

export interface SchedulePlacement {
  task_id: string
  date: string
  day_index: number
}

export interface SchedulerOptions {
  tasks: TaskInput[]
  startDate: Date
  endDate: Date
  weeklyHours: number
  milestones?: Array<{
    id?: string
    name?: string
    target_date?: string
    idx?: number
  }>
}

// AI-specific types
export interface TimelineSchema {
  total_days: number
  reasoning: string
}

export interface AIModelRequest {
  goal: string
  start_date: string // YYYY-MM-DD format
  clarifications?: Record<string, any>
  clarificationQuestions?: string[]
}

export interface AIModelResponse {
  model_name: string
  prompt_version: string
  request_data: any
  timeline: TimelineSchema
  milestones: Array<{
    name: string
    description: string
    rationale?: string
    target_date?: string
  }>
  tasks: Array<{
    milestone_idx: number
    name: string
    details: string
    category: 'milestone_task' | 'daily_task'
  }>
  token_count: number
  cost_cents: number
}
