import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzeAndReschedule, applyScheduleChanges } from '@/lib/smart-scheduler'
import { logger } from '@/lib/logger'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { planId, missedDate, force = false } = body

    if (!planId) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 })
    }

    // Verify user owns the plan
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('id, user_id')
      .eq('id', planId)
      .eq('user_id', user.id)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found or access denied' }, { status: 404 })
    }

    // Analyze rescheduling needs
    const result = await analyzeAndReschedule(planId, user.id, missedDate)

    if (!result && !force) {
      return NextResponse.json({ 
        success: false,
        message: 'No rescheduling needed'
      })
    }

    // If no result but force is true, return error
    if (!result) {
      return NextResponse.json({ 
        success: false,
        message: 'Cannot force rescheduling when no adjustments are needed'
      }, { status: 400 })
    }

    // Apply the rescheduling changes
    const success = await applyScheduleChanges(planId, user.id, result)

    if (!success) {
      return NextResponse.json({ 
        success: false,
        message: 'Failed to apply rescheduling changes'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Rescheduling applied successfully',
      adjustments: {
        daysExtended: result.daysExtended,
        tasksRescheduled: result.taskAdjustments.length,
        newEndDate: result.newEndDate.toISOString().split('T')[0]
      }
    })

  } catch (error) {
    logger.error('Error applying rescheduling', error as Error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}



