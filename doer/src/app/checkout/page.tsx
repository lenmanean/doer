'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { StripeProvider } from '@/components/providers/stripe-provider'
import { supabase } from '@/lib/supabase/client'
import { useSupabase } from '@/components/providers/supabase-provider'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ArrowLeft, Loader2, Lock, Shield, CheckCircle } from 'lucide-react'
import { getPlanCycleBySlugAndCycle, type BillingCycle } from '@/lib/billing/plans'
import Link from 'next/link'

interface PlanDetails {
  name: string
  cycle: BillingCycle
  priceCents: number | null
}

function CheckoutForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const stripe = useStripe()
  const elements = useElements()
  const { addToast } = useToast()
  const { user: providerUser, loading: authLoading } = useSupabase()

  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [planDetails, setPlanDetails] = useState<PlanDetails | null>(null)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [setupIntentClientSecret, setSetupIntentClientSecret] = useState<string | null>(null)
  const [trialEligible, setTrialEligible] = useState<boolean | null>(null)
  const alreadySubscribedNotificationShown = useRef(false)
  
  // Billing address fields
  const [fullName, setFullName] = useState('')
  const [country, setCountry] = useState('United States')
  const [address, setAddress] = useState('')

  const planSlug = searchParams.get('plan')?.toLowerCase()
  const billingCycle = (searchParams.get('cycle')?.toLowerCase() || 'monthly') as BillingCycle

  // Log component mount and Stripe status
  useEffect(() => {
    console.log('[Checkout] Component mounted', { 
      hasStripe: !!stripe, 
      hasElements: !!elements,
      planSlug, 
      billingCycle 
    })
  }, [stripe, elements, planSlug, billingCycle])

  useEffect(() => {
    console.log('[Checkout] useEffect triggered', { planSlug, billingCycle, searchParams: searchParams.toString() })
    
    // Validate query params
    if (!planSlug || !['basic', 'pro'].includes(planSlug)) {
      console.log('[Checkout] Invalid planSlug, redirecting to pricing')
      setInitialLoading(false)
      addToast({
        type: 'error',
        title: 'Invalid Plan',
        description: 'Please select a valid plan from the pricing page.',
        duration: 5000,
      })
      router.push('/pricing')
      return
    }

    if (!['monthly', 'annual'].includes(billingCycle)) {
      console.log('[Checkout] Invalid billingCycle, redirecting to pricing')
      setInitialLoading(false)
      addToast({
        type: 'error',
        title: 'Invalid Billing Cycle',
        description: 'Please select a valid billing cycle.',
        duration: 5000,
      })
      router.push('/pricing')
      return
    }

    // Fetch user and profile
    const fetchUserData = async () => {
      console.log('[Checkout] Starting fetchUserData')
      try {
        setInitialLoading(true)
        setError(null)

        console.log('[Checkout] Checking user authentication...')
        console.log('[Checkout] Provider user:', { hasUser: !!providerUser, userId: providerUser?.id, authLoading })
        
        // Try to use provider user first (faster, already loaded)
        let currentUser = providerUser
        
        // If provider user is not available, try direct getUser() with timeout
        if (!currentUser && !authLoading) {
          console.log('[Checkout] Provider user not available, fetching from Supabase auth...')
          
          // Add timeout wrapper for getUser() to prevent infinite hanging
          const getUserWithTimeout = async () => {
            return Promise.race([
              supabase.auth.getUser(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('getUser() timeout after 5 seconds')), 5000)
              )
            ]) as Promise<{ data: { user: any }, error: any }>
          }
          
          let userError: any = null
          
          try {
            const result = await getUserWithTimeout()
            currentUser = result.data?.user
            userError = result.error
            console.log('[Checkout] User fetch result:', { 
              hasUser: !!currentUser, 
              userId: currentUser?.id,
              error: userError?.message 
            })
          } catch (timeoutError) {
            console.error('[Checkout] getUser() timed out or failed:', timeoutError)
            throw new Error('Authentication check timed out. Please refresh the page and try again.')
          }
        } else if (authLoading) {
          console.log('[Checkout] Waiting for auth to load from provider...')
          // Wait a bit for auth to load
          await new Promise(resolve => setTimeout(resolve, 1000))
          currentUser = providerUser
        }
        
        if (!currentUser) {
          console.log('[Checkout] No user found, redirecting to login')
          setInitialLoading(false)
          router.push('/login')
          return
        }

        setUser(currentUser)
        console.log('[Checkout] User set in state:', currentUser.id)

        // Fetch profile with timeout
        console.log('[Checkout] Fetching user profile from user_settings...')
        const profileFetchPromise = supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', currentUser.id)
          .maybeSingle() // Use maybeSingle() to handle missing records gracefully
        
        const profileTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Profile fetch timeout after 5 seconds')), 5000)
        )
        
        let userProfile: any = null
        let profileError: any = null
        
        try {
          const result = await Promise.race([profileFetchPromise, profileTimeoutPromise]) as any
          userProfile = result.data
          profileError = result.error
          console.log('[Checkout] Profile fetch result:', { 
            hasProfile: !!userProfile, 
            error: profileError?.message,
            errorCode: profileError?.code
          })
        } catch (timeoutError: any) {
          console.error('[Checkout] Profile fetch timed out or failed:', timeoutError)
          // Continue without profile - it's optional for checkout
          userProfile = null
          profileError = timeoutError
        }

        if (profileError && profileError.code !== 'PGRST116' && profileError.message !== 'Profile fetch timeout after 5 seconds') {
          // PGRST116 is "not found" which is fine, but other errors should be logged
          console.error('[Checkout] Profile fetch error:', profileError)
        }

        setProfile(userProfile || null)
        console.log('[Checkout] Profile set in state (or skipped due to error)')
        
        // Pre-fill billing address from profile if available
        if (userProfile?.first_name && userProfile?.last_name) {
          setFullName(`${userProfile.first_name} ${userProfile.last_name}`)
        }
        
        // Check trial eligibility for Pro Monthly
        if (planSlug === 'pro' && billingCycle === 'monthly') {
          try {
            const trialResponse = await fetch('/api/subscription/trial-eligibility')
            if (trialResponse.ok) {
              const trialData = await trialResponse.json()
              setTrialEligible(trialData.eligible)
            }
          } catch (trialError) {
            console.warn('[Checkout] Could not check trial eligibility:', trialError)
            setTrialEligible(null)
          }
        } else {
          setTrialEligible(false)
        }

        // Fetch plan details
        console.log('[Checkout] Fetching plan details...', { planSlug, billingCycle })
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
        try {
          const response = await fetch(`/api/billing/plan-details?planSlug=${planSlug}&cycle=${billingCycle}`, {
            signal: controller.signal
          })
          clearTimeout(timeoutId)
          console.log('[Checkout] Plan details response:', { ok: response.ok, status: response.status })
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            console.error('[Checkout] Plan details error:', errorData)
            
            // If user already has this plan, redirect to settings
            if (errorData.alreadySubscribed) {
              // Only show notification once to prevent duplicates
              if (!alreadySubscribedNotificationShown.current) {
                alreadySubscribedNotificationShown.current = true
                addToast({
                  type: 'info',
                  title: 'Already Subscribed',
                  description: errorData.error || 'You already have this plan active.',
                  duration: 5000,
                })
              }
              router.push('/settings?section=subscription')
              return
            }
            
            throw new Error(errorData.error || 'Failed to fetch plan details')
          }
          const planData = await response.json()
          console.log('[Checkout] Plan details received:', planData)
          setPlanDetails(planData)
        } catch (fetchError: any) {
          clearTimeout(timeoutId)
          if (fetchError.name === 'AbortError') {
            throw new Error('Request timeout: Plan details fetch took too long')
          }
          throw fetchError
        }

        // Create setup intent
        console.log('[Checkout] Creating setup intent...', { planSlug, billingCycle })
        const setupController = new AbortController()
        const setupTimeoutId = setTimeout(() => setupController.abort(), 15000) // 15 second timeout
        try {
          const setupResponse = await fetch('/api/checkout/create-setup-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planSlug, billingCycle }),
            signal: setupController.signal,
          })
          clearTimeout(setupTimeoutId)
          console.log('[Checkout] Setup intent response:', { ok: setupResponse.ok, status: setupResponse.status })

          if (!setupResponse.ok) {
            const errorData = await setupResponse.json().catch(() => ({}))
            console.error('[Checkout] Setup intent error:', errorData)
            throw new Error(errorData.error || 'Failed to initialize payment')
          }

          const { clientSecret } = await setupResponse.json()
          console.log('[Checkout] Setup intent created successfully')
          setSetupIntentClientSecret(clientSecret)
        } catch (setupError: any) {
          clearTimeout(setupTimeoutId)
          if (setupError.name === 'AbortError') {
            throw new Error('Request timeout: Setup intent creation took too long')
          }
          throw setupError
        }
      } catch (err) {
        console.error('Error fetching checkout data:', err)
        const errorMessage = err instanceof Error ? err.message : 'Failed to load checkout page'
        setError(errorMessage)
        addToast({
          type: 'error',
          title: 'Error',
          description: errorMessage,
          duration: 5000,
        })
      } finally {
        setInitialLoading(false)
      }
    }

    fetchUserData()
    
    // Reset notification flag when plan or cycle changes
    return () => {
      alreadySubscribedNotificationShown.current = false
    }
  }, [planSlug, billingCycle, router, addToast])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements || !setupIntentClientSecret) {
      return
    }

    setLoading(true)
    setError(null)

    const cardElement = elements.getElement(CardElement)
    if (!cardElement) {
      setError('Card element not found')
      setLoading(false)
      return
    }

    try {
      // Confirm setup intent to collect payment method
      const billingName = fullName || (profile?.first_name && profile?.last_name
        ? `${profile.first_name} ${profile.last_name}`
        : user?.email?.split('@')[0] || undefined)
      
      const { error: setupError, setupIntent } = await stripe.confirmCardSetup(
        setupIntentClientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              email: user?.email || undefined,
              name: billingName,
              address: address ? {
                line1: address,
                country: country === 'United States' ? 'US' : country,
              } : undefined,
            },
          },
        }
      )

      if (setupError) {
        throw new Error(setupError.message || 'Payment method setup failed')
      }

      if (!setupIntent?.payment_method) {
        throw new Error('Payment method not created')
      }

      // Create subscription with payment method
      const subscriptionResponse = await fetch('/api/checkout/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planSlug,
          billingCycle,
          paymentMethodId: setupIntent.payment_method,
        }),
      })

      if (!subscriptionResponse.ok) {
        const errorData = await subscriptionResponse.json()
        // Show details if available (helps with debugging configuration issues)
        const errorMessage = errorData.error || 'Failed to create subscription'
        const errorDetails = errorData.details ? ` ${errorData.details}` : ''
        throw new Error(errorMessage + errorDetails)
      }

      const subscriptionData = await subscriptionResponse.json()
      const { 
        clientSecret: paymentIntentClientSecret, 
        status: subscriptionStatus, 
        message,
        subscriptionId 
      } = subscriptionData

      // If subscription was created successfully but no payment is needed (e.g., $0 invoice)
      if (!paymentIntentClientSecret && subscriptionStatus === 'active') {
        // Redirect to success page immediately
        router.push(`/checkout/success?plan=${planSlug}&cycle=${billingCycle}`)
        return
      }

      // If there's a message indicating no payment needed, handle it
      if (!paymentIntentClientSecret && message) {
        addToast({
          type: 'success',
          title: 'Subscription Created',
          description: message,
          duration: 5000,
        })
        router.push(`/checkout/success?plan=${planSlug}&cycle=${billingCycle}`)
        return
      }

      // If no client secret and no success message, this is an error
      if (!paymentIntentClientSecret) {
        throw new Error('No payment intent found. Please try again or contact support.')
      }

      // Confirm payment
      const paymentMethodId = typeof setupIntent.payment_method === 'string' 
        ? setupIntent.payment_method 
        : setupIntent.payment_method?.id
      
      if (!paymentMethodId) {
        throw new Error('Payment method ID not found')
      }

      const { error: paymentError, paymentIntent } = await stripe.confirmCardPayment(
        paymentIntentClientSecret,
        {
          payment_method: paymentMethodId,
        }
      )

      if (paymentError) {
        // Handle specific error types
        let errorMessage = paymentError.message || 'Payment failed'
        if (paymentError.type === 'card_error') {
          switch (paymentError.code) {
            case 'card_declined':
              errorMessage = 'Your card was declined. Please try a different payment method.'
              break
            case 'insufficient_funds':
              errorMessage = 'Insufficient funds. Please use a different card.'
              break
            case 'expired_card':
              errorMessage = 'Your card has expired. Please use a different card.'
              break
            case 'incorrect_cvc':
              errorMessage = "Your card's security code is incorrect."
              break
            default:
              errorMessage = paymentError.message || 'Payment failed. Please try again.'
          }
        }
        throw new Error(errorMessage)
      }

      if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'processing') {
        // Payment succeeded - wait a moment for Stripe to process and update subscription status
        // Then check subscription status and sync if needed
        console.log('[Checkout] Payment succeeded, waiting for subscription activation...')
        
        // Give Stripe a moment to process the payment and update subscription status
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Try to sync the subscription status by calling our API
        // This will trigger a refresh and ensure the subscription is active
        try {
          if (subscriptionId) {
            const syncResponse = await fetch('/api/subscription/sync-after-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                subscriptionId,
              }),
            })
            
            if (syncResponse.ok) {
              console.log('[Checkout] Subscription synced after payment')
            } else {
              console.warn('[Checkout] Failed to sync subscription, webhook will handle it')
            }
          }
        } catch (syncError) {
          // Non-critical - webhook will handle sync
          console.warn('[Checkout] Error syncing subscription after payment:', syncError)
        }
        
        // Invalidate subscription cache to force refresh
        try {
          await fetch('/api/subscription?refresh=true', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (refreshError) {
          // Non-critical - webhook will handle sync
          console.warn('Failed to refresh subscription cache:', refreshError)
        }
        
        // Redirect to success page
        console.log('[Checkout] Redirecting to success page:', { planSlug, billingCycle })
        router.push(`/checkout/success?plan=${planSlug}&cycle=${billingCycle}&upgraded=true`)
      } else if (paymentIntent?.status === 'requires_action') {
        // Handle 3D Secure or other actions
        throw new Error('Additional authentication required. Please complete the verification.')
      } else {
        throw new Error('Payment not completed')
      }
    } catch (err) {
      console.error('Checkout error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Payment failed. Please try again.'
      setError(errorMessage)
      addToast({
        type: 'error',
        title: 'Payment Failed',
        description: errorMessage,
        duration: 7000,
      })
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (cents: number | null) => {
    if (!cents) return 'Free'
    return `$${(cents / 100).toFixed(2)}`
  }

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#ff7f00] animate-spin" />
      </div>
    )
  }

  if (error && (!planDetails || !user)) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-red-400">Error Loading Checkout</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-[#d7d2cb]">{error}</p>
            <div className="flex gap-4">
              <Button onClick={() => router.push('/pricing')} variant="outline" className="flex-1">
                Back to Pricing
              </Button>
              <Button onClick={() => window.location.reload()} className="flex-1">
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!planDetails || !user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#ff7f00] animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <Link
          href="/pricing"
          className="inline-flex items-center text-[#d7d2cb]/60 hover:text-[#d7d2cb] mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Pricing
        </Link>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column: Payment Form */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Payment Information</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Email (pre-filled, read-only) */}
                  <div>
                    <label className="block text-sm font-medium text-[#d7d2cb] mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      readOnly
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] cursor-not-allowed"
                    />
                  </div>

                  {/* Card Element */}
                  <div>
                    <label className="block text-sm font-medium text-[#d7d2cb] mb-2">
                      Card Information
                    </label>
                    <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg">
                      <CardElement
                        options={{
                          style: {
                            base: {
                              fontSize: '16px',
                              color: '#d7d2cb',
                              '::placeholder': {
                                color: '#9ca3af',
                              },
                            },
                            invalid: {
                              color: '#ef4444',
                            },
                          },
                          hidePostalCode: false,
                        }}
                      />
                    </div>
                  </div>

                  {/* Billing Address Section */}
                  <div className="border-t border-white/10 pt-6 space-y-4">
                    <h3 className="text-sm font-semibold text-[#d7d2cb]">Billing Address</h3>
                    
                    {/* Full Name */}
                    <div>
                      <label className="block text-sm font-medium text-[#d7d2cb] mb-2">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Enter your full name"
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#ff7f00] focus:border-transparent"
                      />
                    </div>

                    {/* Country/Region */}
                    <div>
                      <label className="block text-sm font-medium text-[#d7d2cb] mb-2">
                        Country or Region
                      </label>
                      <select
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[#ff7f00] focus:border-transparent"
                      >
                        <option value="United States">United States</option>
                        <option value="Canada">Canada</option>
                        <option value="United Kingdom">United Kingdom</option>
                        <option value="Australia">Australia</option>
                        <option value="Germany">Germany</option>
                        <option value="France">France</option>
                        <option value="Japan">Japan</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    {/* Address */}
                    <div>
                      <label className="block text-sm font-medium text-[#d7d2cb] mb-2">
                        Address
                      </label>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Enter your address"
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#ff7f00] focus:border-transparent"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={loading || !stripe || !elements}
                    className="w-full"
                    size="lg"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 mr-2" />
                        Subscribe Now
                      </>
                    )}
                  </Button>

                  <div className="flex items-center justify-center gap-2 text-xs text-[#d7d2cb]/60">
                    <Shield className="w-4 h-4" />
                    <span>Your payment information is secure and encrypted</span>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Order Summary */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-[#d7d2cb] mb-2">
                    {planDetails.name} Plan
                  </h3>
                  <p className="text-sm text-[#d7d2cb]/60 capitalize">
                    {billingCycle} billing
                  </p>
                </div>

                <div className="border-t border-white/10 pt-4">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-lg font-semibold text-[#d7d2cb]">
                      {planSlug === 'pro' && billingCycle === 'monthly' && trialEligible !== false ? 'Due Today' : 'Total'}
                    </span>
                    {planSlug === 'pro' && billingCycle === 'monthly' && trialEligible !== false ? (
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-[#ff7f00]">$0</span>
                        <span className="text-lg text-[#d7d2cb]/40 line-through">$20</span>
                        <span className="text-sm text-[#d7d2cb]/60">/mo</span>
                      </div>
                    ) : (
                      <span className="text-2xl font-bold text-[#ff7f00]">
                        {formatPrice(planDetails.priceCents)}/{billingCycle === 'monthly' ? 'mo' : 'yr'}
                      </span>
                    )}
                  </div>
                  {planSlug === 'pro' && billingCycle === 'monthly' && trialEligible !== false && (
                    <p className="text-xs text-[#d7d2cb]/60">
                      14-day free trial, then $20/month
                    </p>
                  )}
                </div>

                <div className="border-t border-white/10 pt-4 space-y-3">
                  <h4 className="font-semibold text-[#d7d2cb] mb-2">What's Included</h4>
                  <ul className="space-y-2 text-sm text-[#d7d2cb]/80">
                    {planSlug === 'pro' ? (
                      <>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                          <span>Unlimited API credits & integrations</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                          <span>AI scheduling assistant</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                          <span>Native integrations (Slack, HubSpot, Notion, Jira, Google Workspace)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                          <span>Portfolio analytics & KPI dashboards</span>
                        </li>
                      </>
                    ) : (
                      <>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                          <span>Personal workspace & automation</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                          <span>AI nudges & daily recaps</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                          <span>Recurring routines with calendar sync</span>
                        </li>
                      </>
                    )}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <StripeProvider>
      <Suspense fallback={
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#ff7f00] animate-spin" />
        </div>
      }>
        <CheckoutForm />
      </Suspense>
    </StripeProvider>
  )
}

