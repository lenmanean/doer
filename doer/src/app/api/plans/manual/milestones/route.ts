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

    const { plan_id, milestones } = body

    if (!plan_id || !milestones || !Array.isArray(milestones)) {
      return NextResponse.json(
        { error: 'Missing required fields: plan_id or milestones array' },
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
        { error: 'Can only add milestones to manual plans' },
        { status: 400 }
      )
    }

    console.log('Adding milestones to manual plan:', plan_id, 'count:', milestones.length)

    // Insert milestones
    const milestonesToInsert = milestones.map((milestone: any, index: number) => ({
      plan_id,
      user_id: user.id,
      idx: index + 1,
      name: milestone.name,
      rationale: milestone.rationale || milestone.description || '',
      target_date: milestone.target_date ? formatDateForDB(new Date(milestone.target_date)) : null,
    }))

    const { data: insertedMilestones, error: milestoneError } = await supabase
      .from('milestones')
      .insert(milestonesToInsert)
      .select()

    if (milestoneError) {
      console.error('Milestone insert error:', milestoneError)
      return NextResponse.json({ 
        error: 'Failed to create milestones',
        details: milestoneError.message 
      }, { status: 500 })
    }

    console.log('✅ Milestones created successfully:', insertedMilestones.length)

    return NextResponse.json({
      success: true,
      milestones: insertedMilestones
    }, { status: 200 })
    
  } catch (err: any) {
    console.error('Milestone Creation Error:', err)
    return NextResponse.json({ 
      error: 'Unexpected error during milestone creation',
      message: err.message || 'Unknown error'
    }, { status: 500 })
  }
}

