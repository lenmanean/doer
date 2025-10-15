'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/ui/Sidebar'
import { useOnboardingProtection } from '@/lib/useOnboardingProtection'
import { FadeInWrapper, StaggeredFadeIn } from '@/components/ui/FadeInWrapper'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { 
  User, 
  Bell, 
  Shield, 
  Palette, 
  Globe, 
  Zap,
  Save,
  Trash2,
  Key,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  Target,
  Loader2
} from 'lucide-react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'
import { SwitchPlanModal } from '@/components/ui/SwitchPlanModal'
import { useUserRoadmap } from '@/hooks/useUserRoadmap'

interface SettingsData {
  // Account
  email: string
  displayName: string
  
  // Notifications
  emailNotifications: boolean
  taskReminders: boolean
  milestoneAlerts: boolean
  weeklyDigest: boolean
  
  // Privacy
  profileVisibility: 'public' | 'private'
  shareAchievements: boolean
  showProgress: boolean
  
  // Preferences
  theme: 'dark' | 'light' | 'system'
  language: string
  timeFormat: '12h' | '24h'
  startOfWeek: 'sunday' | 'monday'
  
  // Advanced
  aiSuggestions: boolean
  autoSchedule: boolean
  dataExport: boolean
}

export default function SettingsPage() {
  const { user, profile, loading, handleSignOut } = useOnboardingProtection()
  const { roadmapData, refetch } = useUserRoadmap(user?.id || null)
  const [activeSection, setActiveSection] = useState('account')
  const [showSwitchPlanModal, setShowSwitchPlanModal] = useState(false)
  const [settingsData, setSettingsData] = useState<SettingsData>({
    email: '',
    displayName: '',
    emailNotifications: true,
    taskReminders: true,
    milestoneAlerts: true,
    weeklyDigest: false,
    profileVisibility: 'public',
    shareAchievements: true,
    showProgress: true,
    theme: 'dark',
    language: 'en',
    timeFormat: '12h',
    startOfWeek: 'monday',
    aiSuggestions: true,
    autoSchedule: false,
    dataExport: false
  })
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (user && profile) {
      const savedSettings = profile.settings || {}
      
      setSettingsData(prev => ({
        ...prev,
        email: user.email || '',
        displayName: profile.display_name || '',
        shareAchievements: profile.share_achievements ?? true,
        // Load from settings JSONB
        emailNotifications: savedSettings.notifications?.email ?? true,
        taskReminders: savedSettings.notifications?.task_reminders ?? true,
        milestoneAlerts: savedSettings.notifications?.milestone_alerts ?? true,
        weeklyDigest: savedSettings.notifications?.weekly_digest ?? false,
        profileVisibility: savedSettings.privacy?.profile_visibility || 'public',
        showProgress: savedSettings.privacy?.show_progress ?? true,
        theme: savedSettings.preferences?.theme || 'dark',
        language: savedSettings.preferences?.language || 'en',
        timeFormat: savedSettings.preferences?.time_format || '12h',
        startOfWeek: savedSettings.preferences?.start_of_week || 'monday',
        aiSuggestions: savedSettings.advanced?.ai_suggestions ?? true,
        autoSchedule: savedSettings.advanced?.auto_schedule ?? false,
      }))
    }
  }, [user, profile])

  const handleSave = async () => {
    setSaving(true)
    try {
      // Build settings object
      const settings = {
        notifications: {
          email: settingsData.emailNotifications,
          task_reminders: settingsData.taskReminders,
          milestone_alerts: settingsData.milestoneAlerts,
          weekly_digest: settingsData.weeklyDigest
        },
        privacy: {
          profile_visibility: settingsData.profileVisibility,
          show_progress: settingsData.showProgress
        },
        preferences: {
          theme: settingsData.theme,
          language: settingsData.language,
          time_format: settingsData.timeFormat,
          start_of_week: settingsData.startOfWeek
        },
        advanced: {
          ai_suggestions: settingsData.aiSuggestions,
          auto_schedule: settingsData.autoSchedule
        }
      }

      // Save profile and settings updates
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: settingsData.displayName,
          share_achievements: settingsData.shareAchievements,
          settings: settings
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save settings')
      }

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)

      // Refresh the page data to get updated settings
      window.location.reload()
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('Failed to save settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async () => {
    // Validate passwords
    if (!newPassword || newPassword.length < 6) {
      alert('New password must be at least 6 characters long')
      return
    }

    if (newPassword !== confirmPassword) {
      alert('Passwords do not match')
      return
    }

    setPasswordSaving(true)
    try {
      const response = await fetch('/api/settings/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update password')
      }

      alert('Password updated successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      console.error('Error updating password:', error)
      alert(error.message || 'Failed to update password. Please try again.')
    } finally {
      setPasswordSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      alert('Please type DELETE to confirm account deletion')
      return
    }

    if (!confirm('Are you absolutely sure? This action cannot be undone.')) {
      return
    }

    setDeleting(true)
    try {
      const response = await fetch('/api/settings/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmation: deleteConfirmation
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete account')
      }

      alert('Account deletion initiated. You will be signed out.')
      await handleSignOut()
    } catch (error: any) {
      console.error('Error deleting account:', error)
      alert(error.message || 'Failed to delete account. Please try again.')
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const sections = [
    { id: 'account', label: 'Account', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy & Security', icon: Shield },
    { id: 'preferences', label: 'Preferences', icon: Palette },
    { id: 'advanced', label: 'Advanced', icon: Zap },
  ]

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-[#d7d2cb]">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Sidebar 
        user={profile || { email: user?.email || '' }}
        onSignOut={handleSignOut}
        currentPath="/settings"
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <StaggeredFadeIn>
          {/* Header */}
          <FadeInWrapper delay={0.1} direction="up">
            <div className="mb-8">
              <h1 className="text-5xl font-bold tracking-tight text-[#d7d2cb] mb-4">
                Settings
              </h1>
              <p className="text-base leading-relaxed text-[#d7d2cb]/70">
                Manage your account settings and preferences
              </p>
            </div>
          </FadeInWrapper>

          {/* Main Layout */}
          <FadeInWrapper delay={0.2} direction="up">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Sidebar Navigation */}
              <Card className="lg:col-span-1 h-fit">
                <CardContent className="p-4">
                  <nav className="space-y-1">
                    {sections.map((section) => {
                      const Icon = section.icon
                      return (
                        <button
                          key={section.id}
                          onClick={() => setActiveSection(section.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                            activeSection === section.id
                              ? 'bg-white/10 text-[#d7d2cb] border border-white/20'
                              : 'text-[#d7d2cb]/60 hover:text-[#d7d2cb] hover:bg-white/5'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {section.label}
                        </button>
                      )
                    })}
                  </nav>
                </CardContent>
              </Card>

              {/* Settings Content */}
              <div className="lg:col-span-3 space-y-6">
                {/* Account Settings */}
                {activeSection === 'account' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <Card>
                      <CardHeader>
                        <CardTitle>Account Information</CardTitle>
                        <CardDescription>Update your account details</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-[#d7d2cb] mb-2">
                            Email Address
                          </label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#d7d2cb]/40" />
                            <input
                              type="email"
                              value={settingsData.email}
                              disabled
                              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/20 rounded-lg text-[#d7d2cb] cursor-not-allowed opacity-60"
                            />
                          </div>
                          <p className="text-xs text-[#d7d2cb]/50 mt-1">Email cannot be changed</p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-[#d7d2cb] mb-2">
                            Display Name
                          </label>
                          <input
                            type="text"
                            value={settingsData.displayName}
                            onChange={(e) => setSettingsData({ ...settingsData, displayName: e.target.value })}
                            placeholder="Enter your display name"
                            className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-[#d7d2cb] placeholder-[#d7d2cb]/40 focus:outline-none focus:border-[#d7d2cb] focus:ring-1 focus:ring-[#d7d2cb]"
                          />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Password</CardTitle>
                        <CardDescription>Change your password</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-[#d7d2cb] mb-2">
                            Current Password
                          </label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#d7d2cb]/40" />
                            <input
                              type={showPassword ? 'text' : 'password'}
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                              placeholder="Enter current password"
                              className="w-full pl-10 pr-12 py-2 bg-white/5 border border-white/20 rounded-lg text-[#d7d2cb] placeholder-[#d7d2cb]/40 focus:outline-none focus:border-[#d7d2cb] focus:ring-1 focus:ring-[#d7d2cb]"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#d7d2cb]/40 hover:text-[#d7d2cb]"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-[#d7d2cb] mb-2">
                            New Password
                          </label>
                          <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Enter new password (min 6 characters)"
                            className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-[#d7d2cb] placeholder-[#d7d2cb]/40 focus:outline-none focus:border-[#d7d2cb] focus:ring-1 focus:ring-[#d7d2cb]"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-[#d7d2cb] mb-2">
                            Confirm New Password
                          </label>
                          <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm new password"
                            className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-[#d7d2cb] placeholder-[#d7d2cb]/40 focus:outline-none focus:border-[#d7d2cb] focus:ring-1 focus:ring-[#d7d2cb]"
                          />
                        </div>

                        <button 
                          onClick={handlePasswordChange}
                          disabled={passwordSaving || !newPassword || !confirmPassword}
                          className="px-4 py-2 bg-white/10 backdrop-blur-md border border-white/30 rounded-lg text-[#d7d2cb] hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {passwordSaving ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Updating...
                            </>
                          ) : (
                            <>
                              <Key className="w-4 h-4" />
                              Update Password
                            </>
                          )}
                        </button>
                      </CardContent>
                    </Card>

                    <Card className="border-red-500/20 bg-red-500/5">
                      <CardHeader>
                        <CardTitle className="text-red-400">Danger Zone</CardTitle>
                        <CardDescription>Irreversible actions</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {!showDeleteConfirm ? (
                          <button 
                            onClick={() => setShowDeleteConfirm(true)}
                            className="px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/30 transition-colors flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete Account
                          </button>
                        ) : (
                          <div className="space-y-4">
                            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                              <p className="text-sm text-red-400 mb-2">
                                ⚠️ This action is irreversible. All your data will be permanently deleted.
                              </p>
                              <p className="text-xs text-[#d7d2cb]/60">
                                Type <span className="font-bold text-red-400">DELETE</span> to confirm
                              </p>
                            </div>
                            <input
                              type="text"
                              value={deleteConfirmation}
                              onChange={(e) => setDeleteConfirmation(e.target.value)}
                              placeholder="Type DELETE to confirm"
                              className="w-full px-4 py-2 bg-white/5 border border-red-500/30 rounded-lg text-[#d7d2cb] placeholder-[#d7d2cb]/40 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                            />
                            <div className="flex gap-3">
                              <button
                                onClick={() => {
                                  setShowDeleteConfirm(false)
                                  setDeleteConfirmation('')
                                }}
                                className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-[#d7d2cb] hover:bg-white/20 transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleDeleteAccount}
                                disabled={deleting || deleteConfirmation !== 'DELETE'}
                                className="flex-1 px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                              >
                                {deleting ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Deleting...
                                  </>
                                ) : (
                                  <>
                                    <Trash2 className="w-4 h-4" />
                                    Delete My Account
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Notifications */}
                {activeSection === 'notifications' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card>
                      <CardHeader>
                        <CardTitle>Notification Preferences</CardTitle>
                        <CardDescription>Manage how you receive notifications</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {[
                          { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive notifications via email' },
                          { key: 'taskReminders', label: 'Task Reminders', desc: 'Get reminded about upcoming tasks' },
                          { key: 'milestoneAlerts', label: 'Milestone Alerts', desc: 'Notifications when you complete milestones' },
                          { key: 'weeklyDigest', label: 'Weekly Digest', desc: 'Receive a summary of your weekly progress' },
                        ].map((item) => (
                          <div key={item.key} className="flex items-center justify-between p-4 bg-white/5 border border-white/20 rounded-lg">
                            <div>
                              <p className="text-sm font-medium text-[#d7d2cb]">{item.label}</p>
                              <p className="text-xs text-[#d7d2cb]/60">{item.desc}</p>
                            </div>
                            <button
                              onClick={() => setSettingsData({ 
                                ...settingsData, 
                                [item.key]: !settingsData[item.key as keyof SettingsData] 
                              })}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-transparent ${
                                settingsData[item.key as keyof SettingsData] ? 'bg-blue-500' : 'bg-white/20'
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                                  settingsData[item.key as keyof SettingsData] ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Privacy & Security */}
                {activeSection === 'privacy' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <Card>
                      <CardHeader>
                        <CardTitle>Privacy Settings</CardTitle>
                        <CardDescription>Control who can see your information</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-[#d7d2cb] mb-2">
                            Profile Visibility
                          </label>
                          <select
                            value={settingsData.profileVisibility}
                            onChange={(e) => setSettingsData({ ...settingsData, profileVisibility: e.target.value as 'public' | 'private' })}
                            className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-[#d7d2cb] focus:outline-none focus:border-[#d7d2cb] focus:ring-1 focus:ring-[#d7d2cb]"
                          >
                            <option value="public">Public</option>
                            <option value="private">Private</option>
                          </select>
                        </div>

                        {[
                          { key: 'shareAchievements', label: 'Share Achievements', desc: 'Display achievements in community' },
                          { key: 'showProgress', label: 'Show Progress', desc: 'Allow others to see your progress' },
                        ].map((item) => (
                          <div key={item.key} className="flex items-center justify-between p-4 bg-white/5 border border-white/20 rounded-lg">
                            <div>
                              <p className="text-sm font-medium text-[#d7d2cb]">{item.label}</p>
                              <p className="text-xs text-[#d7d2cb]/60">{item.desc}</p>
                            </div>
                            <button
                              onClick={() => setSettingsData({ 
                                ...settingsData, 
                                [item.key]: !settingsData[item.key as keyof SettingsData] 
                              })}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                                settingsData[item.key as keyof SettingsData] ? 'bg-blue-500' : 'bg-white/20'
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                                  settingsData[item.key as keyof SettingsData] ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Data & Privacy</CardTitle>
                        <CardDescription>Manage your data</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <button className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-[#d7d2cb] hover:bg-white/10 transition-colors text-left">
                          Download My Data
                        </button>
                        <button className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-[#d7d2cb] hover:bg-white/10 transition-colors text-left">
                          View Privacy Policy
                        </button>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Preferences */}
                {activeSection === 'preferences' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card>
                      <CardHeader>
                        <CardTitle>App Preferences</CardTitle>
                        <CardDescription>Customize your experience</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-[#d7d2cb] mb-2">
                            Time Format
                          </label>
                          <select
                            value={settingsData.timeFormat}
                            onChange={(e) => setSettingsData({ ...settingsData, timeFormat: e.target.value as '12h' | '24h' })}
                            className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-[#d7d2cb] focus:outline-none focus:border-[#d7d2cb] focus:ring-1 focus:ring-[#d7d2cb]"
                          >
                            <option value="12h">12-hour</option>
                            <option value="24h">24-hour</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-[#d7d2cb] mb-2">
                            Start of Week
                          </label>
                          <select
                            value={settingsData.startOfWeek}
                            onChange={(e) => setSettingsData({ ...settingsData, startOfWeek: e.target.value as 'sunday' | 'monday' })}
                            className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-[#d7d2cb] focus:outline-none focus:border-[#d7d2cb] focus:ring-1 focus:ring-[#d7d2cb]"
                          >
                            <option value="sunday">Sunday</option>
                            <option value="monday">Monday</option>
                          </select>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Advanced */}
                {activeSection === 'advanced' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card>
                      <CardHeader>
                        <CardTitle>Advanced Features</CardTitle>
                        <CardDescription>Manage your plans and goals</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="p-4 bg-white/5 border border-white/20 rounded-lg">
                          <div className="flex items-center gap-3 mb-2">
                            <Target className="w-5 h-5 text-[#ff7f00]" />
                            <p className="text-sm font-medium text-[#d7d2cb]">Manage Plans</p>
                          </div>
                          <p className="text-xs text-[#d7d2cb]/60 mb-3">
                            Switch between plans, create new ones, or delete existing plans
                          </p>
                          <button
                            onClick={() => setShowSwitchPlanModal(true)}
                            className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-[#d7d2cb] hover:bg-white/20 transition-colors"
                          >
                            Open Plan Manager
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Save Button (Fixed at bottom) */}
                <div className="sticky bottom-6 flex items-center justify-between p-4 bg-white/5 backdrop-blur-md border border-white/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    {saveSuccess && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2 text-green-400"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm">Settings saved successfully!</span>
                      </motion.div>
                    )}
                  </div>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-2 bg-white/10 backdrop-blur-md border border-white/30 rounded-lg text-[#d7d2cb] hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-[#d7d2cb] border-t-transparent rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </FadeInWrapper>
        </StaggeredFadeIn>
      </main>

      {/* Switch Plan Modal */}
      <SwitchPlanModal
        isOpen={showSwitchPlanModal}
        onClose={() => setShowSwitchPlanModal(false)}
        hasActivePlan={!!roadmapData?.plan}
        currentPlanTitle={roadmapData?.plan?.summary_data?.goal_title || roadmapData?.goal?.title}
        onPlanChanged={() => {
          // Refetch roadmap data when plan is switched/changed
          refetch()
        }}
      />
    </div>
  )
}

