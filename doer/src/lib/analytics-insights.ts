import { ActivityHeatmapData } from '@/components/ui/ActivityHeatmap'
import { TrendChartData } from '@/components/ui/TrendChart'
import { BarChartData } from '@/components/ui/BarChart'

// Activity Heatmap Insights
export function analyzeActivityHeatmap(data: ActivityHeatmapData[]): string {
  if (data.length === 0) {
    return "No activity data available. Start completing tasks to see your activity patterns visualized."
  }

  const recentData = data.slice(-90) // Last 90 days
  const totalDays = recentData.length
  const activeDays = recentData.filter(d => d.count > 0).length
  const activityRate = (activeDays / totalDays) * 100
  const avgDailyTasks = recentData.reduce((sum, d) => sum + d.count, 0) / totalDays
  const maxDailyTasks = Math.max(...recentData.map(d => d.count))
  
  // Check for streaks
  let currentStreak = 0
  let maxStreak = 0
  let tempStreak = 0
  
  for (let i = recentData.length - 1; i >= 0; i--) {
    if (recentData[i].count > 0) {
      tempStreak++
      if (i === recentData.length - 1) {
        currentStreak = tempStreak
      }
      maxStreak = Math.max(maxStreak, tempStreak)
    } else {
      tempStreak = 0
    }
  }

  // Check for consistency (variance)
  const variance = recentData.reduce((sum, d) => {
    const diff = d.count - avgDailyTasks
    return sum + (diff * diff)
  }, 0) / totalDays
  const consistency = variance < 2 ? 'high' : variance < 5 ? 'moderate' : 'low'

  // Generate insights
  if (activityRate < 30) {
    return `Your activity is quite sparse with only ${Math.round(activityRate)}% of days showing activity. This low engagement suggests you may be struggling to maintain consistency. Consider setting smaller, daily goals to build momentum. Even completing 1-2 tasks per day can significantly improve your progress over time.`
  } else if (activityRate < 50) {
    return `You're active on ${Math.round(activityRate)}% of days, showing moderate engagement. Your average of ${avgDailyTasks.toFixed(1)} tasks per day indicates room for improvement. Try to establish a daily routine - consistency is key to long-term success. Focus on maintaining your current streak of ${currentStreak} days.`
  } else if (activityRate < 70) {
    return `Good activity levels! You're active ${Math.round(activityRate)}% of the time with an average of ${avgDailyTasks.toFixed(1)} tasks daily. Your ${consistency === 'high' ? 'consistent' : consistency === 'moderate' ? 'somewhat consistent' : 'inconsistent'} pattern shows ${consistency === 'high' ? 'strong discipline' : 'areas for improvement'}. ${currentStreak > 0 ? `Keep your ${currentStreak}-day streak going!` : 'Try to build a daily streak.'}`
  } else {
    return `Excellent activity! You're active ${Math.round(activityRate)}% of days with ${avgDailyTasks.toFixed(1)} tasks on average. Your ${consistency === 'high' ? 'highly consistent' : 'consistent'} pattern demonstrates strong commitment. ${currentStreak > 7 ? `Your ${currentStreak}-day streak is impressive!` : currentStreak > 0 ? `Maintain your ${currentStreak}-day streak.` : 'Consider building a longer streak.'} ${maxDailyTasks > avgDailyTasks * 2 ? 'You have high-capacity days - leverage these for challenging tasks.' : ''}`
  }
}

