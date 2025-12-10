'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Sidebar } from '@/components/ui/Sidebar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { useOnboardingProtection } from '@/lib/useOnboardingProtection'
import { CheckCircle, XCircle, Settings, ArrowRight, Zap } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { isEmailConfirmed } from '@/lib/email-confirmation'

interface ProviderStatus {
  provider: 'google' | 'outlook' | 'apple'
  connected: boolean
  connection: {
    id: string
    selected_calendar_ids: string[]
    auto_sync_enabled: boolean
    auto_push_enabled: boolean
    last_sync_at: string | null
    created_at: string
  } | null
}

interface ProviderInfo {
  provider: 'google' | 'outlook' | 'apple'
  name: string
  description: string
  icon: React.ReactNode
  color: string
}

const PROVIDER_INFO: ProviderInfo[] = [
  {
    provider: 'google',
    name: 'Google Calendar',
    description: 'Sync your Google Calendar events with DOER plans and automatically detect busy slots.',
    icon: (
      <Image
        src="/integrations/google-calendar.png"
        alt="Google Calendar"
        width={48}
        height={48}
        className="w-12 h-12 object-contain"
      />
    ),
    color: 'text-blue-500',
  },
  {
    provider: 'outlook',
    name: 'Microsoft Outlook',
    description: 'Sync your Outlook calendar events with DOER plans and automatically detect busy slots.',
    icon: (
      <Image
        src="/integrations/outlook-calendar.png"
        alt="Microsoft Outlook"
        width={48}
        height={48}
        className="w-12 h-12 object-contain"
      />
    ),
    color: 'text-blue-600',
  },
  {
    provider: 'apple',
    name: 'Apple Calendar',
    description: 'Sync your iCloud Calendar events with DOER plans and automatically detect busy slots.',
    icon: (
      <Image
        src="/integrations/apple-calendar.png"
        alt="Apple Calendar"
        width={48}
        height={48}
        className="w-12 h-12 object-contain"
      />
    ),
    color: 'text-gray-600',
  },
]

/**
 * Integrations Hub Page
 * Shows all available calendar providers and their connection status
 */
export default function IntegrationsPage() {
  const router = useRouter()
  const { addToast } = useToast()
  const { user, profile, loading, handleSignOut } = useOnboardingProtection()
  const [emailConfirmed, setEmailConfirmed] = useState(true)
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const [loadingProviders, setLoadingProviders] = useState(true)

  useEffect(() => {
    if (!user) {
      setEmailConfirmed(true)
      return
    }
    setEmailConfirmed(isEmailConfirmed(user))
  }, [user?.id])

  // Load provider statuses
  useEffect(() => {
    if (!user?.id) return

    const loadProviders = async () => {
      try {
        setLoadingProviders(true)
        const response = await fetch('/api/integrations/status')

        if (!response.ok) {
          throw new Error('Failed to load provider statuses')
        }

        const data = await response.json()
        setProviders(data.providers || [])
      } catch (error) {
        console.error('Error loading providers:', error)
        addToast({
          type: 'error',
          title: 'Failed to load integrations',
          description: 'Please try again later.',
          duration: 5000,
        })
      } finally {
        setLoadingProviders(false)
      }
    }

    loadProviders()
  }, [user?.id, addToast])

  const handleProviderClick = (provider: string) => {
    router.push(`/integrations/${provider}`)
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center overflow-x-hidden">
        <div className="text-gray-900 dark:text-gray-100">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 overflow-x-hidden">
      <Sidebar
        user={profile || { email: user?.email || '' }}
        onSignOut={handleSignOut}
        currentPath="/integrations"
        emailConfirmed={emailConfirmed}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Integrations
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Connect and manage your calendar integrations
            </p>
          </div>

          {/* Provider Cards */}
          {loadingProviders ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-32 bg-gray-200 dark:bg-gray-700" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-20 w-full bg-gray-200 dark:bg-gray-700" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {PROVIDER_INFO.map((providerInfo) => {
                const status = providers.find(p => p.provider === providerInfo.provider)
                const isConnected = status?.connected || false

                return (
                  <Card
                    key={providerInfo.provider}
                    className="cursor-pointer hover:border-[var(--primary)] transition-colors"
                    onClick={() => handleProviderClick(providerInfo.provider)}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0">
                            {providerInfo.icon}
                          </div>
                          <div>
                            <CardTitle>{providerInfo.name}</CardTitle>
                          </div>
                        </div>
                        {isConnected && (
                          <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Connected
                          </Badge>
                        )}
                        {!isConnected && (
                          <Badge variant="outline" className="bg-gray-500/10 text-gray-400 border-gray-500/20">
                            <XCircle className="w-3 h-3 mr-1" />
                            Not Connected
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <CardDescription>
                        {providerInfo.description}
                      </CardDescription>
                      {isConnected && status?.connection && (
                        <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                          <p>
                            Last sync: {status.connection.last_sync_at
                              ? new Date(status.connection.last_sync_at).toLocaleString()
                              : 'Never'}
                          </p>
                          <p>
                            Calendars: {status.connection.selected_calendar_ids.length} selected
                          </p>
                        </div>
                      )}
                      <Button
                        variant={isConnected ? 'outline' : 'default'}
                        className="w-full flex items-center justify-center gap-2"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleProviderClick(providerInfo.provider)
                        }}
                      >
                        {isConnected ? (
                          <>
                            <Settings className="w-4 h-4" />
                            Configure
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4" />
                            Connect
                          </>
                        )}
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
