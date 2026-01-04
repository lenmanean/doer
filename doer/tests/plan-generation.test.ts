// Integration Tests for Plan Generation
// Tests critical paths and edge cases

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { validatePlanInput, validateCapacity, validatePriorityDistribution, validateAvailabilityPayload } from '../src/lib/plan-validation'

describe('Plan Validation', () => {
  describe('validatePlanInput', () => {
    it('should accept valid plan input', () => {
      const result = validatePlanInput({
        goal_text: 'Complete project redesign with new features',
        start_date: '2025-11-15',
        timeline_days: 14
      })
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject empty goal text', () => {
      const result = validatePlanInput({
        goal_text: '',
        start_date: '2025-11-15'
      })
      
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Goal text is required')
    })

    it('should reject invalid date format', () => {
      const result = validatePlanInput({
        goal_text: 'Valid goal text here',
        start_date: '15-11-2025' // Wrong format
      })
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('YYYY-MM-DD format'))).toBe(true)
    })

    it('should reject timeline exceeding 21 days', () => {
      const result = validatePlanInput({
        goal_text: 'Valid goal text here',
        start_date: '2025-11-15',
        timeline_days: 25
      })
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('21 days'))).toBe(true)
    })

    it('should warn about short goal text', () => {
      const result = validatePlanInput({
        goal_text: 'Short',
        start_date: '2025-11-15'
      })
      
      expect(result.warnings.some(w => w.includes('very short'))).toBe(true)
    })

    it('should validate task durations', () => {
      const result = validatePlanInput({
        goal_text: 'Valid goal',
        start_date: '2025-11-15',
        tasks: [
          {
            name: 'Valid task',
            estimated_duration_minutes: 30,
            priority: 2
          },
          {
            name: 'Invalid task',
            estimated_duration_minutes: 400, // Exceeds max
            priority: 1
          }
        ]
      })
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('360 minutes'))).toBe(true)
    })
  })

  describe('validateCapacity', () => {
    it('should detect insufficient capacity', () => {
      const result = validateCapacity({
        tasks: [
          { estimated_duration_minutes: 120 },
          { estimated_duration_minutes: 120 },
          { estimated_duration_minutes: 120 },
          { estimated_duration_minutes: 120 },
          { estimated_duration_minutes: 120 }
        ], // 600 minutes total
        timeline_days: 1, // ~288 minutes capacity with 60% utilization
        workday_settings: {
          workday_start_hour: 9,
          workday_end_hour: 17,
          lunch_start_hour: 12,
          lunch_end_hour: 13
        }
      })
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('Timeline too short'))).toBe(true)
    })

    it('should accept sufficient capacity', () => {
      const result = validateCapacity({
        tasks: [
          { estimated_duration_minutes: 60 },
          { estimated_duration_minutes: 60 },
          { estimated_duration_minutes: 60 }
        ], // 180 minutes total
        timeline_days: 1, // ~288 minutes capacity
        workday_settings: {
          workday_start_hour: 9,
          workday_end_hour: 17,
          lunch_start_hour: 12,
          lunch_end_hour: 13
        }
      })
      
      expect(result.valid).toBe(true)
    })

    it('should warn about underutilization', () => {
      const result = validateCapacity({
        tasks: [
          { estimated_duration_minutes: 30 }
        ], // 30 minutes total
        timeline_days: 5, // ~1440 minutes capacity
        workday_settings: {
          workday_start_hour: 9,
          workday_end_hour: 17,
          lunch_start_hour: 12,
          lunch_end_hour: 13
        }
      })
      
      expect(result.warnings.some(w => w.includes('underutilized'))).toBe(true)
    })
  })

  describe('validatePriorityDistribution', () => {
    it('should accept balanced priorities', () => {
      const result = validatePriorityDistribution([
        { priority: 1, name: 'Task 1' },
        { priority: 2, name: 'Task 2' },
        { priority: 2, name: 'Task 3' },
        { priority: 3, name: 'Task 4' },
        { priority: 3, name: 'Task 5' },
        { priority: 4, name: 'Task 6' }
      ])
      
      expect(result.valid).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })

    it('should warn about too many critical tasks', () => {
      const result = validatePriorityDistribution([
        { priority: 1, name: 'Task 1' },
        { priority: 1, name: 'Task 2' },
        { priority: 1, name: 'Task 3' },
        { priority: 1, name: 'Task 4' },
        { priority: 2, name: 'Task 5' }
      ])
      
      expect(result.warnings.some(w => w.includes('Too many critical'))).toBe(true)
    })

    it('should warn about no high priority tasks', () => {
      const result = validatePriorityDistribution([
        { priority: 3, name: 'Task 1' },
        { priority: 3, name: 'Task 2' },
        { priority: 4, name: 'Task 3' },
        { priority: 4, name: 'Task 4' }
      ])
      
      expect(result.warnings.some(w => w.includes('No high priority'))).toBe(true)
    })
  })

  describe('validateAvailabilityPayload', () => {
    it('should accept empty availability', () => {
      const result = validateAvailabilityPayload(undefined)
      expect(result.valid).toBe(true)
      expect(result.normalized.busySlots).toHaveLength(0)
    })

    it('should normalize busy slots to ISO strings', () => {
      const result = validateAvailabilityPayload({
        busy_slots: [
          {
            start: '2025-11-12T09:00:00-05:00',
            end: '2025-11-12T10:00:00-05:00',
            source: 'existing_plan'
          }
        ]
      })

      expect(result.valid).toBe(true)
      expect(result.normalized.busySlots[0]).toMatchObject({
        start: expect.stringMatching(/2025-11-12T14:00:00\.000Z/),
        end: expect.stringMatching(/2025-11-12T15:00:00\.000Z/),
        source: 'existing_plan'
      })
    })

    it('should reject invalid availability date formats', () => {
      const result = validateAvailabilityPayload({
        busy_slots: [
          {
            start: 'invalid-date',
            end: '2025-11-12T10:00:00Z'
          }
        ]
      })

      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('invalid date format')
    })
  })
})

