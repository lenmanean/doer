import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/supabase/service-role'
import { serverLogger } from '@/lib/logger/server'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * POST /api/account/restore
 * Restores an account that was scheduled for deletion
 * Clears scheduled_deletion_at and updates audit log
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const supabaseService = getServiceRoleClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user settings to check for scheduled deletion
    const { data: userSettings, error: settingsError } = await supabase
      .from('user_settings')
      .select('scheduled_deletion_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (settingsError) {
      serverLogger.error('Error fetching user settings for restore', {
        userId: user.id,
        error: settingsError.message,
      })
      return NextResponse.json(
        { error: 'Failed to check account status' },
        { status: 500 }
      )
    }

    // Check if account is scheduled for deletion
    if (!userSettings?.scheduled_deletion_at) {
      return NextResponse.json(
        { error: 'Account is not scheduled for deletion' },
        { status: 400 }
      )
    }

    // Clear scheduled_deletion_at
    const { error: updateError } = await supabase
      .from('user_settings')
      .update({ scheduled_deletion_at: null })
      .eq('user_id', user.id)

    if (updateError) {
      serverLogger.error('Error clearing scheduled deletion', {
        userId: user.id,
        error: updateError.message,
      })
      return NextResponse.json(
        { error: 'Failed to restore account' },
        { status: 500 }
      )
    }

    // Update audit log to 'restored' status
    // Find the most recent audit record for this user with 'scheduled' status
    const { data: auditRecords } = await supabaseService
      .from('account_deletion_audit')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'scheduled')
      .order('deletion_initiated_at', { ascending: false })
      .limit(1)

    if (auditRecords && auditRecords.length > 0) {
      await supabaseService
        .from('account_deletion_audit')
        .update({
          status: 'restored',
          deletion_completed_at: new Date().toISOString(),
        })
        .eq('id', auditRecords[0].id)
    }

    serverLogger.logAccountDeletion('account_restore', 'completed', {
      userId: user.id,
      scheduledDeletionAt: userSettings.scheduled_deletion_at,
    })

    return NextResponse.json({ 
      success: true,
      message: 'Account has been successfully restored',
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    serverLogger.error('Unexpected error in POST /api/account/restore', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

