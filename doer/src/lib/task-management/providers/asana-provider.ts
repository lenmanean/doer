/**
 * Asana Provider Implementation
 * Implements TaskManagementProvider interface for Asana integration
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

const ASANA_API_BASE = 'https://app.asana.com/api/1.0'

/**
 * Asana API Error Response
 */
interface AsanaError {
  errors?: Array<{
    message: string
    help?: string
  }>
  error?: string
}

/**
 * Asana API Response Wrapper (Asana wraps all responses in { data: ... })
 */
interface AsanaResponse<T> {
  data: T
}

/**
 * Asana Task Response
 */
interface AsanaTask {
  gid: string
  name: string
  notes?: string
  due_on?: string | null
  due_at?: string | null
  priority?: 'high' | 'medium' | 'low' | null
  completed?: boolean
  projects?: Array<{ gid: string }>
  workspace?: { gid: string }
}

/**
 * Asana Project Response
 */
interface AsanaProject {
  gid: string
  name: string
  color?: string | null
  archived?: boolean
  workspace?: { gid: string }
}

/**
 * Asana Token Response
 */
interface AsanaTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  data?: {
    access_token: string
    refresh_token?: string
    expires_in?: number
  }
}

/**
 * Asana Provider
 */
export class AsanaProvider implements TaskManagementProvider {
  private readonly provider = 'asana' as const

  validateConfig(): void {
    if (!process.env.ASANA_CLIENT_ID) {
      throw new Error('ASANA_CLIENT_ID environment variable is not set')
    }
    if (!process.env.ASANA_CLIENT_SECRET) {
      throw new Error('ASANA_CLIENT_SECRET environment variable is not set')
    }
  }

  getRedirectUri(): string {
    // First priority: explicit URL from environment
    if (process.env.NEXT_PUBLIC_APP_URL) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL.trim()
      const baseUrl = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl
      return `${baseUrl}/api/integrations/asana/callback`
    }
    
    // Second priority: production domain (usedoer.com) - always use https
    const nodeEnv = process.env.NODE_ENV as string | undefined
    const vercelEnv = process.env.VERCEL_ENV as string | undefined
    const isProduction = vercelEnv === 'production' || 
                        nodeEnv === 'production' ||
                        (!nodeEnv && process.env.VERCEL)
    
    if (isProduction) {
      return `https://usedoer.com/api/integrations/asana/callback`
    }
    
    // Third priority: Vercel preview/deployment URL
    if (process.env.VERCEL_URL && vercelEnv !== 'production') {
      const vercelUrl = process.env.VERCEL_URL.trim()
      const baseUrl = vercelUrl.startsWith('https://') 
        ? vercelUrl 
        : `https://${vercelUrl}`
      return `${baseUrl}/api/integrations/asana/callback`
    }
    
