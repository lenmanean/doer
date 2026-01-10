import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * POST /api/preferences/strengthen-plan-modal
 * Updates the user's preference for showing the strengthen plan modal
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { dont_show_again } = body

    // Validate input
    if (typeof dont_show_again !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid dont_show_again value. Must be a boolean.' },
        { status: 400 }
      )
    }

    // Fetch current preferences
    const { data: existingProfile, error: fetchError } = await supabase
      .from('user_settings')
      .select('preferences')
      .eq('user_id', user.id)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 means no row found, which is fine - we'll create it
      console.error('Error fetching profile:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    // Get current preferences or initialize empty object
    const currentPrefs = existingProfile?.preferences || {}
    
    // Update the strengthen_plan_modal preference
    const updatedPrefs = {
      ...currentPrefs,
      strengthen_plan_modal: {
        ...(currentPrefs.strengthen_plan_modal || {}),
        dont_show_again
      }
    }

    // Upsert the user_settings with updated preferences
    const { error: updateError } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        preferences: updatedPrefs,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })

    if (updateError) {
      console.error('Error updating preference:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      preference: { dont_show_again }
    })
  } catch (error) {
    console.error('Unexpected error in POST /api/preferences/strengthen-plan-modal:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/preferences/strengthen-plan-modal
 * Fetches the user's preference for showing the strengthen plan modal
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch current preferences
    const { data: profile, error: fetchError } = await supabase
      .from('user_settings')
      .select('preferences')
      .eq('user_id', user.id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        // No profile found, return default (show modal)
        return NextResponse.json({ 
          dont_show_again: false 
        })
      }
      console.error('Error fetching profile:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    const dontShowAgain = profile?.preferences?.strengthen_plan_modal?.dont_show_again ?? false

    return NextResponse.json({ 
      dont_show_again: dontShowAgain
    })
  } catch (error) {
    console.error('Unexpected error in GET /api/preferences/strengthen-plan-modal:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

