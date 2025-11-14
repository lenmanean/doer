'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { StripeProvider } from '@/components/providers/stripe-provider'
import { supabase } from '@/lib/supabase/client'
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
  apiCreditLimit: number
  integrationActionLimit: number
}

function CheckoutForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const stripe = useStripe()
  const elements = useElements()
  const { addToast } = useToast()

  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [planDetails, setPlanDetails] = useState<PlanDetails | null>(null)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [setupIntentClientSecret, setSetupIntentClientSecret] = useState<string | null>(null)

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

        console.log('[Checkout] Fetching user from Supabase auth...')
        const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser()
        console.log('[Checkout] User fetch result:', { 
          hasUser: !!currentUser, 
          userId: currentUser?.id,
          error: userError?.message 
        })
        
        if (!currentUser) {
          console.log('[Checkout] No user found, redirecting to login')
          setInitialLoading(false)
          router.push('/login')
          return
        }

        setUser(currentUser)
        console.log('[Checkout] User set in state')

        // Fetch profile
        console.log('[Checkout] Fetching user profile from user_settings...')
        const { data: userProfile, error: profileError } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', currentUser.id)
          .maybeSingle() // Use maybeSingle() to handle missing records gracefully
        
        console.log('[Checkout] Profile fetch result:', { 
          hasProfile: !!userProfile, 
          error: profileError?.message,
          errorCode: profileError?.code
        })

        if (profileError && profileError.code !== 'PGRST116') {
          // PGRST116 is "not found" which is fine, but other errors should be logged
          console.error('[Checkout] Profile fetch error:', profileError)
        }

        setProfile(userProfile || null)
        console.log('[Checkout] Profile set in state')

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
      const { error: setupError, setupIntent } = await stripe.confirmCardSetup(
        setupIntentClientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              email: user?.email || undefined,
              name: profile?.first_name && profile?.last_name
                ? `${profile.first_name} ${profile.last_name}`
                : user?.email?.split('@')[0] || undefined,
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
      const { clientSecret: paymentIntentClientSecret, status: subscriptionStatus, message } = subscriptionData

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
        // Redirect to success page
        router.push(`/checkout/success?plan=${planSlug}&cycle=${billingCycle}`)
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

                <div className="border-t border-white/10 pt-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[#d7d2cb]">Plan Price</span>
                    <span className="text-xl font-bold text-[#d7d2cb]">
                      {formatPrice(planDetails.priceCents)}/{billingCycle === 'monthly' ? 'mo' : 'yr'}
                    </span>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-lg font-semibold text-[#d7d2cb]">Total</span>
                    <span className="text-2xl font-bold text-[#ff7f00]">
                      {formatPrice(planDetails.priceCents)}/{billingCycle === 'monthly' ? 'mo' : 'yr'}
                    </span>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4 space-y-3">
                  <h4 className="font-semibold text-[#d7d2cb] mb-2">What's Included</h4>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-[#d7d2cb]/80">
                        {planDetails.apiCreditLimit.toLocaleString()} API Credits per {billingCycle === 'monthly' ? 'month' : 'year'}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-[#d7d2cb]/80">
                        {planDetails.integrationActionLimit.toLocaleString()} Integration Actions per {billingCycle === 'monthly' ? 'month' : 'year'}
                      </span>
                    </div>
                  </div>
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