// Completion Trend Insights
export function analyzeCompletionTrend(data: TrendChartData[]): string {
  if (data.length === 0) {
    return "No completion data available. Complete tasks to track your progress over time."
  }

  const values = data.map(d => d.value)
  const avgCompletion = values.reduce((sum, v) => sum + v, 0) / values.length
  const recentAvg = values.slice(-7).reduce((sum, v) => sum + v, 0) / Math.min(7, values.length)
  const earlierAvg = values.slice(0, -7).length > 0 
    ? values.slice(0, -7).reduce((sum, v) => sum + v, 0) / (values.length - 7)
    : avgCompletion
  
  const trend = recentAvg - earlierAvg
  const trendPercent = Math.abs(trend)
  const isImproving = trend > 2
  const isDeclining = trend < -2
  const isStable = !isImproving && !isDeclining

  const minCompletion = Math.min(...values)
  const maxCompletion = Math.max(...values)
  const variance = values.reduce((sum, v) => {
    const diff = v - avgCompletion
    return sum + (diff * diff)
  }, 0) / values.length
  const volatility = variance > 400 ? 'high' : variance > 100 ? 'moderate' : 'low'

  // Generate insights
  if (avgCompletion < 50) {
    const trendMsg = isDeclining
      ? `It's declining by ${trendPercent.toFixed(1)}% recently, indicating you may be taking on too much or losing motivation.`
      : isImproving
      ? `However, you're improving by ${trendPercent.toFixed(1)}% - keep this momentum!`
      : 'This suggests tasks may be too challenging or poorly scheduled.'
    return `Your completion rate is ${avgCompletion.toFixed(1)}%, which is below optimal. ${trendMsg} Consider breaking tasks into smaller steps, reducing your daily load, or reassessing task priorities. Consistency at a lower rate is better than sporadic high performance.`
  } else if (avgCompletion < 70) {
    const trendMsg = isImproving
      ? `Great progress! You're improving by ${trendPercent.toFixed(1)}% recently.`
      : isDeclining
      ? `You're declining by ${trendPercent.toFixed(1)}% - this may indicate burnout or overcommitment.`
      : 'Your performance is stable.'
    const volatilityMsg = volatility === 'high'
      ? 'Your completion rate varies significantly, suggesting inconsistent planning or execution.'
      : volatility === 'moderate'
      ? 'Some variation in your completion rate suggests room for more consistent planning.'
      : 'Your consistent performance is a strength.'
    return `Your completion rate is ${avgCompletion.toFixed(1)}%, showing moderate performance. ${trendMsg} ${volatilityMsg} Focus on maintaining realistic expectations and building sustainable habits.`
  } else if (avgCompletion < 85) {
    const trendMsg = isImproving 
      ? `You're trending upward by ${trendPercent.toFixed(1)}% - excellent momentum!`
      : isDeclining 
      ? `Watch out - you're declining by ${trendPercent.toFixed(1)}%. This might indicate you're pushing too hard.`
      : 'Your performance is steady.'
    const volatilityMsg = volatility === 'high' 
      ? 'Your completion rate fluctuates - try to maintain more consistent daily performance.'
      : 'Your consistent performance shows good planning and execution.'
    return `Strong completion rate of ${avgCompletion.toFixed(1)}%! ${trendMsg} ${volatilityMsg} You're on track, but there's room to push toward 85%+ for optimal productivity.`
  } else {
    const trendMsg = isImproving
      ? `You're still improving by ${trendPercent.toFixed(1)}% - exceptional work!`
      : isDeclining
      ? `Slight decline of ${trendPercent.toFixed(1)}% - monitor for signs of overcommitment.`
      : 'You're maintaining excellent performance.'
    const volatilityMsg = volatility === 'low'
      ? 'Your consistent high performance demonstrates excellent planning and execution.'
      : 'Maintain this high level while ensuring sustainability.'
    return `Outstanding completion rate of ${avgCompletion.toFixed(1)}%! ${trendMsg} ${volatilityMsg} You're operating at peak efficiency - consider taking on more challenging goals or helping others improve their systems.`
  }
}

