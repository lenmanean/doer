import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user)
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })

    const { data: settings, error } = await supabase
      .from('user_settings')
      .select('preferences')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching workday settings:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const preferences = settings?.preferences || {}
    const workdaySettings = preferences.workday || {}

    return NextResponse.json({
      workdayStartHour: workdaySettings.workday_start_hour || 9,
      workdayEndHour: workdaySettings.workday_end_hour || 17,
      lunchStartHour: workdaySettings.lunch_start_hour || 12,
      lunchEndHour: workdaySettings.lunch_end_hour || 13,
    })
  } catch (error) {
    console.error('Error in GET /api/settings/workday:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user)
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })

    const body = await req.json()
    const { workdayStartHour, workdayEndHour, lunchStartHour, lunchEndHour } = body

    // Validate inputs
    if (workdayStartHour < 0 || workdayStartHour > 23 ||
        workdayEndHour < 0 || workdayEndHour > 23 ||
        lunchStartHour < 0 || lunchStartHour > 23 ||
        lunchEndHour < 0 || lunchEndHour > 23) {
      return NextResponse.json({ error: 'Invalid hour values' }, { status: 400 })
    }

    if (workdayStartHour >= workdayEndHour) {
      return NextResponse.json({ error: 'Workday start must be before end' }, { status: 400 })
    }

    if (lunchStartHour >= lunchEndHour) {
      return NextResponse.json({ error: 'Lunch start must be before end' }, { status: 400 })
    }

    // Get existing preferences
    const { data: existingSettings } = await supabase
      .from('user_settings')
      .select('preferences')
      .eq('user_id', user.id)
      .single()

    const existingPreferences = existingSettings?.preferences || {}

    // Update workday settings
    const updatedPreferences = {
      ...existingPreferences,
      workday: {
        workday_start_hour: workdayStartHour,
        workday_end_hour: workdayEndHour,
        lunch_start_hour: lunchStartHour,
        lunch_end_hour: lunchEndHour,
      }
    }

    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        preferences: updatedPreferences,
        updated_at: new Date().toISOString()
      })

    if (error) {
      console.error('Error updating workday settings:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in PATCH /api/settings/workday:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}















































