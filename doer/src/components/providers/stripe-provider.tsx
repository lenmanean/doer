'use client'

import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'
import { ReactNode } from 'react'

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
)

interface StripeProviderProps {
  children: ReactNode
  options?: StripeElementsOptions
}

export function StripeProvider({ children, options }: StripeProviderProps) {
  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    console.warn('[StripeProvider] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set')
    return <>{children}</>
  }

  const defaultOptions: StripeElementsOptions = {
    appearance: {
      theme: 'night',
      variables: {
        colorPrimary: '#ff7f00',
        colorBackground: '#0a0a0a',
        colorText: '#d7d2cb',
        colorDanger: '#ef4444',
        fontFamily: 'system-ui, sans-serif',
        spacingUnit: '4px',
        borderRadius: '8px',
      },
    },
    ...options,
  }

  return (
    <Elements stripe={stripePromise} options={defaultOptions}>
      {children}
    </Elements>
  )
}





