import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzeAndReschedule } from '@/lib/smart-scheduler'

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
    const { planId, missedDate } = body

    if (!planId) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 })
    }

    // Verify user owns the plan
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('id, user_id')
      .eq('id', planId)
      .eq('user_id', user.id)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found or access denied' }, { status: 404 })
    }

    // Analyze rescheduling needs
    const result = await analyzeAndReschedule(planId, user.id, missedDate)

    if (!result) {
      return NextResponse.json({ 
        needsRescheduling: false,
        message: 'No rescheduling needed'
      })
    }

    return NextResponse.json({
      needsRescheduling: true,
      analysis: result
    })

  } catch (error) {
    console.error('Error analyzing rescheduling:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}



