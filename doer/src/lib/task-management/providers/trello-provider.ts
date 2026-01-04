/**
 * Trello Provider Implementation
 * Implements TaskManagementProvider interface for Trello integration
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

const TRELLO_API_BASE = 'https://api.trello.com/1'

/**
 * Trello API Error Response
 */
interface TrelloError {
  error?: string
  message?: string
}

/**
 * Trello Board Response
 */
interface TrelloBoard {
  id: string
  name: string
  closed: boolean
  color?: string
}

/**
 * Trello List Response
 */
interface TrelloList {
  id: string
  name: string
  closed: boolean
  idBoard: string
}

/**
 * Trello Card Response
 */
interface TrelloCard {
  id: string
  name: string
  desc?: string
  due?: string | null
  dueComplete?: boolean
  idList: string
  idBoard: string
  idLabels?: string[]
  closed?: boolean
}

/**
 * Trello Label Response
 */
interface TrelloLabel {
  id: string
  name: string
  color: string
  idBoard: string
}

/**
 * Rate limiting state
 */
interface RateLimitState {
  requests: number[]
  windowStart: number
}

/**
 * Trello Provider
 */
export class TrelloProvider implements TaskManagementProvider {
  private readonly provider = 'trello' as const
  private rateLimitState: RateLimitState = {
    requests: [],
    windowStart: Date.now(),
  }

  validateConfig(): void {
    if (!process.env.TRELLO_API_KEY) {
      throw new Error('TRELLO_API_KEY environment variable is not set')
    }
  }

  getRedirectUri(): string {
    // First priority: explicit URL from environment
    if (process.env.NEXT_PUBLIC_APP_URL) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL.trim()
      const baseUrl = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl
      return `${baseUrl}/api/integrations/trello/callback`
    }
    
    // Second priority: production domain (usedoer.com) - always use https
    const nodeEnv = process.env.NODE_ENV as string | undefined
    const vercelEnv = process.env.VERCEL_ENV as string | undefined
    const isProduction = vercelEnv === 'production' || 
                        nodeEnv === 'production' ||
                        (!nodeEnv && process.env.VERCEL)
    
    if (isProduction) {
      return `https://usedoer.com/api/integrations/trello/callback`
    }
    
    // Third priority: Vercel preview/deployment URL
    if (process.env.VERCEL_URL && vercelEnv !== 'production') {
      const vercelUrl = process.env.VERCEL_URL.trim()
      const baseUrl = vercelUrl.startsWith('https://') 
        ? vercelUrl 
        : `https://${vercelUrl}`
      return `${baseUrl}/api/integrations/trello/callback`
    }
    