describe('Single-Day Plan Scheduling', () => {
  it('should enforce single-day constraint', () => {
    // This test would need actual scheduler integration
    // For now, testing the validation layer
    const result = validateCapacity({
      tasks: [
        { estimated_duration_minutes: 60 },
        { estimated_duration_minutes: 60 },
        { estimated_duration_minutes: 60 },
        { estimated_duration_minutes: 60 }
      ], // 240 minutes total
      timeline_days: 1,
      workday_settings: {
        workday_start_hour: 9,
        workday_end_hour: 17,
        lunch_start_hour: 12,
        lunch_end_hour: 13
      }
    })
    
    expect(result.valid).toBe(true)
  })

  it('should reject single-day plan with too many tasks', () => {
    const result = validateCapacity({
      tasks: [
        { estimated_duration_minutes: 120 },
        { estimated_duration_minutes: 120 },
        { estimated_duration_minutes: 120 },
        { estimated_duration_minutes: 120 }
      ], // 480 minutes - won't fit in single workday
      timeline_days: 1,
      workday_settings: {
        workday_start_hour: 9,
        workday_end_hour: 17,
        lunch_start_hour: 12,
        lunch_end_hour: 13
      }
    })
    
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('Timeline too short'))).toBe(true)
  })
})

describe('Priority-Based Scheduling', () => {
  it('should validate priority values', () => {
    const result = validatePlanInput({
      goal_text: 'Test goal',
      start_date: '2025-11-15',
      tasks: [
        {
          name: 'Valid P1',
          estimated_duration_minutes: 60,
          priority: 1
        },
        {
          name: 'Valid P4',
          estimated_duration_minutes: 30,
          priority: 4
        },
        {
          name: 'Invalid priority',
          estimated_duration_minutes: 45,
          priority: 5 // Invalid
        }
      ]
    })
    
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('Priority must be'))).toBe(true)
  })
})

describe('After-Hours Plan Creation', () => {
  it('should validate date adjustment logic', () => {
    // This test validates that our validation accepts dates
    // The actual date adjustment happens in the route handler
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]
    
    const result = validatePlanInput({
      goal_text: 'Plan created after hours',
      start_date: tomorrowStr,
      timeline_days: 1
    })
    
    expect(result.valid).toBe(true)
  })
})



