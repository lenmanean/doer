import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateTaskSchedule } from '@/lib/roadmap-server'
import { getBusySlotsForUser } from '@/lib/calendar/busy-slots'
import { validateProvider } from '@/lib/calendar/providers/provider-factory'
import { logger } from '@/lib/logger'
import { parseDateFromDB } from '@/lib/date-utils'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * Regenerate plan schedule based on latest calendar events
 * POST /api/integrations/[provider]/regenerate
 * Body: { plan_id: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Validate provider
    let provider: 'google' | 'outlook' | 'apple'
    try {
      provider = validateProvider(params.provider)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid provider' },
        { status: 400 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { plan_id } = body

    if (!plan_id) {
      return NextResponse.json(
        { error: 'plan_id is required' },
        { status: 400 }
      )
    }

    // Verify plan belongs to user
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('id, user_id, start_date, end_date')
      .eq('id', plan_id)
      .eq('user_id', user.id)
      .single()

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      )
    }

    // Check if user has calendar connection (any provider, not just this one)
    const { data: connection } = await supabase
      .from('calendar_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .single()

    if (!connection) {
      return NextResponse.json(
        { error: `No ${provider} Calendar connection found` },
        { status: 404 }
      )
    }

    // Fetch latest busy slots from all calendar providers (provider-agnostic)
    const startDate = parseDateFromDB(plan.start_date)
    const endDate = parseDateFromDB(plan.end_date || plan.start_date)

    // Extend end date by 1 day to ensure we capture all relevant events
    endDate.setDate(endDate.getDate() + 1)

    const busySlots = await getBusySlotsForUser(user.id, startDate, endDate)

    // Regenerate schedule
    await generateTaskSchedule(plan.id, startDate, endDate)

    return NextResponse.json({
      success: true,
      plan_id: plan.id,
      busy_slots_count: busySlots.length,
      message: 'Plan schedule regenerated successfully',
    })
  } catch (error) {
    logger.error('Failed to regenerate plan schedule', error as Error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to regenerate plan schedule' },
      { status: 500 }
    )
  }
}

