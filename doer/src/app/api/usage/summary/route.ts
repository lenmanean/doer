import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('user_usage_summary')
      .select('metric, cycle_start, cycle_end, allocation, used, reserved, available, billing_cycle')
      .eq('user_id', user.id)
      .order('metric', { ascending: true })

    if (error) {
      console.error('[usage/summary] Failed to load usage summary', error)
      return NextResponse.json({ error: 'Failed to load usage summary' }, { status: 500 })
    }

    const metrics = (data ?? []).map((row) => ({
      metric: row.metric,
      cycleStart: row.cycle_start,
      cycleEnd: row.cycle_end,
      allocation: row.allocation,
      used: row.used,
      reserved: row.reserved,
      available: row.available,
      billingCycle: row.billing_cycle,
    }))

    return NextResponse.json({ success: true, metrics })
  } catch (err) {
    console.error('[usage/summary] Unexpected error', err)
    return NextResponse.json(
      { error: 'Failed to load usage summary' },
      { status: 500 }
    )
  }
}

