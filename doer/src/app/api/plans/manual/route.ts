import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatDateForDB } from '@/lib/date-utils'

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

    // Extract and validate data from request
    const { goal_text, goal_description, start_date, end_date } = body

    if (!goal_text || !start_date || !end_date) {
      return NextResponse.json(
        { error: 'Missing required fields: goal_text, start_date, or end_date' },
        { status: 400 }
      )
    }

    // Validate dates
    const startDate = new Date(start_date)
    const endDate = new Date(end_date)
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      )
    }
    
    if (endDate <= startDate) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      )
    }

    // Calculate timeline days
    const timelineDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1

    console.log('Creating manual plan for user:', user.id, {
      goal_text,
      start_date,
      end_date,
      timeline_days: timelineDays
    })

    // ✅ Check for existing active plan and set it to 'paused'
    const { data: existingPlans, error: fetchError } = await supabase
      .from('plans')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (fetchError) {
      console.error('Error fetching existing active plans:', fetchError)
      return NextResponse.json({ 
        error: 'Failed to check for existing plans',
        details: fetchError.message 
      }, { status: 500 })
    }

    if (existingPlans && existingPlans.length > 0) {
      console.log(`Found ${existingPlans.length} existing active plan(s), setting to paused`)
      
      for (const plan of existingPlans) {
        const { error: pauseError } = await supabase
          .from('plans')
          .update({ status: 'paused' })
          .eq('id', plan.id)
          .eq('user_id', user.id)
        
        if (pauseError) {
          console.error('Error pausing existing plan:', pauseError)
          return NextResponse.json({ 
            error: 'Failed to pause existing plan',
            details: pauseError.message
          }, { status: 500 })
        }
      }
      
      console.log('✅ Successfully paused all existing active plans')
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // ✅ Insert manual plan record
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .insert({
        user_id: user.id,
        goal_text,
        start_date: formatDateForDB(startDate),
        end_date: formatDateForDB(endDate),
        status: 'active',
        plan_type: 'manual',
        summary_data: {
          total_duration_days: timelineDays,
          goal_title: goal_text,
          goal_summary: goal_description || null
        }
      })
      .select()
      .single()

    if (planError) {
      console.error('Plan insert error:', planError)
      return NextResponse.json({ 
        error: 'Failed to create manual plan',
        details: planError.message 
      }, { status: 500 })
    }

    console.log('✅ Manual plan created successfully:', plan.id)

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

