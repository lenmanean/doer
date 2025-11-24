'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import { Sidebar } from '@/components/ui/Sidebar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { useOnboardingProtection } from '@/lib/useOnboardingProtection'
import { Calendar, CheckCircle, XCircle, RefreshCw, Settings, Trash2, ExternalLink, AlertCircle, ArrowLeft } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { isEmailConfirmed } from '@/lib/email-confirmation'

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
  
  // Get provider from URL params
  const providerParam = params?.provider as string
  const provider = (['google', 'outlook', 'apple'].includes(providerParam || '') 
    ? providerParam 
    : 'google') as 'google' | 'outlook' | 'apple'
  
  // Validate provider
  useEffect(() => {
    if (providerParam && !['google', 'outlook', 'apple'].includes(providerParam)) {
      addToast({
        type: 'error',
        title: 'Invalid provider',
        description: 'The specified provider is not supported.',
        duration: 5000,
      })
      router.push('/integrations')
    }
  }, [providerParam, router, addToast])
  
  // Calendar connection state
  const [connection, setConnection] = useState<any>(null)
  const [loadingConnection, setLoadingConnection] = useState(true)
  const [calendars, setCalendars] = useState<Array<{ id: string; summary: string; primary?: boolean }>>([])
  const [loadingCalendars, setLoadingCalendars] = useState(false)
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([])
  
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
  
  // Provider display info
  const providerInfo: Record<string, { name: string; icon: React.ReactNode }> = {
    google: {
      name: 'Google Calendar',
      icon: <Calendar className="w-6 h-6 text-blue-500" />,
    },
    outlook: {
      name: 'Microsoft Outlook',
      icon: <Calendar className="w-6 h-6 text-blue-600" />,
    },
    apple: {
      name: 'Apple Calendar',
      icon: <Calendar className="w-6 h-6 text-gray-600" />,
    },
  }
  
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
      const response = await fetch('/api/plans')
      if (response.ok) {
        const data = await response.json()
        const active = Array.isArray(data.plans) 
          ? data.plans.find((plan: any) => plan.status === 'active') || data.plans[0]
          : null
        setActivePlan(active || null)
      }
    } catch (error) {
      console.error('Error loading active plan:', error)
    }
  }, [user?.id])
  
  // Load available calendars
  const loadCalendars = useCallback(async () => {
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
  }, [provider, addToast])
  
  // Load connection status function
  const loadConnection = useCallback(async (retryCount = 0) => {
    if (!user?.id) return
    
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
  }, [user?.id, provider, loadCalendars, loadActivePlan, addToast])
  
  // Handle OAuth callback query parameters
  useEffect(() => {
    if (!user?.id || !loadConnection || !provider) return
    
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')
    
    // Handle successful connection
    if (connected === provider) {
      const handleConnection = async () => {
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
          addToast({
            type: 'success',
            title: 'Successfully connected!',
            description: `${providerInfo[provider]?.name || 'Calendar'} has been connected. Please select calendars to sync.`,
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
        
        setTimeout(() => {
          router.replace(`/integrations/${provider}`)
        }, 100)
      }
      
      handleConnection()
    }
    
    // Handle errors
    if (error) {
      let errorMessage = `Failed to connect ${providerInfo[provider]?.name || 'Calendar'}`
      if (error === 'oauth_failed') {
        errorMessage = 'OAuth authorization was cancelled or failed'
      } else if (error === 'connection_failed') {
        errorMessage = 'Failed to save connection. Please try again.'
      }
      addToast({
        type: 'error',
        title: 'Connection failed',
        description: errorMessage,
        duration: 7000,
      })
      router.replace(`/integrations/${provider}`)
    }
  }, [user?.id, provider, searchParams, router, addToast, loadConnection])
  
  // Load connection status on mount
  useEffect(() => {
    if (!user?.id || !loadConnection || !provider) return
    
    const connected = searchParams.get('connected')
    if (!connected) {
      loadConnection()
    }
  }, [user?.id, provider, searchParams, loadConnection])
  
  // Connect Calendar
  const handleConnect = async () => {
    try {
      const response = await fetch(`/api/integrations/${provider}/authorize`)
      
      if (!response.ok) {
        throw new Error('Failed to generate authorization URL')
      }
      
      const data = await response.json()
      window.location.href = data.auth_url
    } catch (error) {
      console.error('Error connecting calendar:', error)
      addToast({
        type: 'error',
        title: 'Failed to connect',
        description: 'Please try again later.',
        duration: 5000,
      })
    }
  }
  
  // Disconnect Calendar
  const handleDisconnect = async () => {
    if (!confirm(`Are you sure you want to disconnect ${providerInfo[provider]?.name || 'this calendar'}? This will remove all sync settings and stop syncing.`)) {
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
      setCalendars([])
      setSelectedCalendarIds([])
      setSyncLogs([])
      
      addToast({
        type: 'success',
        title: 'Disconnected successfully',
        description: `${providerInfo[provider]?.name || 'Calendar'} has been disconnected.`,
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
  
  // Manual sync (Pull from Calendar)
  const handleSync = async () => {
    try {
      setSyncing(true)
      const response = await fetch(`/api/integrations/${provider}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendar_ids: selectedCalendarIds.length > 0 ? selectedCalendarIds : undefined,
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
        description: `Pulled ${data.events_pulled} events from ${providerInfo[provider]?.name || 'calendar'}. ${data.conflicts_detected > 0 ? `${data.conflicts_detected} conflicts detected.` : ''}`,
        duration: 7000,
      })
      
      // Reload connection status
      const statusResponse = await fetch(`/api/integrations/${provider}/status`)
      if (statusResponse.ok) {
        const statusData = await statusResponse.json()
        setSyncLogs(statusData.recent_syncs || [])
        if (statusData.connection) {
          setConnection(statusData.connection)
          setAutoSyncEnabled(statusData.connection.auto_sync_enabled || false)
          setAutoPushEnabled(statusData.connection.auto_push_enabled || false)
        }
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
      setSyncing(false)
    }
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
    
    try {
      setPushing(true)
      
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
        setPushing(false)
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
        setPushing(false)
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
        setSyncLogs(statusData.recent_syncs || [])
        if (statusData.connection) {
          setConnection(statusData.connection)
          setAutoSyncEnabled(statusData.connection.auto_sync_enabled || false)
          setAutoPushEnabled(statusData.connection.auto_push_enabled || false)
        }
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
      setPushing(false)
    }
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
                {currentProviderInfo?.name || 'Calendar Integration'}
              </h1>
              <p className="text-[var(--foreground)]/70">
                Connect and manage your {currentProviderInfo?.name || 'calendar'} integration
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
                      Sync your calendar events with DOER plans
                    </CardDescription>
                  </div>
                </div>
                {connection && (
                  <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Connected
                  </Badge>
                )}
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
                    Connect your {currentProviderInfo?.name} to automatically detect busy slots and sync your DOER tasks.
                  </p>
                  <Button onClick={handleConnect} className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
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
                  
                  {/* Auto-sync Toggles */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                      <div>
                        <p className="text-sm font-medium text-[var(--foreground)]">
                          Auto-pull from {currentProviderInfo?.name}
                        </p>
                        <p className="text-xs text-[var(--foreground)]/60">
                          Automatically pull calendar events to detect busy slots (coming soon)
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
                  
                  {/* Sync Buttons */}
                  <div className="flex gap-3">
                    <Button
                      onClick={handleSync}
                      disabled={syncing || selectedCalendarIds.length === 0}
                      variant="outline"
                      className="flex items-center gap-2 flex-1"
                    >
                      <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                      {syncing ? 'Pulling...' : `Pull from ${currentProviderInfo?.name}`}
                    </Button>
                    <Button
                      onClick={handlePush}
                      disabled={pushing || selectedCalendarIds.length === 0 || !activePlan}
                      variant="outline"
                      className="flex items-center gap-2 flex-1"
                    >
                      <ExternalLink className={`w-4 h-4 ${pushing ? 'animate-pulse' : ''}`} />
                      {pushing ? 'Pushing...' : `Push to ${currentProviderInfo?.name}`}
                    </Button>
                  </div>
                  
                  {!activePlan && (
                    <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-blue-400" />
                      <p className="text-sm text-blue-400">
                        Create or activate a plan to push tasks to {currentProviderInfo?.name}
                      </p>
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
                  View your recent calendar sync operations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {syncLogs.length === 0 ? (
                  <p className="text-sm text-[var(--foreground)]/60 text-center py-8">
                    No sync activity yet. Click "Sync Now" to start syncing.
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
                              {log.sync_type === 'pull' ? 'Pulled' : log.sync_type === 'push' ? 'Pushed' : 'Full Sync'}
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
                            {log.events_pulled > 0 && (
                              <p>Pulled: {log.events_pulled} events</p>
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
    </div>
  )
}

