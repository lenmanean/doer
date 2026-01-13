/**
 * Notion Provider Implementation
 * Implements knowledge provider interface for Notion integration
 */

import { createClient } from '@/lib/supabase/server'
import { decryptToken } from '@/lib/calendar/encryption'
import { logger } from '@/lib/logger'

export interface NotionPage {
  id: string
  title: string
  url: string
  last_edited_time: string
}

export interface NotionDatabase {
  id: string
  title: string
  url: string
  last_edited_time: string
}

export interface NotionPageContent {
  pageId: string
  title: string
  content: string // Markdown or plain text
  blocks: any[] // Notion blocks
}

/**
 * Notion Provider
 */
export class NotionProvider {
  private clientId: string
  private clientSecret: string
  private redirectUri: string
  private readonly NOTION_API_VERSION = '2022-06-28'
  private readonly NOTION_API_BASE = 'https://api.notion.com/v1'
  
  // Rate limiting: 3 requests per second per integration
  private rateLimitState: {
    requests: number[]
    windowStart: number
  } = { requests: [], windowStart: Date.now() }

  constructor() {
    this.clientId = process.env.NOTION_CLIENT_ID || ''
    this.clientSecret = process.env.NOTION_CLIENT_SECRET || ''
    
    // Get redirect URI from environment or construct from app URL
    if (process.env.NOTION_REDIRECT_URI) {
      this.redirectUri = process.env.NOTION_REDIRECT_URI.trim()
    } else if (process.env.NEXT_PUBLIC_APP_URL) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL.trim()
      const baseUrl = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl
      this.redirectUri = `${baseUrl}/api/integrations/notion/callback`
    } else {
      const nodeEnv = process.env.NODE_ENV as string | undefined
      const vercelEnv = process.env.VERCEL_ENV as string | undefined
      const isProduction = vercelEnv === 'production' ||
                          nodeEnv === 'production' ||
                          (!nodeEnv && process.env.VERCEL)

      if (isProduction) {
        this.redirectUri = 'https://usedoer.com/api/integrations/notion/callback'
      } else if (process.env.VERCEL_URL && vercelEnv !== 'production') {
        const vercelUrl = process.env.VERCEL_URL.trim()
        const baseUrl = vercelUrl.startsWith('https://')
          ? vercelUrl
          : `https://${vercelUrl}`
        this.redirectUri = `${baseUrl}/api/integrations/notion/callback`
      } else {
        this.redirectUri = 'http://localhost:3000/api/integrations/notion/callback'
      }
    }
  }

  validateConfig(): void {
    if (!this.clientId) {
      throw new Error('NOTION_CLIENT_ID environment variable is not set')
    }
    if (!this.clientSecret) {
      throw new Error('NOTION_CLIENT_SECRET environment variable is not set')
    }
  }

  getRedirectUri(): string {
    return this.redirectUri
  }

  getAuthorizationUrl(state: string): string {
    this.validateConfig()
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      owner: 'user',
      state,
    })
    return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`
  }

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<{
    access_token: string
    token_type: string
    bot_id: string
    workspace_id: string
    workspace_name: string
    workspace_icon: string | null
  }> {
    this.validateConfig()
    
    // Notion OAuth uses HTTP Basic Authentication
    // Format: base64(client_id:client_secret)
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')
    
    const response = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Notion OAuth error: ${error}`)
    }

    return await response.json()
  }

  /**
   * Get standard Notion API headers
   */
  private getApiHeaders(accessToken: string): Record<string, string> {
    return {
      'Authorization': `Bearer ${accessToken}`,
      'Notion-Version': this.NOTION_API_VERSION,
      'Content-Type': 'application/json',
    }
  }

  /**
   * Check and enforce rate limiting (3 requests per second)
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now()
    const windowMs = 1000 // 1 second
    const maxRequests = 3

    // Reset window if more than 1 second has passed
    if (now - this.rateLimitState.windowStart >= windowMs) {
      this.rateLimitState = {
        requests: [],
        windowStart: now,
      }
    }

    // Remove requests older than 1 second
    this.rateLimitState.requests = this.rateLimitState.requests.filter(
      timestamp => now - timestamp < windowMs
    )

    // Check if we're at the limit
    if (this.rateLimitState.requests.length >= maxRequests) {
      const oldestRequest = this.rateLimitState.requests[0]
      const waitTime = windowMs - (now - oldestRequest) + 100 // Add 100ms buffer
      
      logger.warn('Notion rate limit reached, waiting', {
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
   * Make API request with rate limiting and error handling
   */
  private async apiRequest<T>(
    accessToken: string,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    await this.checkRateLimit()

    const url = `${this.NOTION_API_BASE}${endpoint}`
    const headers = {
      ...this.getApiHeaders(accessToken),
      ...options.headers,
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      let errorMessage = response.statusText
      try {
        const errorData = await response.json()
        errorMessage = errorData.message || errorData.error || response.statusText
      } catch {
        // If JSON parsing fails, try to get text
        try {
          const errorText = await response.text()
          errorMessage = errorText || response.statusText
        } catch {
          // If text parsing also fails, use status text
          errorMessage = response.statusText
        }
      }
      
      // Handle specific error codes
      if (response.status === 401) {
        throw new Error('Notion authentication failed: Token may be invalid or revoked')
      } else if (response.status === 404) {
        throw new Error('Notion resource not found')
      } else if (response.status === 429) {
        // Rate limit exceeded - wait and retry once
        logger.warn('Notion rate limit exceeded, retrying after delay')
        await new Promise(resolve => setTimeout(resolve, 1000))
        return this.apiRequest<T>(accessToken, endpoint, options)
      }
      
      throw new Error(`Notion API error: ${errorMessage}`)
    }

    return await response.json()
  }

  async getAccessToken(connectionId: string): Promise<string> {
    // Fetch connection from database and decrypt token
    const supabase = await createClient()
    const { data: connection, error } = await supabase
      .from('notion_connections')
      .select('access_token_encrypted')
      .eq('id', connectionId)
      .single()

    if (error || !connection) {
      throw new Error('Notion connection not found')
    }

    return decryptToken(connection.access_token_encrypted)
  }

  async searchPages(accessToken: string, query?: string): Promise<NotionPage[]> {
    const response = await this.apiRequest<{
      results: Array<{
        id: string
        properties: any
        url: string
        last_edited_time: string
      }>
    }>(accessToken, '/search', {
      method: 'POST',
      body: JSON.stringify({
        filter: { property: 'object', value: 'page' },
        query: query || '',
      }),
    })

    return response.results.map(page => ({
      id: page.id,
      title: this.extractPageTitle(page.properties),
      url: page.url,
      last_edited_time: page.last_edited_time,
    }))
  }

  async searchDatabases(accessToken: string, query?: string): Promise<NotionDatabase[]> {
    const response = await this.apiRequest<{
      results: Array<{
        id: string
        title: Array<{ plain_text: string }>
        url: string
        last_edited_time: string
      }>
    }>(accessToken, '/search', {
      method: 'POST',
      body: JSON.stringify({
        filter: { property: 'object', value: 'database' },
        query: query || '',
      }),
    })

    return response.results.map(db => ({
      id: db.id,
      title: db.title.map(t => t.plain_text).join('') || 'Untitled',
      url: db.url,
      last_edited_time: db.last_edited_time,
    }))
  }

  /**
   * Extract page title from Notion page properties
   */
  private extractPageTitle(properties: any): string {
    // Notion pages have title in properties.title
    if (properties.title?.title) {
      return properties.title.title.map((t: any) => t.plain_text).join('')
    }
    return 'Untitled'
  }

  /**
   * Convert Notion blocks to plain text/markdown
   * Handles common block types: paragraph, heading, list, code, etc.
   */
  private blocksToText(blocks: any[]): string {
    const lines: string[] = []
    
    for (const block of blocks) {
      const text = this.blockToText(block)
      if (text) lines.push(text)
    }
    
    return lines.join('\n')
  }

  /**
   * Convert a single Notion block to text
   */
  private blockToText(block: any): string {
    const type = block.type
    const content = block[type]
    
    if (!content) return ''
    
    // Extract text from rich_text arrays
    const extractText = (richText: any[]): string => {
      return richText.map((rt: any) => rt.plain_text).join('')
    }
    
    switch (type) {
      case 'paragraph':
        return extractText(content.rich_text || [])
      case 'heading_1':
        return `# ${extractText(content.rich_text || [])}`
      case 'heading_2':
        return `## ${extractText(content.rich_text || [])}`
      case 'heading_3':
        return `### ${extractText(content.rich_text || [])}`
      case 'bulleted_list_item':
        return `- ${extractText(content.rich_text || [])}`
      case 'numbered_list_item':
        return `1. ${extractText(content.rich_text || [])}`
      case 'to_do':
        return `${content.checked ? '[x]' : '[ ]'} ${extractText(content.rich_text || [])}`
      case 'code':
        return `\`\`\`${content.language || ''}\n${extractText(content.rich_text || [])}\n\`\`\``
      case 'quote':
        return `> ${extractText(content.rich_text || [])}`
      default:
        // For other block types, try to extract text
        return extractText(content.rich_text || [])
    }
  }

  async getPageContent(accessToken: string, pageId: string): Promise<NotionPageContent> {
    // Get page metadata
    const page = await this.apiRequest<any>(accessToken, `/pages/${pageId}`)
    
    // Get page blocks (recursively for nested blocks)
    const blocks = await this.getPageBlocks(accessToken, pageId)
    
    // Convert blocks to text
    const content = this.blocksToText(blocks)
    const title = this.extractPageTitle(page.properties)
    
    return {
      pageId,
      title,
      content,
      blocks,
    }
  }

  /**
   * Recursively fetch all blocks for a page
   */
  private async getPageBlocks(accessToken: string, blockId: string): Promise<any[]> {
    const allBlocks: any[] = []
    let cursor: string | undefined = undefined
    
    do {
      const endpoint: string = `/blocks/${blockId}/children${cursor ? `?start_cursor=${cursor}` : ''}`
      const response = await this.apiRequest<{
        results: any[]
        next_cursor: string | null
        has_more: boolean
      }>(accessToken, endpoint)
      
      allBlocks.push(...response.results)
      cursor = response.next_cursor || undefined
      
      // For each block with children, recursively fetch them
      for (const block of response.results) {
        if (block.has_children) {
          const childBlocks = await this.getPageBlocks(accessToken, block.id)
          allBlocks.push(...childBlocks)
        }
      }
    } while (cursor)
    
    return allBlocks
  }

  async getDatabaseContent(accessToken: string, databaseId: string): Promise<any> {
    // Database queries use POST with filter/sort in body
    const response = await this.apiRequest<{
      results: any[]
      has_more: boolean
      next_cursor: string | null
    }>(accessToken, `/databases/${databaseId}/query`, {
      method: 'POST',
      body: JSON.stringify({
        // Empty query returns all entries (with pagination)
        // Add filters/sorts as needed
      }),
    })

    return response.results
  }

  async createPage(accessToken: string, parentPageId: string, title: string, content: any): Promise<string> {
    const response = await this.apiRequest<{ id: string }>(accessToken, '/pages', {
      method: 'POST',
      body: JSON.stringify({
        parent: { page_id: parentPageId },
        properties: {
          title: {
            title: [{ text: { content: title } }],
          },
        },
        children: content.blocks || [],
      }),
    })

    return response.id
  }

  async updatePage(accessToken: string, pageId: string, content: any): Promise<void> {
    await this.apiRequest(accessToken, `/pages/${pageId}`, {
      method: 'PATCH',
      body: JSON.stringify(content),
    })
  }
}