// Productivity Patterns Insights
export function analyzeProductivityPatterns(data: BarChartData[]): string {
  if (data.length === 0) {
    return "No productivity data available. Complete tasks throughout the week to identify your most productive days."
  }

  const values = data.map(d => d.value)
  const avgProductivity = values.reduce((sum, v) => sum + v, 0) / values.length
  const maxProductivity = Math.max(...values)
  const minProductivity = Math.min(...values)
  const maxDay = data.find(d => d.value === maxProductivity)?.category || ''
  const minDay = data.find(d => d.value === minProductivity)?.category || ''
  
  const weekdayAvg = data
    .filter(d => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(d.category))
    .reduce((sum, d) => sum + d.value, 0) / 5
  const weekendAvg = data
    .filter(d => ['Sat', 'Sun'].includes(d.category))
    .reduce((sum, d) => sum + d.value, 0) / 2
  
  const weekdayVsWeekend = weekdayAvg - weekendAvg
  const variance = values.reduce((sum, v) => {
    const diff = v - avgProductivity
    return sum + (diff * diff)
  }, 0) / values.length
  const consistency = variance < 50 ? 'high' : variance < 150 ? 'moderate' : 'low'

  // Generate insights
  if (maxProductivity < 10) {
    return `Your productivity is quite low across all days, with ${maxDay} being your most productive day at ${maxProductivity} tasks. This suggests you may be struggling to maintain consistent work habits. Consider establishing a daily routine, starting with just 1-2 tasks per day. Build momentum gradually rather than trying to do everything at once.`
  } else if (maxProductivity < 20) {
    return `${maxDay} is your most productive day (${maxProductivity} tasks), while ${minDay} is your least productive (${minProductivity} tasks). ${weekdayVsWeekend > 5 ? 'You\'re significantly more productive on weekdays, which is common for work-focused schedules.' : weekdayVsWeekend < -5 ? 'You\'re more productive on weekends - consider if your weekday schedule needs adjustment.' : 'Your productivity is balanced across weekdays and weekends.'} ${consistency === 'low' ? 'Your productivity varies significantly by day - try to distribute work more evenly.' : 'Your consistent productivity across days shows good planning.'}`
  } else if (maxProductivity < 30) {
    return `Strong productivity patterns! ${maxDay} is your peak day (${maxProductivity} tasks). ${weekdayVsWeekend > 5 ? 'Your weekday focus is clear - leverage this for important tasks.' : weekdayVsWeekend < -5 ? 'Your weekend productivity is notable - use this time strategically.' : 'You maintain good productivity throughout the week.'} ${consistency === 'high' ? 'Your consistent daily productivity demonstrates excellent time management.' : 'Consider scheduling your most challenging tasks on your peak days (' + maxDay + ') to maximize efficiency.'}`
  } else {
    return `Exceptional productivity! ${maxDay} stands out as your peak day (${maxProductivity} tasks). ${weekdayVsWeekend > 5 ? 'Your weekday productivity is exceptional - you\'re maximizing your work schedule effectively.' : weekdayVsWeekend < -5 ? 'Your weekend productivity is impressive - you maintain high output even on days off.' : 'You maintain high productivity consistently throughout the week.'} ${consistency === 'high' ? 'Your consistent high productivity across all days is remarkable.' : 'Schedule your most important and challenging work on ' + maxDay + ' to leverage your peak performance.'} Consider if you can sustain this level long-term or if strategic rest days would improve overall outcomes.`
  }
}

