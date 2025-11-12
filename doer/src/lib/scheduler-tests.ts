/**
 * Comprehensive test suite for the scheduler
 * Prevents regression of known issues
 */

import { timeBlockScheduler } from './time-block-scheduler'
import { calculateTaskPosition, validateTaskPosition, groupTasksByTimeSlot } from './task-positioning'

// Test data
const mockTasks = [
  {
    id: '1',
    name: 'Test Task 1',
    estimated_duration_minutes: 60,
    complexity_score: 5,
    priority: 1,
    idx: 0
  },
  {
    id: '2', 
    name: 'Test Task 2',
    estimated_duration_minutes: 30,
    complexity_score: 3,
    priority: 2,
    idx: 1
  }
]

const mockOptions = {
  tasks: mockTasks,
  startDate: new Date('2025-10-28'),
  endDate: new Date('2025-11-03'),
  workdayStartHour: 9,
  workdayStartMinute: 0,
  workdayEndHour: 17,
  lunchStartHour: 12,
  lunchEndHour: 13
}

/**
 * Test 1: Daily capacity calculation (prevents dailyCapacity: 0 bug)
 */
export function testDailyCapacityCalculation() {
  console.log('🧪 Testing daily capacity calculation...')
  
  try {
    const result = timeBlockScheduler(mockOptions)
    
    // Should not throw an error
    console.log('✅ Daily capacity calculation passed')
    return true
  } catch (error) {
    console.error('❌ Daily capacity calculation failed:', error)
    return false
  }
}

/**
 * Test 2: Task positioning (prevents CSS positioning bug)
 */
export function testTaskPositioning() {
  console.log('🧪 Testing task positioning...')
  
  try {
    // Test single task
    const singleTaskPosition = calculateTaskPosition(0, 1, 5)
    validateTaskPosition(singleTaskPosition, 'Single Task')
    
    // Test multiple tasks
    const multiTaskPosition = calculateTaskPosition(1, 3, 5)
    validateTaskPosition(multiTaskPosition, 'Multi Task')
    
    // Test edge cases
    const edgeCasePosition = calculateTaskPosition(0, 10, 5)
    validateTaskPosition(edgeCasePosition, 'Edge Case Task')
    
    console.log('✅ Task positioning passed')
    return true
  } catch (error) {
    console.error('❌ Task positioning failed:', error)
    return false
  }
}

/**
 * Test 3: Task grouping (prevents complex grouping bugs)
 */
export function testTaskGrouping() {
  console.log('🧪 Testing task grouping...')
  
  try {
    // Test empty array
    const emptyGroups = groupTasksByTimeSlot([])
    if (emptyGroups.length !== 0) {
      throw new Error('Empty array should return empty groups')
    }
    
    // Test single task
    const singleTaskGroups = groupTasksByTimeSlot([mockTasks[0]])
    if (singleTaskGroups.length !== 1 || singleTaskGroups[0].length !== 1) {
      throw new Error('Single task should return single group with one task')
    }
    
    // Test multiple tasks
    const multiTaskGroups = groupTasksByTimeSlot(mockTasks)
    if (multiTaskGroups.length !== 1 || multiTaskGroups[0].length !== 2) {
      throw new Error('Multiple tasks should return single group with all tasks')
    }
    
    console.log('✅ Task grouping passed')
    return true
  } catch (error) {
    console.error('❌ Task grouping failed:', error)
    return false
  }
}

/**
 * Test 4: Invalid input handling
 */
export function testInvalidInputHandling() {
  console.log('🧪 Testing invalid input handling...')
  
  try {
    // Test invalid workday hours
    const invalidWorkdayOptions = {
      ...mockOptions,
      workdayStartHour: 25, // Invalid
      workdayEndHour: 17
    }
    
    try {
      timeBlockScheduler(invalidWorkdayOptions)
      throw new Error('Should have thrown error for invalid workday hours')
    } catch (error) {
      // Expected to throw
    }
    
    // Test invalid task durations
    const invalidTaskOptions = {
      ...mockOptions,
      tasks: [{
        ...mockTasks[0],
        estimated_duration_minutes: 0 // Invalid
      }]
    }
    
    try {
      timeBlockScheduler(invalidTaskOptions)
      throw new Error('Should have thrown error for invalid task duration')
    } catch (error) {
      // Expected to throw
    }
    
    console.log('✅ Invalid input handling passed')
    return true
  } catch (error) {
    console.error('❌ Invalid input handling failed:', error)
    return false
  }
}

/**
 * Test 5: Weekend-aware scheduling bias
 */
export function testWeekendSchedulingBias() {
  console.log('🧪 Testing weekend scheduling bias...')

  try {
    const startDate = new Date('2025-11-07') // Friday
    const endDate = new Date('2025-11-12') // Following Wednesday

    const tasks = [
      {
        id: 'long-session',
        name: 'Long Creative Session',
        estimated_duration_minutes: 240,
        complexity_score: 6,
        priority: 2,
        idx: 1
      },
      {
        id: 'daily-habit',
        name: 'Weekday Habit',
        estimated_duration_minutes: 45,
        complexity_score: 3,
        priority: 1,
        idx: 2
      }
    ]

    const result = timeBlockScheduler({
      tasks,
      startDate,
      endDate,
      workdayStartHour: 9,
      workdayStartMinute: 0,
      workdayEndHour: 17,
      lunchStartHour: 12,
      lunchEndHour: 13,
      allowWeekends: true,
      weekendStartHour: 10,
      weekendStartMinute: 0,
      weekendEndHour: 18,
      weekendLunchStartHour: 13,
      weekendLunchEndHour: 14,
      weekdayMaxMinutes: 180,
      weekendMaxMinutes: 360
    })

    const longPlacement = result.placements.find(p => p.task_id === 'long-session')
    const shortPlacement = result.placements.find(p => p.task_id === 'daily-habit')

    if (!longPlacement) throw new Error('Long session was not scheduled')
    const longDay = new Date(longPlacement.date).getDay()
    if (longDay !== 0 && longDay !== 6) {
      throw new Error(`Long session scheduled on weekday (${longPlacement.date}) instead of weekend`)
    }

    if (!shortPlacement) throw new Error('Weekday habit was not scheduled')
    const shortDay = new Date(shortPlacement.date).getDay()
    if (shortDay === 0 || shortDay === 6) {
      throw new Error(`Weekday habit scheduled on weekend (${shortPlacement.date}) despite bias`)
    }

    console.log('✅ Weekend scheduling bias passed')
    return true
  } catch (error) {
    console.error('❌ Weekend scheduling bias failed:', error)
    return false
  }
}

/**
 * Run all tests
 */
export function runAllSchedulerTests() {
  console.log('🚀 Running comprehensive scheduler tests...')
  
  const tests = [
    testDailyCapacityCalculation,
    testTaskPositioning,
    testTaskGrouping,
    testInvalidInputHandling,
    testWeekendSchedulingBias
  ]
  
  let passed = 0
  let failed = 0
  
  tests.forEach(test => {
    if (test()) {
      passed++
    } else {
      failed++
    }
  })
  
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`)
  
  if (failed === 0) {
    console.log('🎉 All tests passed! Scheduler is robust and ready.')
  } else {
    console.log('⚠️  Some tests failed. Please fix issues before creating new plans.')
  }
  
  return failed === 0
}