    // Last resort: localhost (development only)
    return `http://localhost:3000/api/integrations/trello/callback`
  }

  async generateAuthUrl(state?: string): Promise<string> {
    this.validateConfig()
    const apiKey = process.env.TRELLO_API_KEY!
    const redirectUri = this.getRedirectUri()

    const params = new URLSearchParams({
      expiration: 'never',
      name: 'DOER',
      scope: 'read,write',
      response_type: 'token',
      key: apiKey,
      return_url: redirectUri,
    })

    if (state) {
      params.append('state', state)
    }

    return `https://trello.com/1/authorize?${params.toString()}`
  }

  async exchangeCodeForTokens(token: string, redirectUri: string): Promise<Tokens> {
    // Trello returns token directly (not a code)
    // Token is passed as a parameter, not exchanged
    // Validate token by making a test API call
    this.validateConfig()
    const apiKey = process.env.TRELLO_API_KEY!

    // Test token by fetching user info
    const testUrl = `${TRELLO_API_BASE}/members/me?key=${apiKey}&token=${token}`
    const testResponse = await fetch(testUrl)

    if (!testResponse.ok) {
      const errorText = await testResponse.text()
      let errorMessage = 'Unknown error'
      try {
        const errorData: TrelloError = JSON.parse(errorText)
        errorMessage = errorData.error || errorData.message || errorText
      } catch {
        errorMessage = errorText || testResponse.statusText
      }
      throw new Error(`Invalid Trello token: ${errorMessage}`)
    }

    // Trello tokens don't expire, set far future expiry
    return {
      access_token: token,
      refresh_token: undefined, // Trello doesn't use refresh tokens
      expiry_date: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year from now
    }
  }

  async refreshAccessToken(connectionId: string): Promise<Tokens> {
    // Trello tokens don't expire - just return existing token
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
    
    // Return existing token (Trello tokens don't expire)
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

    // Trello tokens don't expire, but check expiry for consistency
    if (connection.token_expires_at) {
      const expiresAt = new Date(connection.token_expires_at)
      const now = new Date()
      if (expiresAt <= now) {
        // Try to refresh (will just return existing token for Trello)
        const refreshed = await this.refreshAccessToken(connectionId)
        return refreshed.access_token
      }
    }

    return decryptToken(connection.access_token_encrypted)
  }

  /**
   * Check and enforce rate limiting (300 requests per 10 seconds)
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now()
    const windowMs = 10 * 1000 // 10 seconds
    const maxRequests = 300

    // Reset window if more than 10 seconds have passed
    if (now - this.rateLimitState.windowStart >= windowMs) {
      this.rateLimitState = {
        requests: [],
        windowStart: now,
      }
    }

    // Remove requests older than 10 seconds
    this.rateLimitState.requests = this.rateLimitState.requests.filter(
      timestamp => now - timestamp < windowMs
    )

    // Check if we're at the limit
    if (this.rateLimitState.requests.length >= maxRequests) {
      const oldestRequest = this.rateLimitState.requests[0]
      const waitTime = windowMs - (now - oldestRequest) + 100 // Add 100ms buffer
      
      logger.warn('Trello rate limit reached, waiting', {
        waitTimeMs: waitTime,
        requestsInWindow: this.rateLimitState.requests.length,
      })

      await new Promise(resolve => setTimeout(resolve, waitTime))
      
      // Reset after waiting
      this.rateLimitState = {
        requests: [],
        windowStart: Date.now(),
      }
    }

    // Record this request
    this.rateLimitState.requests.push(now)
  }

  /**
   * Make API request to Trello with rate limiting and error handling
   */
  private async makeApiRequest<T>(
    accessToken: string,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    await this.checkRateLimit()

    this.validateConfig()
    const apiKey = process.env.TRELLO_API_KEY!

    // Trello requires key and token as query parameters
    const url = new URL(endpoint.startsWith('http') ? endpoint : `${TRELLO_API_BASE}${endpoint}`)
    url.searchParams.set('key', apiKey)
    url.searchParams.set('token', accessToken)

    // Add timeout using AbortController
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30-second timeout

    try {
      const response = await fetch(url.toString(), {
        ...options,
        signal: controller.signal, // Pass the signal to the fetch request
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })

      clearTimeout(timeoutId) // Clear timeout if request completes

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = 'Unknown error'
        
        try {
          const errorData: TrelloError = JSON.parse(errorText)
          errorMessage = errorData.error || errorData.message || errorText
        } catch {
          errorMessage = errorText || response.statusText
        }

        // Handle specific error codes
        if (response.status === 401) {
          throw new Error(`Trello API authentication failed: ${errorMessage}`)
        } else if (response.status === 403) {
          throw new Error(`Trello API access forbidden: ${errorMessage}`)
        } else if (response.status === 404) {
          throw new Error(`Trello API resource not found: ${errorMessage}`)
        } else if (response.status === 429) {
          // Rate limit exceeded - wait and retry once
          logger.warn('Trello rate limit exceeded, waiting before retry')
          await new Promise(resolve => setTimeout(resolve, 11000)) // Wait 11 seconds
          // Retry once
          return this.makeApiRequest<T>(accessToken, endpoint, options)
        } else if (response.status >= 500) {
          throw new Error(`Trello API server error: ${errorMessage}`)
        }
        
        throw new Error(`Trello API error: ${errorMessage}`)
      }

      return response.json()
    } catch (error) {
      clearTimeout(timeoutId) // Clear timeout on error as well
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Trello API request timeout')
      }
      throw error
    }
  }

  async getProjects(connectionId: string): Promise<Project[]> {
    try {
      const accessToken = await this.getAccessToken(connectionId)
      const boards = await this.makeApiRequest<TrelloBoard[]>(
        accessToken,
        '/members/me/boards?filter=open'
      )

      return boards
        .filter(board => !board.closed)
        .map(board => ({
          id: board.id,
          name: board.name,
          color: board.color,
          is_favorite: false, // Trello API doesn't provide favorite status in this endpoint
        }))
    } catch (error) {
      logger.error('Failed to fetch Trello boards', {
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        connectionId,
      })
      throw error
    }
  }

  /**
   * Get or create a list on a board
   */
  private async getOrCreateList(
    accessToken: string,
    boardId: string,
    listName: string
  ): Promise<string> {
    // First, try to find existing list
    const lists = await this.makeApiRequest<TrelloList[]>(
      accessToken,
      `/boards/${boardId}/lists?filter=open`
    )

    const existingList = lists.find(list => 
      list.name.toLowerCase() === listName.toLowerCase() && !list.closed
    )

    if (existingList) {
      return existingList.id
    }

    // Create new list
    const newList = await this.makeApiRequest<TrelloList>(
      accessToken,
      '/lists',
      {
        method: 'POST',
        body: JSON.stringify({
          name: listName,
          idBoard: boardId,
        }),
      }
    )

    return newList.id
  }

  /**
   * Get or create priority labels on a board
   */
  private async getOrCreatePriorityLabels(
    accessToken: string,
    boardId: string,
    priority: number
  ): Promise<string[]> {
    // Priority mapping: 1=Critical (red), 2=High (orange), 3=Medium (yellow), 4=Low (green)
    const priorityConfig = [
      { priority: 1, name: 'Critical', color: 'red' },
      { priority: 2, name: 'High', color: 'orange' },
      { priority: 3, name: 'Medium', color: 'yellow' },
      { priority: 4, name: 'Low', color: 'green' },
    ]

    const config = priorityConfig.find(c => c.priority === priority)
    if (!config) {
      return []
    }

    // Get existing labels
    const labels = await this.makeApiRequest<TrelloLabel[]>(
      accessToken,
      `/boards/${boardId}/labels`
    )

    // Find or create label
    let label = labels.find(l => 
      l.name.toLowerCase() === config.name.toLowerCase() && 
      l.color === config.color
    )

    if (!label) {
      // Create label
      label = await this.makeApiRequest<TrelloLabel>(
        accessToken,
        '/labels',
        {
          method: 'POST',
          body: JSON.stringify({
            name: config.name,
            color: config.color,
            idBoard: boardId,
          }),
        }
      )
    }

    return [label.id]
  }

  async pushTask(connectionId: string, task: TaskInput): Promise<PushResult> {
    try {
      const accessToken = await this.getAccessToken(connectionId)

      // Get default board if not specified
      let boardId = task.projectId
      if (!boardId) {
        const supabase = await createClient()
        const { data: connection } = await supabase
          .from('task_management_connections')
          .select('default_project_id')
          .eq('id', connectionId)
          .single()
        boardId = connection?.default_project_id || undefined
      }

      if (!boardId) {
        return {
          external_task_id: '',
          success: false,
          error: 'No board specified for task',
        }
      }

      // Get or create list (use "To Do" as default, or create plan-specific list)
      const listName = task.planName ? `Plan: ${task.planName}` : 'To Do'
      const listId = await this.getOrCreateList(accessToken, boardId, listName)

      // Get or create priority labels
      const labelIds = await this.getOrCreatePriorityLabels(accessToken, boardId, task.priority)

      // Build card description
      let description = ''
      if (task.taskDetails) {
        description = task.taskDetails
      }
      if (task.durationMinutes) {
        if (description) description += '\n\n'
        description += `Duration: ${task.durationMinutes} minutes`
      }
      if (task.planName && listName !== `Plan: ${task.planName}`) {
        if (description) description += '\n\n'
        description += `Plan: ${task.planName}`
      }

      // Format due date (Trello accepts ISO 8601 format)
      // If dueDateTime exists, use as-is (should already be ISO 8601)
      // If only dueDate exists (YYYY-MM-DD), convert to ISO 8601 datetime
      let dueDate: string | undefined = undefined
      if (task.dueDateTime) {
        dueDate = task.dueDateTime
      } else if (task.dueDate) {
        // Convert YYYY-MM-DD to ISO 8601 datetime (YYYY-MM-DDTHH:mm:ss.sssZ)
        // Use midnight UTC for date-only values
        dueDate = new Date(`${task.dueDate}T00:00:00.000Z`).toISOString()
      }

      // Create card
      const cardData: Partial<TrelloCard> = {
        name: task.taskName,
        desc: description || undefined,
        idList: listId,
        due: dueDate || undefined,
        idLabels: labelIds.length > 0 ? labelIds : undefined,
      }

      const createdCard = await this.makeApiRequest<TrelloCard>(
        accessToken,
        '/cards',
        {
          method: 'POST',
          body: JSON.stringify(cardData),
        }
      )

      return {
        external_task_id: createdCard.id,
        success: true,
      }
    } catch (error) {
      logger.error('Failed to push task to Trello', {
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

      const cardData: Partial<TrelloCard> = {}

      if (updates.taskName !== undefined) {
        cardData.name = updates.taskName
      }
      if (updates.taskDetails !== undefined) {
        cardData.desc = updates.taskDetails
      }
      if (updates.priority !== undefined) {
        // Get card to find board ID
        const card = await this.makeApiRequest<TrelloCard>(
          accessToken,
          `/cards/${externalTaskId}`
        )
        
        // Get or create priority labels
        const labelIds = await this.getOrCreatePriorityLabels(
          accessToken,
          card.idBoard,
          updates.priority
        )
        cardData.idLabels = labelIds
      }
      if (updates.dueDate !== undefined || updates.dueDateTime !== undefined) {
        // Format due date (Trello accepts ISO 8601 format)
        // If dueDateTime exists, use as-is (should already be ISO 8601)
        // If only dueDate exists (YYYY-MM-DD), convert to ISO 8601 datetime
        let dueDate: string | null = null
        if (updates.dueDateTime) {
          dueDate = updates.dueDateTime
        } else if (updates.dueDate) {
          // Convert YYYY-MM-DD to ISO 8601 datetime (YYYY-MM-DDTHH:mm:ss.sssZ)
          // Use midnight UTC for date-only values
          dueDate = new Date(`${updates.dueDate}T00:00:00.000Z`).toISOString()
        }
        cardData.due = dueDate
      }
      if (updates.projectId !== undefined) {
        // Moving card to different board requires special handling
        // For now, we'll just update the list if it's on the same board
        // Get current card to check board
        const card = await this.makeApiRequest<TrelloCard>(
          accessToken,
          `/cards/${externalTaskId}`
        )
        
        if (card.idBoard !== updates.projectId) {
          // Card is being moved to a different board
          // Get or create list on new board
          const listName = 'To Do'
          const listId = await this.getOrCreateList(accessToken, updates.projectId, listName)
          cardData.idList = listId
          cardData.idBoard = updates.projectId
        }
      }

      await this.makeApiRequest<TrelloCard>(
        accessToken,
        `/cards/${externalTaskId}`,
        {
          method: 'PUT',
          body: JSON.stringify(cardData),
        }
      )

      return {
        success: true,
      }
    } catch (error) {
      logger.error('Failed to update task in Trello', {
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

      // Get card to find board
      const card = await this.makeApiRequest<TrelloCard>(
        accessToken,
        `/cards/${externalTaskId}`
      )

      // Get or create "Done" list
      const doneListId = await this.getOrCreateList(accessToken, card.idBoard, 'Done')

      // Move card to "Done" list
      await this.makeApiRequest<TrelloCard>(
        accessToken,
        `/cards/${externalTaskId}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            idList: doneListId,
          }),
        }
      )

      return {
        success: true,
      }
    } catch (error) {
      logger.error('Failed to complete task in Trello', {
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
   * Reopen a completed task (move back from Done list)
   */
  async reopenTask(
    connectionId: string,
    externalTaskId: string,
    originalListId?: string
  ): Promise<CompleteResult> {
    try {
      const accessToken = await this.getAccessToken(connectionId)

      // Get card to find board
      const card = await this.makeApiRequest<TrelloCard>(
        accessToken,
        `/cards/${externalTaskId}`
      )

      // If we have original list ID, use it; otherwise use first list on board
      let targetListId = originalListId
      if (!targetListId) {
        const lists = await this.makeApiRequest<TrelloList[]>(
          accessToken,
          `/boards/${card.idBoard}/lists?filter=open`
        )
        // Find first non-Done list, or use first list
        const firstList = lists.find(list => 
          list.name.toLowerCase() !== 'done' && !list.closed
        ) || lists[0]
        
        if (firstList) {
          targetListId = firstList.id
        } else {
          // No lists found, create "To Do" list
          targetListId = await this.getOrCreateList(accessToken, card.idBoard, 'To Do')
        }
      }

      // Move card back to original list
      await this.makeApiRequest<TrelloCard>(
        accessToken,
        `/cards/${externalTaskId}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            idList: targetListId,
          }),
        }
      )

      return {
        success: true,
      }
    } catch (error) {
      logger.error('Failed to reopen task in Trello', {
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

