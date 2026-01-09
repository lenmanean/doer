// Test script for health snapshot system
// Run with: node test-health-snapshots.js

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testHealthSnapshots() {
  console.log('\n=== Testing Health Snapshot System ===\n')

  try {
    // 1. Test the database function
    console.log('1. Testing database function: capture_all_health_snapshots()')
    const { data: functionResult, error: functionError } = await supabase.rpc('capture_all_health_snapshots')
    
    if (functionError) {
      console.error('❌ Database function error:', functionError.message)
    } else {
      console.log('✅ Database function executed successfully')
      console.log('   Result:', JSON.stringify(functionResult, null, 2))
    }

    // 2. Check recent snapshots
    console.log('\n2. Checking recent health snapshots')
    const { data: snapshots, error: snapshotsError } = await supabase
      .from('health_snapshots')
      .select('plan_id, user_id, snapshot_date, health_score, has_scheduled_tasks, created_at')
      .order('created_at', { ascending: false })
      .limit(5)
    
    if (snapshotsError) {
      console.error('❌ Error fetching snapshots:', snapshotsError.message)
    } else {
      console.log(`✅ Found ${snapshots?.length || 0} recent snapshot(s)`)
      if (snapshots && snapshots.length > 0) {
        snapshots.forEach((snapshot, idx) => {
          console.log(`   ${idx + 1}. Plan: ${snapshot.plan_id.substring(0, 8)}..., Health: ${snapshot.health_score}, Date: ${snapshot.snapshot_date}`)
        })
      }
    }

    // 3. Count active plans
    console.log('\n3. Counting active plans')
    const { data: plans, error: plansError } = await supabase
      .from('plans')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
    
    if (plansError) {
      console.error('❌ Error counting plans:', plansError.message)
    } else {
      console.log(`✅ Active plans: ${plans || 0}`)
    }

    // 4. Test Edge Function (if service role key is available)
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log('\n4. Testing Edge Function (via HTTP)')
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/capture_health_snapshots`
      
      try {
        const response = await fetch(edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        })
        
        const result = await response.json()
        
        if (response.ok) {
          console.log('✅ Edge Function executed successfully')
          console.log('   Result:', JSON.stringify(result, null, 2))
        } else {
          console.error('❌ Edge Function error:', result.error || 'Unknown error')
        }
      } catch (fetchError) {
        console.error('❌ Error calling Edge Function:', fetchError.message)
        console.log('   Note: This might fail if the function is not deployed or network is unreachable')
      }
    } else {
      console.log('\n4. Skipping Edge Function test (service role key not available)')
    }

    console.log('\n=== Test Complete ===\n')

  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

testHealthSnapshots()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })























