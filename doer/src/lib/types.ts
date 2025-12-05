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
  plan_type: 'ai' | 'manual' // text in database (integration plans removed)
  created_at: string // timestamp with time zone
  archived_at?: string // timestamp with time zone
}

// Milestone interface removed - focusing on difficulty-based task system

export type TaskDifficulty = 'easy' | 'medium' | 'hard'

export function getDifficultyFromComplexity(score: number): TaskDifficulty {
  if (score <= 3) return 'easy'
  if (score <= 7) return 'medium'
  return 'hard'
}

export interface Task {
  id: string
  plan_id: string | null // null for calendar events and free-mode tasks
  idx: number
  name: string
  details?: string
  estimated_duration_minutes: number
  complexity_score?: number // 1-10 scale (legacy)
  priority: 1 | 2 | 3 | 4 // Task priority system
  created_at: string // timestamp with time zone
  scheduled_date?: string // For validation
  start_time?: string // For validation
  end_time?: string // For validation
  day_index?: number // For calendar display
  is_calendar_event?: boolean // True if task came from calendar event (read-only)
  calendar_event_id?: string // Reference to calendar_events.id
  is_detached?: boolean // True if user has edited this calendar event task (deprecated for read-only calendar events)
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
  plan_id: string | null // null for calendar events and free-mode tasks
  task_id: string
  milestone_id?: string
  day_index: number
  date: string // date in database
  start_time?: string // time in database (HH:MM format)
  end_time?: string // time in database (HH:MM format)
  duration_minutes?: number
  rescheduled_from?: string // date in database
  created_at: string // timestamp with time zone
  status?: string
  pending_reschedule_id?: string
  reschedule_count?: number
  reschedule_reason?: string | Record<string, unknown> | null
}

export interface RescheduleProposal {
  id: string
  plan_id: string
  user_id: string
  task_schedule_id: string
  task_id: string
  proposed_date: string
  proposed_start_time: string
  proposed_end_time: string
  proposed_day_index: number
  original_date: string
  original_start_time: string | null
  original_end_time: string | null
  original_day_index: number
  context_score: number | null
  priority_penalty: number | null
  density_penalty: number | null
  reason: string
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
  reviewed_at: string | null
  reviewed_by_user_id: string | null
  // Enriched fields (from joins)
  task_name?: string
  task_priority?: number
  task_duration_minutes?: number
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
  taskCount: number
}

// MilestoneData interface removed - focusing on difficulty-based task system

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

export interface ClarificationNeedsResponse {
  needsClarification: boolean
  questions: string[]
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
}

// Time-block scheduler types
export interface TimeBlockPlacement {
  task_id: string
  date: string
  day_index: number
  start_time: string // "09:00"
  end_time: string // "11:30"
  duration_minutes: number
}

export interface TimeBlockSchedulerOptions {
  tasks: Array<{
    id: string
    name: string
    estimated_duration_minutes: number
    priority: number
    idx: number // AI's intended order
    complexity_score: number // Keep for backward compatibility with scheduler
  }>
  startDate: Date
  endDate: Date
  workdayStartHour: number // Default 9
  workdayStartMinute: number // Default 0
  workdayEndHour: number // Default 17
  lunchStartHour: number // Default 12
  lunchEndHour: number // Default 13
  allowWeekends?: boolean // Include weekends when scheduling
  weekendStartHour?: number // Default to workdayStartHour
  weekendStartMinute?: number // Default to workdayStartMinute
  weekendEndHour?: number // Default to workdayEndHour
  weekendLunchStartHour?: number // Default to lunchStartHour
  weekendLunchEndHour?: number // Default to lunchEndHour
  weekdayMaxMinutes?: number // Cap per-day minutes on weekdays to respect energy limits
  weekendMaxMinutes?: number // Cap per-day minutes on weekends
  currentTime?: Date // Optional current time to avoid scheduling in the past
  existingSchedules?: Array<{ // Optional existing schedules to avoid conflicts
    date: string
    start_time: string
    end_time: string
  }>
  availability?: NormalizedAvailability
  forceStartDate?: boolean // If true, prioritize scheduling on start date even if it's a weekend
  taskDependencies?: Map<number, number[]> // Map of task idx -> array of dependent task idxs
  requireStartDate?: boolean // If true, schedule tasks on day 0 starting from workday start, even if current time is after workday end
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
  availability?: NormalizedAvailability
  timeConstraints?: {
    isStartDateToday: boolean
    remainingMinutes: number
    urgencyLevel: 'high' | 'medium' | 'low' | 'none'
    requiresToday: boolean
    deadlineDate?: Date
    deadlineType?: 'tomorrow' | 'specific_date' | 'none'
    timeFormat?: '12h' | '24h'
    userLocalTime?: Date
    timelineRequirement?: {
      minimumDays?: number
      preferredDays?: number
      timelinePhrase?: string
    }
  }
}

export interface AITaskOutput {
  name: string
  details: string
  estimated_duration_minutes: number
  priority: 1 | 2 | 3 | 4
}

export interface AIModelResponse {
  model_name: string
  prompt_version: string
  request_data: any
  timeline_days: number
  goal_text: string
  plan_summary: string
  end_date: string
  tasks: AITaskOutput[] // Combined, no more milestone_tasks/daily_tasks split
  token_count: number
  cost_cents: number
}

// New interfaces for plan review and validation system
export interface GeneratedPlan {
  id: string
  goal_text: string
  start_date: string
  end_date: string
  timeline_days: number
  summary_data: any
}

export interface ValidationError {
  type: 'date_order' | 'task_before_start' | 'task_after_end'
  message: string
  blocking: true
}

export interface ValidationWarning {
  type: 'timeline_compressed' | 'task_overlap'
  message: string
  blocking: false
}

export interface TimelineAdjustmentRequest {
  planId: string
  newDuration: number
  tasks: Task[]
}

export interface ReviewState {
  plan: GeneratedPlan
  tasks: Task[]
  validationErrors: ValidationError[]
  validationWarnings: ValidationWarning[]
  isDirty: boolean
}
// Availability types
export type AvailabilitySource =
  | 'existing_plan'
  | 'manual_task'
  | 'calendar_event'
  | 'time_off'

export interface BusySlot {
  start: string
  end: string
  source?: AvailabilitySource
  metadata?: Record<string, any>
}

export interface AvailabilityPayload {
  busy_slots?: BusySlot[]
  time_off?: BusySlot[]
  deadline?: string | null
}

export interface NormalizedAvailability {
  busySlots: BusySlot[]
  timeOff: BusySlot[]
  deadline?: string | null
}

export interface AvailabilityValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  normalized: NormalizedAvailability
}

