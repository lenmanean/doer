/**
 * Calendar Event to Task Sync Service
 * Converts calendar events to tasks in integration plans
 */

import { createClient } from '@/lib/supabase/server'
import { formatDateForDB, getDayNumber } from '@/lib/date-utils'
import { logger } from '@/lib/logger'
import type { CalendarEvent } from '@/lib/calendar/types'
import {
  getOrCreateIntegrationPlan,
  getIntegrationPlanForConnection,
  type CalendarInfo,
} from './integration-plan-service'

export interface SyncEventsResult {
  tasks_created: number
  tasks_updated: number
  tasks_skipped: number
  errors: string[]
}

/**
 * Sync calendar events to tasks in integration plan
 */
export async function syncEventsToIntegrationPlan(
  connectionId: string,
  userId: string,
  provider: 'google' | 'outlook' | 'apple',
  calendarIds: string[],
  calendarNames: string[],
  calendarInfos?: CalendarInfo[]
): Promise<SyncEventsResult> {
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

    // Get or create integration plan
    let planId: string
    try {
      planId = await getOrCreateIntegrationPlan(
        userId,
        connectionId,
        provider,
        calendarIds,
        calendarNames,
        calendarInfos
      )
      logger.info('Integration plan ready for sync', {
        planId,
        connectionId,
        userId,
        provider,
      })
    } catch (planError) {
      logger.error('Failed to get or create integration plan', planError as Error, {
        connectionId,
        userId,
        provider,
      })
      throw new Error(`Failed to get or create integration plan: ${planError instanceof Error ? planError.message : 'Unknown error'}`)
    }

    // Fetch all calendar events for this connection
    const { data: calendarEventsData, error: eventsError } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('calendar_connection_id', connectionId)
      .eq('is_busy', true)
      .eq('is_doer_created', false)
      .order('start_time', { ascending: true })

    if (eventsError) {
      logger.error('Failed to fetch calendar events', eventsError as Error, {
        connectionId,
        planId,
      })
      throw eventsError
    }

    const calendarEvents = calendarEventsData || []

    logger.info('Fetched calendar events for sync', {
      connectionId,
      planId,
      eventCount: calendarEvents.length,
      eventIds: calendarEvents.map((e: any) => e.id).slice(0, 5), // Log first 5 IDs
    })

    if (calendarEvents.length === 0) {
      logger.info('No calendar events to sync', { connectionId, planId })
      return {
        tasks_created: 0,
        tasks_updated: 0,
        tasks_skipped: 0,
        errors: [],
      }
    }

    // Get plan start date for calculating day_index
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('start_date')
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      throw new Error('Integration plan not found')
    }

    const planStartDate = new Date(plan.start_date)

    // Get existing tasks for this plan to find max idx
    const { data: existingTasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, idx, calendar_event_id, is_detached')
      .eq('plan_id', planId)

    if (tasksError) {
      logger.error('Failed to fetch existing tasks', tasksError as Error, {
        planId,
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

    // Find max idx
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
        // Skip if task exists and is detached
        const existingTask = tasksByCalendarEventId.get(event.id)
        if (existingTask && existingTask.is_detached) {
          tasksSkipped++
          continue
        }

        // Calculate task properties
        // event.start_time and event.end_time are stored as ISO strings in UTC
        // We need to convert them to the user's timezone for display
        const startTimeUTC = new Date(event.start_time)
        const endTimeUTC = new Date(event.end_time)
        const durationMinutes = Math.round(
          (endTimeUTC.getTime() - startTimeUTC.getTime()) / (1000 * 60)
        )

        // Ensure minimum duration
        const finalDuration = Math.max(durationMinutes, 5)

        // Convert UTC times to user's timezone using the stored timezone
        // If timezone is not available, use the local timezone of the server
        const timezone = event.timezone || 'UTC'
        
        // Format times in the user's timezone
        const formatTimeInTimezone = (date: Date, tz: string): string => {
          try {
            // Use Intl.DateTimeFormat to format in the specified timezone
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
        const endTimeStr = formatTimeInTimezone(endTimeUTC, timezone)

        // For date calculations, we need the date in the user's timezone
        // Get the date components in the user's timezone
        const dateFormatter = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
        const dateParts = dateFormatter.formatToParts(startTimeUTC)
        const year = parseInt(dateParts.find(p => p.type === 'year')?.value || '0')
        const month = parseInt(dateParts.find(p => p.type === 'month')?.value || '0') - 1 // Month is 0-indexed
        const day = parseInt(dateParts.find(p => p.type === 'day')?.value || '0')
        const startTimeInTz = new Date(year, month, day)
        
        const eventDate = formatDateForDB(startTimeInTz)
        const dayIndex = getDayNumber(startTimeInTz, planStartDate)

        if (existingTask) {
          // Update existing task
          const { error: updateError } = await supabase
            .from('tasks')
            .update({
              name: event.summary || 'Untitled Event',
              details: event.description || null,
              estimated_duration_minutes: finalDuration,
              // Don't update priority - keep user's choice if they set it
            })
            .eq('id', existingTask.id)
            .eq('is_detached', false) // Only update if not detached

          if (updateError) {
            logger.error('Failed to update task', updateError as Error, {
              taskId: existingTask.id,
              eventId: event.id,
              eventSummary: event.summary,
              planId,
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
          // For calendar events, there should typically be one schedule per task
          // Find any existing schedule for this task (in case event moved dates)
          const { data: existingSchedules } = await supabase
            .from('task_schedule')
            .select('id, date')
            .eq('task_id', existingTask.id)
            .order('date', { ascending: false })

          const scheduleOnCurrentDate = existingSchedules?.find(s => s.date === eventDate)
          const scheduleOnDifferentDate = existingSchedules?.find(s => s.date !== eventDate)

          if (scheduleOnCurrentDate) {
            // Update existing schedule on the same date (time or duration changed)
            const { error: scheduleUpdateError } = await supabase
              .from('task_schedule')
              .update({
                start_time: startTimeStr,
                end_time: endTimeStr,
                duration_minutes: finalDuration,
                day_index: dayIndex,
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

            // If there are schedules on different dates, remove them (event moved)
            if (scheduleOnDifferentDate) {
              const { error: deleteError } = await supabase
                .from('task_schedule')
                .delete()
                .eq('task_id', existingTask.id)
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
            // Event moved to a different date - update the existing schedule to new date
            const { error: scheduleUpdateError } = await supabase
              .from('task_schedule')
              .update({
                date: eventDate,
                start_time: startTimeStr,
                end_time: endTimeStr,
                duration_minutes: finalDuration,
                day_index: dayIndex,
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

            // Remove any other schedules on different dates (in case there are multiple)
            if (existingSchedules && existingSchedules.length > 1) {
              const { error: deleteError } = await supabase
                .from('task_schedule')
                .delete()
                .eq('task_id', existingTask.id)
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
            const { error: scheduleInsertError, data: newSchedule } = await supabase
              .from('task_schedule')
              .insert({
                plan_id: planId,
                user_id: userId,
                task_id: existingTask.id,
                date: eventDate,
                day_index: dayIndex,
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

          // Update calendar event link if schedule changed
          // Find the link for this event and update it with the current schedule
          const { data: currentSchedule } = await supabase
            .from('task_schedule')
            .select('id')
            .eq('task_id', existingTask.id)
            .eq('date', eventDate)
            .single()

          if (currentSchedule) {
            const { error: linkUpdateError } = await supabase
              .from('calendar_event_links')
              .upsert({
                user_id: userId,
                calendar_connection_id: connectionId,
                calendar_event_id: event.id,
                plan_id: planId,
                task_id: existingTask.id,
                task_schedule_id: currentSchedule.id,
                external_event_id: event.external_event_id,
                task_name: event.summary || 'Untitled Event',
                metadata: {},
              }, {
                onConflict: 'calendar_event_id,task_schedule_id',
              })

            if (linkUpdateError) {
              logger.warn('Failed to update calendar event link', {
                taskId: existingTask.id,
                scheduleId: currentSchedule.id,
                eventId: event.id,
                error: linkUpdateError instanceof Error ? linkUpdateError.message : String(linkUpdateError),
              })
            }
          }

          tasksUpdated++
        } else {
          // Create new task
          const { data: newTask, error: taskInsertError } = await supabase
            .from('tasks')
            .insert({
              plan_id: planId,
              user_id: userId,
              idx: nextIdx++,
              name: event.summary || 'Untitled Event',
              details: event.description || null,
              estimated_duration_minutes: finalDuration,
              priority: 3, // Default to medium priority for calendar events
              is_calendar_event: true,
              calendar_event_id: event.id,
              is_detached: false,
            })
            .select('id')
            .single()

          if (taskInsertError || !newTask) {
            logger.error('Failed to create task', taskInsertError as Error, {
              eventId: event.id,
              eventSummary: event.summary,
              planId,
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
            planId,
          })

          // Create task schedule
          const { data: newSchedule, error: scheduleInsertError } = await supabase
            .from('task_schedule')
            .insert({
              plan_id: planId,
              user_id: userId,
              task_id: newTask.id,
              date: eventDate,
              day_index: dayIndex,
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
              planId,
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

          // Create calendar event link
          const { error: linkError } = await supabase
            .from('calendar_event_links')
            .upsert({
              user_id: userId,
              calendar_connection_id: connectionId,
              calendar_event_id: event.id,
              plan_id: planId,
              task_id: newTask.id,
              task_schedule_id: newSchedule.id,
              external_event_id: event.external_event_id,
              task_name: event.summary || 'Untitled Event',
              metadata: {},
            }, {
              onConflict: 'calendar_event_id,task_schedule_id',
            })

          if (linkError) {
            logger.warn('Failed to create calendar event link', {
              taskId: newTask.id,
              scheduleId: newSchedule.id,
              eventId: event.id,
              planId,
              userId,
              errorCode: linkError instanceof Error ? (linkError as any).code : undefined,
              errorMessage: linkError instanceof Error ? linkError.message : String(linkError),
              errorDetails: linkError instanceof Error ? (linkError as any).details : undefined,
            })
            // Don't fail the whole sync for this
          } else {
            logger.info('Created calendar event link', {
              taskId: newTask.id,
              scheduleId: newSchedule.id,
              eventId: event.id,
            })
          }

          tasksCreated++
          logger.info('Successfully created task and schedule from calendar event', {
            taskId: newTask.id,
            scheduleId: newSchedule.id,
            eventId: event.id,
            eventSummary: event.summary,
            eventDate,
          })
        }
      } catch (error) {
        logger.error('Error processing calendar event', error as Error, {
          eventId: event.id,
        })
        errors.push(`Error processing event ${event.summary}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    logger.info('Synced calendar events to integration plan', {
      planId,
      connectionId,
      tasksCreated,
      tasksUpdated,
      tasksSkipped,
      errors: errors.length,
    })

    return {
      tasks_created: tasksCreated,
      tasks_updated: tasksUpdated,
      tasks_skipped: tasksSkipped,
      errors,
    }
  } catch (error) {
    logger.error('Failed to sync events to integration plan', error as Error, {
      connectionId,
      userId,
    })
    throw error
  }
}

/**
 * Handle deleted calendar events - remove or mark tasks as deleted
 * Security: Verifies connection belongs to user before processing deletions
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

    // Find tasks linked to deleted events (RLS will ensure user can only access their own tasks)
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('id, is_detached, user_id')
      .in('calendar_event_id', deletedEventIds)
      .eq('is_detached', false) // Only remove non-detached tasks
      .eq('user_id', userId) // Explicit user_id check for security

    if (error) {
      logger.error('Failed to find tasks for deleted events', error as Error)
      return
    }

    if (!tasks || tasks.length === 0) {
      return
    }

    // Remove task schedules (soft delete by removing schedule entries)
    const taskIds = tasks.map((t) => t.id)
    const { error: scheduleError } = await supabase
      .from('task_schedule')
      .delete()
      .in('task_id', taskIds)

    if (scheduleError) {
      logger.error('Failed to delete task schedules', scheduleError as Error)
    }

    // Optionally: delete tasks or mark them as archived
    // For now, we'll just remove the schedules so tasks remain but aren't scheduled
    logger.info('Handled deleted calendar events', {
      connectionId,
      userId,
      deletedCount: deletedEventIds.length,
      tasksRemoved: tasks.length,
    })
  } catch (error) {
    logger.error('Error handling deleted calendar events', error as Error, {
      connectionId,
      userId,
    })
  }
}

