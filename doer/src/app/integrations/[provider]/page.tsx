'use client'

import { useState, useEffect, useCallback, useRef, useTransition } from 'react'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import Image from 'next/image'
import { Sidebar } from '@/components/ui/Sidebar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { useOnboardingProtection } from '@/lib/useOnboardingProtection'
import { CheckCircle, XCircle, RefreshCw, Settings, Trash2, ExternalLink, AlertCircle, ArrowLeft, ChevronDown } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { isEmailConfirmed } from '@/lib/email-confirmation'
import { PushToCalendarPanel } from '@/components/integrations/PushToCalendarPanel'
import { SyncWarningModal } from '@/components/integrations/SyncWarningModal'
import { supabase } from '@/lib/supabase/client'
import { integrations, type IntegrationDefinition } from '@/data/integrations'
import { 
  SiGooglecalendar, 
  SiApple, 
  SiTodoist, 
  SiAsana, 
  SiTrello, 
  SiNotion, 
  SiEvernote, 
  SiSlack, 
  SiStrava,
  SiCoursera,
  SiUdemy
} from 'react-icons/si'
import { FaHeartbeat, FaMicrosoft } from 'react-icons/fa'
import { MdEmail } from 'react-icons/md'
import type { ComponentType } from 'react'

// Mapping integration keys to icon components
const integrationIconMap: Record<string, ComponentType<{ className?: string }>> = {
  googleCalendar: SiGooglecalendar,
  outlook: MdEmail,
  appleCalendar: SiApple,
  todoist: SiTodoist,
  asana: SiAsana,
  trello: SiTrello,
  notion: SiNotion,
  evernote: SiEvernote,
  slack: SiSlack,
  microsoftTeams: FaMicrosoft,
  strava: SiStrava,
  appleHealth: FaHeartbeat,
  coursera: SiCoursera,
  udemy: SiUdemy,
}

// Convert URL identifier back to integration key
function urlToIntegrationKey(urlIdentifier: string): string {
  // Map calendar integrations
  if (urlIdentifier === 'google') return 'googleCalendar'
  if (urlIdentifier === 'apple') return 'appleCalendar'
  if (urlIdentifier === 'outlook') return 'outlook'
  
  // Convert kebab-case to camelCase for other integrations
  return urlIdentifier.split('-').map((part, index) => 
    index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
  ).join('')
}

/**
 * Provider-Specific Integrations Page
 * Shows calendar connection status, sync controls, and event summaries for a specific provider
 */
