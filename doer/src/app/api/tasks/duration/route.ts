import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * GET: Fetch task durations for a plan
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const planId = searchParams.get('plan_id')
    
    if (!planId) {
      return NextResponse.json({ error: 'Missing plan_id parameter' }, { status: 400 })
    }
    
    // Fetch tasks with duration estimates
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('id, name, category, estimated_duration_minutes, complexity_score')
      .eq('plan_id', planId)
      .eq('user_id', user.id)
      .order('idx', { ascending: true })
    
    if (error) {
      console.error('Error fetching task durations:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ tasks }, { status: 200 })
    
  } catch (error) {
    console.error('Error in GET /api/tasks/duration:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST: Bulk update task durations (for AI estimation updates)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await request.json()
    const { updates } = body
    
    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json({ 
        error: 'Missing or invalid updates array' 
      }, { status: 400 })
    }
    
    // Validate updates
    for (const update of updates) {
      if (!update.task_id) {
        return NextResponse.json({ 
          error: 'Each update must have a task_id' 
        }, { status: 400 })
      }
      
      if (update.estimated_duration_minutes !== undefined && 
          (update.estimated_duration_minutes < 0 || update.estimated_duration_minutes > 1440)) {
        return NextResponse.json({ 
          error: 'Duration must be between 0 and 1440 minutes (24 hours)' 
        }, { status: 400 })
      }
      
      if (update.complexity_score !== undefined && 
          (update.complexity_score < 1 || update.complexity_score > 10)) {
        return NextResponse.json({ 
          error: 'Complexity score must be between 1 and 10' 
        }, { status: 400 })
      }
    }
    
    // Update tasks one by one (could be optimized with upsert in future)
    const results = []
    const errors = []
    
    for (const update of updates) {
      const updateData: any = {}
      
      if (update.estimated_duration_minutes !== undefined) {
        updateData.estimated_duration_minutes = update.estimated_duration_minutes
      }
      
      if (update.complexity_score !== undefined) {
        updateData.complexity_score = update.complexity_score
      }
      
      const { data, error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', update.task_id)
        .eq('user_id', user.id)
        .select()
        .single()
      
      if (error) {
        errors.push({ task_id: update.task_id, error: error.message })
      } else {
        results.push(data)
      }
    }
    
    if (errors.length > 0) {
      return NextResponse.json({ 
        success: false,
        updated: results,
        errors 
      }, { status: 207 }) // Multi-Status
    }
    
    return NextResponse.json({ 
      success: true, 
      updated: results 
    }, { status: 200 })
    
  } catch (error) {
    console.error('Error in POST /api/tasks/duration:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}




