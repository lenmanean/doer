'use client'

import { useState } from 'react'
import { Play, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { CodeBlock } from './CodeBlock'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'

interface Endpoint {
  method: string
  path: string
  summary: string
  description: string
  example?: {
    request?: string
    response?: string
    curl?: string
  }
}

interface ApiExplorerProps {
  endpoint: Endpoint
  baseUrl?: string
}

export function ApiExplorer({ endpoint, baseUrl = 'https://usedoer.com/api' }: ApiExplorerProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [response, setResponse] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [apiToken, setApiToken] = useState('')
  const [requestBody, setRequestBody] = useState(endpoint.example?.request || '')
  const [copied, setCopied] = useState<string | null>(null)

  const handleCopy = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleTryIt = async () => {
    setIsLoading(true)
    setError('')
    setResponse('')

    try {
      // Replace path parameters with example values
      let url = `${baseUrl}${endpoint.path}`
      const pathParams = url.match(/\{(\w+)\}/g)
      if (pathParams) {
        pathParams.forEach(param => {
          const paramName = param.slice(1, -1)
          // Use example UUIDs or generate placeholders
          url = url.replace(param, `00000000-0000-0000-0000-000000000000`)
        })
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }

      if (apiToken) {
        headers['Authorization'] = `Bearer ${apiToken}`
      }

      const options: RequestInit = {
        method: endpoint.method,
        headers,
      }

      if (endpoint.method !== 'GET' && requestBody) {
        options.body = requestBody
      }

      const res = await fetch(url, options)
      const data = await res.json()

      setResponse(JSON.stringify(data, null, 2))
      
      if (!res.ok) {
        setError(`Error ${res.status}: ${data.message || res.statusText}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const generateCurl = () => {
    let url = `${baseUrl}${endpoint.path}`
    const pathParams = url.match(/\{(\w+)\}/g)
    if (pathParams) {
      pathParams.forEach(param => {
        url = url.replace(param, `00000000-0000-0000-0000-000000000000`)
      })
    }

    let curl = `curl -X ${endpoint.method} "${url}"`
    
    if (apiToken) {
      curl += ` \\\n  -H "Authorization: Bearer ${apiToken}"`
    }

    curl += ` \\\n  -H "Content-Type: application/json"`

    if (endpoint.method !== 'GET' && requestBody) {
      curl += ` \\\n  -d '${requestBody.replace(/'/g, "'\\''")}'`
    }

    return curl
  }

  const methodColors = {
    GET: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    POST: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    PUT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    DELETE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    PATCH: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  }

  return (
    <Card className="my-4">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className={cn(
                'px-2 py-1 rounded text-xs font-semibold',
                methodColors[endpoint.method as keyof typeof methodColors] || 'bg-gray-100 text-gray-800'
              )}>
                {endpoint.method}
              </span>
              <code className="text-sm font-mono text-gray-700 dark:text-gray-300">
                {endpoint.path}
              </code>
            </div>
            <CardTitle className="text-lg">{endpoint.summary}</CardTitle>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {endpoint.description}
            </p>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* API Token Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              API Token (optional)
            </label>
            <Input
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder="Bearer doer.token_id.token_secret"
              className="font-mono text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Get your API token from Settings → API Tokens
            </p>
          </div>

          {/* Request Body */}
          {endpoint.method !== 'GET' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Request Body
                </label>
                <button
                  onClick={() => handleCopy(requestBody, 'request')}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1"
                >
                  {copied === 'request' ? (
                    <>
                      <Check className="w-3 h-3" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" /> Copy
                    </>
                  )}
                </button>
              </div>
              <textarea
                value={requestBody}
                onChange={(e) => setRequestBody(e.target.value)}
                className="w-full h-32 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg font-mono text-sm text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Enter JSON request body..."
              />
            </div>
          )}

          {/* Code Examples */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Code Examples
              </h4>
            </div>
            
            {/* cURL */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">cURL</span>
                <button
                  onClick={() => handleCopy(generateCurl(), 'curl')}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1"
                >
                  {copied === 'curl' ? (
                    <>
                      <Check className="w-3 h-3" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" /> Copy
                    </>
                  )}
                </button>
              </div>
              <CodeBlock
                code={generateCurl()}
                language="bash"
                className="text-sm"
              />
            </div>
          </div>

          {/* Try It Button */}
          <Button
            onClick={handleTryIt}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              'Loading...'
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Try it out
              </>
            )}
          </Button>

          {/* Response */}
          {(response || error) && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {error ? 'Error' : 'Response'}
              </h4>
              <CodeBlock
                code={error || response}
                language="json"
                className={cn(error && 'border-red-500')}
              />
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

