/**
 * Base Task Management Provider Interface
 * Defines the contract that all task management providers (Todoist, Asana, Trello) must implement
 */

/**
 * OAuth tokens returned from provider
 */
export interface Tokens {
  access_token: string
  refresh_token?: string // Optional, depends on provider
  expiry_date: number
}

/**
 * Project representation from provider
 */
export interface Project {
  id: string
  name: string
  color?: string
  is_favorite?: boolean
}

/**
 * Task input for pushing to task management tool
 */
export interface TaskInput {
  taskScheduleId: string
  taskId: string
  planId: string | null
  taskName: string
  taskDetails?: string
  planName: string | null
  priority: number // 1-4 (1=Critical, 4=Low)
  dueDate: string // ISO date string (YYYY-MM-DD)
  dueDateTime?: string // ISO datetime string (optional)
  durationMinutes?: number
  projectId?: string // Provider-specific project ID
}

/**
 * Task update input
 */
export interface TaskUpdate {
  taskName?: string
  taskDetails?: string
  priority?: number
  dueDate?: string
  dueDateTime?: string
  projectId?: string
}

/**
 * Result of pushing task to task management tool
 */
export interface PushResult {
  external_task_id: string
  success: boolean
  error?: string
}

/**
 * Result of updating task
 */
export interface UpdateResult {
  success: boolean
  error?: string
}

/**
 * Result of completing task
 */
export interface CompleteResult {
  success: boolean
  error?: string
}

/**
 * Task Management Provider Interface
 * All task management providers must implement this interface
 */
export interface TaskManagementProvider {
  /**
   * Generate OAuth authorization URL
   */
  generateAuthUrl(state?: string): Promise<string>

  /**
   * Exchange authorization code for access and refresh tokens
   */
  exchangeCodeForTokens(code: string, redirectUri: string): Promise<Tokens>

  /**
   * Refresh access token using refresh token (if supported)
   */
  refreshAccessToken(connectionId: string): Promise<Tokens>

  /**
   * Get the OAuth redirect URI for this provider
   */
  getRedirectUri(): string

  /**
   * Push a DOER task to the task management tool
   */
  pushTask(
    connectionId: string,
    task: TaskInput
  ): Promise<PushResult>

  /**
   * Update an existing task in the task management tool
   */
  updateTask(
    connectionId: string,
    externalTaskId: string,
    updates: TaskUpdate
  ): Promise<UpdateResult>

  /**
   * Mark a task as complete in the task management tool
   */
  completeTask(
    connectionId: string,
    externalTaskId: string
  ): Promise<CompleteResult>

  /**
   * Fetch list of available projects for the user
   */
  getProjects(connectionId: string): Promise<Project[]>

  /**
   * Validate that required configuration (env vars, etc.) is present
   * Throws error if configuration is invalid
   */
  validateConfig(): void
}

