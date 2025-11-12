import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/settings/export-data
 * Exports all user data in multiple formats (JSON, CSV)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'json'

    // Fetch all user data
    const [plansResult, tasksResult, userSettingsResult, taskSchedulesResult, taskCompletionsResult] = await Promise.all([
      supabase
        .from('plans')
        .select('*')
        .eq('user_id', user.id),
      supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id),
      supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('task_schedule')
        .select('*')
        .eq('user_id', user.id),
      supabase
        .from('task_completions')
        .select('*')
        .eq('user_id', user.id)
    ])

    const dateStr = new Date().toISOString().split('T')[0]

    if (format === 'csv') {
      // Convert to CSV format
      let csv = 'Type,ID,Name/Title,Created Date,Status,Details\n'
      
      // Plans
      if (plansResult.data) {
        plansResult.data.forEach((plan: any) => {
          const title = plan.goal_text || plan.summary_data?.goal_title || 'Untitled Plan'
          const status = plan.status || 'unknown'
          const details = (plan.clarifications || '').replace(/"/g, '""').replace(/\n/g, ' ')
          csv += `Plan,${plan.id},"${title.replace(/"/g, '""')}",${plan.created_at},${status},"${details}"\n`
        })
      }
      
      // Tasks
      if (tasksResult.data) {
        tasksResult.data.forEach((task: any) => {
          const name = task.name || 'Unnamed Task'
          const details = (task.details || '').replace(/"/g, '""').replace(/\n/g, ' ')
          csv += `Task,${task.id},"${name.replace(/"/g, '""')}",${task.created_at},"","${details}"\n`
        })
      }

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="doer-data-export-${dateStr}.csv"`
        }
      })
    }

    // Default: JSON format
    const exportData = {
      export_date: new Date().toISOString(),
      user_id: user.id,
      user_email: user.email,
      user_metadata: user.user_metadata,
      plans: plansResult.data || [],
      tasks: tasksResult.data || [],
      task_schedules: taskSchedulesResult.data || [],
      task_completions: taskCompletionsResult.data || [],
      user_settings: userSettingsResult.data || null,
      summary: {
        total_plans: (plansResult.data || []).length,
        total_tasks: (tasksResult.data || []).length,
        total_schedules: (taskSchedulesResult.data || []).length,
        total_completions: (taskCompletionsResult.data || []).length
      }
    }

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="doer-data-export-${dateStr}.json"`
      }
    })
  } catch (error) {
    console.error('Error exporting data:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

