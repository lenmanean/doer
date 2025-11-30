import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

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
    const { enabled } = body

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid enabled value' }, { status: 400 })
    }

    // Get current settings first
    const { data: currentSettings, error: fetchError } = await supabase
      .from('user_settings')
      .select('preferences')
      .eq('user_id', user.id)
      .single()

    // Update smart scheduling settings in preferences JSONB
    const currentPreferences = currentSettings?.preferences || {}
    const updatedPreferences = {
      ...currentPreferences,
      smart_scheduling: {
        ...currentPreferences.smart_scheduling,
        enabled
      }
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
      console.error('Error updating smart scheduling setting:', updateError)
      return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      smartSchedulingEnabled: enabled
    })

  } catch (error) {
    console.error('Error updating smart scheduling setting:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current setting
    const { data: settings, error: fetchError } = await supabase
      .from('user_settings')
      .select('preferences')
      .eq('user_id', user.id)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error fetching smart scheduling setting:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch setting' }, { status: 500 })
    }

    // Extract smart scheduling enabled status from preferences
    const smartSchedulingEnabled = settings?.preferences?.smart_scheduling?.enabled ?? true

    return NextResponse.json({
      success: true,
      smartSchedulingEnabled
    })

  } catch (error) {
    console.error('Error fetching smart scheduling setting:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


