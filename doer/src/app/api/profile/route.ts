import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/profile
 * Fetches the current user's profile
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error) {
      // If profile doesn't exist, create it
      if (error.code === 'PGRST116') {
        const { data: newProfile, error: createError } = await supabase
          .from('user_profiles')
          .insert({
            user_id: user.id,
            display_name: user.email?.split('@')[0] || 'User'
          })
          .select()
          .single()

        if (createError) {
          console.error('Error creating profile:', createError)
          return NextResponse.json({ error: createError.message }, { status: 500 })
        }

        return NextResponse.json({ profile: newProfile })
      }

      console.error('Error fetching profile:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Unexpected error in GET /api/profile:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/profile
 * Updates the current user's profile
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { display_name, bio, avatar_url, share_achievements, settings } = body

    // Validate input
    if (display_name && typeof display_name !== 'string') {
      return NextResponse.json(
        { error: 'Invalid display_name' },
        { status: 400 }
      )
    }

    if (bio && typeof bio !== 'string') {
      return NextResponse.json(
        { error: 'Invalid bio' },
        { status: 400 }
      )
    }

    if (avatar_url && typeof avatar_url !== 'string') {
      return NextResponse.json(
        { error: 'Invalid avatar_url' },
        { status: 400 }
      )
    }

    if (share_achievements !== undefined && typeof share_achievements !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid share_achievements' },
        { status: 400 }
      )
    }

    if (settings !== undefined && typeof settings !== 'object') {
      return NextResponse.json(
        { error: 'Invalid settings' },
        { status: 400 }
      )
    }

    // Build update object with only provided fields
    const updateData: any = { user_id: user.id }
    if (display_name !== undefined) updateData.display_name = display_name
    if (bio !== undefined) updateData.bio = bio
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url
    if (share_achievements !== undefined) updateData.share_achievements = share_achievements
    if (settings !== undefined) updateData.settings = settings

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .upsert(updateData, {
        onConflict: 'user_id'
      })
      .select()
      .single()

    if (error) {
      console.error('Error upserting profile:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ profile, success: true })
  } catch (error) {
    console.error('Unexpected error in POST /api/profile:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

