import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rescheduleOverdueTasks } from '@/lib/task-auto-rescheduler'

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
    const { planId, taskId } = body

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

    // Check if auto-reschedule is enabled
    const { data: enabled, error: checkError } = await supabase.rpc('is_auto_reschedule_enabled', {
      p_user_id: user.id
    })

    if (checkError) {
      console.error('Error checking auto-reschedule setting:', checkError)
      return NextResponse.json({ error: 'Failed to check settings' }, { status: 500 })
    }

    if (!enabled) {
      return NextResponse.json({ 
        success: false,
        message: 'Auto-reschedule is disabled for this user',
        results: []
      })
    }

    // If taskId is provided, reschedule just that task
    // Otherwise, reschedule all overdue tasks
    if (taskId) {
      // For single task rescheduling, we'll reschedule all overdue tasks
      // and filter the results (simpler implementation)
      const results = await rescheduleOverdueTasks(supabase, planId, user.id)
      const taskResult = results.find(r => r.taskId === taskId)
      
      if (taskResult) {
        return NextResponse.json({
          success: true,
          message: 'Task rescheduled successfully',
          results: [taskResult]
        })
      } else {
        return NextResponse.json({
          success: false,
          message: 'Task not found or not overdue',
          results: []
        })
      }
    } else {
      // Reschedule all overdue tasks (can be null for free-mode)
      console.log(`[API] Rescheduling overdue tasks for planId: ${planId || 'free-mode'}`)
      const results = await rescheduleOverdueTasks(supabase, planId || null, user.id)
      
      console.log(`[API] Reschedule results: ${results.length} proposal(s) created`)

      return NextResponse.json({
        success: true,
        message: `Created ${results.length} reschedule proposal(s)`,
        results
      })
    }

  } catch (error) {
    console.error('Error in reschedule endpoint:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

