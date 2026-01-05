'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { Sidebar } from '@/components/ui/Sidebar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { useOnboardingProtection } from '@/lib/useOnboardingProtection'
import { CheckCircle, XCircle, Settings, ArrowRight, Zap, Clock } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { isEmailConfirmed } from '@/lib/email-confirmation'
import { integrations, type IntegrationDefinition } from '@/data/integrations'
import { PlanSelectionOverlay } from '@/components/ui/PlanSelectionOverlay'
import { 
  SiGooglecalendar, 
  SiApple, 
  SiTodoist, 
  SiAsana, 
  SiTrello, 
  SiNotion, 
  SiSlack, 
  SiStrava,
  SiLinear,
  SiClickup,
  SiJira,
  SiDiscord,
  SiObsidian,
  SiEvernote,
  SiGithub,
  SiGooglefit
} from 'react-icons/si'
import { FaMicrosoft } from 'react-icons/fa'
import { MdEmail } from 'react-icons/md'
import type { ComponentType } from 'react'

interface ProviderStatus {
  provider: string
  connected: boolean
  connection: {
    id: string
    selected_calendar_ids?: string[]
    auto_sync_enabled?: boolean
    auto_push_enabled?: boolean
    last_sync_at: string | null
    created_at: string
  } | null
}

interface ProviderInfo {
  key: string
  provider: string // URL-friendly identifier
  name: string
  description: string
  icon: React.ReactNode
  category: string
}

// Mapping integration keys to icon components
const integrationIconMap: Record<string, ComponentType<{ className?: string }>> = {
  googleCalendar: SiGooglecalendar,
  outlook: MdEmail,
  appleCalendar: SiApple,
  todoist: SiTodoist,
  asana: SiAsana,
  trello: SiTrello,
  notion: SiNotion,
  slack: SiSlack,
  microsoftTeams: FaMicrosoft,
  strava: SiStrava,
  linear: SiLinear,
  clickUp: SiClickup,
  // mondayCom: No icon available, will use emoji fallback
  jira: SiJira,
  discord: SiDiscord,
  obsidian: SiObsidian,
  evernote: SiEvernote,
  // oneNote: No icon available, will use emoji fallback
  github: SiGithub,
  appleHealth: SiApple, // Using SiApple as placeholder, emoji will be used via fallback
  googleFit: SiGooglefit,
}

// Convert integration key to URL-friendly identifier
function integrationKeyToUrl(key: string): string {
  // Map calendar integrations to existing URLs
  if (key === 'googleCalendar') return 'google'
  if (key === 'appleCalendar') return 'apple'
  if (key === 'outlook') return 'outlook'
  
  // Convert camelCase to kebab-case for other integrations
  return key.replace(/([A-Z])/g, '-$1').toLowerCase()
}

// Mapping integration keys to image file names
const integrationImageMap: Record<string, string> = {
  googleCalendar: 'google-calendar.png',
  outlook: 'outlook-calendar.png',
  appleCalendar: 'apple-calendar.png',
  todoist: 'todoist.png',
  asana: 'asana.png',
  trello: 'trello.png',
  slack: 'slack.png',
  microsoftTeams: 'microsoft-teams.png',
  strava: 'strava.png',
}

// Create provider info from integrations data
function createProviderInfo(integration: IntegrationDefinition): ProviderInfo {
  // Check if we have an image for this integration
  const imageFile = integrationImageMap[integration.key]
  
  if (imageFile) {
    // Use image icon
    return {
      key: integration.key,
      provider: integrationKeyToUrl(integration.key),
      name: integration.name,
      description: integration.description,
      icon: (
        <Image
          src={`/integrations/${imageFile}`}
          alt={integration.name}
          width={48}
          height={48}
          className="w-12 h-12 object-contain"
        />
      ),
      category: integration.category,
    }
  }

  // Fallback to react-icons or emoji if no image available
  const IconComponent = integrationIconMap[integration.key]
  const iconElement = IconComponent ? (
    <div className="w-12 h-12 flex items-center justify-center text-[var(--foreground)]">
      <IconComponent className="w-full h-full" />
    </div>
  ) : (
    <div className="w-12 h-12 flex items-center justify-center text-3xl">
      {integration.icon}
    </div>
  )

  return {
    key: integration.key,
    provider: integrationKeyToUrl(integration.key),
    name: integration.name,
    description: integration.description,
    icon: iconElement,
    category: integration.category,
  }
}

const PROVIDER_INFO: ProviderInfo[] = integrations.map(createProviderInfo)

// Define which integrations are implemented (have backend API routes)
const IMPLEMENTED_INTEGRATION_KEYS = ['googleCalendar', 'outlook', 'appleCalendar', 'todoist', 'asana', 'trello', 'slack', 'notion', 'strava']

