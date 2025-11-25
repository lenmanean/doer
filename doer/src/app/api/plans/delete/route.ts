import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'User not authenticated' },
        { status: 401 }
      )
    }

    // Parse request body
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error('Error parsing request body:', parseError)
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      )
    }
    
    console.log('Delete plan request body:', body)
    
    const { plan_id } = body
    
    if (!plan_id) {
      console.error('plan_id is missing from request:', body)
      return NextResponse.json(
        { success: false, error: 'plan_id is required' },
        { status: 400 }
      )
    }

    console.log(`Deleting plan ${plan_id} for user ${user.id}`)
    
    // Verify the plan belongs to the user before deletion
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('id, user_id, status')
      .eq('id', plan_id)
      .eq('user_id', user.id)
      .single()
    
    if (planError || !plan) {
      console.error('Plan not found or access denied:', planError)
      return NextResponse.json(
        { success: false, error: 'Plan not found or access denied' },
        { status: 404 }
      )
    }

    const wasActive = plan.status === 'active'
    
    // Delete related data in order (respecting foreign key constraints)
    // 1. Delete task completions
    const { error: completionsError } = await supabase
      .from('task_completions')
      .delete()
      .eq('plan_id', plan_id)
    
    if (completionsError) {
      console.error('Error deleting task completions:', completionsError)
    }
    
    // 2. Delete task schedules
    const { error: schedulesError } = await supabase
      .from('task_schedule')
      .delete()
      .eq('plan_id', plan_id)
    
    if (schedulesError) {
      console.error('Error deleting task schedules:', schedulesError)
    }
    
    // 3. Delete tasks
    const { error: tasksError } = await supabase
      .from('tasks')
      .delete()
      .eq('plan_id', plan_id)
    
    if (tasksError) {
      console.error('Error deleting tasks:', tasksError)
    }
    
    // 4. Delete onboarding responses associated with this plan
    const { error: onboardingError } = await supabase
      .from('onboarding_responses')
      .delete()
      .eq('plan_id', plan_id)
      .eq('user_id', user.id)
    
    if (onboardingError) {
      console.error('Error deleting onboarding responses:', onboardingError)
    }
    
    // 6. Delete the plan itself
    const { error: planDeleteError } = await supabase
      .from('plans')
      .delete()
      .eq('id', plan_id)
      .eq('user_id', user.id)
    
    if (planDeleteError) {
      console.error('Error deleting plan:', planDeleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete plan: ' + planDeleteError.message },
        { status: 500 }
      )
    }
    
    console.log(`Plan ${plan_id} successfully deleted`)

    return NextResponse.json({ 
      success: true,
      was_active: wasActive
    })
  } catch (error) {
    console.error('Unexpected error in plan deletion:', error)
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred while deleting the plan' },
      { status: 500 }
    )
  }
}

