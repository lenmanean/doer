import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPendingReschedules } from '@/lib/task-auto-rescheduler'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const planId = searchParams.get('planId')

    // planId can be null for free-mode tasks
    // If planId is provided, verify user owns the plan
    if (planId) {
      const { data: plan, error: planError } = await supabase
        .from('plans')
        .select('id, user_id')
        .eq('id', planId)
        .eq('user_id', user.id)
        .single()

      if (planError || !plan) {
        return NextResponse.json({ error: 'Plan not found or access denied' }, { status: 404 })
      }
    }

    // Get pending reschedules (can be null for free-mode)
    const proposals = await getPendingReschedules(supabase, user.id, planId || null)

    return NextResponse.json({
      success: true,
      proposals,
      count: proposals.length
    })

  } catch (error) {
    console.error('Error fetching pending reschedules:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

