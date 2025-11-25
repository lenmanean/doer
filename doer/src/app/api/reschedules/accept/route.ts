import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { applyRescheduleProposal } from '@/lib/task-auto-rescheduler'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { proposalIds } = body

    if (!proposalIds || !Array.isArray(proposalIds) || proposalIds.length === 0) {
      return NextResponse.json({ error: 'Proposal IDs array is required' }, { status: 400 })
    }

    // Verify all proposals belong to user (can be from any plan or free-mode)
    const { data: proposals, error: proposalsError } = await supabase
      .from('pending_reschedules')
      .select('id, plan_id, user_id, status')
      .in('id', proposalIds)
      .eq('user_id', user.id)
      .eq('status', 'pending')

    if (proposalsError) {
      return NextResponse.json({ error: 'Error validating proposals' }, { status: 500 })
    }

    if (!proposals || proposals.length !== proposalIds.length) {
      return NextResponse.json({ error: 'One or more proposals not found or already processed' }, { status: 400 })
    }

    // Apply each proposal
    const results = []
    const errors = []

    for (const proposalId of proposalIds) {
      try {
        const result = await applyRescheduleProposal(supabase, proposalId, user.id)
        if (result.success) {
          results.push(proposalId)
        }
      } catch (error) {
        console.error(`Error applying proposal ${proposalId}:`, error)
        errors.push({ proposalId, error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    if (results.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Failed to apply any proposals',
        errors
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Applied ${results.length} of ${proposalIds.length} reschedule proposal(s)`,
      appliedCount: results.length,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('Error accepting reschedule proposals:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

