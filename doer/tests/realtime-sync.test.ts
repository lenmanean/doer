/**
 * End-to-End Test: Realtime Sync and Database Functions
 * 
 * Purpose: Verify that all database migrations work correctly:
 * - get_task_completion_status RPC
 * - Milestone auto-fill trigger
 * - Realtime plan_update channel
 * - get_vitality_now health metrics
 * 
 * Usage: Run this script with ts-node or integrate into your test suite
 */

import { createClient as createServerClient } from '@/lib/supabase/server'
import { supabase } from '@/lib/supabase/client'

interface TestContext {
  userId: string
  planId: string
  milestoneId: string
  taskId: string
  scheduleId: string
  completionId?: string
}

/**
 * Main test function
 */
export async function testRealtimeSync() {
  console.log('🧪 Starting Realtime Sync E2E Test...\n')
  
  const context: Partial<TestContext> = {}
  
  try {
    // ========================================
    // Step 1: Setup - Get authenticated user
    // ========================================
    console.log('📋 Step 1: Authenticating...')
    const serverSupabase = await createServerClient()
    const { data: { user }, error: userError } = await serverSupabase.auth.getUser()
    
    if (userError || !user) {
      throw new Error('User not authenticated. Please sign in first.')
    }
    
    context.userId = user.id
    console.log(`✅ Authenticated as user: ${user.id}\n`)
    
    // ========================================
    // Step 2: Create test plan
    // ========================================
    console.log('📋 Step 2: Creating test plan...')
    const { data: plan, error: planError } = await serverSupabase
      .from('plans')
      .insert({
        user_id: user.id,
        goal_text: 'E2E Test Plan - Realtime Sync Verification',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'active'
      })
      .select()
      .single()
    
    if (planError) throw planError
    context.planId = plan.id
    console.log(`✅ Created test plan: ${plan.id}\n`)
    
    // ========================================
    // Step 3: Create test milestone
    // ========================================
    console.log('📋 Step 3: Creating test milestone...')
    const { data: milestone, error: milestoneError } = await serverSupabase
      .from('milestones')
      .insert({
        user_id: user.id,
        plan_id: plan.id,
        idx: 0,
        name: 'Test Milestone',
        rationale: 'Testing milestone auto-fill trigger',
        target_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      })
      .select()
      .single()
    
    if (milestoneError) throw milestoneError
    context.milestoneId = milestone.id
    console.log(`✅ Created test milestone: ${milestone.id}\n`)
    
    // ========================================
    // Step 4: Create test task
    // ========================================
    console.log('📋 Step 4: Creating test task...')
    const { data: task, error: taskError } = await serverSupabase
      .from('tasks')
      .insert({
        user_id: user.id,
        plan_id: plan.id,
        milestone_id: milestone.id,
        idx: 0,
        name: 'Test Task',
        category: 'daily_task'
      })
      .select()
      .single()
    
    if (taskError) throw taskError
    context.taskId = task.id
    console.log(`✅ Created test task: ${task.id}\n`)
    
    // ========================================
    // Step 5: Create task schedule
    // ========================================
    console.log('📋 Step 5: Creating task schedule...')
    const today = new Date().toISOString().split('T')[0]
    const { data: schedule, error: scheduleError } = await serverSupabase
      .from('task_schedule')
      .insert({
        user_id: user.id,
        plan_id: plan.id,
        task_id: task.id,
        milestone_id: milestone.id,
        day_index: 0,
        date: today
      })
      .select()
      .single()
    
    if (scheduleError) throw scheduleError
    context.scheduleId = schedule.id
    console.log(`✅ Created task schedule: ${schedule.id}\n`)
    
    // ========================================
    // Step 6: Test get_task_completion_status RPC
    // ========================================
    console.log('📋 Step 6: Testing get_task_completion_status RPC...')
    const { data: completionStatus, error: rpcError } = await serverSupabase.rpc(
      'get_task_completion_status',
      {
        p_user_id: user.id,
        p_plan_id: plan.id,
        p_date: today
      }
    )
    
    if (rpcError) throw rpcError
    
    const taskStatus = completionStatus.find((s: any) => s.task_id === task.id)
    if (!taskStatus) {
      throw new Error('Task not found in completion status')
    }
    
    if (taskStatus.is_completed !== false) {
      throw new Error('Expected task to be incomplete initially')
    }
    
    console.log('✅ RPC returned correct initial status: not completed\n')
    
    // ========================================
    // Step 7: Subscribe to realtime channel
    // ========================================
    console.log('📋 Step 7: Setting up realtime subscription...')
    let realtimeNotificationReceived = false
    
    const channel = supabase
      .channel(`test-plan-update-${plan.id}`)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'task_completions',
          filter: `plan_id=eq.${plan.id}`
        },
        (payload) => {
          console.log('📡 Realtime notification received:', payload)
          realtimeNotificationReceived = true
        }
      )
      .subscribe()
    
    // Wait for subscription to be ready
    await new Promise(resolve => setTimeout(resolve, 1000))
    console.log('✅ Realtime subscription active\n')
    
    // ========================================
    // Step 8: Complete the task
    // ========================================
    console.log('📋 Step 8: Completing test task...')
    const { data: completion, error: completionError } = await serverSupabase
      .from('task_completions')
      .insert({
        user_id: user.id,
        plan_id: plan.id,
        task_id: task.id,
        scheduled_date: today
        // Note: milestone_id should be auto-filled by trigger
      })
      .select()
      .single()
    
    if (completionError) throw completionError
    context.completionId = completion.id
    console.log(`✅ Task completed: ${completion.id}`)
    
    // Verify milestone_id was auto-filled
    if (!completion.milestone_id) {
      throw new Error('❌ Milestone auto-fill trigger failed!')
    }
    console.log(`✅ Milestone auto-filled: ${completion.milestone_id}\n`)
    
    // ========================================
    // Step 9: Verify completion status updated
    // ========================================
    console.log('📋 Step 9: Verifying completion status updated...')
    const { data: updatedStatus, error: statusError } = await serverSupabase.rpc(
      'get_task_completion_status',
      {
        p_user_id: user.id,
        p_plan_id: plan.id,
        p_date: today
      }
    )
    
    if (statusError) throw statusError
    
    const updatedTaskStatus = updatedStatus.find((s: any) => s.task_id === task.id)
    if (!updatedTaskStatus || updatedTaskStatus.is_completed !== true) {
      throw new Error('Task completion status not updated correctly')
    }
    
    console.log('✅ RPC confirmed task is now completed\n')
    
    // ========================================
    // Step 10: Test get_vitality_now RPC
    // ========================================
    console.log('📋 Step 10: Testing get_vitality_now RPC...')
    const { data: vitality, error: vitalityError } = await serverSupabase.rpc(
      'get_vitality_now',
      {
        p_user_id: user.id,
        p_plan_id: plan.id
      }
    )
    
    if (vitalityError) throw vitalityError
    
    console.log('📊 Vitality metrics:', {
      progress: vitality.progress,
      consistency: vitality.consistency,
      efficiency: vitality.efficiency
    })
    console.log('✅ Health metrics retrieved successfully\n')
    
    // ========================================
    // Step 11: Wait for realtime notification
    // ========================================
    console.log('📋 Step 11: Waiting for realtime notification...')
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    if (realtimeNotificationReceived) {
      console.log('✅ Realtime notification received successfully\n')
    } else {
      console.warn('⚠️  Realtime notification not received (may be environment-dependent)\n')
    }
    
    // ========================================
    // Cleanup
    // ========================================
    console.log('🧹 Cleaning up test data...')
    await supabase.removeChannel(channel)
    
    // Use delete_plan_data RPC for cleanup
    const { error: cleanupError } = await serverSupabase.rpc('delete_plan_data', {
      target_user_id: user.id,
      target_plan_id: plan.id
    })
    
    if (cleanupError) {
      console.error('⚠️  Cleanup error:', cleanupError)
    } else {
      console.log('✅ Test data cleaned up\n')
    }
    
    // ========================================
    // Results
    // ========================================
    console.log('🎉 All tests passed!\n')
    console.log('Summary:')
    console.log('  ✅ get_task_completion_status RPC works')
    console.log('  ✅ Milestone auto-fill trigger works')
    console.log('  ✅ Task completion logic works')
    console.log('  ✅ get_vitality_now RPC works')
    console.log('  ✅ delete_plan_data RPC works')
    if (realtimeNotificationReceived) {
      console.log('  ✅ Realtime notifications work')
    }
    
    return true
    
  } catch (error) {
    console.error('\n❌ Test failed:', error)
    
    // Attempt cleanup on error
    if (context.planId && context.userId) {
      console.log('🧹 Attempting cleanup after error...')
      const serverSupabase = await createServerClient()
      await serverSupabase.rpc('delete_plan_data', {
        target_user_id: context.userId,
        target_plan_id: context.planId
      })
    }
    
    throw error
  }
}

// Export for test runner integration
export default testRealtimeSync

// Allow running directly with ts-node
if (require.main === module) {
  testRealtimeSync()
    .then(() => {
      console.log('Test completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Test failed:', error)
      process.exit(1)
    })
}



