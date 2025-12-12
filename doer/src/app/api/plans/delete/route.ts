import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { requireAuthOrError } from '@/lib/api/auth-helpers'
import { badRequestResponse, notFoundResponse, internalServerErrorResponse, successResponse } from '@/lib/api/error-responses'
import { getUserResource } from '@/lib/supabase/query-helpers'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await requireAuthOrError(request)
    if (authResult instanceof Response) {
      return authResult
    }
    const { user } = authResult

    const supabase = await createClient()
    
    // Parse request body
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error('Error parsing request body:', parseError)
      return badRequestResponse('Invalid request body')
    }
    
    console.log('Delete plan request body:', body)
    
    const { plan_id } = body
    
    if (!plan_id) {
      console.error('plan_id is missing from request:', body)
      return badRequestResponse('plan_id is required')
    }

    console.log(`Deleting plan ${plan_id} for user ${user.id}`)
    
    // Verify the plan belongs to the user before deletion
    const plan = await getUserResource<{
      id: string
      user_id: string
      status: string
      plan_type: string
      integration_metadata: any
    }>(
      supabase,
      'plans',
      user.id,
      plan_id,
      'id, user_id, status, plan_type, integration_metadata'
    )
    
    if (!plan) {
      console.error('Plan not found or access denied')
      return notFoundResponse('Plan')
    }

    const wasActive = plan.status === 'active'
    
    // Note: Integration plans are no longer used - calendar events are stored as tasks with plan_id = null
    // If this is an integration plan, it should have been removed by migration
    if (plan.plan_type === 'integration') {
      logger.warn('Attempted to delete integration plan (should have been removed by migration)', {
        planId: plan_id,
        userId: user.id,
      })
    }
    
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
      return internalServerErrorResponse('Failed to delete plan')
    }
    
    console.log(`Plan ${plan_id} successfully deleted`)

    return successResponse({ 
      success: true,
      was_active: wasActive
    })
  } catch (error) {
    console.error('Unexpected error in plan deletion:', error)
    return internalServerErrorResponse('An unexpected error occurred while deleting the plan')
  }
}

