import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getInvoicesFromStripe } from '@/lib/stripe/subscriptions'

export const dynamic = 'force-dynamic'

/**
 * GET /api/subscription/invoices
 * Returns the invoice history for the authenticated user
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Authenticate user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      )
    }
    
    // Fetch invoices directly from Stripe
    const invoices = await getInvoicesFromStripe(user.id)
    
    return NextResponse.json({
      success: true,
      invoices,
    }, { status: 200 })
    
  } catch (err) {
    console.error('Error fetching invoices:', err)
    return NextResponse.json(
      { error: 'Failed to fetch invoices', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

