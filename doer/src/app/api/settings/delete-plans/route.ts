import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/settings/delete-plans
 * Deletes selected plans by their IDs
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { plan_ids } = body

    if (!plan_ids || !Array.isArray(plan_ids) || plan_ids.length === 0) {
      return NextResponse.json(
        { error: 'plan_ids array is required' },
        { status: 400 }
      )
    }

    // Verify all plans belong to the user before deletion
    const { data: plans, error: verifyError } = await supabase
      .from('plans')
      .select('id')
      .eq('user_id', user.id)
      .in('id', plan_ids)

    if (verifyError) {
      console.error('Error verifying plans:', verifyError)
      return NextResponse.json(
        { error: 'Failed to verify plans' },
        { status: 500 }
      )
    }

    if (!plans || plans.length !== plan_ids.length) {
      return NextResponse.json(
        { error: 'Some plans not found or access denied' },
        { status: 403 }
      )
    }

    // Delete the plans (cascades will handle related data)
    const { error: deleteError } = await supabase
      .from('plans')
      .delete()
      .eq('user_id', user.id)
      .in('id', plan_ids)

    if (deleteError) {
      console.error('Error deleting plans:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete plans' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true,
      message: `Successfully deleted ${plan_ids.length} plan(s).`,
      deleted_count: plan_ids.length
    })
  } catch (error) {
    console.error('Error deleting plans:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}














