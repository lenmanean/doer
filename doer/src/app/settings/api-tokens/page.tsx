'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { KeyRound, Loader2, RefreshCw, ShieldBan, ShieldCheck, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'

interface ApiTokenSummary {
  id: string
  name: string
  description: string | null
  scopes: string[]
  created_at: string
  last_used_at: string | null
  expires_at: string | null
  metadata?: Record<string, unknown> | null
}

interface TokenListResponse {
  tokens: ApiTokenSummary[]
  metadata: {
    availableScopes: string[]
    defaultScopes: string[]
  }
}

const formatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

type ScopeState = Record<string, boolean>

export default function ApiTokenSettingsPage() {
  const { addToast } = useToast()

  const [tokens, setTokens] = useState<ApiTokenSummary[]>([])
  const [availableScopes, setAvailableScopes] = useState<string[]>([])
  const [defaultScopes, setDefaultScopes] = useState<string[]>([])
  const [scopesState, setScopesState] = useState<ScopeState>({})
  const [scopesInitialized, setScopesInitialized] = useState(false)

  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [newTokenValue, setNewTokenValue] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [expiresAt, setExpiresAt] = useState('')

  const initialiseScopes = useCallback(
    (scopes: string[], defaults: string[]) => {
      if (scopesInitialized) return
      const nextState: ScopeState = {}
      scopes.forEach((scope) => {
        nextState[scope] = defaults.includes(scope)
      })
      setScopesState(nextState)
      setScopesInitialized(true)
    },
    [scopesInitialized]
  )

  const fetchTokens = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/settings/api-tokens', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load API tokens')
      }

      const payload: TokenListResponse = await response.json()
      setTokens(payload.tokens)
      setAvailableScopes(payload.metadata.availableScopes)
      setDefaultScopes(payload.metadata.defaultScopes)
      initialiseScopes(payload.metadata.availableScopes, payload.metadata.defaultScopes)
    } catch (error) {
      console.error('[API Tokens] Failed to fetch tokens:', error)
      addToast({
        type: 'error',
        title: 'Unable to load tokens',
        description: 'We could not fetch your API tokens. Please refresh and try again.',
      })
    } finally {
      setLoading(false)
    }
  }, [addToast, initialiseScopes])

  useEffect(() => {
    void fetchTokens()
  }, [fetchTokens])

  const selectedScopes = useMemo(() => {
    return Object.entries(scopesState)
      .filter(([, selected]) => selected)
      .map(([scope]) => scope)
  }, [scopesState])

  const handleScopeToggle = (scope: string) => {
    setScopesState((prev) => ({
      ...prev,
      [scope]: !prev[scope],
    }))
  }

  const resetForm = () => {
    setName('')
    setDescription('')
    setExpiresAt('')
    const nextState: ScopeState = {}
    availableScopes.forEach((scope) => {
      nextState[scope] = defaultScopes.includes(scope)
    })
    setScopesState(nextState)
  }

  const handleGenerateToken = async () => {
    if (!name.trim()) {
      addToast({
        type: 'warning',
        title: 'Token name required',
        description: 'Please provide a descriptive name for this token.',
      })
      return
    }

    setGenerating(true)
    try {
      const response = await fetch('/api/settings/api-tokens', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          scopes: selectedScopes,
          expiresAt: expiresAt || undefined,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to create API token')
      }

      const payload = await response.json()
      setNewTokenValue(payload.token)
      addToast({
        type: 'success',
        title: 'Token created',
        description: 'Copy the token now — it will not be shown again.',
      })

      resetForm()
      await fetchTokens()
    } catch (error) {
      console.error('[API Tokens] Creation failed:', error)
      addToast({
        type: 'error',
        title: 'Token creation failed',
        description:
          error instanceof Error ? error.message : 'We could not create the API token. Please retry.',
      })
    } finally {
      setGenerating(false)
    }
  }

  const handleRevokeToken = async (tokenId: string) => {
    if (!window.confirm('Revoke this token? This action cannot be undone.')) return

    try {
      const response = await fetch(`/api/settings/api-tokens/${tokenId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to revoke API token')
      }

      addToast({
        type: 'success',
        title: 'Token revoked',
      })
      await fetchTokens()
    } catch (error) {
      console.error('[API Tokens] Revocation failed:', error)
      addToast({
        type: 'error',
        title: 'Unable to revoke token',
        description:
          error instanceof Error ? error.message : 'We could not revoke the token. Try again later.',
      })
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex items-center gap-3">
          <KeyRound className="h-9 w-9 text-orange-400" />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">API Tokens</h1>
            <p className="text-slate-400">
              Manage personal access tokens for integrating with the DOER API. Tokens inherit your plan limits and
              permissions.
            </p>
          </div>
        </div>

        {newTokenValue && (
          <Card className="border-orange-500/40 bg-orange-500/10">
            <CardHeader>
              <CardTitle className="text-orange-100">New token generated</CardTitle>
              <CardDescription className="text-orange-200/80">
                Copy this token now — it will not be shown again.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input value={newTokenValue} readOnly className="bg-slate-950 border-orange-400/60" />
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      void navigator.clipboard.writeText(newTokenValue)
                      addToast({
                        type: 'success',
                        title: 'Token copied',
                      })
                    }}
                  >
                    Copy
                  </Button>
                  <Button variant="ghost" onClick={() => setNewTokenValue(null)}>
                    Dismiss
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Create a new token</CardTitle>
            <CardDescription>
              Choose a descriptive name and select the scopes the integration requires. Tokens inherit your current plan
              limits.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="token-name">Token name</Label>
                <Input
                  id="token-name"
                  placeholder="e.g. Zapier automation"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={80}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="token-expires">Expires on (optional)</Label>
                <Input
                  id="token-expires"
                  type="date"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="token-description">Description (optional)</Label>
              <Input
                id="token-description"
                placeholder="What is this token used for?"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={160}
              />
            </div>

            <div className="space-y-3">
              <Label>Scopes</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                {availableScopes.map((scope) => {
                  const selected = scopesState[scope]
                  return (
                    <button
                      type="button"
                      key={scope}
                      onClick={() => handleScopeToggle(scope)}
                      className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
                        selected
                          ? 'border-orange-500/80 bg-orange-500/10 text-orange-100'
                          : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                      }`}
                    >
                      <span className="text-sm font-medium">{scope}</span>
                      {selected ? (
                        <ShieldCheck className="h-4 w-4 text-orange-300" />
                      ) : (
                        <ShieldBan className="h-4 w-4 text-slate-500" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={handleGenerateToken} disabled={generating}>
                {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate token
              </Button>
              <Button variant="ghost" onClick={resetForm} disabled={generating}>
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Existing tokens</CardTitle>
              <CardDescription>
                Active tokens inherit your billing plan limits. Revoke tokens immediately if they are no longer needed.
              </CardDescription>
            </div>
            <Button variant="ghost" onClick={() => void fetchTokens()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-sm text-slate-400">Loading tokens…</p>
            ) : tokens.length === 0 ? (
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 text-center text-sm text-slate-400">
                No API tokens yet. Create one to get started.
              </div>
            ) : (
              <div className="space-y-4">
                {tokens.map((token) => (
                  <div
                    key={token.id}
                    className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 sm:p-6"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <h3 className="text-lg font-semibold text-slate-100">{token.name}</h3>
                        {token.description && <p className="text-sm text-slate-400">{token.description}</p>}
                        <div className="flex flex-wrap gap-2 pt-2">
                          {token.scopes.map((scope) => (
                            <Badge key={scope} variant="orange">
                              {scope}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" onClick={() => handleRevokeToken(token.id)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Revoke
                        </Button>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
                      <span>
                        Created {formatter.format(new Date(token.created_at))}
                      </span>
                      <span>
                        {token.last_used_at
                          ? `Last used ${formatter.format(new Date(token.last_used_at))}`
                          : 'Never used'}
                      </span>
                      <span>
                        {token.expires_at
                          ? `Expires ${formatter.format(new Date(token.expires_at))}`
                          : 'No expiration'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