// Rescheduling Analysis Insights
export function analyzeRescheduling(data: BarChartData[]): string {
  if (data.length === 0) {
    return "No rescheduling data available. Track task reschedules to understand your time management patterns."
  }

  const totalTasks = data.reduce((sum, d) => {
    if (d.subValues) {
      return sum + Object.values(d.subValues).reduce((s, v) => s + v, 0)
    }
    return sum + d.value
  }, 0)
  
  const totalRescheduled = data.reduce((sum, d) => {
    if (d.subValues) {
      // Check for 'Rescheduled' key (case-insensitive)
      const rescheduledKey = Object.keys(d.subValues).find(
        key => key.toLowerCase().includes('reschedule')
      )
      if (rescheduledKey) {
        return sum + d.subValues[rescheduledKey]
      }
    }
    return sum
  }, 0)
  
  const rescheduleRate = totalTasks > 0 ? (totalRescheduled / totalTasks) * 100 : 0
  
  // Calculate trend
  const recentWeek = data[0] // Most recent
  const previousWeek = data[1] || data[0]
  const olderWeek = data[2] || data[0]
  
  const recentRescheduledKey = recentWeek.subValues 
    ? Object.keys(recentWeek.subValues).find(key => key.toLowerCase().includes('reschedule'))
    : null
  const recentRescheduled = recentRescheduledKey ? (recentWeek.subValues?.[recentRescheduledKey] || 0) : 0
  const recentTotal = recentWeek.subValues 
    ? Object.values(recentWeek.subValues).reduce((s, v) => s + v, 0)
    : recentWeek.value
  const recentRate = recentTotal > 0 ? (recentRescheduled / recentTotal) * 100 : 0
  
  const previousRescheduledKey = previousWeek.subValues
    ? Object.keys(previousWeek.subValues).find(key => key.toLowerCase().includes('reschedule'))
    : null
  const previousRescheduled = previousRescheduledKey ? (previousWeek.subValues?.[previousRescheduledKey] || 0) : 0
  const previousTotal = previousWeek.subValues
    ? Object.values(previousWeek.subValues).reduce((s, v) => s + v, 0)
    : previousWeek.value
  const previousRate = previousTotal > 0 ? (previousRescheduled / previousTotal) * 100 : 0
  
  const trend = recentRate - previousRate
  const isImproving = trend < -5 // Decreasing reschedule rate is good
  const isWorsening = trend > 5

  // Generate insights
  if (rescheduleRate < 10) {
    return `Excellent time management! Only ${rescheduleRate.toFixed(1)}% of tasks are being rescheduled, indicating strong planning and commitment. ${isImproving ? 'You\'re improving further - your rescheduling rate decreased by ' + Math.abs(trend).toFixed(1) + '% recently.' : isWorsening ? 'Watch out - your rescheduling rate increased by ' + trend.toFixed(1) + '% recently.' : 'You\'re maintaining excellent consistency.'} This low reschedule rate suggests your task estimates are accurate and you\'re following through on commitments. Keep up this disciplined approach!`
  } else if (rescheduleRate < 20) {
    return `Good time management with ${rescheduleRate.toFixed(1)}% of tasks being rescheduled. ${isImproving ? 'Great progress! Your rescheduling rate decreased by ' + Math.abs(trend).toFixed(1) + '% recently, showing improved planning.' : isWorsening ? 'Your rescheduling rate increased by ' + trend.toFixed(1) + '% - this may indicate overcommitment or unrealistic scheduling.' : 'Your rescheduling rate is stable.'} This moderate rate suggests some tasks may be overestimated or external factors are affecting your schedule. Consider building buffer time into your plans or reassessing task complexity estimates.`
  } else if (rescheduleRate < 35) {
    return `Your rescheduling rate is ${rescheduleRate.toFixed(1)}%, indicating frequent schedule adjustments. ${isImproving ? 'Good news - you\'re improving! Your rescheduling rate decreased by ' + Math.abs(trend).toFixed(1) + '% recently.' : isWorsening ? 'Your rescheduling rate increased by ' + trend.toFixed(1) + '% - this suggests you may be taking on too much or underestimating task complexity.' : 'Your rescheduling rate remains elevated.'} This pattern suggests tasks may be too ambitious, poorly estimated, or external interruptions are common. Consider: (1) Breaking tasks into smaller, more manageable pieces, (2) Adding 20-30% buffer time to estimates, (3) Identifying and addressing common interruption sources.`
  } else {
    return `High rescheduling rate of ${rescheduleRate.toFixed(1)}% suggests significant planning challenges. ${isImproving ? 'You\'re making progress - rescheduling decreased by ' + Math.abs(trend).toFixed(1) + '% recently. Keep working on improving your planning.' : isWorsening ? 'Your rescheduling rate increased by ' + trend.toFixed(1) + '% - this is a red flag that your current approach isn\'t sustainable.' : 'This high rate persists, indicating systemic issues.'} This pattern typically indicates: (1) Tasks are significantly underestimated, (2) External factors frequently disrupt plans, (3) Overcommitment is common, or (4) Task priorities aren\'t well-aligned with available time. Take time to reassess your planning approach: use historical data to improve estimates, build in substantial buffer time, and consider reducing your daily task load to more realistic levels.`
  }
}

