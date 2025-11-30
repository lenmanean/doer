/**
 * Calendar Event Sync Service
 * Converts calendar events to read-only tasks (plan_id = null, is_calendar_event = true)
 */

import { createClient } from '@/lib/supabase/server'
import { formatDateForDB } from '@/lib/date-utils'
import { logger } from '@/lib/logger'
import type { CalendarEvent } from '@/lib/calendar/types'

export interface SyncCalendarEventsResult {
  tasks_created: number
  tasks_updated: number
  tasks_skipped: number
  errors: string[]
}

/**
 * Sync calendar events to tasks (without integration plans)
 * Stores tasks with plan_id = null and is_calendar_event = true
 * Fetches all events (no date filtering) and handles deleted events
 */
export async function syncCalendarEventsToTasks(
  connectionId: string,
  userId: string,
  provider: 'google' | 'outlook' | 'apple',
  calendarIds: string[],
  deletedEventIds: string[] = []
): Promise<SyncCalendarEventsResult> {
  const supabase = await createClient()

  try {
    // Security: Verify connection belongs to user
    const { data: connection, error: connError } = await supabase
      .from('calendar_connections')
      .select('id, user_id')
      .eq('id', connectionId)
      .eq('user_id', userId)
      .single()

    if (connError || !connection) {
      logger.error('Connection not found or access denied', connError instanceof Error ? connError : undefined, {
        connectionId,
        userId,
      })
      throw new Error('Connection not found or access denied')
    }

    // Fetch ALL calendar events for this connection (no date filtering)
    const { data: calendarEventsData, error: eventsError } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('calendar_connection_id', connectionId)
      .eq('is_busy', true)
      .eq('is_doer_created', false)
      .eq('is_deleted_in_calendar', false) // Only sync non-deleted events
      .order('start_time', { ascending: true })

    if (eventsError) {
      logger.error('Failed to fetch calendar events', eventsError as Error, {
        connectionId,
        userId,
      })
      throw eventsError
    }

    const calendarEvents = calendarEventsData || []

    logger.info('Fetched calendar events for sync', {
      connectionId,
      userId,
      eventCount: calendarEvents.length,
      deletedEventCount: deletedEventIds.length,
      eventIds: calendarEvents.map((e: any) => e.id).slice(0, 5), // Log first 5 IDs
    })

    if (calendarEvents.length === 0) {
      logger.info('No calendar events to sync', { connectionId, userId })
      return {
        tasks_created: 0,
        tasks_updated: 0,
        tasks_skipped: 0,
        errors: [],
      }
    }

    // Get existing calendar event tasks for this user (plan_id = null, is_calendar_event = true)
    const { data: existingTasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, idx, calendar_event_id')
      .eq('user_id', userId)
      .is('plan_id', null)
      .eq('is_calendar_event', true)

    if (tasksError) {
      logger.error('Failed to fetch existing calendar tasks', tasksError as Error, {
        userId,
      })
      throw tasksError
    }

    // Create map of tasks by calendar_event_id
    const tasksByCalendarEventId = new Map<string, any>()
    existingTasks?.forEach((task) => {
      if (task.calendar_event_id) {
        tasksByCalendarEventId.set(task.calendar_event_id, task)
      }
    })

    // Find max idx for new tasks
    const maxIdx =
      existingTasks && existingTasks.length > 0
        ? Math.max(...existingTasks.map((t) => t.idx || 0))
        : 0

    let nextIdx = maxIdx + 1
    let tasksCreated = 0
    let tasksUpdated = 0
    let tasksSkipped = 0
    const errors: string[] = []

    // Process each calendar event
    for (const event of calendarEvents) {
      try {
        const existingTask = tasksByCalendarEventId.get(event.id)

        // Calculate task properties
        const startTimeUTC = new Date(event.start_time)
        const endTimeUTC = new Date(event.end_time)
        const durationMinutes = Math.round(
          (endTimeUTC.getTime() - startTimeUTC.getTime()) / (1000 * 60)
        )

        // Ensure minimum duration (calendar events can be any length, including all-day/multi-day)
        const finalDuration = Math.max(durationMinutes, 5)

        // Convert UTC times to event's timezone
        const timezone = event.timezone || 'UTC'
        
        // Format times in the event's timezone
        const formatTimeInTimezone = (date: Date, tz: string): string => {
          try {
            const formatter = new Intl.DateTimeFormat('en-US', {
              timeZone: tz,
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })
            return formatter.format(date)
          } catch (error) {
            // Fallback to local time if timezone is invalid
            return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
          }
        }

        const startTimeStr = formatTimeInTimezone(startTimeUTC, timezone)
        const endTimeStrRaw = formatTimeInTimezone(endTimeUTC, timezone)

        // Get date in event's timezone for start and end
        const dateFormatter = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
        const startDateParts = dateFormatter.formatToParts(startTimeUTC)
        const endDateParts = dateFormatter.formatToParts(endTimeUTC)
        
        const startYear = parseInt(startDateParts.find(p => p.type === 'year')?.value || '0')
        const startMonth = parseInt(startDateParts.find(p => p.type === 'month')?.value || '0') - 1
        const startDay = parseInt(startDateParts.find(p => p.type === 'day')?.value || '0')
        const startTimeInTz = new Date(startYear, startMonth, startDay)
        
        const endYear = parseInt(endDateParts.find(p => p.type === 'year')?.value || '0')
        const endMonth = parseInt(endDateParts.find(p => p.type === 'month')?.value || '0') - 1
        const endDay = parseInt(endDateParts.find(p => p.type === 'day')?.value || '0')
        const endTimeInTz = new Date(endYear, endMonth, endDay)
        
        const eventDate = formatDateForDB(startTimeInTz)
        
        // Check if event spans multiple days (cross-day event)
        const isCrossDay = startTimeInTz.getTime() !== endTimeInTz.getTime()
        
        // For cross-day events, set end_time to null to avoid constraint violation
        // The duration_minutes will still be accurate
        const endTimeStr: string | null = isCrossDay ? null : endTimeStrRaw

        // Check if this event or task was previously deleted and restore it
        const wasDeleted = existingTask?.is_deleted_in_calendar
        if (wasDeleted) {
          // Restore the event - clear deletion flags
          const { error: restoreEventError } = await supabase
            .from('calendar_events')
            .update({
              is_deleted_in_calendar: false,
              deleted_at: null,
            })
            .eq('id', event.id)
          
          if (restoreEventError) {
            logger.warn('Failed to restore deleted calendar event', {
              eventId: event.id,
              error: restoreEventError.message,
            })
          } else {
            logger.info('Restored previously deleted calendar event', {
              eventId: event.id,
              taskId: existingTask.id,
            })
          }
        }

        if (existingTask) {
          // Update existing task (calendar events are always synced, never detached)
          // Remove "[Deleted in Google Calendar]" suffix if present
          const taskName = (event.summary || 'Untitled Event').replace(/\s*\[Deleted in.*?\]\s*$/, '')
          const { error: updateError } = await supabase
            .from('tasks')
            .update({
              name: taskName,
              details: event.description || null,
              estimated_duration_minutes: finalDuration,
              is_deleted_in_calendar: false, // Clear deletion flag if it was restored
            })
            .eq('id', existingTask.id)
            .eq('user_id', userId)

          if (updateError) {
            logger.error('Failed to update task', updateError as Error, {
              taskId: existingTask.id,
              eventId: event.id,
              eventSummary: event.summary,
              userId,
              errorCode: updateError.code,
              errorMessage: updateError.message,
              errorDetails: updateError.details,
              errorHint: updateError.hint,
            })
            errors.push(`Failed to update task for event ${event.summary}: ${updateError.message}`)
            continue
          }

          logger.info('Updated task from calendar event', {
            taskId: existingTask.id,
            eventId: event.id,
            eventSummary: event.summary,
          })

          // Update task schedule - handle date/time changes
          const { data: existingSchedules } = await supabase
            .from('task_schedule')
            .select('id, date')
            .eq('task_id', existingTask.id)
            .is('plan_id', null)
            .order('date', { ascending: false })

          const scheduleOnCurrentDate = existingSchedules?.find(s => s.date === eventDate)
          const scheduleOnDifferentDate = existingSchedules?.find(s => s.date !== eventDate)

          if (scheduleOnCurrentDate) {
            // Update existing schedule on the same date
            const { error: scheduleUpdateError } = await supabase
              .from('task_schedule')
              .update({
                start_time: startTimeStr,
                end_time: endTimeStr,
                duration_minutes: finalDuration,
              })
              .eq('id', scheduleOnCurrentDate.id)

            if (scheduleUpdateError) {
              logger.error('Failed to update task schedule', scheduleUpdateError as Error, {
                scheduleId: scheduleOnCurrentDate.id,
                taskId: existingTask.id,
                eventId: event.id,
                eventDate,
                errorCode: scheduleUpdateError.code,
                errorMessage: scheduleUpdateError.message,
              })
              errors.push(`Failed to update schedule for event ${event.summary}: ${scheduleUpdateError.message}`)
            } else {
              logger.info('Updated task schedule (same date)', {
                scheduleId: scheduleOnCurrentDate.id,
                taskId: existingTask.id,
                eventId: event.id,
                eventDate,
                startTime: startTimeStr,
                endTime: endTimeStr,
              })
            }

            // Remove schedules on different dates (event moved)
            if (scheduleOnDifferentDate) {
              const { error: deleteError } = await supabase
                .from('task_schedule')
                .delete()
                .eq('task_id', existingTask.id)
                .is('plan_id', null)
                .neq('date', eventDate)

              if (deleteError) {
                logger.warn('Failed to delete old schedules after event date change', {
                  taskId: existingTask.id,
                  eventId: event.id,
                  error: deleteError.message,
                })
              } else {
                logger.info('Deleted old schedules after event date change', {
                  taskId: existingTask.id,
                  eventId: event.id,
                  deletedDates: existingSchedules?.filter(s => s.date !== eventDate).map(s => s.date),
                })
              }
            }
          } else if (scheduleOnDifferentDate) {
            // Event moved to a different date - update the existing schedule
            const { error: scheduleUpdateError } = await supabase
              .from('task_schedule')
              .update({
                date: eventDate,
                start_time: startTimeStr,
                end_time: endTimeStr,
                duration_minutes: finalDuration,
              })
              .eq('id', scheduleOnDifferentDate.id)

            if (scheduleUpdateError) {
              logger.error('Failed to update task schedule (date change)', scheduleUpdateError as Error, {
                scheduleId: scheduleOnDifferentDate.id,
                taskId: existingTask.id,
                eventId: event.id,
                oldDate: scheduleOnDifferentDate.date,
                newDate: eventDate,
                errorCode: scheduleUpdateError.code,
                errorMessage: scheduleUpdateError.message,
              })
              errors.push(`Failed to update schedule date for event ${event.summary}: ${scheduleUpdateError.message}`)
            } else {
              logger.info('Updated task schedule (date changed)', {
                scheduleId: scheduleOnDifferentDate.id,
                taskId: existingTask.id,
                eventId: event.id,
                oldDate: scheduleOnDifferentDate.date,
                newDate: eventDate,
                startTime: startTimeStr,
                endTime: endTimeStr,
              })
            }

            // Remove any other schedules
            if (existingSchedules && existingSchedules.length > 1) {
              const { error: deleteError } = await supabase
                .from('task_schedule')
                .delete()
                .eq('task_id', existingTask.id)
                .is('plan_id', null)
                .neq('id', scheduleOnDifferentDate.id)

              if (deleteError) {
                logger.warn('Failed to delete duplicate schedules', {
                  taskId: existingTask.id,
                  error: deleteError.message,
                })
              }
            }
          } else {
            // No schedule exists - create new one
            // For calendar events (plan_id = null), day_index is set to 0 since there's no plan start date
            const { error: scheduleInsertError, data: newSchedule } = await supabase
              .from('task_schedule')
              .insert({
                plan_id: null,
                user_id: userId,
                task_id: existingTask.id,
                day_index: 0, // Calendar events don't have a plan, so day_index is 0
                date: eventDate,
                start_time: startTimeStr,
                end_time: endTimeStr,
                duration_minutes: finalDuration,
                status: 'scheduled',
              })
              .select('id')
              .single()

            if (scheduleInsertError) {
              logger.error('Failed to create task schedule', scheduleInsertError as Error, {
                taskId: existingTask.id,
                eventId: event.id,
                eventDate,
                errorCode: scheduleInsertError.code,
                errorMessage: scheduleInsertError.message,
                errorDetails: scheduleInsertError.details,
                errorHint: scheduleInsertError.hint,
              })
              errors.push(`Failed to create schedule for event ${event.summary}: ${scheduleInsertError.message}`)
            } else {
              logger.info('Created task schedule for existing task', {
                scheduleId: newSchedule?.id,
                taskId: existingTask.id,
                eventId: event.id,
                eventDate,
                startTime: startTimeStr,
                endTime: endTimeStr,
              })
            }
          }

          tasksUpdated++
        } else {
          // Create new task
          const { data: newTask, error: taskInsertError } = await supabase
            .from('tasks')
            .insert({
              plan_id: null,
              user_id: userId,
              idx: nextIdx++,
              name: event.summary || 'Untitled Event',
              details: event.description || null,
              estimated_duration_minutes: finalDuration,
              priority: 3, // Default to medium priority for calendar events
              is_calendar_event: true,
              calendar_event_id: event.id,
              is_detached: false, // Always false for read-only calendar events
            })
            .select('id')
            .single()

          if (taskInsertError || !newTask) {
            logger.error('Failed to create task', taskInsertError as Error, {
              eventId: event.id,
              eventSummary: event.summary,
              userId,
              errorCode: taskInsertError?.code,
              errorMessage: taskInsertError?.message,
              errorDetails: taskInsertError?.details,
              errorHint: taskInsertError?.hint,
            })
            errors.push(`Failed to create task for event ${event.summary}: ${taskInsertError?.message || 'Unknown error'}`)
            continue
          }

          logger.info('Created task from calendar event', {
            taskId: newTask.id,
            eventId: event.id,
            eventSummary: event.summary,
            userId,
          })

          // Create task schedule
          // For calendar events (plan_id = null), day_index is set to 0 since there's no plan start date
          const { data: newSchedule, error: scheduleInsertError } = await supabase
            .from('task_schedule')
            .insert({
              plan_id: null,
              user_id: userId,
              task_id: newTask.id,
              day_index: 0, // Calendar events don't have a plan, so day_index is 0
              date: eventDate,
              start_time: startTimeStr,
              end_time: endTimeStr,
              duration_minutes: finalDuration,
              status: 'scheduled',
            })
            .select('id')
            .single()

          if (scheduleInsertError || !newSchedule) {
            logger.error('Failed to create task schedule', scheduleInsertError as Error, {
              taskId: newTask.id,
              eventId: event.id,
              eventSummary: event.summary,
              userId,
              eventDate,
              errorCode: scheduleInsertError?.code,
              errorMessage: scheduleInsertError?.message,
              errorDetails: scheduleInsertError?.details,
              errorHint: scheduleInsertError?.hint,
            })
            errors.push(`Failed to create schedule for event ${event.summary}: ${scheduleInsertError?.message || 'Unknown error'}`)
            continue
          }

          logger.info('Created task schedule from calendar event', {
            scheduleId: newSchedule.id,
            taskId: newTask.id,
            eventId: event.id,
            eventDate,
          })

          tasksCreated++
        }
      } catch (error) {
        logger.error('Error processing calendar event', error as Error, {
          eventId: event.id,
        })
        errors.push(`Error processing event ${event.summary}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Handle deleted events
    if (deletedEventIds.length > 0) {
      await handleDeletedCalendarEvents(connectionId, userId, deletedEventIds)
    }

    logger.info('Synced calendar events to tasks', {
      connectionId,
      userId,
      tasksCreated,
      tasksUpdated,
      tasksSkipped,
      deletedEvents: deletedEventIds.length,
      errors: errors.length,
    })

    return {
      tasks_created: tasksCreated,
      tasks_updated: tasksUpdated,
      tasks_skipped: tasksSkipped,
      errors,
    }
  } catch (error) {
    logger.error('Failed to sync calendar events to tasks', error as Error, {
      connectionId,
      userId,
    })
    throw error
  }
}

/**
 * Handle deleted calendar events - mark them as deleted but keep them in DOER
 */
export async function handleDeletedCalendarEvents(
  connectionId: string,
  userId: string,
  deletedEventIds: string[]
): Promise<void> {
  const supabase = await createClient()

  try {
    // Security: Verify connection belongs to user
    const { data: connection, error: connError } = await supabase
      .from('calendar_connections')
      .select('id, user_id')
      .eq('id', connectionId)
      .eq('user_id', userId)
      .single()

    if (connError || !connection) {
      logger.warn('Connection not found or access denied', {
        connectionId,
        userId,
      })
      return
    }

    if (deletedEventIds.length === 0) {
      return
    }

    // Find calendar events by external_event_id
    const { data: calendarEvents, error: eventsError } = await supabase
      .from('calendar_events')
      .select('id, external_event_id, summary')
      .eq('calendar_connection_id', connectionId)
      .in('external_event_id', deletedEventIds)

    if (eventsError) {
      logger.error('Failed to find calendar events for deletion', eventsError as Error)
      return
    }

    if (!calendarEvents || calendarEvents.length === 0) {
      return
    }

    const calendarEventIds = calendarEvents.map((e) => e.id)

    // Mark calendar events as deleted
    const { error: updateEventsError } = await supabase
      .from('calendar_events')
      .update({
        is_deleted_in_calendar: true,
        deleted_at: new Date().toISOString(),
      })
      .in('id', calendarEventIds)

    if (updateEventsError) {
      logger.error('Failed to mark calendar events as deleted', updateEventsError as Error)
    }

    // Find tasks linked to deleted events
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, name, user_id')
      .in('calendar_event_id', calendarEventIds)
      .eq('is_calendar_event', true)
      .is('plan_id', null)
      .eq('user_id', userId)

    if (tasksError) {
      logger.error('Failed to find tasks for deleted events', tasksError as Error)
      return
    }

    if (!tasks || tasks.length === 0) {
      logger.info('No tasks found for deleted calendar events', {
        connectionId,
        userId,
        deletedEventCount: deletedEventIds.length,
      })
      return
    }

    // Mark tasks as deleted and update name to indicate deletion
    const taskIds = tasks.map((t) => t.id)
    for (const task of tasks) {
      const deletedName = task.name?.includes('[Deleted in') 
        ? task.name 
        : `${task.name} [Deleted in Google Calendar]`
      
      const { error: updateTaskError } = await supabase
        .from('tasks')
        .update({
          is_deleted_in_calendar: true,
          name: deletedName,
        })
        .eq('id', task.id)
        .eq('user_id', userId)

      if (updateTaskError) {
        logger.error('Failed to mark task as deleted', updateTaskError as Error, {
          taskId: task.id,
        })
      }
    }

    logger.info('Handled deleted calendar events', {
      connectionId,
      userId,
      deletedCount: deletedEventIds.length,
      tasksMarked: tasks.length,
    })
  } catch (error) {
    logger.error('Error handling deleted calendar events', error as Error, {
      connectionId,
      userId,
    })
  }
}

