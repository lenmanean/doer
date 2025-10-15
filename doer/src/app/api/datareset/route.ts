import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'User not authenticated' },
        { status: 401 }
      )
    }

    console.log(`Resetting data for user ${user.id}`)
    
    // Use database function to reset user data (bypasses RLS for complete cleanup)
    const { data: deletedCounts, error: resetError } = await supabase
      .rpc('reset_user_data', { target_user_id: user.id })
    
    if (resetError) {
      console.error('Error resetting user data:', resetError)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to reset user data: ' + resetError.message 
        },
        { status: 500 }
      )
    }
    
    // Log the deletion counts
    console.log('User data reset complete:', deletedCounts)
    for (const [table, count] of Object.entries(deletedCounts || {})) {
      console.log(`  - ${table}: ${count} row(s) deleted`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error in data reset:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'An unexpected error occurred while resetting your data' 
      },
      { status: 500 }
    )
  }
}
