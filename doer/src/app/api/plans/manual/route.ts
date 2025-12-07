import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatDateForDB, toLocalMidnight } from '@/lib/date-utils'
import { autoAssignBasicPlan } from '@/lib/stripe/auto-assign-basic'
import { validateDateRange } from '@/lib/validation/date-validation'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await req.json()

    // ✅ Authenticate user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }

    // Ensure user has Basic plan assigned (auto-assign if needed)
    try {
      await autoAssignBasicPlan(user.id)
    } catch (error) {
      console.warn('[Plan Manual] Failed to auto-assign Basic plan, continuing anyway:', error)
      // Don't fail - will be handled by CreditService if needed
    }

    // Extract and validate data from request
    const { goal_text, goal_description, start_date, end_date } = body

    if (!goal_text || !start_date || !end_date) {
      return NextResponse.json(
        { error: 'Missing required fields: goal_text, start_date, or end_date' },
        { status: 400 }
      )
    }

    // Validate date range using unified validation utility
    // Manual plans allow past dates (user can create historical plans)
    const dateValidation = validateDateRange(start_date, end_date, {
      allowPastDates: true, // Manual plans can have past dates
      maxPastDays: 365, // Allow up to 1 year in past for historical plans
      maxFutureDays: 365, // Allow up to 1 year in future
      warnOnPastDates: false, // Don't warn for manual plans
    })
    
    if (!dateValidation.valid) {
      return NextResponse.json(
        { 
          error: dateValidation.errors[0] || 'Invalid date range',
          details: dateValidation.errors.join('; ')
        },
        { status: 400 }
      )
    }

    // Convert dates to local midnight to avoid timezone issues
    const startDate = toLocalMidnight(start_date)
    const endDate = toLocalMidnight(end_date)

    // Calculate timeline days using local dates
    const timelineDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1

    console.log('Creating manual plan for user:', user.id, {
      goal_text,
      start_date,
      end_date,
      timeline_days: timelineDays
    })

    // ✅ Create manual plan transactionally (pauses existing plans + creates new plan)
    const { data: result, error: rpcError } = await supabase.rpc('create_manual_plan_transactional', {
      p_user_id: user.id,
      p_goal_text: goal_text,
      p_start_date: formatDateForDB(startDate),
      p_end_date: formatDateForDB(endDate),
      p_summary_data: {
        total_duration_days: timelineDays,
        goal_title: goal_text,
        goal_summary: goal_description || null
      }
    })

    if (rpcError) {
      console.error('Error creating manual plan:', rpcError)
      return NextResponse.json({ 
        error: 'Failed to create manual plan',
        details: rpcError.message 
      }, { status: 500 })
    }

    if (!result || !result.success) {
      console.error('Plan creation failed:', result)
      return NextResponse.json({ 
        error: result?.error || 'Failed to create manual plan',
        details: result?.error_detail || 'Unknown error'
      }, { status: 500 })
    }

    // Fetch the created plan
    const { data: plan, error: planFetchError } = await supabase
      .from('plans')
      .select()
      .eq('id', result.plan_id)
      .single()

    if (planFetchError || !plan) {
      console.error('Error fetching created plan:', planFetchError)
      return NextResponse.json({ 
        error: 'Plan created but failed to retrieve',
        details: planFetchError?.message || 'Unknown error'
      }, { status: 500 })
    }

    console.log('✅ Manual plan created successfully:', plan.id, {
      plans_paused: result.plans_paused || 0
    })

    return NextResponse.json({
      success: true,
      plan,
      timeline: {
        days: timelineDays
      }
    }, { status: 200 })
    
  } catch (err: any) {
    console.error('Manual Plan Creation Error:', err)
    return NextResponse.json({ 
      error: 'Unexpected error during manual plan creation',
      message: err.message || 'Unknown error'
    }, { status: 500 })
  }
}