export default function ProviderIntegrationsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const params = useParams()
  const { addToast } = useToast()
  const { user, profile, loading, handleSignOut } = useOnboardingProtection()
  const [emailConfirmed, setEmailConfirmed] = useState(true)
  
  // Track if connection success has been handled to prevent duplicate notifications
  const connectionHandledRef = useRef(false)
  const lastProviderRef = useRef<string | null>(null)
  
  // Get provider from URL params
  const providerParam = params?.provider as string
  const provider = providerParam || 'google'
  
  // Get integration key from URL identifier
  const integrationKey = urlToIntegrationKey(provider)
  const integration = integrations.find(int => int.key === integrationKey)
  
  // Check if this is a calendar integration (has API routes)
  const isCalendarIntegration = ['google', 'outlook', 'apple'].includes(provider)
  
  // Check if this is a task management integration
  const isTaskManagementIntegration = provider === 'todoist' || provider === 'asana'
  
  // Reset connection handled ref when provider changes
  useEffect(() => {
    if (lastProviderRef.current !== provider) {
      connectionHandledRef.current = false
      lastProviderRef.current = provider
    }
  }, [provider])
  
  // Validate provider exists
  useEffect(() => {
    if (providerParam && !integration) {
      addToast({
        type: 'error',
        title: 'Invalid provider',
        description: 'The specified integration is not supported.',
        duration: 5000,
      })
      router.push('/integrations')
    }
  }, [providerParam, integration, router, addToast])
  
  // Calendar connection state
  const [connection, setConnection] = useState<any>(null)
  const [loadingConnection, setLoadingConnection] = useState(true)
  const [calendars, setCalendars] = useState<Array<{ id: string; summary: string; primary?: boolean }>>([])
  const [loadingCalendars, setLoadingCalendars] = useState(false)
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([])
  
  // Task management state
  const [projects, setProjects] = useState<Array<{ id: string; name: string; is_inbox_project?: boolean }>>([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [defaultProjectId, setDefaultProjectId] = useState<string | null>(null)
  const [autoCompletionSyncEnabled, setAutoCompletionSyncEnabled] = useState(false)
  
  // Sync state
  const [syncing, setSyncing] = useState(false)
  const [syncLogs, setSyncLogs] = useState<any[]>([])
  const [loadingSyncLogs, setLoadingSyncLogs] = useState(false)
  
  // Auto-sync toggle
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false)
  const [autoPushEnabled, setAutoPushEnabled] = useState(false)
  const [updatingSettings, setUpdatingSettings] = useState(false)
  
  // Push state
  const [pushing, setPushing] = useState(false)
  const [activePlan, setActivePlan] = useState<any>(null)
  const [showPushPanel, setShowPushPanel] = useState(false)
  const [showSyncWarning, setShowSyncWarning] = useState(false)
  const [estimatedEventCount, setEstimatedEventCount] = useState(0)
  const syncButtonRef = useRef<HTMLButtonElement>(null)
  const [isPending, startTransition] = useTransition()
  
  // Estimate event count for warning
  const estimateEventCount = useCallback(async (): Promise<number> => {
    try {
      // First, check recent sync logs for event count (faster path)
      const response = await fetch(`/api/integrations/${provider}/status`)
      if (response.ok) {
        const data = await response.json()
        // If we have recent sync data, use that as estimate
        if (data.recent_syncs && data.recent_syncs.length > 0) {
          const latestSync = data.recent_syncs[0]
          if (latestSync.events_pulled && latestSync.events_pulled > 0) {
            return latestSync.events_pulled
          }
        }
      }
      
      // Fallback: query calendar events directly
      if (!user?.id || !connection?.id) return 0
      
      const { count, error } = await supabase
        .from('calendar_events')
        .select('*', { count: 'exact', head: true })
        .eq('calendar_connection_id', connection.id)
        .eq('is_doer_created', false)
      
      if (error) {
        console.error('Error estimating event count:', error)
        return 0
      }
      
      return count || 0
    } catch (error) {
      console.error('Error estimating event count:', error)
      return 0
    }
  }, [provider, user?.id, connection?.id])
  
  // Mapping integration keys to image file names
  const integrationImageMap: Record<string, string> = {
    googleCalendar: 'google-calendar.png',
    outlook: 'outlook-calendar.png',
    appleCalendar: 'apple-calendar.png',
    todoist: 'todoist.png',
    asana: 'asana.png',
    trello: 'trello.png',
    evernote: 'evernote.png',
    slack: 'slack.png',
    microsoftTeams: 'microsoft-teams.png',
    strava: 'strava.png',
    appleHealth: 'apple-health.png',
    coursera: 'coursera.png',
    udemy: 'udemy.png',
  }

  // Provider display info - create for all integrations
  const providerInfo: Record<string, { name: string; icon: React.ReactNode }> = {}
  
  integrations.forEach(integ => {
    const urlId = integ.key === 'googleCalendar' ? 'google' 
                : integ.key === 'appleCalendar' ? 'apple'
                : integ.key === 'outlook' ? 'outlook'
                : integ.key.replace(/([A-Z])/g, '-$1').toLowerCase()
    
    // Check if we have an image for this integration
    const imageFile = integrationImageMap[integ.key]
    
    if (imageFile) {
      // Use image icon
      providerInfo[urlId] = {
        name: integ.name,
        icon: (
          <Image
            src={`/integrations/${imageFile}`}
            alt={integ.name}
            width={40}
            height={40}
            className="w-10 h-10 object-contain"
          />
        ),
      }
    } else {
      // Fallback to react-icons or emoji if no image available
      const IconComponent = integrationIconMap[integ.key]
      providerInfo[urlId] = {
        name: integ.name,
        icon: IconComponent ? (
          <div className="w-10 h-10 flex items-center justify-center text-[var(--foreground)]">
            <IconComponent className="w-full h-full" />
          </div>
        ) : (
          <div className="w-10 h-10 flex items-center justify-center text-2xl">
            {integ.icon}
          </div>
        ),
      }
    }
  })
  
  useEffect(() => {
    if (!user) {
      setEmailConfirmed(true)
      return
    }
    setEmailConfirmed(isEmailConfirmed(user))
  }, [user?.id])
  
  // Load active plan
  const loadActivePlan = useCallback(async () => {
    if (!user?.id) return
    
    try {
      const response = await fetch('/api/plans/list')
      if (response.ok) {
        const data = await response.json()
        // Filter out integration plans
        const filteredPlans = Array.isArray(data.plans) 
          ? data.plans.filter((plan: any) => plan.plan_type !== 'integration')
          : []
        const active = filteredPlans.find((plan: any) => plan.status === 'active') || filteredPlans[0] || null
        setActivePlan(active)
      }
    } catch (error) {
      console.error('Error loading active plan:', error)
    }
  }, [user?.id])
  
  // Load available calendars (only for calendar integrations)
  const loadCalendars = useCallback(async () => {
    if (!isCalendarIntegration) {
      setCalendars([])
      return
    }
    
    try {
      setLoadingCalendars(true)
      const response = await fetch(`/api/integrations/${provider}/calendars`)
      
      if (!response.ok) {
        throw new Error('Failed to load calendars')
      }
      
      const data = await response.json()
      setCalendars(data.calendars || [])
    } catch (error) {
      console.error('Error loading calendars:', error)
      addToast({
        type: 'error',
        title: 'Failed to load calendars',
        description: 'Please try again later.',
        duration: 5000,
      })
    } finally {
      setLoadingCalendars(false)
    }
  }, [provider, isCalendarIntegration, addToast])
  
  // Load available projects (only for task management integrations)
  const loadProjects = useCallback(async () => {
    if (!isTaskManagementIntegration) {
      setProjects([])
      return
    }
    
    try {
      setLoadingProjects(true)
      const response = await fetch(`/api/integrations/${provider}/projects`)
      
      if (!response.ok) {
        throw new Error('Failed to load projects')
      }
      
      const data = await response.json()
      setProjects(data.projects || [])
    } catch (error) {
      console.error('Error loading projects:', error)
      addToast({
        type: 'error',
        title: 'Failed to load projects',
        description: 'Please try again later.',
        duration: 5000,
      })
    } finally {
      setLoadingProjects(false)
    }
  }, [provider, isTaskManagementIntegration, addToast])
  
  // Load connection status function
  const loadConnection = useCallback(async (retryCount = 0) => {
    if (!user?.id) return
    
    // Handle task management integrations
    if (isTaskManagementIntegration) {
      try {
        setLoadingConnection(true)
        const response = await fetch(`/api/integrations/${provider}/status`)
        
        if (!response.ok) {
          throw new Error('Failed to load connection status')
        }
        
        const data = await response.json()
        
        // If not connected and this is a retry after OAuth, wait a bit and retry
        if (!data.connected && retryCount < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000))
          return loadConnection(retryCount + 1)
        }
        
        setConnection(data.connected ? data.connection : null)
        setAutoPushEnabled(data.connection?.auto_push_enabled || false)
        setAutoCompletionSyncEnabled(data.connection?.auto_completion_sync || false)
        setDefaultProjectId(data.connection?.default_project_id || null)
        setSyncLogs(data.recent_syncs || [])
        
        // Load projects if connected
        if (data.connected) {
          loadProjects()
        }
        
        // Load active plan for push functionality
        loadActivePlan()
        
        return data.connected
      } catch (error) {
        console.error('Error loading connection:', error)
        addToast({
          type: 'error',
          title: 'Failed to load connection',
          description: 'Please try again later.',
          duration: 5000,
        })
        return false
      } finally {
        setLoadingConnection(false)
      }
    }
    
    // Handle calendar integrations
    if (isCalendarIntegration) {
      try {
        setLoadingConnection(true)
        const response = await fetch(`/api/integrations/${provider}/status`)
        
        if (!response.ok) {
          throw new Error('Failed to load connection status')
        }
        
        const data = await response.json()
        
        // If not connected and this is a retry after OAuth, wait a bit and retry
        if (!data.connected && retryCount < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000))
          return loadConnection(retryCount + 1)
        }
        
        setConnection(data.connected ? data.connection : null)
        setAutoSyncEnabled(data.connection?.auto_sync_enabled || false)
        setAutoPushEnabled(data.connection?.auto_push_enabled || false)
        setSelectedCalendarIds(data.connection?.selected_calendar_ids || [])
        setSyncLogs(data.recent_syncs || [])
        
        // Load calendars if connected
        if (data.connected) {
          loadCalendars()
        }
        
        // Load active plan for push functionality
        loadActivePlan()
        
        return data.connected
      } catch (error) {
        console.error('Error loading connection:', error)
        addToast({
          type: 'error',
          title: 'Failed to load connection',
          description: 'Please try again later.',
          duration: 5000,
        })
        return false
      } finally {
        setLoadingConnection(false)
      }
    }
    
    // Unknown integration type
    setLoadingConnection(false)
    setConnection(null)
    return false
  }, [user?.id, provider, isCalendarIntegration, isTaskManagementIntegration, loadCalendars, loadProjects, loadActivePlan, addToast])
  
  // Handle OAuth callback query parameters
  useEffect(() => {
    if (!user?.id || !provider) return
    
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')
    
    // Handle successful connection
    if (connected === provider && !connectionHandledRef.current) {
      connectionHandledRef.current = true
      
      const handleConnection = async () => {
        // Clean up query parameter immediately to prevent re-triggering
        router.replace(`/integrations/${provider}`)
        
        await new Promise(resolve => setTimeout(resolve, 500))
        
        let isConnected = false
        for (let attempt = 0; attempt < 3; attempt++) {
          isConnected = await loadConnection(attempt)
          if (isConnected) break
          
          if (attempt < 2) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 200))
        
        if (isConnected) {
          const connectionMessage = isCalendarIntegration
            ? 'Please select calendars to sync.'
            : 'Configure your settings below.'
          addToast({
            type: 'success',
            title: 'Successfully connected!',
            description: `${providerInfo[provider]?.name || 'Integration'} has been connected. ${connectionMessage}`,
            duration: 5000,
          })
        } else {
          addToast({
            type: 'warning',
            title: 'Connection may be in progress',
            description: 'The connection is being processed. Please refresh the page if it doesn\'t appear.',
            duration: 7000,
          })
        }
      }
      
      handleConnection()
    }
    
    // Handle errors
    if (error && !connectionHandledRef.current) {
      connectionHandledRef.current = true
      
      let errorMessage = `Failed to connect ${providerInfo[provider]?.name || 'Calendar'}`
      if (error === 'oauth_failed') {
        errorMessage = 'OAuth authorization was cancelled or failed'
      } else if (error === 'connection_failed') {
        errorMessage = 'Failed to save connection. Please try again.'
      } else if (error === 'provider_error') {
        errorMessage = 'Integration provider error. Please contact support.'
      } else if (error === 'config_error') {
        errorMessage = 'Integration configuration error. Please contact support.'
      } else if (error === 'invalid_state') {
        errorMessage = 'Security verification failed. Please try again.'
      } else if (error === 'missing_code') {
        errorMessage = 'Authorization code missing. Please try connecting again.'
      }
      addToast({
        type: 'error',
        title: 'Connection failed',
        description: errorMessage,
        duration: 7000,
      })
      router.replace(`/integrations/${provider}`)
    }
  }, [user?.id, provider, searchParams, router, addToast])
  
  // Load connection status on mount (only if not handling OAuth callback)
  useEffect(() => {
    if (!user?.id || !provider) return
    
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')
    
    // Don't load if we're handling an OAuth callback (to prevent duplicate loading)
    if (!connected && !error && !connectionHandledRef.current) {
      loadConnection()
    }
  }, [user?.id, provider, searchParams])
  
  // Connect Integration
  const handleConnect = async () => {
    // Only calendar and task management integrations are implemented
    if (!isCalendarIntegration && !isTaskManagementIntegration) {
      const integrationName = integration?.name || providerInfo[provider]?.name || 'This integration'
      addToast({
        type: 'info',
        title: `${integrationName} Integration`,
        description: `${integrationName} is currently unavailable, please try again later.`,
        duration: 7000,
      })
      return
    }

    try {
      const response = await fetch(`/api/integrations/${provider}/authorize`)
      
      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = 'Failed to generate authorization URL'
        try {
          const errorData = await response.json()
          if (errorData.error) {
            errorMessage = errorData.error
          }
        } catch {
          // If response isn't JSON, use default message
        }
        throw new Error(errorMessage)
      }
      
      const data = await response.json()
      
      if (!data.auth_url) {
        throw new Error('No authorization URL received')
      }
      
      window.location.href = data.auth_url
    } catch (error) {
      console.error('Error connecting integration:', error)
      const errorMessage = error instanceof Error ? error.message : 'Please try again later.'
      addToast({
        type: 'error',
        title: 'Failed to connect',
        description: errorMessage,
        duration: 7000,
      })
    }
  }
  
  // Disconnect Integration
  const handleDisconnect = async () => {
    if (!confirm(`Are you sure you want to disconnect ${providerInfo[provider]?.name || 'this integration'}? This will remove all sync settings and stop syncing.`)) {
      return
    }
    
    try {
      const response = await fetch(`/api/integrations/${provider}/disconnect`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        throw new Error('Failed to disconnect')
      }
      
      setConnection(null)
      setSyncLogs([])
      
      // Clear calendar-specific state
      if (isCalendarIntegration) {
        setCalendars([])
        setSelectedCalendarIds([])
      }
      
      // Clear task management specific state
      if (isTaskManagementIntegration) {
        setProjects([])
        setDefaultProjectId(null)
        setAutoCompletionSyncEnabled(false)
      }
      
      addToast({
        type: 'success',
        title: 'Disconnected successfully',
        description: `${providerInfo[provider]?.name || 'Integration'} has been disconnected.`,
        duration: 5000,
      })
    } catch (error) {
      console.error('Error disconnecting:', error)
      addToast({
        type: 'error',
        title: 'Failed to disconnect',
        description: 'Please try again later.',
        duration: 5000,
      })
    }
  }
  
  // Manual sync (Pull from Calendar) - Always uses full sync
  const handleSync = async () => {
    // Mark sync as starting immediately for UI feedback
    startTransition(() => {
      setSyncing(true)
      setShowSyncWarning(false)
    })
    
    // Defer API calls to allow UI to update first
    setTimeout(async () => {
      try {
        const response = await fetch(`/api/integrations/${provider}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            calendar_ids: selectedCalendarIds.length > 0 ? selectedCalendarIds : undefined,
            syncType: 'full', // Always use full sync
          }),
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to sync')
        }
        
        const data = await response.json()
        
        addToast({
          type: 'success',
          title: 'Sync completed',
          description: `Pulled ${data.events_pulled} events from ${providerInfo[provider]?.name || 'calendar'}. ${data.tasks_created > 0 ? `${data.tasks_created} task(s) created. ` : ''}${data.tasks_updated > 0 ? `${data.tasks_updated} task(s) updated. ` : ''}${data.conflicts_detected > 0 ? `${data.conflicts_detected} conflicts detected.` : ''}`,
          duration: 7000,
        })
        
        // Reload connection status
        const statusResponse = await fetch(`/api/integrations/${provider}/status`)
        if (statusResponse.ok) {
          const statusData = await statusResponse.json()
          startTransition(() => {
            setSyncLogs(statusData.recent_syncs || [])
            if (statusData.connection) {
              setConnection(statusData.connection)
              setAutoSyncEnabled(statusData.connection.auto_sync_enabled || false)
              setAutoPushEnabled(statusData.connection.auto_push_enabled || false)
            }
          })
        }
      } catch (error) {
        console.error('Error syncing:', error)
        addToast({
          type: 'error',
          title: 'Sync failed',
          description: error instanceof Error ? error.message : 'Please try again later.',
          duration: 5000,
        })
      } finally {
        startTransition(() => {
          setSyncing(false)
        })
      }
    }, 0)
  }

  // Sync with warning if many events
  const handleSyncWithWarning = () => {
    // Defer heavy work to allow browser to paint first
    setTimeout(async () => {
      const WARNING_THRESHOLD = 100
      
      try {
        // Estimate event count
        const eventCount = await estimateEventCount()
        
        // Use transition for non-urgent state updates
        startTransition(() => {
          if (eventCount > WARNING_THRESHOLD) {
            // Show warning modal
            setEstimatedEventCount(eventCount)
            setShowSyncWarning(true)
          } else {
            // Proceed directly with sync
            handleSync()
          }
        })
      } catch (error) {
        console.error('Error estimating event count:', error)
        // If estimation fails, proceed with sync anyway
        startTransition(() => {
          handleSync()
        })
      }
    }, 0)
  }
  
  // Push tasks to Calendar
  const handlePush = async () => {
    if (!activePlan?.id) {
      addToast({
        type: 'error',
        title: 'No active plan',
        description: 'Please create or activate a plan first to push tasks to your calendar.',
        duration: 5000,
      })
      return
    }
    
    // Mark push as starting immediately for UI feedback
    startTransition(() => {
      setPushing(true)
    })
    
    // Defer heavy work to allow browser to paint first
    setTimeout(async () => {
      try {
        const today = new Date()
        const startDate = new Date(today)
        startDate.setDate(startDate.getDate() - 30)
        const endDate = new Date(today)
        endDate.setDate(endDate.getDate() + 90)
        
        const startDateStr = startDate.toISOString().split('T')[0]
        const endDateStr = endDate.toISOString().split('T')[0]
        
        const tasksResponse = await fetch(`/api/tasks/time-schedule?plan_id=${activePlan.id}&start_date=${startDateStr}&end_date=${endDateStr}`)
        if (!tasksResponse.ok) {
          throw new Error('Failed to load tasks')
        }
        
        const tasksData = await tasksResponse.json()
        
        const scheduledTasks: any[] = []
        if (tasksData.tasksByDate) {
          Object.keys(tasksData.tasksByDate).forEach(date => {
            const tasksForDate = tasksData.tasksByDate[date] || []
            scheduledTasks.push(...tasksForDate.filter((t: any) => t.schedule_id && !t.schedule_id.startsWith('synthetic-')))
          })
        }
        
        if (scheduledTasks.length === 0) {
          addToast({
            type: 'warning',
            title: 'No scheduled tasks',
            description: 'There are no scheduled tasks to push to your calendar.',
            duration: 5000,
          })
          startTransition(() => {
            setPushing(false)
          })
          return
        }
        
        const taskScheduleIds = scheduledTasks
          .filter((task: any) => task.schedule_id && !task.schedule_id.startsWith('synthetic-'))
          .map((task: any) => task.schedule_id)
        
        if (taskScheduleIds.length === 0) {
          addToast({
            type: 'warning',
            title: 'No valid schedules',
            description: 'No valid task schedules found to push.',
            duration: 5000,
          })
          startTransition(() => {
            setPushing(false)
          })
          return
        }
        
        const pushResponse = await fetch(`/api/integrations/${provider}/push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            task_schedule_ids: taskScheduleIds,
          }),
        })
        
        if (!pushResponse.ok) {
          const errorData = await pushResponse.json()
          throw new Error(errorData.error || 'Failed to push tasks')
        }
        
        const pushData = await pushResponse.json()
        
        addToast({
          type: 'success',
          title: 'Push completed',
          description: `Pushed ${pushData.events_pushed} task(s) to ${providerInfo[provider]?.name || 'calendar'}.`,
          duration: 7000,
        })
        
        // Reload connection status
        const statusResponse = await fetch(`/api/integrations/${provider}/status`)
        if (statusResponse.ok) {
          const statusData = await statusResponse.json()
          startTransition(() => {
            setSyncLogs(statusData.recent_syncs || [])
            if (statusData.connection) {
              setConnection(statusData.connection)
              setAutoSyncEnabled(statusData.connection.auto_sync_enabled || false)
              setAutoPushEnabled(statusData.connection.auto_push_enabled || false)
            }
          })
        }
      } catch (error) {
        console.error('Error pushing tasks:', error)
        addToast({
          type: 'error',
          title: 'Push failed',
          description: error instanceof Error ? error.message : 'Please try again later.',
          duration: 5000,
        })
      } finally {
        startTransition(() => {
          setPushing(false)
        })
      }
    }, 0)
  }
  
  // Push tasks to Todoist
  const handlePushTasks = async () => {
    if (!activePlan?.id) {
      addToast({
        type: 'error',
        title: 'No active plan',
        description: 'Please create or activate a plan first to push tasks to Todoist.',
        duration: 5000,
      })
      return
    }
    
    // Mark push as starting immediately for UI feedback
    startTransition(() => {
      setPushing(true)
    })
    
    // Defer heavy work to allow browser to paint first
    setTimeout(async () => {
      try {
        const today = new Date()
        const startDate = new Date(today)
        startDate.setDate(startDate.getDate() - 30)
        const endDate = new Date(today)
        endDate.setDate(endDate.getDate() + 90)
        
        const startDateStr = startDate.toISOString().split('T')[0]
        const endDateStr = endDate.toISOString().split('T')[0]
        
        const tasksResponse = await fetch(`/api/tasks/time-schedule?plan_id=${activePlan.id}&start_date=${startDateStr}&end_date=${endDateStr}`)
        if (!tasksResponse.ok) {
          throw new Error('Failed to load tasks')
        }
        
        const tasksData = await tasksResponse.json()
        
        const scheduledTasks: any[] = []
        if (tasksData.tasksByDate) {
          Object.keys(tasksData.tasksByDate).forEach(date => {
            const tasksForDate = tasksData.tasksByDate[date] || []
            scheduledTasks.push(...tasksForDate.filter((t: any) => t.schedule_id && !t.schedule_id.startsWith('synthetic-')))
          })
        }
        
        if (scheduledTasks.length === 0) {
          addToast({
            type: 'warning',
            title: 'No scheduled tasks',
            description: 'There are no scheduled tasks to push to Todoist.',
            duration: 5000,
          })
          startTransition(() => {
            setPushing(false)
          })
          return
        }
        
        const taskScheduleIds = scheduledTasks
          .filter((task: any) => task.schedule_id && !task.schedule_id.startsWith('synthetic-'))
          .map((task: any) => task.schedule_id)
        
        if (taskScheduleIds.length === 0) {
          addToast({
            type: 'warning',
            title: 'No valid schedules',
            description: 'No valid task schedules found to push.',
            duration: 5000,
          })
          startTransition(() => {
            setPushing(false)
          })
          return
        }
        
        const pushResponse = await fetch(`/api/integrations/${provider}/push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            task_schedule_ids: taskScheduleIds,
            project_id: defaultProjectId || undefined,
          }),
        })
        
        if (!pushResponse.ok) {
          const errorData = await pushResponse.json()
          throw new Error(errorData.error || 'Failed to push tasks')
        }
        
        const pushData = await pushResponse.json()
        
        addToast({
          type: 'success',
          title: 'Push completed',
          description: `Pushed ${pushData.tasks_pushed || pushData.tasks_pushed || 0} task(s) to ${providerInfo[provider]?.name || 'Todoist'}.`,
          duration: 7000,
        })
        
        // Reload connection status
        const statusResponse = await fetch(`/api/integrations/${provider}/status`)
        if (statusResponse.ok) {
          const statusData = await statusResponse.json()
          startTransition(() => {
            setSyncLogs(statusData.recent_syncs || [])
            if (statusData.connection) {
              setConnection(statusData.connection)
              setAutoPushEnabled(statusData.connection.auto_push_enabled || false)
              setAutoCompletionSyncEnabled(statusData.connection.auto_completion_sync || false)
              setDefaultProjectId(statusData.connection.default_project_id || null)
            }
          })
        }
      } catch (error) {
        console.error('Error pushing tasks:', error)
        addToast({
          type: 'error',
          title: 'Push failed',
          description: error instanceof Error ? error.message : 'Please try again later.',
          duration: 5000,
        })
      } finally {
        startTransition(() => {
          setPushing(false)
        })
      }
    }, 0)
  }
  
  // Sync plan to Todoist
  const handleSyncPlan = async () => {
    if (!activePlan?.id) {
      addToast({
        type: 'error',
        title: 'No active plan',
        description: 'Please create or activate a plan first to sync to Todoist.',
        duration: 5000,
      })
      return
    }
    
    // Mark sync as starting immediately for UI feedback
    startTransition(() => {
      setSyncing(true)
    })
    
    // Defer API calls to allow UI to update first
    setTimeout(async () => {
      try {
        const response = await fetch(`/api/integrations/${provider}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan_id: activePlan.id,
            project_id: defaultProjectId || undefined,
          }),
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to sync')
        }
        
        const data = await response.json()
        
        addToast({
          type: 'success',
          title: 'Sync completed',
          description: `Synced ${data.tasks_pushed || 0} task(s) to ${providerInfo[provider]?.name || 'Todoist'}.`,
          duration: 7000,
        })
        
        // Reload connection status
        const statusResponse = await fetch(`/api/integrations/${provider}/status`)
        if (statusResponse.ok) {
          const statusData = await statusResponse.json()
          startTransition(() => {
            setSyncLogs(statusData.recent_syncs || [])
            if (statusData.connection) {
              setConnection(statusData.connection)
              setAutoPushEnabled(statusData.connection.auto_push_enabled || false)
              setAutoCompletionSyncEnabled(statusData.connection.auto_completion_sync || false)
              setDefaultProjectId(statusData.connection.default_project_id || null)
            }
          })
        }
      } catch (error) {
        console.error('Error syncing plan:', error)
        addToast({
          type: 'error',
          title: 'Sync failed',
          description: error instanceof Error ? error.message : 'Please try again later.',
          duration: 5000,
        })
      } finally {
        startTransition(() => {
          setSyncing(false)
        })
      }
    }, 0)
  }
  
  // Toggle calendar selection
  const toggleCalendarSelection = (calendarId: string) => {
    setSelectedCalendarIds(prev => {
      const newSelection = prev.includes(calendarId)
        ? prev.filter(id => id !== calendarId)
        : [...prev, calendarId]
      
      saveCalendarSettings(newSelection, autoSyncEnabled, autoPushEnabled)
      
      return newSelection
    })
  }
  
  // Toggle auto-sync (pull)
  const handleToggleAutoSync = async () => {
    const newValue = !autoSyncEnabled
    setAutoSyncEnabled(newValue)
    saveCalendarSettings(selectedCalendarIds, newValue, autoPushEnabled)
  }
  
  // Toggle auto-push
  const handleToggleAutoPush = async () => {
    const newValue = !autoPushEnabled
    setAutoPushEnabled(newValue)
    saveCalendarSettings(selectedCalendarIds, autoSyncEnabled, newValue)
  }
  
  // Save calendar settings
  const saveCalendarSettings = async (calendarIds: string[], autoSync: boolean, autoPush: boolean) => {
    try {
      setUpdatingSettings(true)
      const response = await fetch(`/api/integrations/${provider}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selected_calendar_ids: calendarIds,
          auto_sync_enabled: autoSync,
          auto_push_enabled: autoPush,
        }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to update settings')
      }
    } catch (error) {
      console.error('Error updating settings:', error)
      setAutoSyncEnabled(!autoSync)
      setAutoPushEnabled(!autoPush)
      setSelectedCalendarIds(selectedCalendarIds)
    } finally {
      setUpdatingSettings(false)
    }
  }
  
  // Save task management settings
  const saveTaskManagementSettings = async (projectId: string | null, autoPush: boolean, autoCompletionSync: boolean) => {
    try {
      setUpdatingSettings(true)
      // Note: API currently uses POST, but should be updated to PATCH for consistency
      const response = await fetch(`/api/integrations/${provider}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          default_project_id: projectId,
          auto_push_enabled: autoPush,
          auto_completion_sync: autoCompletionSync,
        }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to update settings')
      }
    } catch (error) {
      console.error('Error updating settings:', error)
      // Revert state on error
      setDefaultProjectId(defaultProjectId)
      setAutoPushEnabled(!autoPush)
      setAutoCompletionSyncEnabled(!autoCompletionSync)
    } finally {
      setUpdatingSettings(false)
    }
  }
  
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-[var(--foreground)]">Loading...</div>
      </div>
    )
  }
  
  const currentProviderInfo = providerInfo[provider]
  
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Sidebar
        user={profile || { email: user?.email || '' }}
        onSignOut={handleSignOut}
        currentPath={`/integrations/${provider}`}
        emailConfirmed={emailConfirmed}
      />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Header with back button */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/integrations')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Integrations
            </Button>
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-[var(--foreground)] mb-2">
                {currentProviderInfo?.name || 'Integration'}
              </h1>
              <p className="text-[var(--foreground)]/70">
                Connect and manage your {currentProviderInfo?.name || 'integration'}
              </p>
            </div>
          </div>
          
          {/* Calendar Connection Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {currentProviderInfo?.icon}
                  <div>
                    <CardTitle>{currentProviderInfo?.name}</CardTitle>
                    <CardDescription>
                      {integration?.description || 'Connect and manage your integration'}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {connection && (
                    <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Connected
                    </Badge>
                  )}
                  {connection && isCalendarIntegration && (
                    <div className="flex gap-2">
                      <Button
                        ref={syncButtonRef}
                        onClick={handleSyncWithWarning}
                        disabled={syncing || selectedCalendarIds.length === 0}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Syncing...' : 'Sync'}
                      </Button>
                      <Button
                        onClick={() => setShowPushPanel(true)}
                        disabled={selectedCalendarIds.length === 0}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Push
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                  {connection && isTaskManagementIntegration && (
                    <div className="flex gap-2">
                      <Button
                        onClick={handleSyncPlan}
                        disabled={syncing || !activePlan?.id}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Syncing...' : 'Sync Plan'}
                      </Button>
                      <Button
                        onClick={handlePushTasks}
                        disabled={pushing || !activePlan?.id}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        {pushing ? 'Pushing...' : 'Push Tasks'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {loadingConnection ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full bg-white/5" />
                  <Skeleton className="h-20 w-full bg-white/5" />
                </div>
              ) : !connection ? (
                <div className="space-y-4">
                  <p className="text-sm text-[var(--foreground)]/70">
                    {isCalendarIntegration 
                      ? `Connect your ${currentProviderInfo?.name} to automatically detect busy slots and sync your DOER tasks.`
                      : `Connect your ${currentProviderInfo?.name} to integrate with DOER plans.`}
                  </p>
                  <Button onClick={handleConnect} className="flex items-center gap-2">
                    Connect {currentProviderInfo?.name}
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Connection Info */}
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                    <div>
                      <p className="text-sm font-medium text-[var(--foreground)]">
                        Connected Account
                      </p>
                      <p className="text-xs text-[var(--foreground)]/60">
                        Last sync: {connection.last_sync_at 
                          ? new Date(connection.last_sync_at).toLocaleString()
                          : 'Never'}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDisconnect}
                      className="flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Disconnect
                    </Button>
                  </div>
                  
                  {/* Calendar Selection */}
                  {isCalendarIntegration && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-[var(--foreground)]">
                          Select Calendars to Sync
                        </h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={loadCalendars}
                          disabled={loadingCalendars}
                        >
                          <RefreshCw className={`w-4 h-4 mr-2 ${loadingCalendars ? 'animate-spin' : ''}`} />
                          Refresh
                        </Button>
                      </div>
                      
                      {loadingCalendars ? (
                        <div className="space-y-2">
                          <Skeleton className="h-12 w-full bg-white/5" />
                          <Skeleton className="h-12 w-full bg-white/5" />
                        </div>
                      ) : calendars.length === 0 ? (
                        <p className="text-sm text-[var(--foreground)]/60">
                          No calendars found. Please check your connection.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {calendars.map((calendar) => (
                            <label
                              key={calendar.id}
                              className="flex items-center gap-3 p-3 rounded-lg border border-white/10 hover:bg-white/5 cursor-pointer transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={selectedCalendarIds.includes(calendar.id)}
                                onChange={() => toggleCalendarSelection(calendar.id)}
                                className="w-4 h-4 rounded border-white/20"
                              />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-[var(--foreground)]">
                                  {calendar.summary}
                                  {calendar.primary && (
                                    <Badge variant="outline" className="ml-2 text-xs">
                                      Primary
                                    </Badge>
                                  )}
                                </p>
                                <p className="text-xs text-[var(--foreground)]/60">
                                  {calendar.id}
                                </p>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                      
                      {selectedCalendarIds.length === 0 && calendars.length > 0 && (
                        <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                          <AlertCircle className="w-4 h-4 text-yellow-400" />
                          <p className="text-sm text-yellow-400">
                            Please select at least one calendar to sync
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Project Selection */}
                  {isTaskManagementIntegration && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-[var(--foreground)]">
                          Default Project
                        </h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={loadProjects}
                          disabled={loadingProjects}
                        >
                          <RefreshCw className={`w-4 h-4 mr-2 ${loadingProjects ? 'animate-spin' : ''}`} />
                          Refresh
                        </Button>
                      </div>
                      
                      {loadingProjects ? (
                        <div className="space-y-2">
                          <Skeleton className="h-10 w-full bg-white/5" />
                        </div>
                      ) : projects.length === 0 ? (
                        <p className="text-sm text-[var(--foreground)]/60">
                          No projects found. Please check your connection.
                        </p>
                      ) : (
                        <select
                          value={defaultProjectId || ''}
                          onChange={(e) => {
                            const newProjectId = e.target.value || null
                            setDefaultProjectId(newProjectId)
                            saveTaskManagementSettings(newProjectId, autoPushEnabled, autoCompletionSyncEnabled)
                          }}
                          className="flex h-10 w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-[#d7d2cb] ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="">No default project (use inbox)</option>
                          {projects.map((project) => (
                            <option key={project.id} value={project.id}>
                              {project.name} {project.is_inbox_project ? '(Inbox)' : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                  
                  {/* Auto-sync Toggles */}
                  {isCalendarIntegration && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                        <div>
                          <p className="text-sm font-medium text-[var(--foreground)]">
                            Auto-pull from {currentProviderInfo?.name}
                          </p>
                          <p className="text-xs text-[var(--foreground)]/60">
                            Automatically pull calendar events every hour to detect busy slots
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={autoSyncEnabled}
                            onChange={handleToggleAutoSync}
                            disabled={updatingSettings || selectedCalendarIds.length === 0}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--primary)]"></div>
                        </label>
                      </div>
                      
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                        <div>
                          <p className="text-sm font-medium text-[var(--foreground)]">
                            Auto-push to {currentProviderInfo?.name}
                          </p>
                          <p className="text-xs text-[var(--foreground)]/60">
                            Automatically push DOER tasks to {currentProviderInfo?.name} when scheduled
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={autoPushEnabled}
                            onChange={handleToggleAutoPush}
                            disabled={updatingSettings || selectedCalendarIds.length === 0}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--primary)]"></div>
                        </label>
                      </div>
                    </div>
                  )}
                  
                  {/* Task Management Toggles */}
                  {isTaskManagementIntegration && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                        <div>
                          <p className="text-sm font-medium text-[var(--foreground)]">
                            Auto-push to {currentProviderInfo?.name}
                          </p>
                          <p className="text-xs text-[var(--foreground)]/60">
                            Automatically push DOER tasks to {currentProviderInfo?.name} when scheduled
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={autoPushEnabled}
                            onChange={() => {
                              const newValue = !autoPushEnabled
                              setAutoPushEnabled(newValue)
                              saveTaskManagementSettings(defaultProjectId, newValue, autoCompletionSyncEnabled)
                            }}
                            disabled={updatingSettings}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--primary)]"></div>
                        </label>
                      </div>
                      
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                        <div>
                          <p className="text-sm font-medium text-[var(--foreground)]">
                            Auto-completion sync
                          </p>
                          <p className="text-xs text-[var(--foreground)]/60">
                            Automatically sync task completion status from DOER to {currentProviderInfo?.name}
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={autoCompletionSyncEnabled}
                            onChange={() => {
                              const newValue = !autoCompletionSyncEnabled
                              setAutoCompletionSyncEnabled(newValue)
                              saveTaskManagementSettings(defaultProjectId, autoPushEnabled, newValue)
                            }}
                            disabled={updatingSettings}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--primary)]"></div>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Sync Logs */}
          {connection && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Sync Activity</CardTitle>
                <CardDescription>
                  View your recent {isTaskManagementIntegration ? 'task management' : 'calendar'} sync operations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {syncLogs.length === 0 ? (
                  <p className="text-sm text-[var(--foreground)]/60 text-center py-8">
                    No sync activity yet. {isCalendarIntegration ? 'Click "Sync Now" to start syncing.' : 'Click "Sync Plan" or "Push Tasks" to start syncing.'}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {syncLogs.map((log: any) => (
                      <div
                        key={log.id}
                        className="flex items-start gap-4 p-4 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
                      >
                        <div className="mt-0.5">
                          {log.status === 'completed' ? (
                            <CheckCircle className="w-5 h-5 text-green-400" />
                          ) : log.status === 'failed' ? (
                            <XCircle className="w-5 h-5 text-red-400" />
                          ) : (
                            <RefreshCw className="w-5 h-5 text-[var(--primary)] animate-spin" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium text-[var(--foreground)]">
                              {isTaskManagementIntegration
                                ? log.sync_type === 'push' ? 'Pushed' : log.sync_type === 'full_sync' ? 'Full Sync' : log.sync_type === 'completion_sync' ? 'Completion Sync' : 'Synced'
                                : log.sync_type === 'pull' ? 'Pulled' : log.sync_type === 'push' ? 'Pushed' : 'Full Sync'}
                            </p>
                            <Badge
                              variant="outline"
                              className={
                                log.status === 'completed'
                                  ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                  : log.status === 'failed'
                                  ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                  : ''
                              }
                            >
                              {log.status}
                            </Badge>
                          </div>
                          <div className="text-xs text-[var(--foreground)]/60 space-y-1">
                            {isTaskManagementIntegration ? (
                              <>
                                {log.tasks_pushed > 0 && (
                                  <p>Pushed: {log.tasks_pushed} task{log.tasks_pushed !== 1 ? 's' : ''}</p>
                                )}
                                {log.tasks_updated > 0 && (
                                  <p>Updated: {log.tasks_updated} task{log.tasks_updated !== 1 ? 's' : ''}</p>
                                )}
                                {log.tasks_completed > 0 && (
                                  <p>Completed: {log.tasks_completed} task{log.tasks_completed !== 1 ? 's' : ''}</p>
                                )}
                              </>
                            ) : (
                              <>
                                {log.events_pulled > 0 && (
                                  <div>
                                    <p className="font-medium mb-1">Pulled: {log.events_pulled} event{log.events_pulled !== 1 ? 's' : ''}</p>
                                    {log.changes_summary?.pulled_events && Array.isArray(log.changes_summary.pulled_events) && log.changes_summary.pulled_events.length > 0 && (
                                      <div className="ml-2 mt-1 space-y-1">
                                        {log.changes_summary.pulled_events.map((event: any, idx: number) => (
                                          <div key={idx} className="text-[var(--foreground)]/70">
                                            <span className="font-medium">{event.title || 'Untitled Event'}</span>
                                            {event.date && (
                                              <span className="ml-2">
                                                {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                {event.startTime && event.endTime && (
                                                  <span className="ml-1 opacity-80">
                                                    • {event.startTime} - {event.endTime}
                                                  </span>
                                                )}
                                              </span>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {log.events_pushed > 0 && (
                                  <p>Pushed: {log.events_pushed} events</p>
                                )}
                                {log.changes_summary?.events_pushed > 0 && !log.events_pushed && (
                                  <p>Pushed: {log.changes_summary.events_pushed} events</p>
                                )}
                                {log.conflicts_detected > 0 && (
                                  <p className="text-yellow-400">
                                    Conflicts: {log.conflicts_detected} detected
                                  </p>
                                )}
                              </>
                            )}
                            {log.error_message && (
                              <p className="text-red-400">{log.error_message}</p>
                            )}
                            <p>
                              {new Date(log.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      
      {/* Push to Calendar Panel - Only for calendar integrations */}
      {showPushPanel && isCalendarIntegration && (
        <PushToCalendarPanel
          isOpen={showPushPanel}
          onClose={() => setShowPushPanel(false)}
          provider={provider as 'google' | 'outlook' | 'apple'}
          connectionId={connection?.id}
          selectedCalendarIds={selectedCalendarIds}
        />
      )}

      {/* Sync Warning Modal */}
      <SyncWarningModal
        isOpen={showSyncWarning}
        onClose={() => setShowSyncWarning(false)}
        onConfirm={handleSync}
        eventCount={estimatedEventCount}
        isSyncing={syncing}
      />
    </div>
  )
}

