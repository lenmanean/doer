// Temporary script to verify waitlist table schema via Supabase service role
// Run with: node verify_waitlist_db.js

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: './doer/.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing required environment variables:')
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌')
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? '✅' : '❌')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function verifyWaitlistSchema() {
  console.log('='.repeat(80))
  console.log('PHASE 0: LIVE DATABASE VERIFICATION')
  console.log('='.repeat(80))
  console.log()

  // Query 1: Get all columns
  console.log('1. COLUMNS:')
  console.log('-'.repeat(80))
  const { data: columns, error: colsError } = await supabase.rpc('exec_sql', {
    query: `
      SELECT 
        column_name, 
        data_type, 
        is_nullable, 
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'waitlist' 
      ORDER BY ordinal_position;
    `
  })

  if (colsError) {
    // Try direct query via PostgREST if RPC doesn't work
    console.log('RPC method failed, trying alternative approach...')
    // We'll need to query via raw SQL - let's try a different approach
    console.log('Error:', colsError.message)
    console.log()
    console.log('Please run the SQL queries in verify_waitlist_schema.sql')
    console.log('in the Supabase SQL Editor and share the results.')
    process.exit(1)
  }

  if (!columns || columns.length === 0) {
    console.log('❌ ERROR: waitlist table does not exist!')
    process.exit(1)
  }

  console.table(columns)
  console.log()

  // Query 2: Check for UTM-like columns
  console.log('2. UTM-LIKE COLUMNS:')
  console.log('-'.repeat(80))
  const utmColumns = columns.filter(col => {
    const name = col.column_name.toLowerCase()
    return name.includes('utm') || 
           name.includes('campaign') || 
           name.includes('adset') ||
           name.includes('ad_name') ||
           (name.includes('source') && name !== 'source') ||
           name.includes('medium') ||
           name.includes('content') ||
           name.includes('term')
  })
  
  if (utmColumns.length > 0) {
    console.log('Found UTM-like columns:')
    console.table(utmColumns)
  } else {
    console.log('No UTM-like columns found.')
  }
  console.log()

  // Query 3: Check constraints (we'll need to use a different method)
  console.log('3. CONSTRAINTS:')
  console.log('-'.repeat(80))
  console.log('Note: Constraint details require direct SQL access.')
  console.log('Please run query #2 from verify_waitlist_schema.sql')
  console.log()

  // Query 4: Check indexes
  console.log('4. INDEXES:')
  console.log('-'.repeat(80))
  console.log('Note: Index details require direct SQL access.')
  console.log('Please run query #3 from verify_waitlist_schema.sql')
  console.log()

  // Summary
  console.log('='.repeat(80))
  console.log('VERIFICATION SUMMARY')
  console.log('='.repeat(80))
  console.log(`Table exists: ✅`)
  console.log(`Total columns: ${columns.length}`)
  console.log(`Columns: ${columns.map(c => c.column_name).join(', ')}`)
  console.log(`UTM columns found: ${utmColumns.length}`)
  if (utmColumns.length > 0) {
    console.log(`UTM columns: ${utmColumns.map(c => c.column_name).join(', ')}`)
  }
  console.log()
  console.log('⚠️  For complete verification (constraints, indexes, RLS),')
  console.log('   please run verify_waitlist_schema.sql in Supabase SQL Editor')
}

verifyWaitlistSchema().catch(console.error)










