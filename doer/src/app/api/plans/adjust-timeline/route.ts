// src/app/api/plans/adjust-timeline/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/ai'
import { TimelineAdjustmentRequest } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Check authentication
    const supabaseClient = await supabase
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: TimelineAdjustmentRequest = await request.json()
    const { planId, newDuration, tasks } = body

    // Verify plan ownership
    const { data: plan, error: planError } = await supabaseClient
      .from('plans')
      .select('*')
      .eq('id', planId)
      .eq('user_id', user.id)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Generate AI-powered timeline redistribution
    const adjustedTasks = await redistributeTasksAcrossTimeline(tasks, newDuration, plan.start_date)

    // Update plan end date
    const startDate = new Date(plan.start_date)
    const newEndDate = new Date(startDate)
    newEndDate.setDate(startDate.getDate() + newDuration - 1)

    const { error: updateError } = await supabaseClient
      .from('plans')
      .update({
        end_date: newEndDate.toISOString().split('T')[0],
        timeline_days: newDuration
      })
      .eq('id', planId)

    if (updateError) {
      console.error('Error updating plan:', updateError)
      return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      adjustedTasks,
      newEndDate: newEndDate.toISOString().split('T')[0],
      timelineDays: newDuration
    })

  } catch (error) {
    console.error('Timeline adjustment error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Use AI to redistribute tasks across a new timeline
 */
async function redistributeTasksAcrossTimeline(
  tasks: any[],
  newDuration: number,
  startDate: string
): Promise<any[]> {
  const prompt = `Redistribute these tasks across a new timeline of ${newDuration} days.

ORIGINAL TASKS:
${tasks.map((task, i) => `${i + 1}. ${task.name} (${task.estimated_duration_minutes} min, Category ${task.category})`).join('\n')}

NEW TIMELINE: ${newDuration} days starting ${startDate}

REDISTRIBUTION RULES:
1. Maintain task order and categories
2. Distribute tasks evenly across available days
3. Consider task complexity when spacing
4. Ensure realistic daily workload (max 7 hours per day)
5. Add buffer time between complex tasks
6. Group related tasks when possible

RETURN JSON:
{
  "redistributed_tasks": [
    {
      "task_index": 0,
      "name": "Task name",
      "estimated_duration_minutes": 60,
      "category": "A",
      "suggested_day": 1,
      "suggested_time": "09:00",
      "rationale": "Why this placement"
    }
  ]
}`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a task scheduling expert. Return only valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    })

    const parsed = JSON.parse(completion.choices[0].message.content || '{}')
    return parsed.redistributed_tasks || []

  } catch (error) {
    console.error('AI redistribution error:', error)
    // Fallback: simple even distribution
    return tasks.map((task, index) => ({
      task_index: index,
      name: task.name,
      estimated_duration_minutes: task.estimated_duration_minutes,
      category: task.category,
      suggested_day: Math.floor((index / tasks.length) * newDuration) + 1,
      suggested_time: '09:00',
      rationale: 'Even distribution fallback'
    }))
  }
}




























