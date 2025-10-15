import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateTaskSchedule } from '@/lib/roadmap-server'
import { generateRoadmapContent } from '@/lib/ai'
import { toLocalMidnight, addDays, formatDateForDB } from '@/lib/date-utils'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    // ✅ No need to parse request body - data comes from onboarding_responses only

    // ✅ Authenticate user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user)
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })

    // ✅ Always load from onboarding_responses table (single source of truth)
    // Fetch the most recent onboarding response that hasn't been linked to a plan yet
    // This supports multiple plans - we get the latest unlinked response
    console.log('Fetching onboarding data for user:', user.id)
    
    const { data: onboardingData, error: onboardingError } = await supabase
      .from('onboarding_responses')
      .select('*')
      .eq('user_id', user.id)
      .is('plan_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (onboardingError) {
      console.error('Error fetching onboarding data:', onboardingError)
      return NextResponse.json(
        { error: 'Failed to fetch onboarding data', details: onboardingError.message },
        { status: 500 }
      )
    }
    
    if (!onboardingData) {
      console.error('No unlinked onboarding response found for user:', user.id)
      return NextResponse.json(
        { error: 'No onboarding data found. Please complete onboarding first.' },
        { status: 400 }
      )
    }
    
    console.log('Found onboarding data:', onboardingData.id, 'for goal:', onboardingData.goal_text)

    const finalGoalText = onboardingData.goal_text
    const finalClarifications = {
      clarification_1: onboardingData.clarification_1,
      clarification_2: onboardingData.clarification_2,
    }
    const finalClarificationQuestions = onboardingData.clarification_questions
    const finalStartDate = onboardingData.start_date

    // ✅ Validate inputs
    if (!finalGoalText || !finalStartDate)
      return NextResponse.json(
        { error: 'Missing required fields: goal_text or start_date' },
        { status: 400 }
      )

    // ✅ Generate roadmap content via AI
    console.log('Generating roadmap content with AI...')
    let aiContent
    
    try {
      aiContent = await generateRoadmapContent({ 
        goal: finalGoalText,
        start_date: finalStartDate,
        clarifications: finalClarifications,
        clarificationQuestions: finalClarificationQuestions
      })
      
      console.log('✅ AI content generated successfully')
    } catch (error) {
      console.error('❌ AI content generation failed:', error)
      return NextResponse.json({ 
        error: 'AI_GENERATION_FAILED',
        message: 'Failed to generate roadmap content. Please try again.',
      }, { status: 500 })
    }

    // ✅ Fix daily task count if AI failed to generate exact amount
    const expectedDailyTasks = aiContent.timeline_days - 2
    const actualDailyTasks = aiContent.daily_tasks.length
    
    if (actualDailyTasks !== expectedDailyTasks) {
      console.warn(`⚠️ Adjusting daily task count: ${actualDailyTasks} → ${expectedDailyTasks}`)
      
      if (actualDailyTasks < expectedDailyTasks) {
        // Pad with additional tasks by cycling through existing ones with variations
        const tasksNeeded = expectedDailyTasks - actualDailyTasks
        
        // Safety check: if AI generated very few or no daily tasks, create generic ones
        if (actualDailyTasks < 3) {
          console.error('⚠️ AI generated insufficient daily tasks for padding. Creating generic tasks.')
          const genericTasks = [
            { name: 'Review your progress', details: 'Take time to reflect on what you have learned.' },
            { name: 'Practice core skills', details: 'Focus on fundamental techniques.' },
            { name: 'Study relevant materials', details: 'Continue learning about your goal.' }
          ]
          
          for (let i = 0; i < tasksNeeded; i++) {
            const template = genericTasks[i % genericTasks.length]
            aiContent.daily_tasks.push({
              name: `${template.name} (Day ${actualDailyTasks + i + 1})`,
              details: template.details
            })
          }
        } else {
          const sampleSize = Math.min(10, actualDailyTasks) // Use up to 10 existing tasks as templates
          const sampleTasks = aiContent.daily_tasks.slice(-sampleSize)
          
          for (let i = 0; i < tasksNeeded; i++) {
            const template = sampleTasks[i % sampleTasks.length]
          
          // Create variations that maintain good grammar
          const variations = [
            (name: string) => `Review your progress on ${name.toLowerCase().replace(/^(practice|learn|study|research|watch|read|create|attend) /, '$1ing ')}`,
            (name: string) => `Continue ${name.toLowerCase().replace(/^(practice|learn|study|research|create|attend) /, '$1ing ')}`,
            (name: string) => `Spend more time ${name.toLowerCase().replace(/^(practice|learn|study|research|watch|read|create|attend) /, '$1ing ')}`,
            (name: string) => `Revisit ${name.toLowerCase().replace(/^(practice|learn|study|research|watch|read|create|attend) /, '$1ing ')}`,
            (name: string) => `Dedicate additional time to ${name.toLowerCase().replace(/^(practice|learn|study|research|watch|read|create|attend) /, '$1ing ')}`
          ]
          
          const variationFn = variations[i % variations.length]
          aiContent.daily_tasks.push({
            name: variationFn(template.name),
            details: template.details
          })
          }
          console.log(`✅ Padded ${tasksNeeded} daily tasks with grammatically correct variations`)
        }
      } else {
        // Trim excess tasks from the end (keep the most important early ones)
        const tasksToRemove = actualDailyTasks - expectedDailyTasks
        aiContent.daily_tasks = aiContent.daily_tasks.slice(0, expectedDailyTasks)
        console.log(`✅ Trimmed ${tasksToRemove} excess daily tasks`)
      }
    }

    if (aiContent.milestone_tasks.length < aiContent.milestones.length) {
      console.error('Insufficient milestone tasks:', { 
        expected: aiContent.milestones.length, 
        actual: aiContent.milestone_tasks.length 
      })
      await supabase.from('onboarding_responses').delete().eq('user_id', user.id)
      return NextResponse.json({ 
        error: 'VALIDATION_FAILED',
        message: `AI generated insufficient milestone tasks. Please restart onboarding.`,
        redirect: '/onboarding'
      }, { status: 400 })
    }

    // Calculate correct end_date from start_date + timeline_days
    // Don't trust AI's end_date calculation as it's prone to errors
    const [year, month, day] = finalStartDate.split('-').map(Number)
    const startDate = new Date(year, month - 1, day, 0, 0, 0, 0)
    
    // For a timeline of N days, end date is start_date + (N - 1) days
    // This gives us N days total: day 0, day 1, ..., day N-1
    const endDate = addDays(startDate, aiContent.timeline_days - 1)
    const calculatedEndDate = endDate.toISOString().split('T')[0]
    
    console.log('✅ AI content validated:', {
      timeline_days: aiContent.timeline_days,
      ai_end_date: aiContent.end_date,
      calculated_end_date: calculatedEndDate,
      milestones: aiContent.milestones.length,
      milestone_tasks: aiContent.milestone_tasks.length,
      daily_tasks: aiContent.daily_tasks.length
    })

    // ✅ Check for existing active plan and set it to 'paused'
    // Use RPC function for atomic operation to avoid race conditions with unique constraint
    console.log('Checking for existing active plans...')
    
    const { data: existingPlans, error: fetchError } = await supabase
      .from('plans')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('status', 'active')

    // Only handle actual errors, not "no rows found"
    if (fetchError) {
      console.error('Error fetching existing active plans:', fetchError)
      return NextResponse.json({ 
        error: 'Failed to check for existing plans',
        details: fetchError.message 
      }, { status: 500 })
    }

    if (existingPlans && existingPlans.length > 0) {
      console.log(`Found ${existingPlans.length} existing active plan(s), setting to paused:`, existingPlans.map(p => p.id))
      
      // Pause ALL active plans (shouldn't be more than 1, but just in case)
      for (const plan of existingPlans) {
        const { error: pauseError } = await supabase
          .from('plans')
          .update({ status: 'paused' })
          .eq('id', plan.id)
          .eq('user_id', user.id)
        
        if (pauseError) {
          console.error('Error pausing existing plan:', pauseError)
          return NextResponse.json({ 
            error: 'Failed to pause existing plan',
            details: pauseError.message,
            hint: 'Please try again or contact support if the issue persists'
          }, { status: 500 })
        }
      }
      
      console.log('✅ Successfully paused all existing active plans')
      
      // Small delay to ensure database constraint check happens after updates commit
      await new Promise(resolve => setTimeout(resolve, 100))
    } else {
      console.log('No existing active plans found - this will be the first plan')
    }

    console.log('Proceeding to insert new plan with status=active...')

    // ✅ Insert plan record
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .insert({
        user_id: user.id,
        goal_text: finalGoalText,
        clarifications: finalClarifications,
        start_date: finalStartDate,
        end_date: calculatedEndDate,
        status: 'active',
        plan_type: 'ai',
        summary_data: {
          total_duration_days: aiContent.timeline_days,
          goal_title: aiContent.goal_title,
          goal_summary: aiContent.plan_summary
        }
      })
      .select()
      .single()

    if (planError) {
      console.error('Plan insert error:', planError)
      return NextResponse.json({ error: planError.message }, { status: 500 })
    }

    // ✅ Update onboarding_responses with plan_id
    const { error: updateOnboardingError } = await supabase
      .from('onboarding_responses')
      .update({ plan_id: plan.id })
      .eq('user_id', user.id)
      .is('plan_id', null) // Only update if plan_id is null (not already linked)

    if (updateOnboardingError) {
      console.error('Error updating onboarding_responses with plan_id:', updateOnboardingError)
      // Don't fail the entire request if this update fails
    }

    // ✅ Insert milestones with deterministic date spacing
    const milestoneMap = new Map<number, string>()
    const milestoneCount = aiContent.milestones.length
    const totalDays = aiContent.timeline_days
    
    for (let i = 0; i < aiContent.milestones.length; i++) {
      const milestone = aiContent.milestones[i]
      
      // Calculate evenly spaced target dates
      const dayOffset = Math.floor((totalDays / (milestoneCount + 1)) * (i + 1))
      const targetDate = addDays(startDate, dayOffset)
      const targetDateStr = formatDateForDB(targetDate) // Use consistent date formatting
      
      const { data: milestoneData, error: milestoneError} = await supabase
        .from('milestones')
        .insert({
          plan_id: plan.id,
          user_id: user.id,
          idx: i + 1,
          name: milestone.name,
          rationale: milestone.rationale,
          target_date: targetDateStr,
        })
        .select()
        .single()

      if (milestoneError) {
        console.error('Milestone insert error:', milestoneError)
        continue
      }
      
      milestoneMap.set(i + 1, milestoneData.id)
    }

    // ✅ Create task records (AI content + DB IDs)
    const allTasks = [
      // Milestone tasks
      ...aiContent.milestone_tasks.map((task, index) => ({
        plan_id: plan.id,
        user_id: user.id,
        milestone_id: milestoneMap.get(task.milestone_idx) || null,
        idx: index + 1,
        name: task.name,
        category: 'milestone_task',
      })),
      // Daily tasks
      ...aiContent.daily_tasks.map((task, index) => ({
        plan_id: plan.id,
        user_id: user.id,
        milestone_id: null,
        idx: aiContent.milestone_tasks.length + index + 1,
        name: task.name,
        category: 'daily_task',
      }))
    ]

    console.log('Inserting tasks:', {
      milestone_tasks: aiContent.milestone_tasks.length,
      daily_tasks: aiContent.daily_tasks.length,
      total_tasks: allTasks.length
    })

    const { error: taskError } = await supabase.from('tasks').insert(allTasks)
    if (taskError) {
      console.error('Task insert error:', taskError)
      return NextResponse.json({ error: taskError.message }, { status: 500 })
    }

    // ✅ Generate deterministic task schedule
    try {
      await generateTaskSchedule(plan.id, startDate, endDate)
      console.log(`✅ Task schedule generated for ${aiContent.timeline_days}-day timeline`)
    } catch (scheduleError) {
      console.error('Error generating task schedule:', scheduleError)
    }

    return NextResponse.json({
      success: true,
      plan,
      timeline: {
        days: aiContent.timeline_days
      },
      milestones: aiContent.milestones.length,
      tasks: {
        milestone: aiContent.milestone_tasks.length,
        daily: aiContent.daily_tasks.length,
        total: allTasks.length
      }
    }, { status: 200 })
  } catch (err: any) {
    console.error('Generate Error:', err)
    console.error('Error details:', {
      message: err.message,
      code: err.code,
      details: err.details,
      hint: err.hint
    })
    return NextResponse.json({ 
      error: 'Unexpected error during plan generation',
      message: err.message || 'Unknown error',
      details: err.details || 'No additional details'
    }, { status: 500 })
  }
}