    // Last resort: localhost (development only)
    return `http://localhost:3000/api/integrations/asana/callback`
  }

  async generateAuthUrl(state?: string): Promise<string> {
    this.validateConfig()
    const clientId = process.env.ASANA_CLIENT_ID!
    const redirectUri = this.getRedirectUri()

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state: state || '',
    })

    return `https://app.asana.com/-/oauth_authorize?${params.toString()}`
  }

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<Tokens> {
    this.validateConfig()
    const clientId = process.env.ASANA_CLIENT_ID!
    const clientSecret = process.env.ASANA_CLIENT_SECRET!

    // Get the expected redirect URI to compare
    const expectedRedirectUri = this.getRedirectUri()

    if (redirectUri !== expectedRedirectUri) {
      logger.warn('Asana redirect URI mismatch', {
        redirectUri,
        expectedRedirectUri,
      })
    }

    const response = await fetch('https://app.asana.com/-/oauth_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('Asana token exchange failed - HTTP error', {
        status: response.status,
        statusText: response.statusText,
        errorText,
        redirectUri,
        hasCode: !!code,
      })
      let errorMessage = 'Unknown error'
      try {
        const errorData: AsanaError = JSON.parse(errorText)
        if (errorData.errors && errorData.errors.length > 0) {
          errorMessage = errorData.errors[0].message
        } else if (errorData.error) {
          errorMessage = errorData.error
        }
      } catch {
        errorMessage = errorText || response.statusText
      }
      throw new Error(`Failed to exchange code for tokens: ${errorMessage}`)
    }

    const responseText = await response.text()
    let data: AsanaTokenResponse
    
    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      logger.error('Asana token exchange failed - invalid JSON response', {
        responseText: responseText.substring(0, 500),
        parseError: parseError instanceof Error ? parseError.message : String(parseError),
      })
      throw new Error('Invalid response format from Asana token endpoint')
    }


    // Check for error in response (some APIs return errors with HTTP 200)
    if ((data as any).errors || (data as any).error) {
      const errorData = data as AsanaError
      const errorMessage = errorData.errors?.[0]?.message || errorData.error || 'Unknown error'
      logger.error('Asana token exchange failed - error in response body', {
        errorData,
        errorMessage,
      })
      throw new Error(`Failed to exchange code for tokens: ${errorMessage}`)
    }

    // Asana OAuth token response format (standard OAuth 2.0):
    // Direct format: { access_token, refresh_token, expires_in, token_type }
    // Or wrapped: { data: { access_token, ... } }
    // Try both formats
    let accessToken: string | undefined
    let refreshToken: string | undefined
    let expiresIn: number = 3600 // Default to 1 hour

    // First, try direct format (standard OAuth 2.0)
    if ((data as any).access_token) {
      accessToken = (data as any).access_token
      refreshToken = (data as any).refresh_token
      expiresIn = (data as any).expires_in || 3600
    }
    // Then try wrapped format (Asana sometimes wraps responses)
    else if ((data as any).data) {
      const wrappedData = (data as any).data
      if (wrappedData.access_token) {
        accessToken = wrappedData.access_token
        refreshToken = wrappedData.refresh_token
        expiresIn = wrappedData.expires_in || 3600
      }
    }

    if (!accessToken) {
      // Include response details in error for debugging (truncated for security)
      const responseKeys = data ? Object.keys(data) : []
      const wrappedKeys = (data as any).data ? Object.keys((data as any).data) : []
      const responseStructure = {
        hasDirectAccessToken: !!(data as any).access_token,
        hasWrappedData: !!(data as any).data,
        topLevelKeys: responseKeys,
        wrappedKeys: wrappedKeys,
        responseType: Array.isArray(data) ? 'array' : typeof data,
      }
      
      logger.error('Asana token exchange failed - no access token in response', {
        responseData: data,
        responseStructure,
        responsePreview: responseText.substring(0, 300),
        fullResponseLength: responseText.length,
      })
      
      // Create a detailed error message that will be visible in the client
      const errorDetails = `Response keys: ${responseKeys.join(', ') || 'none'}${wrappedKeys.length > 0 ? ` | Wrapped keys: ${wrappedKeys.join(', ')}` : ''}`
      throw new Error(`Failed to obtain access token from Asana. ${errorDetails}`)
    }

    // Calculate expiry date (current time + expires_in seconds)
    const expiryDate = Date.now() + expiresIn * 1000

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: expiryDate,
    }
  }

  async refreshAccessToken(connectionId: string): Promise<Tokens> {
    this.validateConfig()
    const supabase = await createClient()
    
    const { data: connection, error } = await supabase
      .from('task_management_connections')
      .select('id, access_token_encrypted, refresh_token_encrypted')
      .eq('id', connectionId)
      .single()

    if (error || !connection) {
      throw new Error(`Connection not found: ${connectionId}`)
    }

    if (!connection.refresh_token_encrypted) {
      throw new Error('No refresh token available for Asana connection')
    }

    const clientId = process.env.ASANA_CLIENT_ID!
    const clientSecret = process.env.ASANA_CLIENT_SECRET!
    const refreshToken = decryptToken(connection.refresh_token_encrypted)

    const response = await fetch('https://app.asana.com/-/oauth_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = 'Unknown error'
      try {
        const errorData: AsanaError = JSON.parse(errorText)
        if (errorData.errors && errorData.errors.length > 0) {
          errorMessage = errorData.errors[0].message
        } else if (errorData.error) {
          errorMessage = errorData.error
        }
      } catch {
        errorMessage = errorText || response.statusText
      }
      throw new Error(`Failed to refresh access token: ${errorMessage}`)
    }

    const data: AsanaTokenResponse = await response.json()
    const tokenData = data.data || data
    const newAccessToken = tokenData.access_token
    const newRefreshToken = tokenData.refresh_token || refreshToken // Use new refresh token if provided, otherwise keep existing
    const expiresIn = tokenData.expires_in || 3600

    if (!newAccessToken) {
      throw new Error('Failed to obtain new access token from Asana')
    }

    // Update connection with new tokens
    const accessTokenEncrypted = encryptToken(newAccessToken)
    const refreshTokenEncrypted = newRefreshToken ? encryptToken(newRefreshToken) : connection.refresh_token_encrypted
    const expiryDate = Date.now() + expiresIn * 1000

    await supabase
      .from('task_management_connections')
      .update({
        access_token_encrypted: accessTokenEncrypted,
        refresh_token_encrypted: refreshTokenEncrypted,
        token_expires_at: new Date(expiryDate).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectionId)

    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expiry_date: expiryDate,
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

    // Check if token needs refresh
    if (connection.token_expires_at) {
      const expiresAt = new Date(connection.token_expires_at)
      const now = new Date()
      // Refresh if token expires within 5 minutes
      if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
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
    const url = endpoint.startsWith('http') ? endpoint : `${ASANA_API_BASE}${endpoint}`
    
    // Add timeout configuration (30 seconds default)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })
      
      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = 'Unknown error'
        try {
          const errorData: AsanaError = JSON.parse(errorText)
          if (errorData.errors && errorData.errors.length > 0) {
            errorMessage = errorData.errors[0].message
            if (errorData.errors[0].help) {
              errorMessage += ` (${errorData.errors[0].help})`
            }
          } else if (errorData.error) {
            errorMessage = errorData.error
          }
        } catch {
          errorMessage = errorText || response.statusText
        }
        
        // Handle rate limiting
        if (response.status === 429) {
          throw new Error(`Asana API rate limit exceeded: ${errorMessage}`)
        }
        
        throw new Error(`Asana API error: ${errorMessage}`)
      }

      const responseData = await response.json()
      
      // Asana wraps all responses in { data: ... }
      // But handle both wrapped and direct formats for safety
      if (responseData && typeof responseData === 'object' && 'data' in responseData) {
        return (responseData as AsanaResponse<T>).data
      }
      
      // If not wrapped, return directly (shouldn't happen with Asana, but be defensive)
      return responseData as T
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Asana API request timeout')
      }
      throw error
    }
  }

  async getProjects(connectionId: string): Promise<Project[]> {
    try {
      const accessToken = await this.getAccessToken(connectionId)
      
      // Asana requires workspace context for projects
      // First, get user's workspaces
      const workspaces = await this.makeApiRequest<Array<{ gid: string; name: string }>>(
        accessToken,
        '/workspaces?opt_fields=name'
      )
      
      if (!workspaces || workspaces.length === 0) {
        logger.warn('No workspaces found for Asana user', { connectionId })
        return []
      }
      
      // Fetch projects from all workspaces in parallel for better performance
      // Asana API: GET /workspaces/{workspace_gid}/projects
      const workspaceProjectPromises = workspaces.map(async (workspace) => {
        try {
          const workspaceProjects: AsanaProject[] = []
          let offset = 0
          const limit = 100
          let hasMore = true
          
          // Handle pagination for workspaces with >100 projects
          while (hasMore) {
            const projects = await this.makeApiRequest<AsanaProject[]>(
              accessToken,
              `/workspaces/${workspace.gid}/projects?opt_fields=name,color,archived&limit=${limit}&offset=${offset}`
            )
            
            if (Array.isArray(projects) && projects.length > 0) {
              workspaceProjects.push(...projects)
              // If we got fewer than limit, we've reached the end
              hasMore = projects.length === limit
              offset += limit
            } else {
              hasMore = false
            }
          }
          
          return workspaceProjects
        } catch (workspaceError) {
          logger.warn('Failed to fetch projects for workspace', {
            workspaceId: workspace.gid,
            workspaceName: workspace.name,
            error: workspaceError instanceof Error ? workspaceError.message : String(workspaceError),
          })
          // Return empty array on error, continue with other workspaces
          return []
        }
      })
      
      // Wait for all workspace project fetches to complete in parallel
      const workspaceProjectsArrays = await Promise.all(workspaceProjectPromises)
      const allProjects: AsanaProject[] = workspaceProjectsArrays.flat()

      return allProjects
        .filter(project => !project.archived) // Filter out archived projects
        .map(project => ({
          id: project.gid,
          name: project.name,
          color: project.color || undefined,
          is_favorite: false, // Asana API doesn't provide favorite status in this endpoint
        }))
    } catch (error) {
      logger.error('Failed to fetch Asana projects', {
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        connectionId,
      })
      throw error
    }
  }

  async pushTask(connectionId: string, task: TaskInput): Promise<PushResult> {
    try {
      const accessToken = await this.getAccessToken(connectionId)

      // Get default project if not specified
      let projectGid = task.projectId
      if (!projectGid) {
        const supabase = await createClient()
        const { data: connection } = await supabase
          .from('task_management_connections')
          .select('default_project_id')
          .eq('id', connectionId)
          .single()
        projectGid = connection?.default_project_id || undefined
      }

      if (!projectGid) {
        return {
          external_task_id: '',
          success: false,
          error: 'No project specified for task',
        }
      }

      // Map DOER priority (1-4) to Asana priority (high/medium/low)
      // DOER: 1=Critical, 2=High, 3=Medium, 4=Low
      // Asana: high, medium, low, or null
      let asanaPriority: 'high' | 'medium' | 'low' | null = null
      if (task.priority === 1 || task.priority === 2) {
        asanaPriority = 'high'
      } else if (task.priority === 3) {
        asanaPriority = 'medium'
      } else if (task.priority === 4) {
        asanaPriority = 'low'
      }

      // Build task notes (description) with details and duration
      let notes = ''
      if (task.taskDetails) {
        notes = task.taskDetails
      }
      if (task.durationMinutes) {
        if (notes) notes += '\n\n'
        notes += `Duration: ${task.durationMinutes} minutes`
      }
      if (task.planName) {
        if (notes) notes += '\n\n'
        notes += `Plan: ${task.planName}`
      }

      // Format due date
      // Asana supports both due_on (date only) and due_at (datetime)
      const taskData: any = {
        name: task.taskName,
        projects: [projectGid],
      }

      if (notes) {
        taskData.notes = notes
      }

      if (task.dueDateTime) {
        // Use due_at for datetime
        taskData.due_at = task.dueDateTime
      } else if (task.dueDate) {
        // Use due_on for date only
        taskData.due_on = task.dueDate
      }

      if (asanaPriority !== null) {
        taskData.priority = asanaPriority
      }

      const createdTask = await this.makeApiRequest<AsanaTask>(
        accessToken,
        '/tasks',
        {
          method: 'POST',
          body: JSON.stringify({ data: taskData }),
        }
      )

      return {
        external_task_id: createdTask.gid,
        success: true,
      }
    } catch (error) {
      logger.error('Failed to push task to Asana', {
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

      const taskData: any = {}

      if (updates.taskName !== undefined) {
        taskData.name = updates.taskName
      }
      if (updates.taskDetails !== undefined) {
        taskData.notes = updates.taskDetails
      }
      if (updates.priority !== undefined) {
        // Map DOER priority to Asana priority
        if (updates.priority === 1 || updates.priority === 2) {
          taskData.priority = 'high'
        } else if (updates.priority === 3) {
          taskData.priority = 'medium'
        } else if (updates.priority === 4) {
          taskData.priority = 'low'
        } else {
          taskData.priority = null
        }
      }
      if (updates.dueDate !== undefined || updates.dueDateTime !== undefined) {
        if (updates.dueDateTime) {
          taskData.due_at = updates.dueDateTime
          // Clear due_on if we're setting due_at
          taskData.due_on = null
        } else if (updates.dueDate) {
          taskData.due_on = updates.dueDate
          // Clear due_at if we're setting due_on
          taskData.due_at = null
        } else {
          // Clear both if no date provided
          taskData.due_on = null
          taskData.due_at = null
        }
      }
      if (updates.projectId !== undefined) {
        taskData.projects = [updates.projectId]
      }

      await this.makeApiRequest<AsanaTask>(
        accessToken,
        `/tasks/${externalTaskId}`,
        {
          method: 'PUT',
          body: JSON.stringify({ data: taskData }),
        }
      )

      return {
        success: true,
      }
    } catch (error) {
      logger.error('Failed to update task in Asana', {
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

      await this.makeApiRequest<AsanaTask>(
        accessToken,
        `/tasks/${externalTaskId}`,
        {
          method: 'PUT',
          body: JSON.stringify({ data: { completed: true } }),
        }
      )

      return {
        success: true,
      }
    } catch (error) {
      logger.error('Failed to complete task in Asana', {
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

  /**
   * Reopen a completed task in Asana (helper method for sync hooks)
   * This is a convenience method since Asana supports reopening tasks
   */
  async reopenTask(
    connectionId: string,
    externalTaskId: string
  ): Promise<CompleteResult> {
    try {
      const accessToken = await this.getAccessToken(connectionId)

      await this.makeApiRequest<AsanaTask>(
        accessToken,
        `/tasks/${externalTaskId}`,
        {
          method: 'PUT',
          body: JSON.stringify({ data: { completed: false } }),
        }
      )

      return {
        success: true,
      }
    } catch (error) {
      logger.error('Failed to reopen task in Asana', {
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

