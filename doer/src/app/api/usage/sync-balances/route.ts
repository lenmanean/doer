import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { initializeUsageBalances } from '@/lib/usage/initialize-balances'

export const dynamic = 'force-dynamic'

/**
 * POST /api/usage/sync-balances
 * Manually sync usage balances from the user's active Stripe subscription
 * Useful for recovery or testing
 */
export async function POST(req: NextRequest) {
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
    
    // Initialize usage balances from Stripe subscription
    await initializeUsageBalances(user.id)
    
    return NextResponse.json({
      success: true,
      message: 'Usage balances synced successfully',
    }, { status: 200 })
    
  } catch (err) {
    console.error('Error syncing usage balances:', err)
    return NextResponse.json(
      { 
        error: 'Failed to sync usage balances', 
        details: err instanceof Error ? err.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

