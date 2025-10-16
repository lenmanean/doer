'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, ArrowRight, Calendar, Target, Clock, Star } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ReviewCalendar } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase/client'
import { toLocalMidnight, formatDateForDB, addDays, formatDateForDisplay } from '@/lib/date-utils'
import { User, OnboardingResponse, RoadmapData, MilestoneData, CalendarTask } from '@/lib/types'

export default function OnboardingReviewPage() {
  const router = useRouter()
  const { addToast } = useToast()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<OnboardingResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkUser = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          router.push('/login')
          return
        }

        setUser(user)

        // Get user's most recent onboarding response (for AI-generated plans)
        const { data: onboardingData, error: onboardingError } = await supabase
          .from('onboarding_responses')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (onboardingError && onboardingError.code !== 'PGRST116') {
          console.error('Error fetching onboarding responses:', onboardingError)
        }
        
        // If no onboarding response found, this is a manual plan - that's okay
        // The loadExistingRoadmap function will handle loading the plan data
        if (onboardingData) {
          setProfile(onboardingData)
        }
        
        setLoading(false)
      } catch (error) {
        console.error('Error in user check:', error)
        router.push('/login')
      }
    }

    checkUser()
  }, [router, supabase.auth])
  const [roadmapData, setRoadmapData] = useState<RoadmapData | null>(null)
  const [plan, setPlan] = useState<any>(null)
  const [isGenerating, setIsGenerating] = useState(true)
  const [calendarTasks, setCalendarTasks] = useState<CalendarTask[]>([])
  const [hoveredMilestone, setHoveredMilestone] = useState<MilestoneData | null>(null)
  const [hasGenerated, setHasGenerated] = useState(false)

  const loadExistingRoadmap = async () => {
    if (!user) {
      console.error('No user data available')
      setIsGenerating(false)
      return
    }
    
    setIsGenerating(true)
    
    try {
      // Check if plan exists - get the most recent active or paused plan
      const { data: existingPlan } = await supabase
        .from('plans')
        .select('id')
        .eq('user_id', user.id)
        .in('status', ['active', 'paused'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!existingPlan) {
        console.log('No plan found, redirecting to loading page...')
        router.push('/onboarding/loading')
        return
      }
      
      // Load the generated plan data - get the most recent active or paused plan
      const { data: plan, error: planError } = await supabase
        .from('plans')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['active', 'paused'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (planError) {
        console.error('Error fetching generated plan:', planError)
        setIsGenerating(false)
        return
      }

      // Store the plan data in state
      setPlan(plan)

      // Load milestones and tasks from the generated plan
      const { data: milestones, error: milestonesError } = await supabase
        .from('milestones')
        .select('*')
        .eq('plan_id', plan.id)
        .order('idx', { ascending: true })

      if (milestonesError) {
        console.error('Error fetching milestones:', milestonesError)
        setIsGenerating(false)
        return
      }

      // Debug: Check if tasks exist for this plan
      console.log('Fetching tasks for plan:', plan.id)
      
      // Fetch tasks with their scheduled dates from task_schedule
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          id, plan_id, milestone_id, idx, name, category, user_id, created_at,
          task_schedule(
            id, plan_id, task_id, user_id, date, day_index, created_at
          )
        `)
        .eq('plan_id', plan.id)
        .order('idx', { ascending: true })

      if (tasksError) {
        console.error('Error fetching tasks:', {
          error: tasksError,
          errorMessage: tasksError.message,
          errorCode: tasksError.code,
          errorDetails: tasksError.details,
          errorHint: tasksError.hint,
          planId: plan.id
        })
        // Continue without tasks - we can still show milestones
        console.log('Continuing without tasks due to error')
      } else {
        console.log('Successfully fetched tasks:', tasks?.length || 0, 'tasks found')
        if (tasks && tasks.length > 0) {
          console.log('Sample task data:', tasks[0])
          console.log('Task schedule data:', tasks[0]?.task_schedule)
        }
      }

      // Use actual plan data - use toLocalMidnight to avoid timezone issues
      const startDate = toLocalMidnight(plan.start_date)
      const endDate = toLocalMidnight(plan.end_date)
      const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      
      console.log('Using generated plan start date:', startDate.toLocaleDateString())
      console.log('Using generated plan end date:', endDate.toLocaleDateString())
      
      // Convert milestones to the expected format - use toLocalMidnight to avoid timezone issues
      const milestonesData = (milestones || []).map((milestone: any) => ({
        id: milestone.id,
        title: milestone.name,
        date: toLocalMidnight(milestone.target_date),
        description: milestone.rationale
      }))
      
      // Debug: Log milestone dates to ensure they match
      console.log('Generated milestone dates:', milestonesData.map(m => m.date.toLocaleDateString()))
      console.log('Milestone objects:', milestonesData.map(m => ({ title: m.title, date: m.date })))
      
      // Convert tasks to calendar format
      const calendarTasks: any[] = []
      
      // Group tasks by date (only if tasks exist)
      if (tasks && tasks.length > 0) {
        console.log('Processing tasks for calendar:', tasks.length, 'tasks found')
        const tasksByDate: { [key: string]: any[] } = {}
        
        tasks.forEach((task: any) => {
          console.log('Processing task:', task.name, 'with schedule:', task.task_schedule)
          
          // Get the scheduled dates from task_schedule array
          if (task.task_schedule && Array.isArray(task.task_schedule)) {
            task.task_schedule.forEach((schedule: any) => {
              const taskDate = schedule.date
              if (taskDate) {
                if (!tasksByDate[taskDate]) {
                  tasksByDate[taskDate] = []
                }
                // Add task with appropriate prefix based on category for calendar compatibility
                const taskName = task.category === 'milestone_task' ? `🏆 ${task.name}` : task.name
                tasksByDate[taskDate].push(taskName)
                console.log('Added task to date:', taskDate, task.name, 'category:', task.category)
              }
            })
          } else {
            console.log('Task has no scheduled date:', task.name)
          }
        })
        
        // Convert to calendar format
        Object.keys(tasksByDate).forEach(date => {
          calendarTasks.push({
            date: date,
            tasks: tasksByDate[date]
          })
        })
        
        console.log('Calendar tasks created:', calendarTasks.length, 'date entries')
      } else {
        console.log('No tasks found, using milestone-only calendar')
      }
      
      // Add milestone markers (not tasks) to milestone target dates
      milestonesData.forEach((milestone: any) => {
        const milestoneDateString = formatDateForDB(milestone.date)
        const existingTasks = calendarTasks.find(t => t.date === milestoneDateString)
        if (existingTasks) {
          // Add milestone as a marker (will be styled differently in UI)
          existingTasks.tasks.push(`🎯 ${milestone.title}`)
        } else {
          calendarTasks.push({
            date: milestoneDateString,
            tasks: [`🎯 ${milestone.title}`]
          })
        }
      })
    
    setRoadmapData({
      startDate: startDate,
      endDate: endDate,
      days,
              milestones: milestonesData,
              taskCount: tasks ? tasks.length : 0
    })
    
      setCalendarTasks(calendarTasks)
    
    // [DATE_FIX] Log milestone dates for verification
      console.log('[DATE_FIX] Overview milestone dates:', milestonesData.map(m => m.date.toLocaleDateString()))
    console.log('[DATE_FIX] Calendar categorized dates:', {
      startDate: startDate.toLocaleDateString(),
      endDate: endDate.toLocaleDateString(),
        milestones: milestonesData.map(m => m.date.toLocaleDateString())
    })
    
    } catch (error) {
      console.error('Error generating roadmap:', error)
      alert('Failed to generate roadmap. Please try again.')
    } finally {
    setIsGenerating(false)
    }
  }

  useEffect(() => {
    if (user && !loading) {
      loadExistingRoadmap()
    }
  }, [user, loading])

  const handleContinueToRoadmap = async () => {
    try {
      // Plan already exists, just navigate to dashboard
      router.push('/dashboard')
    } catch (error) {
      console.error('Error navigating to dashboard:', error)
      alert('Failed to navigate to dashboard. Please try again.')
    }
  }


  const handleDateClick = (date: string) => {
    console.log('Date clicked:', date)
  }



  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-[#d7d2cb]">Loading...</div>
      </div>
    )
  }

  if (isGenerating) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center space-y-8">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-4 border-[#ff7f00] border-t-transparent rounded-full mx-auto"
          />
          <div>
            <h1 className="text-3xl font-bold text-[#d7d2cb] mb-4">
              Loading your plan...
            </h1>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-[#d7d2cb]">
            Your Roadmap is Ready!
          </h1>
          <p className="text-lg text-[#d7d2cb]/70 max-w-2xl mx-auto">
            We've created a personalized roadmap based on your goals. Review the details below and continue to your dashboard.
          </p>
        </div>

        {/* Interactive Timeline Visualization */}
        {roadmapData && roadmapData.milestones && (
        <div className="mb-8">
          <Card className="bg-white/5 backdrop-blur-md border border-white/10">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl text-[#d7d2cb] flex items-center gap-3">
                <Target className="w-5 h-5 text-[#ff7f00]" />
                Interactive Timeline
              </CardTitle>
              <CardDescription className="text-[#d7d2cb]/70">
                Your personalized roadmap journey with {roadmapData.milestones.length} key milestones
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pb-4">
              <div className="relative px-8 py-8 pb-4">
                {/* Timeline Container */}
                <div className="relative h-52 overflow-visible">
                  {/* Calculate intelligent zigzag path and node positions */}
                  {(() => {
                    const totalNodes = roadmapData.milestones.length + 2 // +2 for start and end
                    const svgWidth = 1000
                    const svgHeight = 200 // Increased to give more vertical space
                    const padding = 50
                    const usableWidth = svgWidth - (padding * 2)
                    
                    // Calculate node positions with more pronounced zigzag
                    const nodePositions: { x: number; y: number }[] = []
                    const pathPoints: string[] = []
                    
                    // Reduced zigzag amplitude to keep nodes within bounds
                    const zigzagAmplitude = svgHeight * 0.25 // 25% of total height (reduced from 40%)
                    
                    // Start point
                    const startX = padding
                    const startY = svgHeight / 2
                    nodePositions.push({ x: startX, y: startY })
                    
                    // Calculate positions for milestone nodes with pronounced zigzag
                    roadmapData.milestones.forEach((_: any, index: number) => {
                      const segmentWidth = usableWidth / (totalNodes - 1)
                      const x = padding + (segmentWidth * (index + 1))
                      
                      const y = index % 2 === 0 
                        ? (svgHeight / 2) - zigzagAmplitude  // Upper zigzag
                        : (svgHeight / 2) + zigzagAmplitude  // Lower zigzag
                      
                      nodePositions.push({ x, y })
                    })
                    
                    // End point - continue the zigzag pattern
                    const endX = svgWidth - padding
                    // End node should alternate based on number of milestones
                    const endY = roadmapData.milestones.length % 2 === 0 
                      ? (svgHeight / 2) - zigzagAmplitude  // Upper zigzag
                      : (svgHeight / 2) + zigzagAmplitude  // Lower zigzag
                    nodePositions.push({ x: endX, y: endY })
                    
                    // Create smooth sine-wave path using cubic bezier curves
                    let pathData = `M ${nodePositions[0].x},${nodePositions[0].y}`
                    
                    for (let i = 0; i < nodePositions.length - 1; i++) {
                      const current = nodePositions[i]
                      const next = nodePositions[i + 1]
                      
                      // Use cubic bezier for smoother sine-wave curves
                      // Control points positioned 1/3 and 2/3 along the x-axis
                      const control1X = current.x + (next.x - current.x) / 3
                      const control1Y = current.y
                      
                      const control2X = current.x + ((next.x - current.x) * 2 / 3)
                      const control2Y = next.y
                      
                      pathData += ` C ${control1X},${control1Y} ${control2X},${control2Y} ${next.x},${next.y}`
                    }
                    
                    return (
                      <>
                        {/* Zigzag Path with Nodes - Same SVG Coordinate System */}
                        <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="xMidYMid meet">
                          {/* Curved Path - Solid Orange */}
                          <path
                            d={pathData}
                            stroke="#ff7f00"
                            strokeWidth="4"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />

                          {/* Start Node */}
                          <circle
                            cx={nodePositions[0].x}
                            cy={nodePositions[0].y}
                            r="12"
                            fill="#ea580c"
                          />

                          {/* Milestone Nodes */}
                          {roadmapData.milestones.map((milestone: any, index: number) => {
                            const nodeIndex = index + 1
                            const position = nodePositions[nodeIndex]
                            
                            return (
                              <g key={milestone.id}>
                                <circle
                                  cx={position.x}
                                  cy={position.y}
                                  r="14"
                                  fill="#8b5cf6"
                                  className="cursor-pointer transition-all duration-200"
                                  onMouseEnter={() => setHoveredMilestone({ ...milestone, index, position })}
                                  onMouseLeave={() => setHoveredMilestone(null)}
                                  style={{
                                    filter: hoveredMilestone?.index === index ? 'drop-shadow(0 0 4px rgba(139,92,246,0.3))' : 'none'
                                  }}
                                />
                              </g>
                            )
                          })}

                          {/* End Node - Bigger with Checkmark */}
                          <g>
                            <circle
                              cx={nodePositions[nodePositions.length - 1].x}
                              cy={nodePositions[nodePositions.length - 1].y}
                              r="18"
                              fill="#22c55e"
                            />
                            <path
                              d={`M ${nodePositions[nodePositions.length - 1].x - 6},${nodePositions[nodePositions.length - 1].y} 
                                  L ${nodePositions[nodePositions.length - 1].x - 2},${nodePositions[nodePositions.length - 1].y + 4} 
                                  L ${nodePositions[nodePositions.length - 1].x + 6},${nodePositions[nodePositions.length - 1].y - 6}`}
                              stroke="white"
                              strokeWidth="2.5"
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </g>
                        </svg>
                      </>
                    )
                  })()}
                </div>

                {/* Milestone Hover Popup */}
                <AnimatePresence>
                  {hoveredMilestone && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2 }}
                      className="mt-6 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-[#8b5cf6] rounded-full flex items-center justify-center text-white font-bold text-sm">
                          {(hoveredMilestone.index ?? 0) + 1}
                        </div>
                        <div>
                          <div className="font-semibold text-[#d7d2cb] text-sm">{hoveredMilestone.title}</div>
                          <div className="text-xs text-[#d7d2cb]/60 mt-1">
                            {formatDateForDisplay(hoveredMilestone.date)}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

              </div>
            </CardContent>
          </Card>
        </div>
        )}

        {/* Main Content - Two Column Layout */}
        {roadmapData && roadmapData.milestones && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Left Column - Roadmap Overview */}
          <Card className="h-full min-h-[600px] flex flex-col">
            <CardHeader className="pb-4 flex-shrink-0">
              <CardTitle className="text-xl text-[#d7d2cb] flex items-center gap-3">
                <Target className="w-5 h-5 text-[#ff7f00]" />
                Roadmap Overview
              </CardTitle>
              <CardDescription className="text-[#d7d2cb]/70">
                {plan?.summary_data?.goal_summary || profile?.goal_text || 'Your personalized plan'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col flex-1 space-y-6">
              {/* Timeline Summary */}
              <div className="grid grid-cols-3 gap-3 flex-shrink-0">
                <div className="bg-white/5 rounded-lg p-4 text-center">
                  <div className="text-xl font-bold text-[#d7d2cb]">{roadmapData.days}</div>
                  <div className="text-xs text-[#d7d2cb]/70">Days Duration</div>
                </div>
                <div className="bg-white/5 rounded-lg p-4 text-center">
                  <div className="text-xl font-bold text-[#d7d2cb]">{roadmapData.milestones.length}</div>
                  <div className="text-xs text-[#d7d2cb]/70">Key Milestones</div>
                </div>
                <div className="bg-white/5 rounded-lg p-4 text-center">
                  <div className="text-xl font-bold text-[#d7d2cb]">{roadmapData.taskCount}</div>
                  <div className="text-xs text-[#d7d2cb]/70">Total Tasks</div>
                </div>
              </div>

              {/* Timeline */}
              <div className="text-center py-6 flex-shrink-0">
                <div className="flex items-center justify-center gap-4 text-lg font-semibold text-[#d7d2cb]">
                  <span>{formatDateForDisplay(roadmapData.startDate)}</span>
                  <ArrowRight className="w-5 h-5 text-[#d7d2cb]/60" />
                  <span>{formatDateForDisplay(roadmapData.endDate)}</span>
                </div>
              </div>

              {/* Milestones Wheel - Unique to this page */}
              <div className="flex flex-col flex-1 space-y-4">
                <h3 className="text-base font-semibold text-[#d7d2cb] flex-shrink-0">Key Milestones</h3>
                <div className="relative flex-1">
                  <div className="absolute inset-0 overflow-y-scroll">
                    <div className="space-y-3 p-1">
                      {roadmapData.milestones.map((milestone: any, index: number) => (
                        <div
                          key={milestone.id}
                          className="flex items-center gap-3 p-4 bg-white/5 rounded-lg border border-white/10"
                        >
                          <div className="w-8 h-8 bg-[#ff7f00] rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-[#d7d2cb] text-base mb-1">{milestone.title}</div>
                            <div className="text-sm text-[#d7d2cb]/70 mb-2">{milestone.description}</div>
                            <div className="text-xs text-[#d7d2cb]/50 bg-white/5 px-2 py-1 rounded inline-block">
                              {formatDateForDisplay(milestone.date)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right Column - Calendar */}
          <Card className="h-full min-h-[600px] flex flex-col">
            <CardHeader className="pb-4 flex-shrink-0">
              <CardTitle className="text-xl text-[#d7d2cb] flex items-center gap-3">
                <Calendar className="w-5 h-5 text-[#ff7f00]" />
                Interactive Calendar
              </CardTitle>
              <CardDescription className="text-[#d7d2cb]/70">
                Click on dates to view tasks and milestones
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 flex-1">
              <ReviewCalendar
                tasks={calendarTasks}
                onDateClick={handleDateClick}
                defaultView="month"
                hideDayView={true}
                showYearDecadeView={true}
                futureRangeYears={5}
                categorizedDates={{
                  startDate: roadmapData.startDate,
                  milestones: roadmapData.milestones.map((m: any) => m.date),
                  completionDate: roadmapData.endDate
                }}
              />
            </CardContent>
          </Card>
        </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={handleContinueToRoadmap}
            className="flex items-center gap-2 bg-[#ff7f00] hover:bg-[#ff7f00]/90 text-white"
          >
            Continue to Dashboard
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Progress Indicator */}
        <div className="flex justify-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <div className="w-3 h-3 rounded-full bg-[#ff7f00]"></div>
        </div>
      </div>
    </div>
  )
}
