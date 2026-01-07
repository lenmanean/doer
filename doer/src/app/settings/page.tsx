'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Sidebar } from '@/components/ui/Sidebar'
import { useOnboardingProtection } from '@/lib/useOnboardingProtection'
import { useGlobalPendingReschedules } from '@/hooks/useGlobalPendingReschedules'
import { FadeInWrapper, StaggeredFadeIn } from '@/components/ui/FadeInWrapper'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { 
  User, 
  Shield, 
  Palette, 
  Save,
  Trash2,
  Key,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Clock,
  Upload,
  X,
  LogOut,
  Download,
  FileText,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Phone,
  Calendar,
  CheckCircle,
  AlertCircle,
  CreditCard
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'
import { SwitchPlanModal } from '@/components/ui/SwitchPlanModal'
import { useUserRoadmap } from '@/hooks/useUserRoadmap'
import { useTheme } from '@/components/providers/theme-provider'
import { saveUserPreferences } from '@/lib/date-time-utils'
import { isEmailConfirmed } from '@/lib/email-confirmation'
import { useToast } from '@/components/ui/Toast'
import { AccentColorSelect } from '@/components/ui/AccentColorSelect'
import { PlanManagementDropdown } from '@/components/ui/PlanManagementDropdown'
import { validateUsername } from '@/lib/validation/username'
import { validateEmail } from '@/lib/validation/email'
import { formatDistanceToNow } from 'date-fns'
import { CookieManagement } from '@/components/settings/CookieManagement'

interface SettingsData {
  // Account
  email: string
  firstName: string
  lastName: string
  dateOfBirth: string
  phoneNumber: string
  phoneVerified: boolean
  timezone: string
  locale: string
  
  // Workday & Scheduling
  workdayStartHour: number
  workdayEndHour: number
  lunchStartHour: number
  lunchEndHour: number
  allowWeekends: boolean
  
  // Smart Scheduling
  smartSchedulingEnabled: boolean
  
  // Preferences
  theme: 'dark' | 'light' | 'system'
  accentColor: 'default' | 'blue' | 'green' | 'yellow' | 'pink' | 'orange' | 'purple'
  timeFormat: '12h' | '24h'
  startOfWeek: 'sunday' | 'monday'
}

export default function SettingsPage() {
  const searchParams = useSearchParams()
  const { user, profile, loading, handleSignOut } = useOnboardingProtection()
  const { roadmapData, refetch } = useUserRoadmap(user?.id || null)
  const { theme, setTheme, accentColor, setAccentColor } = useTheme()
  const { hasPending: hasPendingReschedules } = useGlobalPendingReschedules(user?.id || null)
  const { addToast } = useToast()
  const [activeSection, setActiveSection] = useState('account')
  
  // Read tab from URL parameter
  useEffect(() => {
    const tab = searchParams?.get('tab')
    if (tab && ['account', 'subscription', 'workday', 'privacy', 'preferences'].includes(tab)) {
      setActiveSection(tab)
    }
  }, [searchParams])
  const [showSwitchPlanModal, setShowSwitchPlanModal] = useState(false)
  const [settingsData, setSettingsData] = useState<SettingsData>({
    email: '',
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    phoneNumber: '',
    phoneVerified: false,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    locale: Intl.DateTimeFormat().resolvedOptions().locale || 'en-US',
    workdayStartHour: 9,
    workdayEndHour: 17,
    lunchStartHour: 12,
    lunchEndHour: 13,
    allowWeekends: false,
    smartSchedulingEnabled: true,
    theme: 'dark',
    accentColor: 'orange',
    timeFormat: '12h',
    startOfWeek: 'monday'
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
  const [showDeleteDataConfirm, setShowDeleteDataConfirm] = useState(false)
  const [deleteDataConfirmation, setDeleteDataConfirmation] = useState('')
  const [deletingData, setDeletingData] = useState(false)
  const [showPreferencesSave, setShowPreferencesSave] = useState(false)
  const [preferencesChanged, setPreferencesChanged] = useState(false)
  const [emailConfirmed, setEmailConfirmed] = useState(true)
  const [resendingConfirmation, setResendingConfirmation] = useState(false)
  const [profilePicture, setProfilePicture] = useState<File | null>(null)
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [showDeletePlansConfirm, setShowDeletePlansConfirm] = useState(false)
  const [deletePlansConfirmation, setDeletePlansConfirmation] = useState('')
  const [deletingPlans, setDeletingPlans] = useState(false)
  const [showDeleteTasksConfirm, setShowDeleteTasksConfirm] = useState(false)
  const [deleteTasksConfirmation, setDeleteTasksConfirmation] = useState('')
  const [deletingTasks, setDeletingTasks] = useState(false)
  const [exportingData, setExportingData] = useState(false)
  const [improveModelEnabled, setImproveModelEnabled] = useState(false)
  const [originalImproveModelEnabled, setOriginalImproveModelEnabled] = useState(false)
  const [loggingOutAll, setLoggingOutAll] = useState(false)
  const [plans, setPlans] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [selectedPlans, setSelectedPlans] = useState<Set<string>>(new Set())
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())
  const [loadingPlans, setLoadingPlans] = useState(false)
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [showDeletePlansList, setShowDeletePlansList] = useState(false)
  const [showDeleteTasksList, setShowDeleteTasksList] = useState(false)
  const [justSaved, setJustSaved] = useState(false) // Track if we just saved to prevent overwrite
  const [subscription, setSubscription] = useState<any>(null)
  const [loadingSubscription, setLoadingSubscription] = useState(false)
  const [cancelingSubscription, setCancelingSubscription] = useState(false)
  const [openingPortal, setOpeningPortal] = useState(false)
  const [reactivatingBasic, setReactivatingBasic] = useState(false)
  const [invoices, setInvoices] = useState<any[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [usernameInput, setUsernameInput] = useState('')
  const [usernameSaving, setUsernameSaving] = useState(false)
  const [usernameMessage, setUsernameMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [usernameCooldownEnds, setUsernameCooldownEnds] = useState<Date | null>(null)
  const [emailNewValue, setEmailNewValue] = useState('')
  const [emailPasswordInput, setEmailPasswordInput] = useState('')
  const [emailOtpInput, setEmailOtpInput] = useState('')
  const [emailRequestId, setEmailRequestId] = useState<string | null>(null)
  const [emailStep, setEmailStep] = useState<'form' | 'verify'>('form')
  const [emailMessage, setEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [emailSubmitting, setEmailSubmitting] = useState(false)
  const [emailConfirming, setEmailConfirming] = useState(false)
  const [emailCodeExpiresAt, setEmailCodeExpiresAt] = useState<string | null>(null)
  
  // Change tracking for unified save/revert buttons
  const [originalSettings, setOriginalSettings] = useState<SettingsData | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<Record<string, boolean>>({
    account: false,
    workday: false,
    privacy: false,
    preferences: false
  })
  const [savingSection, setSavingSection] = useState<string | null>(null)

  const hasPaidBillingPeriod = Boolean(
    subscription &&
    subscription.planSlug !== 'basic' &&
    subscription.currentPeriodStart &&
    subscription.currentPeriodEnd &&
    !Number.isNaN(new Date(subscription.currentPeriodStart).getTime()) &&
    !Number.isNaN(new Date(subscription.currentPeriodEnd).getTime())
  )

  const currentPeriodStartLabel = hasPaidBillingPeriod && subscription
    ? new Date(subscription.currentPeriodStart).toLocaleDateString()
    : null
  const currentPeriodEndLabel = hasPaidBillingPeriod && subscription
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
    : null


  useEffect(() => {
    if (user && profile && !justSaved) {
      // Prefer flat preferences from user_settings.preferences
      const prefs = profile.preferences || {}
      const savedSettings = profile.settings || {}
      
      const newSettingsData: SettingsData = {
        email: user.email || '',
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        dateOfBirth: profile.date_of_birth || '',
        phoneNumber: profile.phone_number || '',
        phoneVerified: profile.phone_verified || false,
        timezone: profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        locale: profile.locale || Intl.DateTimeFormat().resolvedOptions().locale || 'en-US',
        workdayStartHour: prefs.workday?.workday_start_hour || savedSettings.workday?.workday_start_hour || 9,
        workdayEndHour: prefs.workday?.workday_end_hour || savedSettings.workday?.workday_end_hour || 17,
        lunchStartHour: prefs.workday?.lunch_start_hour || savedSettings.workday?.lunch_start_hour || 12,
        lunchEndHour: prefs.workday?.lunch_end_hour || savedSettings.workday?.lunch_end_hour || 13,
        allowWeekends: prefs.workday?.allow_weekends ?? savedSettings.workday?.allow_weekends ?? false,
        smartSchedulingEnabled: prefs.smart_scheduling?.enabled ?? true,
        theme: (prefs.theme || savedSettings.preferences?.theme || theme) as 'dark' | 'light' | 'system',
        accentColor: (prefs.accent_color || accentColor || 'orange') as 'default' | 'blue' | 'green' | 'yellow' | 'pink' | 'orange' | 'purple',
        timeFormat: (prefs.time_format || savedSettings.preferences?.time_format || '12h') as '12h' | '24h',
        startOfWeek: (
          (prefs.week_start_day !== undefined
            ? (prefs.week_start_day === 1 ? 'monday' : 'sunday')
            : savedSettings.preferences?.start_of_week || 'monday')
        ) as 'sunday' | 'monday',
      }
      
      setSettingsData(prev => ({ ...prev, ...newSettingsData }))
      
      // Store original settings snapshot for change detection
      setOriginalSettings(JSON.parse(JSON.stringify(newSettingsData)))

      // Set profile picture preview if avatar_url exists
      if (profile?.avatar_url) {
        setProfilePicturePreview(profile.avatar_url)
      }

      setUsernameInput(profile.username || '')
      if (profile.username_last_changed_at) {
        const nextChange = new Date(profile.username_last_changed_at)
        nextChange.setHours(nextChange.getHours() + 24)
        setUsernameCooldownEnds(nextChange)
      } else {
        setUsernameCooldownEnds(null)
      }

      if (!emailRequestId) {
        setEmailNewValue(user.email || '')
        setEmailPasswordInput('')
        setEmailOtpInput('')
        setEmailStep('form')
        setEmailMessage(null)
        setEmailCodeExpiresAt(null)
      }

      // Load improve model setting from preferences
      // Check both new privacy structure and legacy root level
      const initialImproveModelEnabled = prefs.privacy?.improve_model_enabled ?? prefs.improve_model_enabled ?? false
      setImproveModelEnabled(initialImproveModelEnabled)
      setOriginalImproveModelEnabled(initialImproveModelEnabled)
    }
  }, [user, profile, theme, emailRequestId])

  // Load plans and tasks when showing delete lists
  useEffect(() => {
    if (showDeletePlansList && user) {
      loadPlans()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDeletePlansList, user])

  useEffect(() => {
    if (showDeleteTasksList && user) {
      loadTasks()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDeleteTasksList, user])

  useEffect(() => {
    if (!user && !profile) return

    // Check email confirmation status - refresh user data to ensure we have latest status
    const checkEmailStatus = async () => {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        if (currentUser) {
          setEmailConfirmed(isEmailConfirmed(currentUser))
        } else {
          setEmailConfirmed(isEmailConfirmed(user))
        }
      } catch (error) {
        console.error('Error checking email status:', error)
        // Fallback to checking the user object we have
        setEmailConfirmed(isEmailConfirmed(user))
      }
    }
    
    checkEmailStatus()
  }, [user, profile, theme])

  // Email confirmation state is derived from current user/profile; no extra auth listener needed

  // Load subscription and invoices when subscription section is active
  useEffect(() => {
    if (activeSection === 'subscription' && user?.id && !loadingSubscription) {
      loadSubscription()
    }
    if (activeSection === 'subscription' && user?.id && !loadingInvoices) {
      loadInvoices()
    }
  }, [activeSection, user?.id])

  // Also check URL params to set active section
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const section = searchParams.get('section')
    if (section && ['account', 'subscription', 'scheduling', 'privacy', 'preferences'].includes(section)) {
      setActiveSection(section)
    }
  }, [])

  // Refresh subscription if coming from upgrade (check URL params)
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const upgraded = searchParams.get('upgraded')
    if (upgraded === 'true' && activeSection === 'subscription' && user?.id) {
      // Force refresh subscription data after upgrade (bypass cache)
      // Wait a moment for webhook to process, then refresh
      setTimeout(() => {
        loadSubscription(true)
        // Clear the URL param after refresh
        const newUrl = window.location.pathname + window.location.search.replace(/[?&]upgraded=true(&|$)/, '').replace(/[?&]plan=[^&]*(&|$)/, '')
        window.history.replaceState({}, '', newUrl || window.location.pathname)
      }, 1000)
    }
  }, [activeSection, user?.id])

  const loadSubscription = async (forceRefresh = false) => {
    if (!user?.id) return
    setLoadingSubscription(true)
    try {
      // Add timestamp to force fresh fetch if needed
      const url = forceRefresh 
        ? `/api/subscription?t=${Date.now()}`
        : '/api/subscription'
      
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store', // Always fetch fresh data
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to load subscription')
      }

      const data = await response.json()
      setSubscription(data.subscription)
      
      // No need for recovery - we're querying Stripe directly now
    } catch (error) {
      console.error('Error loading subscription:', error)
      addToast({
        type: 'error',
        title: 'Load Failed',
        description: 'Failed to load subscription information.',
        duration: 5000,
      })
    } finally {
      setLoadingSubscription(false)
    }
  }

  const loadInvoices = async () => {
    if (!user?.id) return
    setLoadingInvoices(true)
    try {
      const response = await fetch('/api/subscription/invoices', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to load invoices')
      }

      const data = await response.json()
      setInvoices(data.invoices || [])
    } catch (error) {
      console.error('Error loading invoices:', error)
      addToast({
        type: 'error',
        title: 'Load Failed',
        description: 'Failed to load billing history.',
        duration: 5000,
      })
    } finally {
      setLoadingInvoices(false)
    }
  }

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will continue to have access until the end of your billing period.')) {
      return
    }

    setCancelingSubscription(true)
    try {
      const response = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to cancel subscription')
      }

      addToast({
        type: 'success',
        title: 'Subscription Canceled',
        description: 'Your subscription will be canceled at the end of the billing period.',
        duration: 5000,
      })

      // Reload subscription
      await loadSubscription()
    } catch (error: any) {
      console.error('Error canceling subscription:', error)
      addToast({
        type: 'error',
        title: 'Cancel Failed',
        description: error.message || 'Failed to cancel subscription. Please try again.',
        duration: 5000,
      })
    } finally {
      setCancelingSubscription(false)
    }
  }

  const handleManagePayment = async () => {
    setOpeningPortal(true)
    try {
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create portal session')
      }

      const { url } = await response.json()
      window.location.href = url
    } catch (error: any) {
      console.error('Error opening portal:', error)
      addToast({
        type: 'error',
        title: 'Error',
        description: error.message || 'Failed to open payment portal. Please try again.',
        duration: 5000,
      })
      setOpeningPortal(false)
    }
  }

  const handleReactivateBasicPlan = async () => {
    setReactivatingBasic(true)
    try {
      const response = await fetch('/api/stripe/assign-basic', {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to reactivate Basic plan')
      }

      addToast({
        type: 'success',
        title: 'Basic Plan Restored',
        description: 'Your Basic plan has been reactivated.',
        duration: 4000,
      })

      await loadSubscription()
    } catch (error: any) {
      console.error('Error reactivating Basic plan:', error)
      addToast({
        type: 'error',
        title: 'Unable to Reactivate',
        description: error.message || 'Please try again in a moment.',
        duration: 5000,
      })
    } finally {
      setReactivatingBasic(false)
    }
  }

  const handleUsernameUpdate = async () => {
    setUsernameMessage(null)
    const validation = validateUsername(usernameInput)
    if (!validation.valid) {
      setUsernameMessage({ type: 'error', text: validation.message || 'Invalid username' })
      return
    }

    setUsernameSaving(true)
    try {
      const response = await fetch('/api/settings/change-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Failed to update username.')
      }

      if (payload.cooldownEnds) {
        setUsernameCooldownEnds(new Date(payload.cooldownEnds))
      } else {
        setUsernameCooldownEnds(new Date(Date.now() + 24 * 60 * 60 * 1000))
      }

      setUsernameMessage({ type: 'success', text: 'Username updated successfully.' })
    } catch (error) {
      setUsernameMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to update username.',
      })
    } finally {
      setUsernameSaving(false)
    }
  }

  const handleStartEmailChange = async () => {
    setEmailMessage(null)
    const validation = validateEmail(emailNewValue)
    if (!validation.valid) {
      setEmailMessage({ type: 'error', text: validation.message || 'Invalid email address.' })
      return
    }
    if (!emailPasswordInput) {
      setEmailMessage({ type: 'error', text: 'Please enter your current password.' })
      return
    }

    setEmailSubmitting(true)
    try {
      const response = await fetch('/api/settings/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newEmail: emailNewValue,
          currentPassword: emailPasswordInput,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Failed to send verification code.')
      }

      setEmailRequestId(payload.requestId)
      setEmailCodeExpiresAt(payload.expiresAt || null)
      setEmailStep('verify')
      setEmailOtpInput('')
      setEmailMessage({
        type: 'success',
        text: `Verification code sent to ${emailNewValue}.`,
      })
    } catch (error) {
      setEmailMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to send verification code.',
      })
    } finally {
      setEmailSubmitting(false)
    }
  }

  const handleConfirmEmailChange = async () => {
    if (!emailRequestId) {
      setEmailMessage({ type: 'error', text: 'No verification request found.' })
      return
    }
    if (!emailOtpInput) {
      setEmailMessage({ type: 'error', text: 'Please enter the verification code.' })
      return
    }

    setEmailConfirming(true)
    try {
      const response = await fetch('/api/settings/confirm-email-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: emailRequestId,
          otp: emailOtpInput,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Failed to verify code.')
      }

      const updatedEmail = payload.newEmail || emailNewValue
      setSettingsData((prev) => ({ ...prev, email: updatedEmail }))
      setEmailNewValue(updatedEmail)
      setEmailPasswordInput('')
      setEmailOtpInput('')
      setEmailRequestId(null)
      setEmailStep('form')
      setEmailCodeExpiresAt(null)
      setEmailMessage({
        type: 'success',
        text: 'Email updated successfully.',
      })
      setEmailConfirmed(true)
    } catch (error) {
      setEmailMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to verify code.',
      })
    } finally {
      setEmailConfirming(false)
    }
  }

  // Change detection function
  const checkSectionChanges = (section: string): boolean => {
    if (!originalSettings) return false
    
    switch (section) {
      case 'account':
        return (
          settingsData.firstName !== originalSettings.firstName ||
          settingsData.lastName !== originalSettings.lastName ||
          settingsData.dateOfBirth !== originalSettings.dateOfBirth ||
          settingsData.phoneNumber !== originalSettings.phoneNumber
        )
      case 'workday':
        return (
          settingsData.workdayStartHour !== originalSettings.workdayStartHour ||
          settingsData.workdayEndHour !== originalSettings.workdayEndHour ||
          settingsData.lunchStartHour !== originalSettings.lunchStartHour ||
          settingsData.lunchEndHour !== originalSettings.lunchEndHour ||
          settingsData.allowWeekends !== originalSettings.allowWeekends ||
          settingsData.smartSchedulingEnabled !== originalSettings.smartSchedulingEnabled
        )
      case 'privacy':
        // improveModelEnabled is stored separately, check it against original
        return improveModelEnabled !== originalImproveModelEnabled
      case 'preferences':
        return (
          settingsData.theme !== originalSettings.theme ||
          settingsData.accentColor !== originalSettings.accentColor ||
          settingsData.timeFormat !== originalSettings.timeFormat ||
          settingsData.startOfWeek !== originalSettings.startOfWeek
        )
      default:
        return false
    }
  }

  // Update change detection when settings change
  useEffect(() => {
    if (!originalSettings) return
    
    const sections = ['account', 'workday', 'privacy', 'preferences']
    const newHasUnsavedChanges: Record<string, boolean> = {}
    
    sections.forEach(section => {
      newHasUnsavedChanges[section] = checkSectionChanges(section)
    })
    
    setHasUnsavedChanges(newHasUnsavedChanges)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsData, originalSettings, improveModelEnabled, originalImproveModelEnabled])

  // Unified save handler
  const handleUnifiedSave = async (section: string) => {
    setSavingSection(section)
    setSaving(true)
    
    try {
      switch (section) {
        case 'account': {
          const response = await fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              first_name: settingsData.firstName,
              last_name: settingsData.lastName,
              date_of_birth: settingsData.dateOfBirth || null,
              phone_number: settingsData.phoneNumber || null,
            })
          })
          
          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Failed to save account settings')
          }
          
          // Update original settings after successful save
          setOriginalSettings(prev => prev ? {
            ...prev,
            firstName: settingsData.firstName,
            lastName: settingsData.lastName,
            dateOfBirth: settingsData.dateOfBirth,
            phoneNumber: settingsData.phoneNumber,
          } : null)
          
          addToast({
            type: 'success',
            title: 'Settings Saved',
            description: 'Your account settings have been updated successfully.',
            duration: 3000
          })
          break
        }
        
        case 'workday': {
          const response = await fetch('/api/settings/workday', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              workdayStartHour: settingsData.workdayStartHour,
              workdayEndHour: settingsData.workdayEndHour,
              lunchStartHour: settingsData.lunchStartHour,
              lunchEndHour: settingsData.lunchEndHour,
              allowWeekends: settingsData.allowWeekends
            })
          })
          
          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Failed to save workday settings')
          }
          
          // Save smart scheduling separately
          const smartSchedulingResponse = await fetch('/api/settings/smart-scheduling', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: settingsData.smartSchedulingEnabled })
          })
          
          if (!smartSchedulingResponse.ok) {
            const errorData = await smartSchedulingResponse.json()
            throw new Error(errorData.error || 'Failed to save smart scheduling setting')
          }
          
          // Update original settings after successful save
          setOriginalSettings(prev => prev ? {
            ...prev,
            workdayStartHour: settingsData.workdayStartHour,
            workdayEndHour: settingsData.workdayEndHour,
            lunchStartHour: settingsData.lunchStartHour,
            lunchEndHour: settingsData.lunchEndHour,
            allowWeekends: settingsData.allowWeekends,
            smartSchedulingEnabled: settingsData.smartSchedulingEnabled,
          } : null)
          
          addToast({
            type: 'success',
            title: 'Settings Saved',
            description: 'Your workday settings have been updated successfully.',
            duration: 3000
          })
          break
        }
        
        case 'privacy': {
          // Get current preferences
          const { data: currentSettings } = await supabase
            .from('user_settings')
            .select('preferences')
            .eq('user_id', user?.id)
            .single()

          const currentPrefs = currentSettings?.preferences || {}
          
          // Update preferences with improve_model_enabled in privacy object
          const updatedPreferences = {
            ...currentPrefs,
            privacy: {
              ...(currentPrefs.privacy || {}),
              improve_model_enabled: improveModelEnabled
            }
          }
          
          // Remove legacy root-level improve_model_enabled if it exists
          if (updatedPreferences.improve_model_enabled !== undefined) {
            delete updatedPreferences.improve_model_enabled
          }

          // Update in database
          const { error } = await supabase
            .from('user_settings')
            .update({
              preferences: updatedPreferences,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', user?.id)

          if (error) {
            throw error
          }

          // Update original value after successful save
          setOriginalImproveModelEnabled(improveModelEnabled)

          addToast({
            type: 'success',
            title: improveModelEnabled ? 'Opt-in Enabled' : 'Opt-in Disabled',
            description: improveModelEnabled 
              ? 'Thank you for helping improve the model!'
              : 'You have opted out of model improvement.',
            duration: 3000
          })
          break
        }
        
        case 'preferences': {
          const settings = {
            preferences: {
              theme: settingsData.theme,
              accent_color: settingsData.accentColor,
              time_format: settingsData.timeFormat,
              start_of_week: settingsData.startOfWeek
            }
          }

          const response = await fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              first_name: settingsData.firstName,
              last_name: settingsData.lastName,
              settings: settings
            })
          })

          if (!response.ok) {
            const errorData = await response.json()
            if (response.status === 401) {
              console.error('Unauthorized when saving preferences:', errorData)
              alert('Your session may have expired. Please refresh the page and try again.')
              setSaving(false)
              setSavingSection(null)
              return
            }
            throw new Error(errorData.error || 'Failed to save preferences')
          }

          // Update original settings after successful save
          setOriginalSettings(prev => prev ? {
            ...prev,
            theme: settingsData.theme,
            accentColor: settingsData.accentColor,
            timeFormat: settingsData.timeFormat,
            startOfWeek: settingsData.startOfWeek,
          } : null)

          // Apply theme and accent color immediately after successful save
          setTheme(settingsData.theme)
          setAccentColor(settingsData.accentColor)
          
          addToast({
            type: 'success',
            title: 'Settings Saved',
            description: 'Your preferences have been updated successfully.',
            duration: 3000
          })
          break
        }
        
        default:
          throw new Error(`Unknown section: ${section}`)
      }
      
      // Reset unsaved changes for this section
      setHasUnsavedChanges(prev => ({ ...prev, [section]: false }))
      
    } catch (error: any) {
      console.error(`Error saving ${section} settings:`, error)
      addToast({
        type: 'error',
        title: 'Save Failed',
        description: error.message || `Failed to save ${section} settings. Please try again.`,
        duration: 5000
      })
    } finally {
      setSaving(false)
      setSavingSection(null)
    }
  }

  // Unified revert handler
  const handleUnifiedRevert = async (section: string) => {
    try {
      // Fetch latest settings from database
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('User not authenticated')
      }
      
      // Fetch profile and settings
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      const { data: settings } = await supabase
        .from('user_settings')
        .select('preferences')
        .eq('user_id', user.id)
        .single()
      
      const prefs = settings?.preferences || {}
      const savedSettings = profile?.settings || {}
      
      // Restore settings based on section
      switch (section) {
        case 'account': {
          setSettingsData(prev => ({
            ...prev,
            firstName: profile?.first_name || '',
            lastName: profile?.last_name || '',
            dateOfBirth: profile?.date_of_birth || '',
            phoneNumber: profile?.phone_number || '',
          }))
          break
        }
        
        case 'workday': {
          const workdaySettings = prefs.workday || {}
          setSettingsData(prev => ({
            ...prev,
            workdayStartHour: workdaySettings.workday_start_hour || savedSettings.workday?.workday_start_hour || 9,
            workdayEndHour: workdaySettings.workday_end_hour || savedSettings.workday?.workday_end_hour || 17,
            lunchStartHour: workdaySettings.lunch_start_hour || savedSettings.workday?.lunch_start_hour || 12,
            lunchEndHour: workdaySettings.lunch_end_hour || savedSettings.workday?.lunch_end_hour || 13,
            allowWeekends: workdaySettings.allow_weekends ?? savedSettings.workday?.allow_weekends ?? false,
            smartSchedulingEnabled: prefs.smart_scheduling?.enabled ?? true,
          }))
          break
        }
        
        case 'privacy': {
          const revertedValue = prefs.privacy?.improve_model_enabled ?? prefs.improve_model_enabled ?? false
          setImproveModelEnabled(revertedValue)
          setOriginalImproveModelEnabled(revertedValue)
          break
        }
        
        case 'preferences': {
          setSettingsData(prev => ({
            ...prev,
            theme: (prefs.theme || savedSettings.preferences?.theme || theme) as 'dark' | 'light' | 'system',
            accentColor: (prefs.accent_color || accentColor || 'orange') as 'default' | 'blue' | 'green' | 'yellow' | 'pink' | 'orange' | 'purple',
            timeFormat: (prefs.time_format || savedSettings.preferences?.time_format || '12h') as '12h' | '24h',
            startOfWeek: (
              (prefs.week_start_day !== undefined
                ? (prefs.week_start_day === 1 ? 'monday' : 'sunday')
                : savedSettings.preferences?.start_of_week || 'monday')
            ) as 'sunday' | 'monday',
          }))
          break
        }
      }
      
      // Update original settings to match reverted values
      setOriginalSettings(prev => prev ? JSON.parse(JSON.stringify({
        ...prev,
        ...(section === 'account' ? {
          firstName: profile?.first_name || '',
          lastName: profile?.last_name || '',
          dateOfBirth: profile?.date_of_birth || '',
          phoneNumber: profile?.phone_number || '',
        } : {}),
        ...(section === 'workday' ? {
          workdayStartHour: prefs.workday?.workday_start_hour || savedSettings.workday?.workday_start_hour || 9,
          workdayEndHour: prefs.workday?.workday_end_hour || savedSettings.workday?.workday_end_hour || 17,
          lunchStartHour: prefs.workday?.lunch_start_hour || savedSettings.workday?.lunch_start_hour || 12,
          lunchEndHour: prefs.workday?.lunch_end_hour || savedSettings.workday?.lunch_end_hour || 13,
          allowWeekends: prefs.workday?.allow_weekends ?? savedSettings.workday?.allow_weekends ?? false,
          smartSchedulingEnabled: prefs.smart_scheduling?.enabled ?? true,
        } : {}),
        ...(section === 'preferences' ? {
          theme: (prefs.theme || savedSettings.preferences?.theme || theme) as 'dark' | 'light' | 'system',
          accentColor: (prefs.accent_color || accentColor || 'orange') as 'default' | 'blue' | 'green' | 'yellow' | 'pink' | 'orange' | 'purple',
          timeFormat: (prefs.time_format || savedSettings.preferences?.time_format || '12h') as '12h' | '24h',
          startOfWeek: (
            (prefs.week_start_day !== undefined
              ? (prefs.week_start_day === 1 ? 'monday' : 'sunday')
              : savedSettings.preferences?.start_of_week || 'monday')
          ) as 'sunday' | 'monday',
        } : {}),
      })) : null)
      
      // Reset unsaved changes for this section
      setHasUnsavedChanges(prev => ({ ...prev, [section]: false }))
      
      addToast({
        type: 'success',
        title: 'Changes Reverted',
        description: `Your ${section} settings have been reverted to the last saved state.`,
        duration: 3000
      })
      
    } catch (error: any) {
      console.error(`Error reverting ${section} settings:`, error)
      addToast({
        type: 'error',
        title: 'Revert Failed',
        description: error.message || `Failed to revert ${section} settings. Please try again.`,
        duration: 5000
      })
    }
  }

  // Helper function to check if workday hours panel has changes
  const hasWorkdayHoursChanges = (): boolean => {
    if (!originalSettings) return false
    return (
      settingsData.workdayStartHour !== originalSettings.workdayStartHour ||
      settingsData.workdayEndHour !== originalSettings.workdayEndHour ||
      settingsData.lunchStartHour !== originalSettings.lunchStartHour ||
      settingsData.lunchEndHour !== originalSettings.lunchEndHour ||
      settingsData.allowWeekends !== originalSettings.allowWeekends
    )
  }

  // Helper function to check if smart scheduling panel has changes
  const hasSmartSchedulingChanges = (): boolean => {
    if (!originalSettings) return false
    return settingsData.smartSchedulingEnabled !== originalSettings.smartSchedulingEnabled
  }

  // Helper function to check if model improvement panel has changes
  const hasModelImprovementChanges = (): boolean => {
    return improveModelEnabled !== originalImproveModelEnabled
  }

  // Panel Save Button Component
  const PanelSaveButton = ({ 
    hasChanges, 
    onSave, 
    isSaving, 
    section 
  }: { 
    hasChanges: boolean
    onSave: () => void
    isSaving: boolean
    section: string
  }) => {
    return (
      <AnimatePresence>
        {hasChanges && (
          <motion.div
            key={`save-button-${section}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="pt-4 border-t border-[var(--border)] mt-4"
          >
            <button
              onClick={onSave}
              disabled={isSaving}
              className="w-full px-6 py-2.5 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium shadow-md"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    )
  }

  // Unified Save/Revert Button Component (Fixed at bottom of viewport)
  const UnifiedSaveRevertButtons = () => {
    // Determine which section to save/revert based on active section
    const targetSection = activeSection === 'subscription' ? null : activeSection
    
    // Check if the active section has unsaved changes
    const hasChanges = targetSection ? hasUnsavedChanges[targetSection] || false : false
    const isSaving = savingSection !== null
    
    if (!hasChanges || !targetSection) return null
    
    return (
      <AnimatePresence>
        <motion.div
          key={`unified-save-${targetSection}`}
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--background)]/95 backdrop-blur-md border-t border-[var(--border)] shadow-lg"
        >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--foreground)]">
                You have unsaved changes
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                Don't forget to save your changes
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleUnifiedRevert(targetSection)}
                disabled={isSaving}
                className="px-6 py-2.5 bg-[var(--accent)] border border-[var(--border)] rounded-lg text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
              >
                <X className="w-4 h-4" />
                Revert Changes
              </button>
              <button
                onClick={() => handleUnifiedSave(targetSection)}
                disabled={isSaving}
                className="px-6 py-2.5 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium shadow-md"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
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
      </motion.div>
      </AnimatePresence>
    )
  }

  // Handle preferences changes
  const handlePreferencesChange = (key: string, value: any) => {
    setSettingsData(prev => ({ ...prev, [key]: value }))
    setPreferencesChanged(true)
    setShowPreferencesSave(true)
    
    // Note: Theme and accent color are NOT applied immediately
    // They will only be applied after the user clicks "Save Changes"
    // This prevents premature theme switches that the user might want to cancel
  }

  // Save preferences only
  const handleSavePreferences = async () => {
    setSaving(true)
    try {
      const settings = {
        preferences: {
          theme: settingsData.theme,
          accent_color: settingsData.accentColor,
          time_format: settingsData.timeFormat,
          start_of_week: settingsData.startOfWeek
        }
      }

      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: settingsData.firstName,
          last_name: settingsData.lastName,
          settings: settings
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        // If unauthorized, don't throw - just log and return early
        // This prevents logout issues when theme changes
        if (response.status === 401) {
          console.error('Unauthorized when saving preferences:', errorData)
          alert('Your session may have expired. Please refresh the page and try again.')
          setSaving(false)
          return
        }
        throw new Error(errorData.error || 'Failed to save preferences')
      }

      // Get the updated profile from the response
      const result = await response.json()
      const updatedProfile = result.profile

      // Mark that we just saved to prevent useEffect from overwriting
      setJustSaved(true)

      // Update local state immediately to reflect saved values
      // Use the values we just saved, not from the response (which might be stale)
      setSettingsData(prev => ({
        ...prev,
        theme: settingsData.theme, // Use the value we just saved
        accentColor: settingsData.accentColor, // Use the value we just saved
        timeFormat: settingsData.timeFormat,
        startOfWeek: settingsData.startOfWeek
      }))

      setPreferencesChanged(false)
      setShowPreferencesSave(false)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)

      // Apply theme and accent color immediately after successful save
      // These should already be applied via handlePreferencesChange, but ensure consistency
      setTheme(settingsData.theme)
      setAccentColor(settingsData.accentColor)
      
      // Clear the justSaved flag after a short delay to allow useEffect to work normally
      setTimeout(() => {
        setJustSaved(false)
      }, 1000)
    } catch (error) {
      console.error('Error saving preferences:', error)
      alert('Failed to save preferences. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Build settings object
      const settings = {
        preferences: {
          theme: settingsData.theme,
          accent_color: settingsData.accentColor,
          time_format: settingsData.timeFormat,
          start_of_week: settingsData.startOfWeek
        }
      }

      // Save profile and settings updates
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: settingsData.firstName,
          last_name: settingsData.lastName,
          settings: settings
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        // If unauthorized, don't throw - just log and return early
        // This prevents logout issues when saving settings
        if (response.status === 401) {
          console.error('Unauthorized when saving settings:', errorData)
          alert('Your session may have expired. Please refresh the page and try again.')
          setSaving(false)
          return
        }
        throw new Error(errorData.error || 'Failed to save settings')
      }

      // Get the updated profile from the response
      const result = await response.json()
      const updatedProfile = result.profile

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)

      // Update theme if changed
      if (settingsData.theme !== theme) {
        setTheme(settingsData.theme)
      }

      // Save local preferences
      saveUserPreferences({
        timeFormat: settingsData.timeFormat,
        startOfWeek: settingsData.startOfWeek
      })

      // Wait a brief moment to ensure the database update is committed
      // This helps prevent race conditions when the page reloads
      await new Promise(resolve => setTimeout(resolve, 500))

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

    if (!confirm('Are you absolutely sure? Your account will be scheduled for deletion at the end of your current billing period. You can restore your account at any time before then by signing in.')) {
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
        throw new Error(errorData.error || 'Failed to schedule account deletion')
      }

      const data = await response.json()
      // Show the message from the API (includes scheduled deletion date)
      alert(data.message || 'Your account has been scheduled for deletion. You will retain access until the end of your billing period.')
      // Sign out the user (they can sign back in to restore)
      await handleSignOut()
    } catch (error: any) {
      console.error('Error scheduling account deletion:', error)
      alert(error.message || 'Failed to schedule account deletion. Please try again.')
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleDeleteData = async () => {
    if (deleteDataConfirmation !== 'DELETE DATA') {
      alert('Please type DELETE DATA to confirm data deletion')
      return
    }

    if (!confirm('Are you absolutely sure? This will permanently delete all your plans, tasks, and progress data. This action cannot be undone.')) {
      return
    }

    setDeletingData(true)
    try {
      const response = await fetch('/api/settings/delete-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmation: deleteDataConfirmation
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete data')
      }

      alert('All your data has been permanently deleted. Your account remains active.')
      // Refresh the page to reflect the changes
      window.location.reload()
    } catch (error: any) {
      console.error('Error deleting data:', error)
      alert(error.message || 'Failed to delete data. Please try again.')
    } finally {
      setDeletingData(false)
      setShowDeleteDataConfirm(false)
    }
  }

  const handleResendConfirmation = async () => {
    if (!user?.email) return

    setResendingConfirmation(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email
      })

      if (error) {
        // Check for SMTP/email sending errors
        const isEmailError = error.message.toLowerCase().includes('email') || 
                            error.message.toLowerCase().includes('smtp') ||
                            error.message.toLowerCase().includes('mail')
        
        addToast({
          type: 'error',
          title: 'Resend Failed',
          description: isEmailError 
            ? 'Unable to send email. Please contact support or try again later.'
            : error.message || 'Failed to resend confirmation email. Please try again.',
          duration: 7000
        })
      } else {
        addToast({
          type: 'success',
          title: 'Email Sent',
          description: 'A new confirmation code has been sent to your email. Please check your inbox.',
          duration: 5000
        })
      }
    } catch (error: any) {
      console.error('Error resending confirmation:', error)
      addToast({
        type: 'error',
        title: 'Resend Error',
        description: 'Failed to resend confirmation email. Please try again.',
        duration: 5000
      })
    } finally {
      setResendingConfirmation(false)
    }
  }

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        addToast({
          type: 'error',
          title: 'Invalid File',
          description: 'Please select an image file.',
          duration: 5000
        })
        return
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        addToast({
          type: 'error',
          title: 'File Too Large',
          description: 'Please select an image smaller than 5MB.',
          duration: 5000
        })
        return
      }

      setProfilePicture(file)
      
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setProfilePicturePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeProfilePicture = () => {
    setProfilePicture(null)
    setProfilePicturePreview(null)
  }

  const handleSaveProfile = async () => {
    if (!user) return

    setSaving(true)
    setUploadingAvatar(true)
    try {
      let avatarUrl: string | undefined = profile?.avatar_url || undefined

      // Upload profile picture if provided
      if (profilePicture && user) {
        try {
          const fileExt = profilePicture.name.split('.').pop()
          const fileName = `avatar.${fileExt}`
          const filePath = `${user.id}/${fileName}`

          // Delete existing avatar if any
          const existingFiles = await supabase.storage
            .from('avatars')
            .list(user.id)
          
          if (existingFiles.data && existingFiles.data.length > 0) {
            await supabase.storage
              .from('avatars')
              .remove([`${user.id}/${existingFiles.data[0].name}`])
          }

          // Upload new avatar
          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, profilePicture, {
              cacheControl: '3600',
              upsert: true
            })

          if (uploadError) {
            throw uploadError
          }

          // Get public URL
          const { data: urlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath)

          avatarUrl = urlData.publicUrl
        } catch (uploadError: any) {
          console.error('Avatar upload error:', uploadError)
          addToast({
            type: 'error',
            title: 'Upload Failed',
            description: 'Failed to upload profile picture. You can update it later.',
            duration: 5000
          })
          setUploadingAvatar(false)
          return
        }
      }

      // Save profile updates
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avatar_url: avatarUrl,
          first_name: settingsData.firstName.trim() || null,
          last_name: settingsData.lastName.trim() || null,
          date_of_birth: settingsData.dateOfBirth || null,
          phone_number: settingsData.phoneNumber.trim() || null,
          timezone: settingsData.timezone || null,
          locale: settingsData.locale || null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save profile')
      }

      setProfilePicture(null)
      addToast({
        type: 'success',
        title: 'Profile Updated',
        description: 'Your profile has been updated successfully.',
        duration: 3000
      })

      // Refresh the page to show updated profile
      window.location.reload()
    } catch (error: any) {
      console.error('Error saving profile:', error)
      addToast({
        type: 'error',
        title: 'Save Failed',
        description: error.message || 'Failed to save profile. Please try again.',
        duration: 5000
      })
    } finally {
      setSaving(false)
      setUploadingAvatar(false)
    }
  }

  const handleLogoutAllDevices = async () => {
    setLoggingOutAll(true)
    try {
      const response = await fetch('/api/settings/logout-all-devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to log out')
      }

      addToast({
        type: 'success',
        title: 'Logged Out',
        description: 'You have been signed out of all devices. Please sign in again.',
        duration: 3000
      })

      // Redirect to login
      setTimeout(() => {
        window.location.href = '/login'
      }, 1000)
    } catch (error: any) {
      console.error('Error logging out:', error)
      addToast({
        type: 'error',
        title: 'Logout Failed',
        description: error.message || 'Failed to log out. Please try again.',
        duration: 5000
      })
    } finally {
      setLoggingOutAll(false)
    }
  }


  const handleExportData = async (format: 'json' | 'csv' = 'json') => {
    setExportingData(true)
    try {
      const response = await fetch(`/api/settings/export-data?format=${format}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        throw new Error('Failed to export data')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const extension = format === 'csv' ? 'csv' : 'json'
      a.download = `doer-data-export-${new Date().toISOString().split('T')[0]}.${extension}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      addToast({
        type: 'success',
        title: 'Data Exported',
        description: `Your data has been exported as ${format.toUpperCase()} successfully.`,
        duration: 3000
      })
    } catch (error: any) {
      console.error('Error exporting data:', error)
      addToast({
        type: 'error',
        title: 'Export Failed',
        description: error.message || 'Failed to export data. Please try again.',
        duration: 5000
      })
    } finally {
      setExportingData(false)
    }
  }

  const loadPlans = async () => {
    setLoadingPlans(true)
    try {
      const response = await fetch('/api/plans/list')
      if (!response.ok) throw new Error('Failed to load plans')
      const data = await response.json()
      setPlans(data.plans || [])
    } catch (error) {
      console.error('Error loading plans:', error)
      addToast({
        type: 'error',
        title: 'Load Failed',
        description: 'Failed to load plans. Please try again.',
        duration: 5000
      })
    } finally {
      setLoadingPlans(false)
    }
  }

  const loadTasks = async () => {
    setLoadingTasks(true)
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setTasks(data || [])
    } catch (error: any) {
      console.error('Error loading tasks:', error)
      addToast({
        type: 'error',
        title: 'Load Failed',
        description: 'Failed to load tasks. Please try again.',
        duration: 5000
      })
    } finally {
      setLoadingTasks(false)
    }
  }

  const handleTogglePlanSelection = (planId: string) => {
    setSelectedPlans(prev => {
      const newSet = new Set(prev)
      if (newSet.has(planId)) {
        newSet.delete(planId)
      } else {
        newSet.add(planId)
      }
      return newSet
    })
  }

  const handleSelectAllPlans = () => {
    const validPlans = plans.filter(p => p?.id)
    if (selectedPlans.size === validPlans.length) {
      setSelectedPlans(new Set())
    } else {
      setSelectedPlans(new Set(validPlans.map(p => p.id)))
    }
  }

  const handleToggleTaskSelection = (taskId: string) => {
    setSelectedTasks(prev => {
      const newSet = new Set(prev)
      if (newSet.has(taskId)) {
        newSet.delete(taskId)
      } else {
        newSet.add(taskId)
      }
      return newSet
    })
  }

  const handleSelectAllTasks = () => {
    const validTasks = tasks.filter(t => t?.id)
    if (selectedTasks.size === validTasks.length) {
      setSelectedTasks(new Set())
    } else {
      setSelectedTasks(new Set(validTasks.map(t => t.id)))
    }
  }

  const handleDeleteSelectedPlans = async () => {
    if (selectedPlans.size === 0) {
      addToast({
        type: 'error',
        title: 'No Selection',
        description: 'Please select at least one plan to delete.',
        duration: 5000
      })
      return
    }

    setDeletingPlans(true)
    try {
      const response = await fetch('/api/settings/delete-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_ids: Array.from(selectedPlans) })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete plans')
      }

      addToast({
        type: 'success',
        title: 'Plans Deleted',
        description: `Successfully deleted ${selectedPlans.size} plan(s).`,
        duration: 3000
      })

      setSelectedPlans(new Set())
      setShowDeletePlansList(false)
      await loadPlans()
    } catch (error: any) {
      console.error('Error deleting plans:', error)
      addToast({
        type: 'error',
        title: 'Delete Failed',
        description: error.message || 'Failed to delete plans. Please try again.',
        duration: 5000
      })
    } finally {
      setDeletingPlans(false)
    }
  }

  const handleDeleteSelectedTasks = async () => {
    if (selectedTasks.size === 0) {
      addToast({
        type: 'error',
        title: 'No Selection',
        description: 'Please select at least one task to delete.',
        duration: 5000
      })
      return
    }

    setDeletingTasks(true)
    try {
      const response = await fetch('/api/settings/delete-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_ids: Array.from(selectedTasks) })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete tasks')
      }

      addToast({
        type: 'success',
        title: 'Tasks Deleted',
        description: `Successfully deleted ${selectedTasks.size} task(s).`,
        duration: 3000
      })

      setSelectedTasks(new Set())
      setShowDeleteTasksList(false)
      await loadTasks()
    } catch (error: any) {
      console.error('Error deleting tasks:', error)
      addToast({
        type: 'error',
        title: 'Delete Failed',
        description: error.message || 'Failed to delete tasks. Please try again.',
        duration: 5000
      })
    } finally {
      setDeletingTasks(false)
    }
  }

  const handleImproveModelToggle = (enabled: boolean) => {
    // Just update state - don't save immediately
    // Save button will handle the actual save
    setImproveModelEnabled(enabled)
  }

  const sections = [
    { id: 'account', label: 'Account', icon: User },
    { id: 'subscription', label: 'Subscription', icon: Shield },
    { id: 'workday', label: 'Scheduling', icon: Clock },
    { id: 'privacy', label: 'Privacy & Security', icon: Shield },
    { id: 'preferences', label: 'Preferences', icon: Palette },
  ]

  // Show loading state with timeout protection
  // If loading takes more than 10 seconds, show page anyway (safety timeout in hook will handle it)
  const [showLoadingFallback, setShowLoadingFallback] = useState(false)
  
  // Handle loading timeout - must be before any conditional returns
  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => {
        setShowLoadingFallback(true)
      }, 10000)
      return () => clearTimeout(timeout)
    } else {
      setShowLoadingFallback(false)
    }
  }, [loading])

  // Handle redirect if no user after timeout - must be before any conditional returns
  useEffect(() => {
    if (!user && showLoadingFallback) {
      const checkUser = async () => {
        try {
          const { data: { user: verifiedUser } } = await supabase.auth.getUser()
          if (!verifiedUser) {
            window.location.href = '/login'
          }
        } catch (error) {
          console.error('Error verifying user:', error)
          window.location.href = '/login'
        }
      }
      checkUser()
    }
  }, [user, showLoadingFallback])

  // All hooks must be called before any conditional returns
  if ((loading && !showLoadingFallback) || (!user && !showLoadingFallback)) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-[var(--foreground)]">Loading...</div>
      </div>
    )
  }
  
  if (!user && showLoadingFallback) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-[var(--foreground)]">Redirecting...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Sidebar 
        user={profile || { email: user?.email || '' }}
        onSignOut={handleSignOut}
        currentPath="/settings"
        hasPendingReschedules={hasPendingReschedules}
        emailConfirmed={emailConfirmed}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <StaggeredFadeIn>
          {/* Header */}
          <FadeInWrapper delay={0.1} direction="up">
            <div className="mb-8">
              <h1 className="text-5xl font-bold tracking-tight text-[var(--foreground)] mb-4">
                Settings
              </h1>
              <p className="text-base leading-relaxed text-[#d7d2cb]">
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
                              ? 'bg-[var(--accent)] text-[var(--foreground)] border border-[var(--border)]'
                              : 'text-[#d7d2cb] hover:text-[var(--foreground)] hover:bg-[var(--accent)]'
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
                        <CardTitle>Profile Details</CardTitle>
                        <CardDescription>Update your profile picture and display information</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Profile Picture */}
                        <div>
                          <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            Profile Picture
                          </label>
                          <div className="flex items-center space-x-4">
                            <div className="relative">
                              {profilePicturePreview ? (
                                <div className="relative">
                                  <img
                                    src={profilePicturePreview}
                                    alt="Profile preview"
                                    className="w-20 h-20 rounded-full object-cover border-2 border-[var(--border)]"
                                  />
                                  {profilePicture && (
                                    <button
                                      onClick={removeProfilePicture}
                                      className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                                    >
                                      <X className="w-3 h-3 text-white" />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div className="w-20 h-20 rounded-full bg-[var(--accent)] border-2 border-[var(--border)] flex items-center justify-center">
                                  <User className="w-10 h-10 text-[var(--muted-foreground)]" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleProfilePictureChange}
                                className="hidden"
                                id="profile-picture-input"
                              />
                              <label
                                htmlFor="profile-picture-input"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent)] border border-[var(--border)] rounded-lg text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors cursor-pointer"
                              >
                                <Upload className="w-4 h-4" />
                                {profilePicturePreview ? 'Change Picture' : 'Upload Picture'}
                              </label>
                              <p className="text-xs text-[#d7d2cb]/60 mt-1">
                                JPG, PNG or GIF. Max size 5MB.
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* First Name */}
                        <div>
                          <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            First Name
                          </label>
                          <input
                            type="text"
                            value={settingsData.firstName}
                            onChange={(e) => setSettingsData({ ...settingsData, firstName: e.target.value })}
                            placeholder="Enter your first name"
                            className="w-full px-4 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder-[#d7d2cb]/50 focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                          />
                        </div>

                        {/* Last Name */}
                        <div>
                          <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            Last Name
                          </label>
                          <input
                            type="text"
                            value={settingsData.lastName}
                            onChange={(e) => setSettingsData({ ...settingsData, lastName: e.target.value })}
                            placeholder="Enter your last name"
                            className="w-full px-4 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder-[#d7d2cb]/50 focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                          />
                        </div>

                        {/* Date of Birth */}
                        <div>
                          <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            Date of Birth
                          </label>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#d7d2cb]/40" />
                            <input
                              type="date"
                              value={settingsData.dateOfBirth}
                              onChange={(e) => setSettingsData({ ...settingsData, dateOfBirth: e.target.value })}
                              max={new Date().toISOString().split('T')[0]}
                              className="w-full pl-10 pr-4 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                            />
                          </div>
                          <p className="text-xs text-[#d7d2cb]/60 mt-1">
                            Optional - Used for age-appropriate features and personalized experiences
                          </p>
                        </div>

                        {/* Phone Number */}
                        <div>
                          <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            Phone Number
                          </label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#d7d2cb]/40" />
                            <input
                              type="tel"
                              value={settingsData.phoneNumber}
                              onChange={(e) => setSettingsData({ ...settingsData, phoneNumber: e.target.value })}
                              placeholder="+1 (555) 123-4567"
                              className="w-full pl-10 pr-4 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder-[#d7d2cb]/50 focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                            />
                            {settingsData.phoneNumber && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                {settingsData.phoneVerified ? (
                                  <div className="flex items-center gap-1 text-green-500">
                                    <CheckCircle className="w-4 h-4" />
                                    <span className="text-xs">Verified</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-orange-500">
                                    <AlertCircle className="w-4 h-4" />
                                    <span className="text-xs">Unverified</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="mt-2">
                            {settingsData.phoneNumber && !settingsData.phoneVerified && (
                              <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                                <p className="text-xs text-orange-400 mb-2">
                                  Phone verification is currently disabled. Verification will be implemented in a future update.
                                </p>
                                <button
                                  type="button"
                                  disabled
                                  className="text-xs px-3 py-1.5 bg-orange-500/20 border border-orange-500/30 rounded text-orange-400 opacity-50 cursor-not-allowed"
                                >
                                  Verify Phone Number (Coming Soon)
                                </button>
                              </div>
                            )}
                            <p className="text-xs text-[#d7d2cb]/60 mt-1">
                              Optional - Used for account recovery and security notifications. E.164 format recommended (e.g., +15551234567)
                            </p>
                          </div>
                        </div>

                        {/* Timezone */}
                        <div>
                          <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            Timezone
                          </label>
                          <select
                            value={settingsData.timezone}
                            onChange={(e) => setSettingsData({ ...settingsData, timezone: e.target.value })}
                            className="w-full px-4 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                          >
                            {/* Common Timezones First */}
                            <optgroup label="Common Timezones">
                              <option value="America/New_York">Eastern Time (US & Canada)</option>
                              <option value="America/Chicago">Central Time (US & Canada)</option>
                              <option value="America/Denver">Mountain Time (US & Canada)</option>
                              <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                              <option value="America/Phoenix">Arizona</option>
                              <option value="America/Anchorage">Alaska</option>
                              <option value="Pacific/Honolulu">Hawaii</option>
                              <option value="UTC">UTC (Coordinated Universal Time)</option>
                              <option value="Europe/London">London</option>
                              <option value="Europe/Paris">Paris</option>
                              <option value="Europe/Berlin">Berlin</option>
                              <option value="Europe/Rome">Rome</option>
                              <option value="Europe/Madrid">Madrid</option>
                              <option value="Asia/Tokyo">Tokyo</option>
                              <option value="Asia/Shanghai">Shanghai</option>
                              <option value="Asia/Hong_Kong">Hong Kong</option>
                              <option value="Asia/Singapore">Singapore</option>
                              <option value="Asia/Dubai">Dubai</option>
                              <option value="Australia/Sydney">Sydney</option>
                              <option value="Australia/Melbourne">Melbourne</option>
                              <option value="America/Toronto">Toronto</option>
                              <option value="America/Vancouver">Vancouver</option>
                              <option value="America/Mexico_City">Mexico City</option>
                              <option value="America/Sao_Paulo">São Paulo</option>
                              <option value="America/Buenos_Aires">Buenos Aires</option>
                            </optgroup>
                            {/* All Other Timezones */}
                            <optgroup label="Other Timezones">
                              {(() => {
                                try {
                                  const allTimezones = Intl.supportedValuesOf('timeZone')
                                  const commonTimezones = [
                                    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
                                    'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu', 'UTC',
                                    'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome', 'Europe/Madrid',
                                    'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Singapore', 'Asia/Dubai',
                                    'Australia/Sydney', 'Australia/Melbourne', 'America/Toronto', 'America/Vancouver',
                                    'America/Mexico_City', 'America/Sao_Paulo', 'America/Buenos_Aires'
                                  ]
                                  const otherTimezones = allTimezones.filter(tz => !commonTimezones.includes(tz))
                                  return otherTimezones.map((tz) => (
                                    <option key={tz} value={tz}>
                                      {tz.replace(/_/g, ' ')}
                                    </option>
                                  ))
                                } catch (e) {
                                  // Fallback if Intl.supportedValuesOf is not available
                                  return null
                                }
                              })()}
                            </optgroup>
                          </select>
                          <p className="text-xs text-[#d7d2cb]/60 mt-1">
                            Used for scheduling and time display. Defaults to your browser timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).
                          </p>
                        </div>

                        {/* Locale */}
                        <div>
                          <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            Language & Region
                          </label>
                          <select
                            value={settingsData.locale}
                            onChange={(e) => setSettingsData({ ...settingsData, locale: e.target.value })}
                            className="w-full px-4 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                          >
                            <option value="en-US">English (US)</option>
                            <option value="en-GB">English (UK)</option>
                            <option value="en-CA">English (Canada)</option>
                            <option value="en-AU">English (Australia)</option>
                            <option value="es-ES">Español (España)</option>
                            <option value="es-MX">Español (México)</option>
                            <option value="fr-FR">Français</option>
                            <option value="de-DE">Deutsch</option>
                            <option value="it-IT">Italiano</option>
                            <option value="pt-BR">Português (Brasil)</option>
                            <option value="ja-JP">日本語</option>
                            <option value="zh-CN">中文 (简体)</option>
                            <option value="zh-TW">中文 (繁體)</option>
                            <option value="ko-KR">한국어</option>
                          </select>
                          <p className="text-xs text-[#d7d2cb]/60 mt-1">
                            Used for date/time formatting and language preferences. Defaults to your browser locale.
                          </p>
                        </div>

                        {/* Save Button */}
                        <div className="flex justify-end pt-2">
                          <button
                            onClick={handleSaveProfile}
                            disabled={saving || uploadingAvatar}
                            className="flex items-center gap-2 px-6 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {saving || uploadingAvatar ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {uploadingAvatar ? 'Uploading...' : 'Saving...'}
                              </>
                            ) : (
                              <>
                                <Save className="w-4 h-4" />
                                Save Profile
                              </>
                            )}
                          </button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Account Information</CardTitle>
                        <CardDescription>Manage your login credentials securely</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        {!emailConfirmed && (
                          <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                            <h4 className="text-sm font-semibold text-orange-400 mb-1">
                              Email Not Confirmed
                            </h4>
                            <p className="text-xs text-[#d7d2cb]/70 mb-3">
                              Please confirm your email address to secure your account and enable all features.
                            </p>
                            <button
                              onClick={handleResendConfirmation}
                              disabled={resendingConfirmation}
                              className="text-xs px-3 py-1.5 bg-orange-500/20 border border-orange-500/30 rounded text-orange-400 hover:bg-orange-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {resendingConfirmation ? 'Sending...' : 'Resend Confirmation Email'}
                            </button>
                          </div>
                        )}

                        <div className="grid gap-5 lg:grid-cols-2">
                          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <p className="text-sm text-[var(--muted-foreground)]">Current username</p>
                                <p className="text-xl font-semibold text-[var(--foreground)]">
                                  {profile?.username ? `@${profile.username}` : 'Not set'}
                                </p>
                              </div>
                              {usernameCooldownEnds && usernameCooldownEnds.getTime() > Date.now() && (
                                <span className="text-xs text-orange-400">
                                  Next change {formatDistanceToNow(usernameCooldownEnds, { addSuffix: true })}
                                </span>
                              )}
                            </div>
                            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                              Update username
                            </label>
                            <input
                              type="text"
                              value={usernameInput}
                              onChange={(e) => setUsernameInput(e.target.value)}
                              placeholder="Choose a new username"
                              className="w-full px-4 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder-[#d7d2cb]/50 focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                            />
                            {usernameMessage && (
                              <p
                                className={`mt-2 text-xs ${
                                  usernameMessage.type === 'success' ? 'text-green-400' : 'text-red-400'
                                }`}
                              >
                                {usernameMessage.text}
                              </p>
                            )}
                            <button
                              onClick={handleUsernameUpdate}
                              disabled={usernameSaving}
                              className="mt-3 inline-flex items-center justify-center gap-2 w-full px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {usernameSaving ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Updating...
                                </>
                              ) : (
                                'Update Username'
                              )}
                            </button>
                          </div>

                          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-[var(--muted-foreground)]">Current email</p>
                                <p className="text-lg font-semibold text-[var(--foreground)] break-all">
                                  {settingsData.email || user?.email}
                                </p>
                              </div>
                              <span
                                className={`text-xs px-2 py-1 rounded-full ${
                                  emailConfirmed ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'
                                }`}
                              >
                                {emailConfirmed ? 'Verified' : 'Unverified'}
                              </span>
                            </div>

                            {emailMessage && (
                              <div
                                className={`text-xs px-3 py-2 rounded-lg ${
                                  emailMessage.type === 'success'
                                    ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                                    : 'bg-red-500/10 text-red-400 border border-red-500/30'
                                }`}
                              >
                                {emailMessage.text}
                              </div>
                            )}

                            {emailStep === 'form' ? (
                              <>
                                <div>
                                  <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                    New email address
                                  </label>
                                  <input
                                    type="email"
                                    value={emailNewValue}
                                    onChange={(e) => setEmailNewValue(e.target.value)}
                                    placeholder="you@example.com"
                                    className="w-full px-4 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder-[#d7d2cb]/50 focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                    Current password
                                  </label>
                                  <input
                                    type="password"
                                    value={emailPasswordInput}
                                    onChange={(e) => setEmailPasswordInput(e.target.value)}
                                    placeholder="Enter password"
                                    className="w-full px-4 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder-[#d7d2cb]/50 focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                                  />
                                </div>
                                <button
                                  onClick={handleStartEmailChange}
                                  disabled={emailSubmitting}
                                  className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {emailSubmitting ? (
                                    <>
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                      Sending...
                                    </>
                                  ) : (
                                    'Send Verification Code'
                                  )}
                                </button>
                              </>
                            ) : (
                              <>
                                <p className="text-xs text-[#d7d2cb]/60">
                                  Enter the verification code sent to {emailNewValue}.
                                  {emailCodeExpiresAt && (
                                    <>
                                      {' '}
                                      Code expires{' '}
                                      {formatDistanceToNow(new Date(emailCodeExpiresAt), { addSuffix: true })}.
                                    </>
                                  )}
                                </p>
                                <input
                                  type="text"
                                  value={emailOtpInput}
                                  onChange={(e) => setEmailOtpInput(e.target.value)}
                                  placeholder="000000"
                                  className="w-full px-4 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder-[#d7d2cb]/50 focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] tracking-widest text-center"
                                />
                                <div className="flex flex-col sm:flex-row gap-2">
                                  <button
                                    onClick={handleConfirmEmailChange}
                                    disabled={emailConfirming}
                                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {emailConfirming ? (
                                      <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Verifying...
                                      </>
                                    ) : (
                                      'Verify & Update Email'
                                    )}
                                  </button>
                                  <button
                                    onClick={handleStartEmailChange}
                                    className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-[var(--foreground)] hover:bg-white/20 transition-colors"
                                  >
                                    Resend Code
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
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
                          <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            Current Password
                          </label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#d7d2cb]" />
                            <input
                              type={showPassword ? 'text' : 'password'}
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                              placeholder="Enter current password"
                              className="w-full pl-10 pr-12 py-2 bg-white/5 border border-white/20 rounded-lg text-[#d7d2cb] placeholder-[#d7d2cb]/50 focus:outline-none focus:border-[#d7d2cb] focus:ring-1 focus:ring-[#d7d2cb]"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#d7d2cb] hover:text-[#d7d2cb]"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            New Password
                          </label>
                          <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Enter new password (min 6 characters)"
                            className="w-full px-4 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            Confirm New Password
                          </label>
                          <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm new password"
                            className="w-full px-4 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                          />
                        </div>

                        <button 
                          onClick={handlePasswordChange}
                          disabled={passwordSaving || !newPassword || !confirmPassword}
                            className="px-4 py-2 bg-[var(--accent)] backdrop-blur-md border border-[var(--border)] rounded-lg text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                        <CardTitle className="text-red-400">Delete Account</CardTitle>
                        <CardDescription>Permanently delete your account and all associated data</CardDescription>
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
                              <p className="text-sm text-red-400 mb-3 font-semibold">
                                ⚠️ Permanent Account Deletion
                              </p>
                              <p className="text-sm text-[#d7d2cb] mb-3">
                                This action cannot be undone. All of your data will be permanently deleted:
                              </p>
                              <ul className="text-xs text-[#d7d2cb]/80 space-y-1 mb-3 list-disc list-inside">
                                <li>All plans, tasks, and progress</li>
                                <li>All settings and preferences</li>
                                <li>Your subscription will be canceled at the end of your current billing period</li>
                                <li>You'll retain access until your paid period expires, but your account will be deleted immediately</li>
                                <li>Your billing information will be removed from Stripe after your subscription ends</li>
                                <li>Financial transaction records are retained by Stripe for legal compliance</li>
                              </ul>
                              <p className="text-xs text-[#d7d2cb]/60">
                                Type <span className="font-bold text-red-400">DELETE</span> to confirm
                              </p>
                            </div>
                            <input
                              type="text"
                              value={deleteConfirmation}
                              onChange={(e) => setDeleteConfirmation(e.target.value)}
                              placeholder="Type DELETE to confirm"
                              className="w-full px-4 py-2 bg-white/5 border border-red-500/30 rounded-lg text-[#d7d2cb] placeholder-[#d7d2cb]/50 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
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

                {/* Subscription Settings */}
                {activeSection === 'subscription' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <Card>
                      <CardHeader>
                        <CardTitle>Subscription</CardTitle>
                        <CardDescription>Manage your subscription and billing</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {loadingSubscription ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-[#ff7f00]" />
                          </div>
                        ) : subscription ? (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                Current Plan
                              </label>
                              <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <p className="text-lg font-semibold text-[#d7d2cb]">
                                      {subscription.planDetails.name} - {subscription.billingCycle === 'monthly' ? 'Monthly' : 'Annual'}
                                    </p>
                                    <p className="text-sm text-[#d7d2cb]/60 mt-1">
                                      Status: <span className={`${
                                        subscription.status === 'active' 
                                          ? 'text-green-400' 
                                          : (subscription.status === 'trialing' && !subscription.cancelAtPeriodEnd)
                                            ? 'text-blue-400' 
                                            : (subscription.status === 'trialing' && subscription.cancelAtPeriodEnd)
                                              ? 'text-orange-400'
                                              : subscription.status === 'past_due' 
                                                ? 'text-orange-400' 
                                                : 'text-red-400'
                                      }`}>
                                        {subscription.status === 'active' 
                                          ? 'Active' 
                                          : (subscription.status === 'trialing' && subscription.cancelAtPeriodEnd)
                                            ? 'Trial Canceled'
                                            : subscription.status === 'trialing' 
                                              ? 'Trialing' 
                                              : subscription.status === 'past_due' 
                                                ? 'Past Due' 
                                                : 'Canceled'}
                                      </span>
                                    </p>
                                    {subscription.status === 'trialing' && !subscription.cancelAtPeriodEnd && (
                                      <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                                        <div className="flex items-start gap-2">
                                          <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                                          <p className="text-xs text-[#d7d2cb]/70 flex-1">
                                            Your 14-day free trial ends on{' '}
                                            <span className="font-semibold text-[#d7d2cb]">
                                              {subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', {
                                                month: 'long',
                                                day: 'numeric',
                                                year: 'numeric'
                                              }) : 'Invalid Date'}
                                            </span>
                                            . After the trial ends, you'll be charged $20/month and your billing cycle will begin.
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                    {subscription.cancelAtPeriodEnd && (
                                      <div className="mt-3 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                                        <div className="flex items-start gap-2">
                                          <AlertCircle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                                          <p className="text-xs text-[#d7d2cb]/70 flex-1">
                                            {subscription.status === 'trialing' 
                                              ? subscription.currentPeriodEnd 
                                                ? `Your trial will continue until ${new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. After the trial ends, you'll be downgraded to the Basic plan and will not be charged.`
                                                : `Your trial has been canceled. After the trial ends, you'll be downgraded to the Basic plan and will not be charged.`
                                              : subscription.currentPeriodEnd
                                                ? `Your subscription will end on ${new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. You will not be charged again, and you'll continue to have access until then.`
                                                : `Your subscription has been canceled. You will not be charged again.`
                                            }
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <div className="ml-4 flex-shrink-0">
                                    <PlanManagementDropdown
                                      onUpgrade={() => window.location.href = '/pricing'}
                                      onCancel={handleCancelSubscription}
                                      onManagePayment={handleManagePayment}
                                      isCanceling={cancelingSubscription}
                                      isOpeningPortal={openingPortal}
                                      showCancel={!(subscription.planSlug === 'basic' && subscription.billingCycle === 'monthly')}
                                      showManagePayment={!(subscription.planSlug === 'basic' && subscription.billingCycle === 'monthly')}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {hasPaidBillingPeriod && (
                              <>
                                <div>
                                  <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                    Next Charge Date
                                  </label>
                                  <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb]">
                                    {subscription.currentPeriodEnd
                                      ? new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', {
                                          month: 'long',
                                          day: 'numeric',
                                          year: 'numeric'
                                        })
                                      : 'N/A'}
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                      Current Period Start
                                    </label>
                                    <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb]">
                                      {currentPeriodStartLabel}
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                      Current Period End
                                    </label>
                                    <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb]">
                                      {currentPeriodEndLabel}
                                    </div>
                                  </div>
                                </div>
                              </>
                            )}

                            <div>
                              <label className="block text-sm font-medium text-[var(--foreground)] mb-4">
                                Billing History
                              </label>
                              {loadingInvoices ? (
                                <div className="flex items-center justify-center py-8">
                                  <Loader2 className="w-6 h-6 animate-spin text-[#ff7f00]" />
                                </div>
                              ) : invoices.length === 0 ? (
                                <div className="px-4 py-8 bg-white/5 border border-white/10 rounded-lg text-center">
                                  <FileText className="w-8 h-8 text-[#d7d2cb]/40 mx-auto mb-2" />
                                  <p className="text-[#d7d2cb]/70">No invoices found</p>
                                </div>
                              ) : (
                                <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
                                  <div className="overflow-x-auto">
                                    <table className="w-full">
                                      <thead className="bg-white/5 border-b border-white/10">
                                        <tr>
                                          <th className="px-4 py-3 text-left text-xs font-medium text-[#d7d2cb]/70 uppercase tracking-wider">
                                            Date
                                          </th>
                                          <th className="px-4 py-3 text-left text-xs font-medium text-[#d7d2cb]/70 uppercase tracking-wider">
                                            Amount
                                          </th>
                                          <th className="px-4 py-3 text-left text-xs font-medium text-[#d7d2cb]/70 uppercase tracking-wider">
                                            Invoice #
                                          </th>
                                          <th className="px-4 py-3 text-left text-xs font-medium text-[#d7d2cb]/70 uppercase tracking-wider">
                                            Status
                                          </th>
                                          <th className="px-4 py-3 text-right text-xs font-medium text-[#d7d2cb]/70 uppercase tracking-wider">
                                            Action
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-white/10">
                                        {invoices.map((invoice) => {
                                          const statusColor =
                                            invoice.status === 'paid'
                                              ? 'text-green-400'
                                              : invoice.status === 'open'
                                                ? 'text-yellow-400'
                                                : invoice.status === 'void'
                                                  ? 'text-gray-400'
                                                  : 'text-red-400'
                                          
                                          const statusLabel =
                                            invoice.status === 'paid'
                                              ? 'Paid'
                                              : invoice.status === 'open'
                                                ? 'Open'
                                                : invoice.status === 'void'
                                                  ? 'Void'
                                                  : 'Failed'

                                          const formattedDate = invoice.date
                                            ? new Date(invoice.date).toLocaleDateString('en-US', {
                                                month: 'long',
                                                day: 'numeric',
                                                year: 'numeric'
                                              })
                                            : 'N/A'

                                          const formattedAmount = invoice.amount
                                            ? invoice.amount.toLocaleString('en-US', {
                                                style: 'currency',
                                                currency: invoice.currency || 'USD'
                                              })
                                            : '$0.00'

                                          return (
                                            <tr key={invoice.id} className="hover:bg-white/5">
                                              <td className="px-4 py-3 text-sm text-[#d7d2cb]">
                                                {formattedDate}
                                              </td>
                                              <td className="px-4 py-3 text-sm text-[#d7d2cb]">
                                                {formattedAmount}
                                              </td>
                                              <td className="px-4 py-3 text-sm text-[#d7d2cb]">
                                                {invoice.number || 'N/A'}
                                              </td>
                                              <td className="px-4 py-3 text-sm">
                                                <span className={statusColor}>
                                                  {statusLabel}
                                                </span>
                                              </td>
                                              <td className="px-4 py-3 text-sm text-right">
                                                {invoice.invoicePdf ? (
                                                  <a
                                                    href={invoice.invoicePdf}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-[#ff7f00] hover:text-[#ff9f40] transition-colors"
                                                  >
                                                    <Download className="w-4 h-4" />
                                                    Download
                                                  </a>
                                                ) : (
                                                  <span className="text-[#d7d2cb]/40">N/A</span>
                                                )}
                                              </td>
                                            </tr>
                                          )
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </div>

                          </div>
                        ) : (
                          <div className="text-center py-8 space-y-4">
                            <CreditCard className="w-12 h-12 text-[#d7d2cb]/40 mx-auto" />
                            <div>
                              <p className="text-[#d7d2cb] font-semibold">No active subscription</p>
                              <p className="text-sm text-[#d7d2cb]/70 mt-1">
                                Restore the Basic plan to keep using DOER or explore paid plans for more capacity.
                              </p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                              <Button
                                onClick={() => window.location.href = '/pricing'}
                                variant="primary"
                              >
                                View Paid Plans
                              </Button>
                              <Button
                                onClick={handleReactivateBasicPlan}
                                disabled={reactivatingBasic}
                                variant="secondary"
                              >
                                {reactivatingBasic ? 'Restoring Basic...' : 'Restore Basic Plan'}
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Workday & Scheduling */}
                {activeSection === 'workday' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <Card>
                      <CardHeader>
                        <CardTitle>Workday Hours</CardTitle>
                        <CardDescription>Configure your daily work schedule for optimal task scheduling</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                              Workday Start
                            </label>
                            <input
                              type="time"
                              value={`${settingsData.workdayStartHour.toString().padStart(2, '0')}:00`}
                              onChange={(e) => {
                                const hour = parseInt(e.target.value.split(':')[0])
                                setSettingsData({ ...settingsData, workdayStartHour: hour })
                              }}
                              className="w-full px-4 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                              Workday End
                            </label>
                            <input
                              type="time"
                              value={`${settingsData.workdayEndHour.toString().padStart(2, '0')}:00`}
                              onChange={(e) => {
                                const hour = parseInt(e.target.value.split(':')[0])
                                setSettingsData({ ...settingsData, workdayEndHour: hour })
                              }}
                              className="w-full px-4 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                              Lunch Start
                            </label>
                            <input
                              type="time"
                              value={`${settingsData.lunchStartHour.toString().padStart(2, '0')}:00`}
                              onChange={(e) => {
                                const hour = parseInt(e.target.value.split(':')[0])
                                setSettingsData({ ...settingsData, lunchStartHour: hour })
                              }}
                              className="w-full px-4 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                              Lunch End
                            </label>
                            <input
                              type="time"
                              value={`${settingsData.lunchEndHour.toString().padStart(2, '0')}:00`}
                              onChange={(e) => {
                                const hour = parseInt(e.target.value.split(':')[0])
                                setSettingsData({ ...settingsData, lunchEndHour: hour })
                              }}
                              className="w-full px-4 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                            />
                          </div>
                        </div>
                        
                        {/* Weekend Scheduling Toggle */}
                        <div className="flex items-center justify-between p-4 bg-white/5 border border-white/20 rounded-lg">
                          <div>
                            <p className="text-sm font-medium text-[var(--foreground)]">Include Weekends in Scheduling</p>
                            <p className="text-xs text-[#d7d2cb]/60">Allow tasks to be scheduled on weekends (Saturday and Sunday)</p>
                          </div>
                          <button
                            onClick={() => {
                              setSettingsData({ ...settingsData, allowWeekends: !settingsData.allowWeekends })
                            }}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 focus:ring-offset-transparent ${
                              settingsData.allowWeekends ? 'bg-[var(--primary)]' : 'bg-[var(--accent)]'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                                settingsData.allowWeekends ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                        <PanelSaveButton
                          hasChanges={hasWorkdayHoursChanges()}
                          onSave={() => handleUnifiedSave('workday')}
                          isSaving={savingSection === 'workday' && saving}
                          section="workday"
                        />
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Smart Scheduling */}
                {activeSection === 'workday' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6 mt-6"
                  >
                    <Card>
                      <CardHeader>
                        <CardTitle>Smart Scheduling</CardTitle>
                        <CardDescription>Configure automatic scheduling and rescheduling features</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-white/5 border border-white/20 rounded-lg">
                          <div>
                            <p className="text-sm font-medium text-[var(--foreground)]">Enable Smart Scheduling</p>
                            <p className="text-xs text-[#d7d2cb]/60">Allow AI to automatically reschedule tasks when needed</p>
                          </div>
                          <button
                            onClick={() => {
                              const newValue = !settingsData.smartSchedulingEnabled
                              setSettingsData({ ...settingsData, smartSchedulingEnabled: newValue })
                              // Don't save immediately - let unified save button handle it
                            }}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 focus:ring-offset-transparent ${
                              settingsData.smartSchedulingEnabled ? 'bg-[var(--primary)]' : 'bg-[var(--accent)]'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                                settingsData.smartSchedulingEnabled ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                        <PanelSaveButton
                          hasChanges={hasSmartSchedulingChanges()}
                          onSave={() => handleUnifiedSave('workday')}
                          isSaving={savingSection === 'workday' && saving}
                          section="workday"
                        />
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
                        <CardTitle>Session Management</CardTitle>
                        <CardDescription>Manage your active sessions and devices</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <button
                          onClick={handleLogoutAllDevices}
                          disabled={loggingOutAll}
                          className="w-full px-4 py-2 bg-[var(--accent)] border border-[var(--border)] rounded-lg text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {loggingOutAll ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Logging Out...
                            </>
                          ) : (
                            <>
                              <LogOut className="w-4 h-4" />
                              Log Out of All Devices
                            </>
                          )}
                        </button>
                        <p className="text-xs text-[#d7d2cb]/60 mt-2">
                          This will sign you out of all devices and sessions. You'll need to sign in again.
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Model Improvement</CardTitle>
                        <CardDescription>Help improve the AI model for everyone</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between p-4 bg-white/5 border border-white/20 rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-[var(--foreground)] mb-1">Improve the Model for Everyone</p>
                            <p className="text-xs text-[#d7d2cb]/60">
                              Allow your anonymized usage data to help improve the AI model (optional)
                            </p>
                          </div>
                          <button
                            onClick={() => handleImproveModelToggle(!improveModelEnabled)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 focus:ring-offset-transparent ${
                              improveModelEnabled ? 'bg-[var(--primary)]' : 'bg-[var(--accent)]'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                                improveModelEnabled ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                        <PanelSaveButton
                          hasChanges={hasModelImprovementChanges()}
                          onSave={() => handleUnifiedSave('privacy')}
                          isSaving={savingSection === 'privacy' && saving}
                          section="privacy"
                        />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Data Management</CardTitle>
                        <CardDescription>Manage and export your data</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Data Export */}
                        <div>
                          <h4 className="text-sm font-medium text-[var(--foreground)] mb-3">Data Export</h4>
                          <div className="space-y-2">
                            <button
                              onClick={() => handleExportData('json')}
                              disabled={exportingData}
                              className="w-full px-4 py-2 bg-[var(--accent)] border border-[var(--border)] rounded-lg text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                              {exportingData ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Exporting...
                                </>
                              ) : (
                                <>
                                  <FileText className="w-4 h-4" />
                                  Export as JSON
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => handleExportData('csv')}
                              disabled={exportingData}
                              className="w-full px-4 py-2 bg-[var(--accent)] border border-[var(--border)] rounded-lg text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                              {exportingData ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Exporting...
                                </>
                              ) : (
                                <>
                                  <FileSpreadsheet className="w-4 h-4" />
                                  Export as CSV
                                </>
                              )}
                            </button>
                          </div>
                          <p className="text-xs text-[#d7d2cb]/60 mt-2">
                            Download all your data including plans, tasks, and settings.
                          </p>
                        </div>

                        {/* Delete Plans */}
                        <div className="border-t border-white/10 pt-6">
                          <h4 className="text-sm font-medium text-[var(--foreground)] mb-3">Delete Plans</h4>
                          {!showDeletePlansList ? (
                            <button 
                              onClick={() => {
                                setShowDeletePlansList(true)
                                loadPlans()
                              }}
                              className="px-4 py-2 bg-orange-500/20 border border-orange-500/30 rounded-lg text-orange-400 hover:bg-orange-500/30 transition-colors flex items-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              Select Plans to Delete
                            </button>
                          ) : (
                            <div className="space-y-4">
                              {loadingPlans ? (
                                <div className="text-center py-8 text-[var(--muted-foreground)]">
                                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                  <p>Loading plans...</p>
                                </div>
                              ) : plans.length === 0 ? (
                                <div className="text-center py-8 text-[var(--muted-foreground)]">
                                  <p>No plans found.</p>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center justify-between mb-3">
                                    <button
                                      onClick={handleSelectAllPlans}
                                      className="flex items-center gap-2 text-sm text-[var(--foreground)] hover:text-[var(--primary)] transition-colors"
                                    >
                                      {(() => {
                                        const validPlans = plans.filter(p => p?.id)
                                        return selectedPlans.size === validPlans.length && validPlans.length > 0 ? (
                                          <CheckSquare className="w-4 h-4" />
                                        ) : (
                                          <Square className="w-4 h-4" />
                                        )
                                      })()}
                                      <span>Select All</span>
                                    </button>
                                    <span className="text-xs text-[var(--muted-foreground)]">
                                      {selectedPlans.size} of {plans.filter(p => p?.id).length} selected
                                    </span>
                                  </div>
                                  <div className="max-h-64 overflow-y-auto space-y-2 border border-white/10 rounded-lg p-3">
                                    {plans.filter(plan => plan?.id).map((plan) => {
                                      const isSelected = selectedPlans.has(plan.id)
                                      const planTitle = plan.goal_text || plan.summary_data?.goal_title || 'Untitled Plan'
                                      return (
                                        <div
                                          key={plan.id}
                                          onClick={() => handleTogglePlanSelection(plan.id)}
                                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                            isSelected
                                              ? 'bg-orange-500/20 border-orange-500/30'
                                              : 'bg-white/5 border-white/10 hover:bg-white/10'
                                          }`}
                                        >
                                          {isSelected ? (
                                            <CheckSquare className="w-5 h-5 text-orange-400 flex-shrink-0" />
                                          ) : (
                                            <Square className="w-5 h-5 text-[var(--muted-foreground)] flex-shrink-0" />
                                          )}
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-[var(--foreground)] truncate">{planTitle}</p>
                                            <p className="text-xs text-[var(--muted-foreground)]">
                                              {plan.status || 'unknown'} • Created {plan.created_at ? new Date(plan.created_at).toLocaleDateString() : 'Unknown date'}
                                            </p>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                  <div className="flex gap-3">
                                    <button
                                      onClick={() => {
                                        setShowDeletePlansList(false)
                                        setSelectedPlans(new Set())
                                      }}
                                      className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-[#d7d2cb] hover:bg-white/20 transition-colors"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={handleDeleteSelectedPlans}
                                      disabled={selectedPlans.size === 0 || deletingPlans}
                                      className="flex-1 px-4 py-2 bg-orange-500/20 border border-orange-500/30 rounded-lg text-orange-400 hover:bg-orange-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                      {deletingPlans ? (
                                        <>
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                          Deleting...
                                        </>
                                      ) : (
                                        <>
                                          <Trash2 className="w-4 h-4" />
                                          Delete Selected ({selectedPlans.size})
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Delete Tasks */}
                        <div className="border-t border-white/10 pt-6">
                          <h4 className="text-sm font-medium text-[var(--foreground)] mb-3">Delete Tasks</h4>
                          {!showDeleteTasksList ? (
                            <button 
                              onClick={() => {
                                setShowDeleteTasksList(true)
                                loadTasks()
                              }}
                              className="px-4 py-2 bg-orange-500/20 border border-orange-500/30 rounded-lg text-orange-400 hover:bg-orange-500/30 transition-colors flex items-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              Select Tasks to Delete
                            </button>
                          ) : (
                            <div className="space-y-4">
                              {loadingTasks ? (
                                <div className="text-center py-8 text-[var(--muted-foreground)]">
                                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                  <p>Loading tasks...</p>
                                </div>
                              ) : tasks.length === 0 ? (
                                <div className="text-center py-8 text-[var(--muted-foreground)]">
                                  <p>No tasks found.</p>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center justify-between mb-3">
                                    <button
                                      onClick={handleSelectAllTasks}
                                      className="flex items-center gap-2 text-sm text-[var(--foreground)] hover:text-[var(--primary)] transition-colors"
                                    >
                                      {(() => {
                                        const validTasks = tasks.filter(t => t?.id)
                                        return selectedTasks.size === validTasks.length && validTasks.length > 0 ? (
                                          <CheckSquare className="w-4 h-4" />
                                        ) : (
                                          <Square className="w-4 h-4" />
                                        )
                                      })()}
                                      <span>Select All</span>
                                    </button>
                                    <span className="text-xs text-[var(--muted-foreground)]">
                                      {selectedTasks.size} of {tasks.filter(t => t?.id).length} selected
                                    </span>
                                  </div>
                                  <div className="max-h-64 overflow-y-auto space-y-2 border border-white/10 rounded-lg p-3">
                                    {tasks.filter(task => task?.id).map((task) => {
                                      const isSelected = selectedTasks.has(task.id)
                                      return (
                                        <div
                                          key={task.id}
                                          onClick={() => handleToggleTaskSelection(task.id)}
                                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                            isSelected
                                              ? 'bg-orange-500/20 border-orange-500/30'
                                              : 'bg-white/5 border-white/10 hover:bg-white/10'
                                          }`}
                                        >
                                          {isSelected ? (
                                            <CheckSquare className="w-5 h-5 text-orange-400 flex-shrink-0" />
                                          ) : (
                                            <Square className="w-5 h-5 text-[var(--muted-foreground)] flex-shrink-0" />
                                          )}
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-[var(--foreground)] truncate">{task.name || 'Unnamed Task'}</p>
                                            <p className="text-xs text-[var(--muted-foreground)]">
                                              Created {task.created_at ? new Date(task.created_at).toLocaleDateString() : 'Unknown date'}
                                            </p>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                  <div className="flex gap-3">
                                    <button
                                      onClick={() => {
                                        setShowDeleteTasksList(false)
                                        setSelectedTasks(new Set())
                                      }}
                                      className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-[#d7d2cb] hover:bg-white/20 transition-colors"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={handleDeleteSelectedTasks}
                                      disabled={selectedTasks.size === 0 || deletingTasks}
                                      className="flex-1 px-4 py-2 bg-orange-500/20 border border-orange-500/30 rounded-lg text-orange-400 hover:bg-orange-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                      {deletingTasks ? (
                                        <>
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                          Deleting...
                                        </>
                                      ) : (
                                        <>
                                          <Trash2 className="w-4 h-4" />
                                          Delete Selected ({selectedTasks.size})
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Delete All Data */}
                        <div className="border-t border-white/10 pt-6">
                          <h4 className="text-sm font-medium text-red-400 mb-3">Delete All Data</h4>
                          <p className="text-xs text-[var(--muted-foreground)] mb-3">
                            Permanently delete all your data but keep your account
                          </p>
                          {!showDeleteDataConfirm ? (
                            <button 
                              onClick={() => setShowDeleteDataConfirm(true)}
                              className="px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/30 transition-colors flex items-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete All My Data
                            </button>
                          ) : (
                            <div className="space-y-4">
                              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                                <p className="text-sm text-red-400 mb-2">
                                  ⚠️ This will permanently delete all your plans, tasks, progress data, and settings. Your account will remain active.
                                </p>
                                <p className="text-xs text-[#d7d2cb]/60">
                                  Type <span className="font-bold text-red-400">DELETE DATA</span> to confirm
                                </p>
                              </div>
                              <input
                                type="text"
                                value={deleteDataConfirmation}
                                onChange={(e) => setDeleteDataConfirmation(e.target.value)}
                                placeholder="Type DELETE DATA to confirm"
                                className="w-full px-4 py-2 bg-white/5 border border-red-500/30 rounded-lg text-[#d7d2cb] placeholder-[#d7d2cb]/40 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                              />
                              <div className="flex gap-3">
                                <button
                                  onClick={() => {
                                    setShowDeleteDataConfirm(false)
                                    setDeleteDataConfirmation('')
                                  }}
                                  className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-[#d7d2cb] hover:bg-white/20 transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={handleDeleteData}
                                  disabled={deletingData || deleteDataConfirmation !== 'DELETE DATA'}
                                  className="flex-1 px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                  {deletingData ? (
                                    <>
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                      Deleting...
                                    </>
                                  ) : (
                                    <>
                                      <Trash2 className="w-4 h-4" />
                                      Delete My Data
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Cookie Management */}
                    <CookieManagement />
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
                          <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            Appearance
                          </label>
                          <select
                            value={settingsData.theme}
                            onChange={(e) => handlePreferencesChange('theme', e.target.value as 'dark' | 'light' | 'system')}
                            className="w-full px-4 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                          >
                            <option value="dark">Dark</option>
                            <option value="light">Light</option>
                            <option value="system">System</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            Accent color
                          </label>
                          <AccentColorSelect
                            value={settingsData.accentColor}
                            onChange={(color) => handlePreferencesChange('accentColor', color)}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            Time Format
                          </label>
                          <select
                            value={settingsData.timeFormat}
                            onChange={(e) => handlePreferencesChange('timeFormat', e.target.value as '12h' | '24h')}
                            className="w-full px-4 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                          >
                            <option value="12h">12-hour</option>
                            <option value="24h">24-hour</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            Start of Week
                          </label>
                          <select
                            value={settingsData.startOfWeek}
                            onChange={(e) => handlePreferencesChange('startOfWeek', e.target.value as 'sunday' | 'monday')}
                            className="w-full px-4 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                          >
                            <option value="sunday">Sunday</option>
                            <option value="monday">Monday</option>
                          </select>
                        </div>
                        <PanelSaveButton
                          hasChanges={hasUnsavedChanges.preferences || false}
                          onSave={() => handleUnifiedSave('preferences')}
                          isSaving={savingSection === 'preferences' && saving}
                          section="preferences"
                        />
                      </CardContent>
                    </Card>
                  </motion.div>
                )}


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
        currentPlanTitle={roadmapData?.plan?.summary_data?.goal_title || roadmapData?.plan?.goal_text}
        onPlanChanged={() => {
          // Refetch roadmap data when plan is switched/changed
          refetch()
        }}
      />

      {/* Unified Save/Revert Buttons */}
      <UnifiedSaveRevertButtons />
    </div>
  )
}






