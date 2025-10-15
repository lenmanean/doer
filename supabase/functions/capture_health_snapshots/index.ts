// Supabase Edge Function: capture_health_snapshots
// Purpose: Automated daily health snapshot capture for all active plans
// Schedule: Daily at 00:00 UTC via Supabase cron scheduler
//
// This function:
// 1. Queries all active plans
// 2. Calls capture_health_snapshot RPC for each plan
// 3. Logs results to console
// 4. Returns JSON response with capture count

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

interface Plan {
  user_id: string
  id: string
}

interface CaptureResult {
  success: boolean
  plan_id: string
  error?: string
  health_score?: number
}

serve(async (req) => {
  try {
    // Initialize Supabase client with service role key (for admin access)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log('[Snapshot Capture] Starting daily health snapshot capture...')
    console.log('[Snapshot Capture] Timestamp:', new Date().toISOString())

    // Query all active plans
    const { data: activePlans, error: plansError } = await supabase
      .from('plans')
      .select('user_id, id')
      .eq('status', 'active')

    if (plansError) {
      console.error('[Snapshot Capture] Error fetching active plans:', plansError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to fetch active plans',
          details: plansError.message 
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    if (!activePlans || activePlans.length === 0) {
      console.log('[Snapshot Capture] No active plans found')
      return new Response(
        JSON.stringify({ 
          success: true, 
          captured: 0,
          message: 'No active plans to capture'
        }),
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`[Snapshot Capture] Found ${activePlans.length} active plans`)

    // Loop through each plan and capture snapshot
    const results: CaptureResult[] = []
    let successCount = 0
    let errorCount = 0

    for (const plan of activePlans) {
      try {
        const { data, error } = await supabase.rpc('capture_health_snapshot', {
          p_user_id: plan.user_id,
          p_plan_id: plan.id
        })

        if (error) {
          console.error(`[Snapshot Capture] Error capturing snapshot for plan ${plan.id}:`, error)
          results.push({
            success: false,
            plan_id: plan.id,
            error: error.message
          })
          errorCount++
        } else {
          console.log(`[Snapshot Capture] ✓ Captured snapshot for plan ${plan.id}:`, {
            health_score: data.health_score,
            snapshot_date: data.snapshot_date
          })
          results.push({
            success: true,
            plan_id: plan.id,
            health_score: data.health_score
          })
          successCount++
        }
      } catch (err) {
        console.error(`[Snapshot Capture] Exception capturing snapshot for plan ${plan.id}:`, err)
        results.push({
          success: false,
          plan_id: plan.id,
          error: err.message || 'Unknown error'
        })
        errorCount++
      }
    }

    console.log(`[Snapshot Capture] Complete: ${successCount} successful, ${errorCount} errors`)

    return new Response(
      JSON.stringify({
        success: true,
        captured: successCount,
        errors: errorCount,
        total_plans: activePlans.length,
        timestamp: new Date().toISOString(),
        results: results
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('[Snapshot Capture] Fatal error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
})


