import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateTaskSchedule } from '@/lib/roadmap-server'

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

    const { plan_id, tasks } = body

    if (!plan_id || !tasks || !Array.isArray(tasks)) {
      return NextResponse.json(
        { error: 'Missing required fields: plan_id or tasks array' },
        { status: 400 }
      )
    }

    // Verify the plan exists and belongs to the user
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', plan_id)
      .eq('user_id', user.id)
      .single()

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'Plan not found or does not belong to user' },
        { status: 404 }
      )
    }

    // Verify plan is manual type
    if (plan.plan_type !== 'manual') {
      return NextResponse.json(
        { error: 'Can only add tasks to manual plans' },
        { status: 400 }
      )
    }

    console.log('Adding tasks to manual plan:', plan_id, 'count:', tasks.length)

    // Insert tasks
    const tasksToInsert = tasks.map((task: any, index: number) => ({
      plan_id,
      user_id: user.id,
      milestone_id: task.milestone_id || null,
      idx: index + 1,
      name: task.name,
      category: task.category || 'daily_task',
    }))

    const { data: insertedTasks, error: taskError } = await supabase
      .from('tasks')
      .insert(tasksToInsert)
      .select()

    if (taskError) {
      console.error('Task insert error:', taskError)
      return NextResponse.json({ 
        error: 'Failed to create tasks',
        details: taskError.message 
      }, { status: 500 })
    }

    console.log('✅ Tasks created successfully:', insertedTasks.length)

    // Generate task schedule if plan has start and end dates
    if (plan.start_date && plan.end_date) {
      try {
        const startDate = new Date(plan.start_date)
        const endDate = new Date(plan.end_date)
        
        await generateTaskSchedule(plan.id, startDate, endDate)
        console.log('✅ Task schedule generated for manual plan')
      } catch (scheduleError) {
        console.error('Error generating task schedule:', scheduleError)
        // Don't fail the request if scheduling fails
      }
    }

    return NextResponse.json({
      success: true,
      tasks: insertedTasks
    }, { status: 200 })
    
  } catch (err: any) {
    console.error('Task Creation Error:', err)
    return NextResponse.json({ 
      error: 'Unexpected error during task creation',
      message: err.message || 'Unknown error'
    }, { status: 500 })
  }
}

