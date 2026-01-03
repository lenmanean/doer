/**
 * Todoist Provider Implementation
 * Implements TaskManagementProvider interface for Todoist integration
 */

import { createClient } from '@/lib/supabase/server'
import { encryptToken, decryptToken } from '@/lib/calendar/encryption'
import { logger } from '@/lib/logger'
import type {
  TaskManagementProvider,
  Tokens,
  Project,
  TaskInput,
  TaskUpdate,
  PushResult,
  UpdateResult,
  CompleteResult,
} from './base-provider'

const TODOIST_API_BASE = 'https://api.todoist.com/rest/v2'

/**
 * Todoist API Error Response
 */
interface TodoistError {
  error: string
  error_code?: number
  error_description?: string
}

/**
 * Todoist Task Response
 */
interface TodoistTask {
  id: string
  content: string
  description?: string
  priority: number
  due?: {
    date: string
    datetime?: string
    string: string
    timezone?: string
  }
  project_id: string
  created_at: string
  updated_at?: string
}

/**
 * Todoist Project Response
 */
interface TodoistProject {
  id: string
  name: string
  color?: string
  is_favorite?: boolean
  order: number
  is_inbox_project?: boolean
  is_team_inbox?: boolean
  view_style?: string
  parent_id?: string
}

/**
 * Todoist Provider
 */
export class TodoistProvider implements TaskManagementProvider {
  private readonly provider = 'todoist' as const

  validateConfig(): void {
    if (!process.env.TODOIST_CLIENT_ID) {
      throw new Error('TODOIST_CLIENT_ID environment variable is not set')
    }
    if (!process.env.TODOIST_CLIENT_SECRET) {
      throw new Error('TODOIST_CLIENT_SECRET environment variable is not set')
    }
  }

