'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { signOutClient } from '@/lib/auth/sign-out-client'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Clock, AlertCircle, CheckCircle } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'

export default function AccountRestorePage() {
  const [scheduledDeletionAt, setScheduledDeletionAt] = useState<string | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<{
    days: number
    hours: number
    minutes: number
    seconds: number
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRestoring, setIsRestoring] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()
  const { addToast } = useToast()

  useEffect(() => {
    const fetchScheduledDeletion = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          router.push('/login')
          return
        }

        const { data: userSettings, error } = await supabase
          .from('user_settings')
          .select('scheduled_deletion_at')
          .eq('user_id', user.id)
          .maybeSingle()

        if (error) {
          console.error('Error fetching scheduled deletion:', error)
          addToast({
            type: 'error',
            title: 'Error',
            description: 'Failed to load account information.',
            duration: 5000,
          })
          setIsLoading(false)
          return
        }

        if (!userSettings?.scheduled_deletion_at) {
          // No scheduled deletion, redirect to dashboard
          router.push('/dashboard')
          return
        }

        setScheduledDeletionAt(userSettings.scheduled_deletion_at)
        setIsLoading(false)
      } catch (error) {
        console.error('Error in fetchScheduledDeletion:', error)
        setIsLoading(false)
      }
    }

    fetchScheduledDeletion()
  }, [router, addToast])

  useEffect(() => {
    if (!scheduledDeletionAt) return

    const updateTimeRemaining = () => {
      const now = new Date()
      const deletionDate = new Date(scheduledDeletionAt)
      const diff = deletionDate.getTime() - now.getTime()

      if (diff <= 0) {
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 })
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      setTimeRemaining({ days, hours, minutes, seconds })
    }

    updateTimeRemaining()
    const interval = setInterval(updateTimeRemaining, 1000)

    return () => clearInterval(interval)
  }, [scheduledDeletionAt])

  const handleRestore = async () => {
    setIsRestoring(true)
    try {
      const response = await fetch('/api/account/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to restore account')
      }

      addToast({
        type: 'success',
        title: 'Account Restored',
        description: 'Your account has been successfully restored. You can continue using DOER.',
        duration: 5000,
      })

      // Redirect to dashboard
      router.push('/dashboard')
    } catch (error) {
      console.error('Error restoring account:', error)
      addToast({
        type: 'error',
        title: 'Restore Failed',
        description: error instanceof Error ? error.message : 'Failed to restore account. Please try again.',
        duration: 5000,
      })
      setIsRestoring(false)
    }
  }

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await signOutClient(supabase)
      router.push('/')
    } catch (error) {
      console.error('Error signing out:', error)
      // Even if sign out fails, redirect to home
      router.push('/')
    }
  }

  const handleDeleteNow = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch('/api/account/delete-immediate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'DELETE' }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete account')
      }

      // Account has been deleted, sign out and redirect
      addToast({
        type: 'success',
        title: 'Account Deleted',
        description: 'Your account has been deleted immediately.',
        duration: 5000,
      })

      // Sign out and redirect to home
      try {
        await signOutClient(supabase)
      } catch (signOutError) {
        console.error('Error signing out after deletion:', signOutError)
      }
      router.push('/')
    } catch (error) {
      console.error('Error deleting account:', error)
      addToast({
        type: 'error',
        title: 'Deletion Failed',
        description: error instanceof Error ? error.message : 'Failed to delete account. Please try again.',
        duration: 5000,
      })
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff7f00] mx-auto mb-4"></div>
          <p className="text-[#d7d2cb]">Loading...</p>
        </div>
      </div>
    )
  }

  if (!scheduledDeletionAt) {
    return null // Will redirect
  }

  const deletionDate = new Date(scheduledDeletionAt)
  const deletionDateFormatted = deletionDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <Card className="glass-panel">
          <CardHeader>
            <div className="flex items-center justify-center mb-4">
              <AlertCircle className="w-12 h-12 text-orange-400" />
            </div>
            <CardTitle className="text-center text-2xl text-[#d7d2cb]">
              Account Scheduled for Deletion
            </CardTitle>
            <CardDescription className="text-center text-sm text-[#d7d2cb]/80 mt-2">
              Your account is scheduled to be deleted on {deletionDateFormatted}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Countdown Timer */}
            {timeRemaining && (
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <Clock className="w-5 h-5 text-orange-400 mr-2" />
                  <p className="text-sm font-semibold text-orange-400">
                    Time Remaining
                  </p>
                </div>
                <div className="text-3xl font-bold text-[#d7d2cb] mb-2">
                  {timeRemaining.days > 0 && `${timeRemaining.days}d `}
                  {timeRemaining.hours > 0 && `${timeRemaining.hours}h `}
                  {timeRemaining.minutes > 0 && `${timeRemaining.minutes}m `}
                  {timeRemaining.seconds}s
                </div>
                <p className="text-xs text-[#d7d2cb]/60">
                  Your account will be deleted in{' '}
                  {timeRemaining.days > 0 && `${timeRemaining.days} day${timeRemaining.days !== 1 ? 's' : ''}, `}
                  {timeRemaining.hours > 0 && `${timeRemaining.hours} hour${timeRemaining.hours !== 1 ? 's' : ''}, `}
                  {timeRemaining.minutes > 0 && `${timeRemaining.minutes} minute${timeRemaining.minutes !== 1 ? 's' : ''}`}
                  {timeRemaining.days === 0 && timeRemaining.hours === 0 && timeRemaining.minutes === 0 && ' less than a minute'}
                </p>
              </div>
            )}

            {/* Warning Message */}
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
              <p className="text-sm text-[#d7d2cb]">
                Your account and all associated data will be permanently deleted on{' '}
                <span className="font-semibold">{deletionDateFormatted}</span>. This action cannot be undone after the deletion date.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                onClick={handleRestore}
                disabled={isRestoring || isSigningOut}
                className="w-full"
                variant="primary"
              >
                {isRestoring ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Restoring...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Restore Account
                  </>
                )}
              </Button>
              <Button
                onClick={handleSignOut}
                disabled={isRestoring || isSigningOut}
                className="w-full"
                variant="outline"
              >
                {isSigningOut ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#d7d2cb] mr-2"></div>
                    Signing Out...
                  </>
                ) : (
                  'Sign Out'
                )}
              </Button>
            </div>

            {/* Info Message */}
            <p className="text-xs text-center text-[#d7d2cb]/60">
              If you restore your account, your subscription cancellation will remain scheduled, but you can continue using DOER until the end of your billing period.
            </p>

            {/* Delete Account Now Button */}
            <div className="pt-2 border-t border-white/10">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isRestoring || isSigningOut || isDeleting}
                className="w-full text-sm text-red-400 hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete account now
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteNow}
        title="Delete Account Immediately?"
        description="Your account and subscription will be canceled and deleted immediately. This action cannot be undone. All your data will be permanently removed."
        confirmText="Delete Account Now"
        isDeleting={isDeleting}
      />
    </div>
  )
}

