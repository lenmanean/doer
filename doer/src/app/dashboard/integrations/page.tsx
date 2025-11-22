'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/ui/Sidebar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { useOnboardingProtection } from '@/lib/useOnboardingProtection'
import { Calendar, CheckCircle, XCircle, RefreshCw, Settings, Trash2, ExternalLink, AlertCircle } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { isEmailConfirmed } from '@/lib/email-confirmation'

/**
 * Dashboard Integrations Page
 * Shows Google Calendar connection status, sync controls, and event summaries
 */
export default function IntegrationsPage() {
  const router = useRouter()
  const { addToast } = useToast()
  const { user, profile, loading, handleSignOut } = useOnboardingProtection()
  const [emailConfirmed, setEmailConfirmed] = useState(true)
  
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
  const [updatingSettings, setUpdatingSettings] = useState(false)
  
  useEffect(() => {
    if (!user) {
      setEmailConfirmed(true)
      return
    }
    setEmailConfirmed(isEmailConfirmed(user))
  }, [user?.id])
  
  // Load connection status
  useEffect(() => {
    if (!user?.id) return
    
    const loadConnection = async () => {
      try {
        setLoadingConnection(true)
        const response = await fetch('/api/integrations/google-calendar/status')
        
        if (!response.ok) {
          throw new Error('Failed to load connection status')
        }
        
        const data = await response.json()
        setConnection(data.connected ? data.connection : null)
        setAutoSyncEnabled(data.connection?.auto_sync_enabled || false)
        setSelectedCalendarIds(data.connection?.selected_calendar_ids || [])
        setSyncLogs(data.recent_syncs || [])
        
        // Load calendars if connected
        if (data.connected) {
          loadCalendars()
        }
      } catch (error) {
        console.error('Error loading connection:', error)
        addToast({
          type: 'error',
          title: 'Failed to load connection',
          description: 'Please try again later.',
          duration: 5000,
        })
      } finally {
        setLoadingConnection(false)
      }
    }
    
    loadConnection()
  }, [user?.id, addToast])
  
  // Load available calendars
  const loadCalendars = async () => {
    try {
      setLoadingCalendars(true)
      const response = await fetch('/api/integrations/google-calendar/calendars')
      
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
  }
  
  // Connect Google Calendar
  const handleConnect = async () => {
    try {
      const response = await fetch('/api/integrations/google-calendar/authorize')
      
      if (!response.ok) {
        throw new Error('Failed to generate authorization URL')
      }
      
      const data = await response.json()
      // Redirect to Google OAuth
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
  
  // Disconnect Google Calendar
  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Google Calendar? This will remove all sync settings and stop syncing.')) {
      return
    }
    
    try {
      const response = await fetch('/api/integrations/google-calendar/disconnect', {
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
        description: 'Google Calendar has been disconnected.',
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
  
  // Manual sync
  const handleSync = async () => {
    try {
      setSyncing(true)
      const response = await fetch('/api/integrations/google-calendar/sync', {
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
        description: `Pulled ${data.events_pulled} events. ${data.conflicts_detected > 0 ? `${data.conflicts_detected} conflicts detected.` : ''}`,
        duration: 7000,
      })
      
      // Reload connection status to get updated sync logs
      const statusResponse = await fetch('/api/integrations/google-calendar/status')
      if (statusResponse.ok) {
        const statusData = await statusResponse.json()
        setSyncLogs(statusData.recent_syncs || [])
        if (statusData.connection) {
          setConnection(statusData.connection)
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
  
  // Toggle calendar selection
  const toggleCalendarSelection = (calendarId: string) => {
    setSelectedCalendarIds(prev => {
      const newSelection = prev.includes(calendarId)
        ? prev.filter(id => id !== calendarId)
        : [...prev, calendarId]
      
      // Save immediately
      saveCalendarSettings(newSelection, autoSyncEnabled)
      
      return newSelection
    })
  }
  
  // Toggle auto-sync
  const handleToggleAutoSync = async () => {
    const newValue = !autoSyncEnabled
    setAutoSyncEnabled(newValue)
    saveCalendarSettings(selectedCalendarIds, newValue)
  }
  
  // Save calendar settings
  const saveCalendarSettings = async (calendarIds: string[], autoSync: boolean) => {
    try {
      setUpdatingSettings(true)
      const response = await fetch('/api/integrations/google-calendar/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selected_calendar_ids: calendarIds,
          auto_sync_enabled: autoSync,
        }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to update settings')
      }
    } catch (error) {
      console.error('Error updating settings:', error)
      // Revert on error
      setAutoSyncEnabled(!autoSync)
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
  
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Sidebar
        user={profile || { email: user?.email || '' }}
        onSignOut={handleSignOut}
        currentPath="/dashboard/integrations"
        emailConfirmed={emailConfirmed}
      />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-4xl font-bold text-[var(--foreground)] mb-2">
              Integrations
            </h1>
            <p className="text-[var(--foreground)]/70">
              Connect and manage your calendar integrations
            </p>
          </div>
          
          {/* Google Calendar Connection Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="w-6 h-6 text-[var(--primary)]" />
                  <div>
                    <CardTitle>Google Calendar</CardTitle>
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
                    Connect your Google Calendar to automatically detect busy slots and sync your DOER tasks.
                  </p>
                  <Button onClick={handleConnect} className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Connect Google Calendar
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
                  
                  {/* Auto-sync Toggle */}
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                    <div>
                      <p className="text-sm font-medium text-[var(--foreground)]">
                        Auto-sync
                      </p>
                      <p className="text-xs text-[var(--foreground)]/60">
                        Automatically sync calendar events (coming soon)
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
                  
                  {/* Sync Button */}
                  <div className="flex gap-3">
                    <Button
                      onClick={handleSync}
                      disabled={syncing || selectedCalendarIds.length === 0}
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                      {syncing ? 'Syncing...' : 'Sync Now'}
                    </Button>
                  </div>
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
