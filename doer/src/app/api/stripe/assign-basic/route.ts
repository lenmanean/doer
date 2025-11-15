import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { autoAssignBasicPlan } from '@/lib/stripe/auto-assign-basic'

export async function POST() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await autoAssignBasicPlan(user.id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[assign-basic] Failed to auto assign plan', err)
    return NextResponse.json(
      { error: 'Failed to assign plan' },
      { status: 500 }
    )
  }
}