// Separate implemented and unimplemented providers
const IMPLEMENTED_PROVIDERS = PROVIDER_INFO.filter(p => IMPLEMENTED_INTEGRATION_KEYS.includes(p.key))
const UNIMPLEMENTED_PROVIDERS = PROVIDER_INFO.filter(p => !IMPLEMENTED_INTEGRATION_KEYS.includes(p.key))

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
  const [showPlanOverlay, setShowPlanOverlay] = useState(false)
  const [subscription, setSubscription] = useState<any>(null)
  const [loadingSubscription, setLoadingSubscription] = useState(true)
  const [showUnimplemented, setShowUnimplemented] = useState(false)

  useEffect(() => {
    if (!user) {
      setEmailConfirmed(true)
      return
    }
    setEmailConfirmed(isEmailConfirmed(user))
  }, [user?.id])

  // Load subscription status
  useEffect(() => {
    if (!user?.id) {
      setLoadingSubscription(false)
      return
    }

    const loadSubscription = async () => {
      try {
        setLoadingSubscription(true)
        const response = await fetch('/api/subscription')

        if (response.ok) {
          const data = await response.json()
          setSubscription(data.subscription)
        }
      } catch (error) {
        console.error('Error loading subscription:', error)
      } finally {
        setLoadingSubscription(false)
      }
    }

    loadSubscription()
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

  const handleProviderClick = async (provider: string) => {
    // Check if user has Pro plan (active or trialing)
    const hasPro = subscription?.planSlug === 'pro' && 
                   (subscription?.status === 'active' || subscription?.status === 'trialing')
    
    if (!hasPro) {
      // Show upgrade overlay
      setShowPlanOverlay(true)
      return
    }
    
    // Proceed to integration
    router.push(`/integrations/${provider}`)
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center overflow-x-hidden">
        <div className="text-[var(--foreground)]">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--background)] overflow-x-hidden">
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
            <h1 className="text-3xl sm:text-4xl font-bold text-[var(--foreground)] mb-2">
              Integrations
            </h1>
            <p className="text-[#d7d2cb]/60">
              Connect and manage your integrations
            </p>
          </div>

          {/* Provider Cards */}
          {loadingProviders ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
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
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {IMPLEMENTED_PROVIDERS.map((providerInfo) => {
                const status = providers.find(p => p.provider === providerInfo.provider)
                const isConnected = status?.connected || false

                return (
                  <Card
                    key={providerInfo.key}
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
                      {isConnected && status?.connection && status.connection.selected_calendar_ids && (
                        <div className="text-xs text-[#d7d2cb]/60 space-y-1">
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

              {/* See More Button - Above unimplemented section (shown when collapsed) */}
              <AnimatePresence>
                {UNIMPLEMENTED_PROVIDERS.length > 0 && !showUnimplemented && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    className="flex items-center justify-center py-6"
                  >
                    <button
                      onClick={() => setShowUnimplemented(true)}
                      className="flex items-center gap-4 text-[var(--foreground)] hover:text-[var(--primary)] transition-colors cursor-pointer group"
                      aria-label="See more integrations"
                    >
                      <span className="flex-1 border-t border-[var(--border)] group-hover:border-[var(--primary)] transition-colors"></span>
                      <span className="text-sm font-medium whitespace-nowrap">
                        See more
                      </span>
                      <span className="flex-1 border-t border-[var(--border)] group-hover:border-[var(--primary)] transition-colors"></span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Unimplemented Integrations Section */}
              <AnimatePresence>
                {showUnimplemented && UNIMPLEMENTED_PROVIDERS.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {UNIMPLEMENTED_PROVIDERS.map((providerInfo, index) => (
                        <motion.div
                          key={providerInfo.key}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.6,
                            delay: index * 0.1,
                            ease: [0.4, 0, 0.2, 1]
                          }}
                        >
                          <Card className="border-gray-700/50 opacity-90">
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
                                <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/20">
                                  <Clock className="w-3 h-3 mr-1" />
                                  Coming Soon
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <CardDescription className="text-[#d7d2cb]/70">
                                {providerInfo.description}
                              </CardDescription>
                              <Button
                                variant="outline"
                                className="w-full flex items-center justify-center gap-2"
                                disabled
                              >
                                <Clock className="w-4 h-4" />
                                Coming Soon
                              </Button>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* See Less Button - Below unimplemented section (shown when expanded) */}
              <AnimatePresence>
                {UNIMPLEMENTED_PROVIDERS.length > 0 && showUnimplemented && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    className="flex items-center justify-center py-6"
                  >
                    <button
                      onClick={() => setShowUnimplemented(false)}
                      className="flex items-center gap-4 text-[var(--foreground)] hover:text-[var(--primary)] transition-colors cursor-pointer group"
                      aria-label="See less integrations"
                    >
                      <span className="flex-1 border-t border-[var(--border)] group-hover:border-[var(--primary)] transition-colors"></span>
                      <span className="text-sm font-medium whitespace-nowrap">
                        See less
                      </span>
                      <span className="flex-1 border-t border-[var(--border)] group-hover:border-[var(--primary)] transition-colors"></span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </main>

      {/* Plan Selection Overlay for non-Pro users */}
      <PlanSelectionOverlay
        isOpen={showPlanOverlay}
        onClose={() => setShowPlanOverlay(false)}
        userEmail={user?.email || null}
      />
    </div>
  )
}