  getRedirectUri(): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    return `${baseUrl}/api/integrations/todoist/callback`
  }

  async generateAuthUrl(state?: string): Promise<string> {
    this.validateConfig()
    const clientId = process.env.TODOIST_CLIENT_ID!
    const redirectUri = this.getRedirectUri()

    const params = new URLSearchParams({
      client_id: clientId,
      scope: 'data:read_write,data:delete',
      state: state || '',
    })

    return `https://todoist.com/oauth/authorize?${params.toString()}&redirect_uri=${encodeURIComponent(redirectUri)}`
  }

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<Tokens> {
    this.validateConfig()
    const clientId = process.env.TODOIST_CLIENT_ID!
    const clientSecret = process.env.TODOIST_CLIENT_SECRET!

    const response = await fetch('https://todoist.com/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    })

    if (!response.ok) {
      const error: TodoistError = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`Failed to exchange code for tokens: ${error.error || response.statusText}`)
    }

    const data = await response.json()

    if (!data.access_token) {
      throw new Error('Failed to obtain access token from Todoist')
    }

    // Todoist tokens don't expire, but we'll set a far future expiry
    // Note: Todoist doesn't provide refresh tokens, tokens are long-lived
    return {
      access_token: data.access_token,
      refresh_token: undefined, // Todoist doesn't use refresh tokens
      expiry_date: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year from now
    }
  }

  async refreshAccessToken(connectionId: string): Promise<Tokens> {
    // Todoist doesn't support refresh tokens - tokens are long-lived
    // If token is invalid, user needs to reconnect
    const supabase = await createClient()
    
    const { data: connection, error } = await supabase
      .from('task_management_connections')
      .select('id, access_token_encrypted')
      .eq('id', connectionId)
      .single()

    if (error || !connection) {
      throw new Error(`Connection not found: ${connectionId}`)
    }

    const accessToken = decryptToken(connection.access_token_encrypted)
    
    // Return existing token (Todoist tokens don't expire)
    return {
      access_token: accessToken,
      refresh_token: undefined,
      expiry_date: Date.now() + 365 * 24 * 60 * 60 * 1000,
    }
  }

  private async getAccessToken(connectionId: string): Promise<string> {
    const supabase = await createClient()

    const { data: connection, error } = await supabase
      .from('task_management_connections')
      .select('id, access_token_encrypted, token_expires_at')
      .eq('id', connectionId)
      .single()

    if (error || !connection) {
      throw new Error(`Connection not found: ${connectionId}`)
    }

    // Check if token needs refresh (unlikely for Todoist, but check expiry)
    if (connection.token_expires_at) {
      const expiresAt = new Date(connection.token_expires_at)
      const now = new Date()
      if (expiresAt <= now) {
        // Try to refresh (will just return existing token for Todoist)
        const refreshed = await this.refreshAccessToken(connectionId)
        return refreshed.access_token
      }
    }

    return decryptToken(connection.access_token_encrypted)
  }

  private async makeApiRequest<T>(
    accessToken: string,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${TODOIST_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error: TodoistError = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`Todoist API error: ${error.error || response.statusText}`)
    }

    return response.json()
  }

  async getProjects(connectionId: string): Promise<Project[]> {
    const accessToken = await this.getAccessToken(connectionId)
    const projects = await this.makeApiRequest<TodoistProject[]>(accessToken, '/projects')

    return projects.map(project => ({
      id: project.id,
      name: project.name,
      color: project.color,
      is_favorite: project.is_favorite,
    }))
  }

  async pushTask(connectionId: string, task: TaskInput): Promise<PushResult> {
    try {
      const accessToken = await this.getAccessToken(connectionId)

      // Get default project if not specified
      let projectId = task.projectId
      if (!projectId) {
        const supabase = await createClient()
        const { data: connection } = await supabase
          .from('task_management_connections')
          .select('default_project_id')
          .eq('id', connectionId)
          .single()
        projectId = connection?.default_project_id || undefined
      }

      // Map DOER priority (1-4) to Todoist priority (1-4)
      // DOER: 1=Critical, 2=High, 3=Medium, 4=Low
      // Todoist: 1=Normal, 2=High, 3=Medium, 4=Low (inverse, but we'll use direct mapping)
      const todoistPriority = task.priority

      // Build task description with details and duration
      let description = ''
      if (task.taskDetails) {
        description = task.taskDetails
      }
      if (task.durationMinutes) {
        if (description) description += '\n\n'
        description += `Duration: ${task.durationMinutes} minutes`
      }
      if (task.planName) {
        if (description) description += '\n\n'
        description += `Plan: ${task.planName}`
      }

      // Format due date
      const dueDate = task.dueDateTime || task.dueDate

      const taskData: Partial<TodoistTask> = {
        content: task.taskName,
        description: description || undefined,
        priority: todoistPriority,
        due: dueDate ? {
          date: task.dueDate,
          datetime: task.dueDateTime || undefined,
          string: dueDate,
        } : undefined,
        project_id: projectId,
      }

      const createdTask = await this.makeApiRequest<TodoistTask>(
        accessToken,
        '/tasks',
        {
          method: 'POST',
          body: JSON.stringify(taskData),
        }
      )

      return {
        external_task_id: createdTask.id,
        success: true,
      }
    } catch (error) {
      logger.error('Failed to push task to Todoist', {
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        connectionId,
        taskId: task.taskId,
      })
      return {
        external_task_id: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async updateTask(
    connectionId: string,
    externalTaskId: string,
    updates: TaskUpdate
  ): Promise<UpdateResult> {
    try {
      const accessToken = await this.getAccessToken(connectionId)

      const taskData: Partial<TodoistTask> = {}

      if (updates.taskName !== undefined) {
        taskData.content = updates.taskName
      }
      if (updates.taskDetails !== undefined) {
        taskData.description = updates.taskDetails
      }
      if (updates.priority !== undefined) {
        taskData.priority = updates.priority
      }
      if (updates.dueDate !== undefined || updates.dueDateTime !== undefined) {
        const dueDate = updates.dueDateTime || updates.dueDate
        taskData.due = dueDate ? {
          date: updates.dueDate || updates.dueDateTime!,
          datetime: updates.dueDateTime || undefined,
          string: dueDate,
        } : undefined
      }
      if (updates.projectId !== undefined) {
        taskData.project_id = updates.projectId
      }

      await this.makeApiRequest<TodoistTask>(
        accessToken,
        `/tasks/${externalTaskId}`,
        {
          method: 'POST',
          body: JSON.stringify(taskData),
        }
      )

      return {
        success: true,
      }
    } catch (error) {
      logger.error('Failed to update task in Todoist', {
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        connectionId,
        externalTaskId,
      })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async completeTask(
    connectionId: string,
    externalTaskId: string
  ): Promise<CompleteResult> {
    try {
      const accessToken = await this.getAccessToken(connectionId)

      await this.makeApiRequest(
        accessToken,
        `/tasks/${externalTaskId}/close`,
        {
          method: 'POST',
        }
      )

      return {
        success: true,
      }
    } catch (error) {
      logger.error('Failed to complete task in Todoist', {
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        connectionId,
        externalTaskId,
      })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}

