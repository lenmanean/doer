import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSchedulingHistory } from '@/lib/smart-scheduler'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get plan ID from query params
    const { searchParams } = new URL(request.url)
    const planId = searchParams.get('planId')

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

    // Get scheduling history
    const history = await getSchedulingHistory(planId)

    return NextResponse.json({
      success: true,
      history: history.map(entry => ({
        id: entry.id,
        adjustmentDate: entry.adjustment_date,
        oldEndDate: entry.old_end_date,
        newEndDate: entry.new_end_date,
        daysExtended: entry.days_extended,
        tasksRescheduled: entry.tasks_rescheduled,
        milestonesAdjusted: 0, // Milestones removed from system
        reason: entry.reason,
        createdAt: entry.created_at
      }))
    })

  } catch (error) {
    console.error('Error fetching scheduling history:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
