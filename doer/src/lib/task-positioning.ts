/**
 * Simplified and robust task positioning utilities
 * Prevents CSS positioning bugs by using simple, predictable logic
 */

export interface TaskPosition {
  left: string
  width: string
  zIndex: number
  marginRight?: string
}

/**
 * Calculate task position within a time slot
 * Uses simple, predictable logic to avoid CSS bugs
 */
export function calculateTaskPosition(
  taskIndex: number,
  totalTasks: number,
  baseZIndex: number = 5
): TaskPosition {
  // Simple rule: if only one task, take full width
  if (totalTasks === 1) {
    return {
      left: '0%',
      width: '100%',
      zIndex: baseZIndex
    }
  }

  // For multiple tasks, divide equally
  const width = 100 / totalTasks
  const left = taskIndex * width

  return {
    left: `${left}%`,
    width: `${width}%`,
    zIndex: baseZIndex + taskIndex,
    marginRight: taskIndex < totalTasks - 1 ? '2px' : '0px'
  }
}

/**
 * Validate task positioning to catch bugs early
 */
export function validateTaskPosition(position: TaskPosition, taskName: string): void {
  const leftValue = parseFloat(position.left)
  const widthValue = parseFloat(position.width)

  if (isNaN(leftValue) || isNaN(widthValue)) {
    throw new Error(`Invalid position values for task "${taskName}": left=${position.left}, width=${position.width}`)
  }

  if (leftValue < 0 || leftValue > 100) {
    throw new Error(`Invalid left position for task "${taskName}": ${position.left} (must be 0-100%)`)
  }

  if (widthValue <= 0 || widthValue > 100) {
    throw new Error(`Invalid width for task "${taskName}": ${position.width} (must be 0-100%)`)
  }

  if (leftValue + widthValue > 100) {
    throw new Error(`Task "${taskName}" overflows container: left=${position.left}, width=${position.width}`)
  }
}

/**
 * Group tasks by time slot with robust overlap detection
 * Handles overlapping tasks by placing them side-by-side
 */
export function groupTasksByTimeSlot(tasks: any[]): any[][] {
  if (tasks.length === 0) return []
  
  // Sort tasks by start time
  const sortedTasks = [...tasks].sort((a, b) => {
    const aStart = a.startMinutes || 0
    const bStart = b.startMinutes || 0
    return aStart - bStart
  })
  
  const groups: any[][] = []
  const processedTasks = new Set()
  
  sortedTasks.forEach((task) => {
    if (processedTasks.has(task.schedule_id)) return
    
    const group = [task]
    processedTasks.add(task.schedule_id)
    
    // Find all tasks that overlap with this task
    sortedTasks.forEach((otherTask) => {
      if (processedTasks.has(otherTask.schedule_id)) return
      
      // Check if tasks overlap in time
      const taskStart = task.startMinutes || 0
      const taskEnd = task.endMinutes || taskStart + (task.duration_minutes || 60)
      const otherStart = otherTask.startMinutes || 0
      const otherEnd = otherTask.endMinutes || otherStart + (otherTask.duration_minutes || 60)
      
      // Tasks overlap if one starts before the other ends
      if (otherStart < taskEnd && otherEnd > taskStart) {
        group.push(otherTask)
        processedTasks.add(otherTask.schedule_id)
      }
    })
    
    groups.push(group)
  })
  
  return groups
}

export interface OverlapGroup {
  tasks: any[]
  startTime: string
  endTime: string
  totalDuration: number
  id: string
}

/**
 * Detect overlapping tasks and group them together
 * Returns groups of tasks that truly overlap in time (excludes consecutive tasks)
 */
export function detectOverlappingTasks(tasks: any[]): OverlapGroup[] {
  if (tasks.length === 0) return []
  
  // Convert time strings to minutes for easier comparison
  const tasksWithMinutes = tasks.map(task => {
    const startMinutes = task.start_time ? 
      parseInt(task.start_time.split(':')[0]) * 60 + parseInt(task.start_time.split(':')[1]) : 0
    const endMinutes = task.end_time ? 
      parseInt(task.end_time.split(':')[0]) * 60 + parseInt(task.end_time.split(':')[1]) : 
      startMinutes + (task.duration_minutes || 60)
    
    return {
      ...task,
      startMinutes,
      endMinutes
    }
  })
  
  // Sort tasks by start time
  const sortedTasks = [...tasksWithMinutes].sort((a, b) => a.startMinutes - b.startMinutes)
  
  const overlapGroups: OverlapGroup[] = []
  const processedTasks = new Set()
  
  // Use a more robust grouping algorithm that handles chains of overlapping tasks only
  for (let i = 0; i < sortedTasks.length; i++) {
    const currentTask = sortedTasks[i]
    if (processedTasks.has(currentTask.schedule_id)) continue
    
    const group = [currentTask]
    processedTasks.add(currentTask.schedule_id)
    
    // Find all tasks that are connected to this group (overlapping or consecutive)
    let foundMore = true
    while (foundMore) {
      foundMore = false
      
      for (let j = 0; j < sortedTasks.length; j++) {
        const otherTask = sortedTasks[j]
        if (processedTasks.has(otherTask.schedule_id)) continue
        
        // Check if this task connects to any task in the current group
        const connectsToGroup = group.some(groupTask => {
          // Check for overlap only (exclude consecutive tasks)
          if (otherTask.startMinutes < groupTask.endMinutes && otherTask.endMinutes > groupTask.startMinutes) {
            return true
          }
          return false
        })
        
        if (connectsToGroup) {
          group.push(otherTask)
          processedTasks.add(otherTask.schedule_id)
          foundMore = true
          break
        }
      }
    }
    
    // Only create overlap group if there are multiple tasks
    if (group.length > 1) {
      // Calculate the combined time range
      const startMinutes = Math.min(...group.map(t => t.startMinutes))
      const endMinutes = Math.max(...group.map(t => t.endMinutes))
      
      // Convert back to time strings
      const startTime = `${Math.floor(startMinutes / 60).toString().padStart(2, '0')}:${(startMinutes % 60).toString().padStart(2, '0')}`
      const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`
      
      // Create unique ID for this overlap group
      const taskIds = group.map(t => t.schedule_id).sort().join('-')
      const groupId = `overlap-${taskIds}`
      
      overlapGroups.push({
        tasks: group,
        startTime,
        endTime,
        totalDuration: endMinutes - startMinutes,
        id: groupId
      })
    }
  }
  
  return overlapGroups
}