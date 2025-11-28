import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * GET /api/settings/timezone
 * Get the current user's timezone preference
 */
export async function GET() {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current settings
    const { data: settings, error: fetchError } = await supabase
      .from('user_settings')
      .select('preferences')
      .eq('user_id', user.id)
      .maybeSingle()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching timezone:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch timezone' }, { status: 500 })
    }

    const prefs = (settings?.preferences as any) ?? {}
    const timezone = prefs.timezone || null

    return NextResponse.json({ timezone })

  } catch (error) {
    console.error('Error in GET /api/settings/timezone:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/settings/timezone
 * Update the user's timezone preference
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { timezone } = body

    // Validate timezone
    if (!timezone || typeof timezone !== 'string') {
      return NextResponse.json({ error: 'Invalid timezone value' }, { status: 400 })
    }

    // Validate timezone format (basic check - should be IANA timezone like "America/New_York")
    if (!/^[A-Za-z_]+\/[A-Za-z_]+$/.test(timezone) && timezone !== 'UTC') {
      // Allow UTC and IANA timezones, but log warning for others
      console.warn(`[timezone] Potentially invalid timezone format: ${timezone}`)
    }

    // Get current settings first
    const { data: currentSettings, error: fetchError } = await supabase
      .from('user_settings')
      .select('preferences')
      .eq('user_id', user.id)
      .maybeSingle()

    // Update timezone in preferences JSONB
    const currentPreferences = currentSettings?.preferences || {}
    const updatedPreferences = {
      ...currentPreferences,
      timezone,
    }

    // Update user settings
    const { error: updateError } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        preferences: updatedPreferences,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })

    if (updateError) {
      console.error('Error updating timezone:', updateError)
      return NextResponse.json({ error: 'Failed to update timezone' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      timezone
    })

  } catch (error) {
    console.error('Error in PATCH /api/settings/timezone:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


