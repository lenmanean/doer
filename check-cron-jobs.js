const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)')
  console.error('\nNote: The cron.job table is in the cron schema and may require direct database access.')
  console.error('Please run check-cron-jobs.sql directly in your Supabase SQL Editor instead.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkCronJobs() {
  console.log('\n=== Checking for pg_cron Jobs ===\n')
  console.log('Note: cron.job table is in a restricted schema.')
  console.log('If this script fails, please run check-cron-jobs.sql in Supabase SQL Editor.\n')

  try {
    // Try to query cron.job directly (may not work due to schema restrictions)
    console.log('Attempting to query cron.job table...\n')
    
    // Use raw SQL query via RPC if available, otherwise show instructions
    console.log('⚠️  Direct query to cron.job may not be possible via Supabase client.')
    console.log('The cron schema is typically restricted.\n')
    console.log('=== Please run the SQL file directly ===')
    console.log('File: check-cron-jobs.sql')
    console.log('Location: Run in Supabase Dashboard > SQL Editor\n')
    
    // Show the SQL that should be run
    const sqlFile = path.join(__dirname, 'check-cron-jobs.sql')
    if (fs.existsSync(sqlFile)) {
      console.log('SQL queries to run:')
      console.log('─'.repeat(50))
      const sqlContent = fs.readFileSync(sqlFile, 'utf8')
      console.log(sqlContent)
      console.log('─'.repeat(50))
    }

  } catch (error) {
    console.error('Error:', error.message)
    console.log('\n=== Run SQL Directly ===')
    console.log('Please run check-cron-jobs.sql in your Supabase SQL Editor')
  }
}

function displayCronJobs(jobs) {
  if (!jobs || jobs.length === 0) {
    console.log('❌ No cron jobs found in the database')
    console.log('\nThis means no pg_cron jobs are currently scheduled.')
    return
  }

  console.log(`✅ Found ${jobs.length} cron job(s):\n`)
  
  jobs.forEach((job, index) => {
    console.log(`--- Job ${index + 1} ---`)
    console.log(`Job ID: ${job.jobid || job.jobid}`)
    console.log(`Name: ${job.jobname || '(unnamed)'}`)
    console.log(`Schedule: ${job.schedule || 'N/A'}`)
    console.log(`Command: ${job.command || 'N/A'}`)
    console.log(`Active: ${job.active !== undefined ? job.active : 'N/A'}`)
    console.log(`Database: ${job.database || 'N/A'}`)
    console.log('')
  })

  // Check if any are health-related
  const healthJobs = jobs.filter(job => 
    (job.command && job.command.includes('capture_health_snapshot')) ||
    (job.jobname && (job.jobname.includes('health') || job.jobname.includes('snapshot')))
  )

  if (healthJobs.length === 0) {
    console.log('⚠️  No health snapshot cron jobs found among the existing jobs')
  } else {
    console.log(`\n✅ Found ${healthJobs.length} health snapshot related job(s)`)
  }
}

checkCronJobs()
  .then(() => {
    console.log('\n=== Check Complete ===\n')
    process.exit(0)
  })
  .catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
