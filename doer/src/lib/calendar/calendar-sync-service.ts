/**
 * Calendar Event Sync Service
 * Converts calendar events to read-only tasks (plan_id = null, is_calendar_event = true)
 */

import { createClient } from '@/lib/supabase/server'
import { formatDateForDB, addDays } from '@/lib/date-utils'
import { logger } from '@/lib/logger'
import type { CalendarEvent } from '@/lib/calendar/types'
import { isCrossDayTask, splitCrossDayScheduleEntry } from '@/lib/task-time-utils'

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
      logger.error('Connection not found or access denied', {
        error: connError instanceof Error ? connError.message : String(connError || 'Connection not found'),
        errorStack: connError instanceof Error ? connError.stack : undefined,
        connectionId,
        userId,
      })
      throw new Error('Connection not found or access denied')
    }

    // Fetch ALL calendar events for this connection (no date filtering)
    // Note: Deleted events are not fetched since they're deleted from the database
    const { data: calendarEventsData, error: eventsError } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('calendar_connection_id', connectionId)
      .eq('is_busy', true)
      .eq('is_doer_created', false)
      .order('start_time', { ascending: true })

    if (eventsError) {
      logger.error('Failed to fetch calendar events', {
        error: eventsError instanceof Error ? eventsError.message : String(eventsError),
        errorStack: eventsError instanceof Error ? eventsError.stack : undefined,
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
      logger.error('Failed to fetch existing calendar tasks', {
        error: tasksError instanceof Error ? tasksError.message : String(tasksError),
        errorStack: tasksError instanceof Error ? tasksError.stack : undefined,
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
        const endEventDate = formatDateForDB(endTimeInTz)
        
        // Check if event spans multiple calendar days
        const spansMultipleDays = eventDate !== endEventDate
        
        // Check if this is a cross-day event (spans midnight within 2 days)
        // For calendar events, if dates differ by exactly 1 day, it's a cross-day event
        // Also check if times cross midnight for same-day events
        const daysDifference = Math.floor((endTimeInTz.getTime() - startTimeInTz.getTime()) / (24 * 60 * 60 * 1000))
        const isCrossDayEvent = spansMultipleDays && daysDifference === 1
        const isTimeCrossDay = !spansMultipleDays && isCrossDayTask(startTimeStr, endTimeStrRaw)
        const shouldSplit = isCrossDayEvent || isTimeCrossDay

        if (existingTask) {
          // Update existing task (calendar events are always synced, never detached)
          const { error: updateError } = await supabase
            .from('tasks')
            .update({
              name: event.summary || 'Untitled Event',
              details: event.description || null,
              estimated_duration_minutes: finalDuration,
            })
            .eq('id', existingTask.id)
            .eq('user_id', userId)

          if (updateError) {
            logger.error('Failed to update task', {
              error: updateError instanceof Error ? updateError.message : String(updateError),
              errorStack: updateError instanceof Error ? updateError.stack : undefined,
              taskId: existingTask.id,
              eventId: event.id,
              eventSummary: event.summary,
              userId,
              errorCode: (updateError as any).code,
              errorMessage: (updateError as any).message,
              errorDetails: (updateError as any).details,
              errorHint: (updateError as any).hint,
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
          // For cross-day events, delete all existing schedules and recreate as split entries
          if (shouldSplit && startTimeStr && endTimeStrRaw) {
            // Delete all existing schedules for this task
            const { error: deleteError } = await supabase
              .from('task_schedule')
              .delete()
              .eq('task_id', existingTask.id)
              .is('plan_id', null)

            if (deleteError) {
              logger.warn('Failed to delete existing schedules before creating split schedules', {
                taskId: existingTask.id,
                eventId: event.id,
                error: deleteError.message,
              })
            }

            // Create split schedule entries
            try {
              const splitEntries = splitCrossDayScheduleEntry(
                eventDate,
                startTimeStr,
                endTimeStrRaw,
                existingTask.id,
                userId,
                null, // plan_id
                0 // day_index
              )
              
              const { error: scheduleInsertError } = await supabase
                .from('task_schedule')
                .insert(splitEntries)

              if (scheduleInsertError) {
                logger.error('Failed to create split task schedule', {
                  error: scheduleInsertError instanceof Error ? scheduleInsertError.message : String(scheduleInsertError),
                  errorStack: scheduleInsertError instanceof Error ? scheduleInsertError.stack : undefined,
                  taskId: existingTask.id,
                  eventId: event.id,
                  eventSummary: event.summary,
                  userId,
                  eventDate,
                  errorCode: (scheduleInsertError as any).code,
                  errorMessage: (scheduleInsertError as any).message,
                })
                errors.push(`Failed to create split schedule for event ${event.summary}: ${scheduleInsertError.message}`)
              } else {
                logger.info('Created split task schedule for cross-day calendar event', {
                  taskId: existingTask.id,
                  eventId: event.id,
                  eventDate,
                  splitEntries: 2
                })
              }
            } catch (splitError: any) {
              logger.error('Error splitting cross-day calendar event', {
                error: splitError instanceof Error ? splitError.message : String(splitError),
                errorStack: splitError instanceof Error ? splitError.stack : undefined,
                taskId: existingTask.id,
                eventId: event.id,
                eventSummary: event.summary,
              })
              errors.push(`Failed to split cross-day event ${event.summary}: ${splitError.message || 'Unknown error'}`)
            }
          } else {
            // Regular event - use existing update logic
            const { data: existingSchedules } = await supabase
              .from('task_schedule')
              .select('id, date')
              .eq('task_id', existingTask.id)
              .is('plan_id', null)
              .order('date', { ascending: false })

            const scheduleOnCurrentDate = existingSchedules?.find(s => s.date === eventDate)
            const scheduleOnDifferentDate = existingSchedules?.find(s => s.date !== eventDate)
            const endTimeForSchedule = spansMultipleDays && daysDifference > 1 ? null : endTimeStrRaw

            if (scheduleOnCurrentDate) {
              // Update existing schedule on the same date
              const { error: scheduleUpdateError } = await supabase
                .from('task_schedule')
                .update({
                  start_time: startTimeStr,
                  end_time: endTimeForSchedule,
                  duration_minutes: finalDuration,
                })
                .eq('id', scheduleOnCurrentDate.id)

              if (scheduleUpdateError) {
                logger.error('Failed to update task schedule', {
                  error: scheduleUpdateError instanceof Error ? scheduleUpdateError.message : String(scheduleUpdateError),
                  errorStack: scheduleUpdateError instanceof Error ? scheduleUpdateError.stack : undefined,
                  scheduleId: scheduleOnCurrentDate.id,
                  taskId: existingTask.id,
                  eventId: event.id,
                  eventDate,
                  errorCode: (scheduleUpdateError as any).code,
                  errorMessage: (scheduleUpdateError as any).message,
                })
                errors.push(`Failed to update schedule for event ${event.summary}: ${scheduleUpdateError.message}`)
              } else {
                logger.info('Updated task schedule (same date)', {
                  scheduleId: scheduleOnCurrentDate.id,
                  taskId: existingTask.id,
                  eventId: event.id,
                  eventDate,
                  startTime: startTimeStr,
                  endTime: endTimeForSchedule,
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
                  end_time: endTimeForSchedule,
                  duration_minutes: finalDuration,
                })
                .eq('id', scheduleOnDifferentDate.id)

              if (scheduleUpdateError) {
                logger.error('Failed to update task schedule (date change)', {
                  error: scheduleUpdateError instanceof Error ? scheduleUpdateError.message : String(scheduleUpdateError),
                  errorStack: scheduleUpdateError instanceof Error ? scheduleUpdateError.stack : undefined,
                  scheduleId: scheduleOnDifferentDate.id,
                  taskId: existingTask.id,
                  eventId: event.id,
                  oldDate: scheduleOnDifferentDate.date,
                  newDate: eventDate,
                  errorCode: (scheduleUpdateError as any).code,
                  errorMessage: (scheduleUpdateError as any).message,
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
                  endTime: endTimeForSchedule,
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
                  end_time: endTimeForSchedule,
                  duration_minutes: finalDuration,
                  status: 'scheduled',
                })
                .select('id')
                .single()

              if (scheduleInsertError) {
                logger.error('Failed to create task schedule', {
                  error: scheduleInsertError instanceof Error ? scheduleInsertError.message : String(scheduleInsertError),
                  errorStack: scheduleInsertError instanceof Error ? scheduleInsertError.stack : undefined,
                  taskId: existingTask.id,
                  eventId: event.id,
                  eventDate,
                  errorCode: (scheduleInsertError as any).code,
                  errorMessage: (scheduleInsertError as any).message,
                  errorDetails: (scheduleInsertError as any).details,
                  errorHint: (scheduleInsertError as any).hint,
                })
                errors.push(`Failed to create schedule for event ${event.summary}: ${scheduleInsertError.message}`)
              } else {
                logger.info('Created task schedule for existing task', {
                  scheduleId: newSchedule?.id,
                  taskId: existingTask.id,
                  eventId: event.id,
                  eventDate,
                  startTime: startTimeStr,
                  endTime: endTimeForSchedule,
                })
              }
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
            logger.error('Failed to create task', {
              error: taskInsertError instanceof Error ? taskInsertError.message : String(taskInsertError || 'Unknown error'),
              errorStack: taskInsertError instanceof Error ? taskInsertError.stack : undefined,
              eventId: event.id,
              eventSummary: event.summary,
              userId,
              errorCode: (taskInsertError as any)?.code,
              errorMessage: (taskInsertError as any)?.message,
              errorDetails: (taskInsertError as any)?.details,
              errorHint: (taskInsertError as any)?.hint,
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

          // Create task schedule(s)
          // For calendar events (plan_id = null), day_index is set to 0 since there's no plan start date
          if (shouldSplit && startTimeStr && endTimeStrRaw) {
            // Split cross-day event into two schedule entries
            try {
              const splitEntries = splitCrossDayScheduleEntry(
                eventDate,
                startTimeStr,
                endTimeStrRaw,
                newTask.id,
                userId,
                null, // plan_id
                0 // day_index
              )
              
              const { error: scheduleInsertError } = await supabase
                .from('task_schedule')
                .insert(splitEntries)

              if (scheduleInsertError) {
                logger.error('Failed to create split task schedule', {
                  error: scheduleInsertError instanceof Error ? scheduleInsertError.message : String(scheduleInsertError),
                  errorStack: scheduleInsertError instanceof Error ? scheduleInsertError.stack : undefined,
                  taskId: newTask.id,
                  eventId: event.id,
                  eventSummary: event.summary,
                  userId,
                  eventDate,
                  errorCode: (scheduleInsertError as any).code,
                  errorMessage: (scheduleInsertError as any).message,
                  errorDetails: (scheduleInsertError as any).details,
                  errorHint: (scheduleInsertError as any).hint,
                })
                errors.push(`Failed to create split schedule for event ${event.summary}: ${scheduleInsertError.message || 'Unknown error'}`)
                continue
              }

              logger.info('Created split task schedule from cross-day calendar event', {
                taskId: newTask.id,
                eventId: event.id,
                eventDate,
                splitEntries: 2
              })
            } catch (splitError: any) {
              logger.error('Error splitting cross-day calendar event', {
                error: splitError instanceof Error ? splitError.message : String(splitError),
                errorStack: splitError instanceof Error ? splitError.stack : undefined,
                taskId: newTask.id,
                eventId: event.id,
                eventSummary: event.summary,
              })
              errors.push(`Failed to split cross-day event ${event.summary}: ${splitError.message || 'Unknown error'}`)
              continue
            }
          } else {
            // Single-day event or multi-day event (>2 days) - create single schedule entry
            const endTimeForSchedule = spansMultipleDays && daysDifference > 1 ? null : endTimeStrRaw
            
            const { data: newSchedule, error: scheduleInsertError } = await supabase
              .from('task_schedule')
              .insert({
                plan_id: null,
                user_id: userId,
                task_id: newTask.id,
                day_index: 0, // Calendar events don't have a plan, so day_index is 0
                date: eventDate,
                start_time: startTimeStr,
                end_time: endTimeForSchedule,
                duration_minutes: finalDuration,
                status: 'scheduled',
              })
              .select('id')
              .single()

            if (scheduleInsertError || !newSchedule) {
              logger.error('Failed to create task schedule', {
                error: scheduleInsertError instanceof Error ? scheduleInsertError.message : String(scheduleInsertError || 'Unknown error'),
                errorStack: scheduleInsertError instanceof Error ? scheduleInsertError.stack : undefined,
                taskId: newTask.id,
                eventId: event.id,
                eventSummary: event.summary,
                userId,
                eventDate,
                errorCode: (scheduleInsertError as any)?.code,
                errorMessage: (scheduleInsertError as any)?.message,
                errorDetails: (scheduleInsertError as any)?.details,
                errorHint: (scheduleInsertError as any)?.hint,
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
          }

          tasksCreated++
        }
      } catch (error) {
        logger.error('Error processing calendar event', {
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
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
    logger.error('Failed to sync calendar events to tasks', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      connectionId,
      userId,
    })
    throw error
  }
}

/**
 * Handle deleted calendar events - delete them from DOER to mirror Google Calendar
 * DOER should act as a mirror of Google Calendar, so if an event is deleted there, delete it here too
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
      logger.error('Failed to find calendar events for deletion', {
        error: eventsError instanceof Error ? eventsError.message : String(eventsError),
        errorStack: eventsError instanceof Error ? eventsError.stack : undefined,
      })
      return
    }

    if (!calendarEvents || calendarEvents.length === 0) {
      return
    }

    const calendarEventIds = calendarEvents.map((e) => e.id)

    // Find tasks linked to deleted events
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, name, user_id')
      .in('calendar_event_id', calendarEventIds)
      .eq('is_calendar_event', true)
      .is('plan_id', null)
      .eq('user_id', userId)

    if (tasksError) {
      logger.error('Failed to find tasks for deleted events', {
        error: tasksError instanceof Error ? tasksError.message : String(tasksError),
        errorStack: tasksError instanceof Error ? tasksError.stack : undefined,
      })
      return
    }

    if (tasks && tasks.length > 0) {
      const taskIds = tasks.map((t) => t.id)

      // Delete task schedules first (cascade should handle this, but being explicit)
      const { error: deleteSchedulesError } = await supabase
        .from('task_schedule')
        .delete()
        .in('task_id', taskIds)
        .eq('user_id', userId)
        .is('plan_id', null)

      if (deleteSchedulesError) {
        logger.error('Failed to delete task schedules for deleted events', {
          error: deleteSchedulesError instanceof Error ? deleteSchedulesError.message : String(deleteSchedulesError),
          errorStack: deleteSchedulesError instanceof Error ? deleteSchedulesError.stack : undefined,
        })
      }

      // Delete tasks
      const { error: deleteTasksError } = await supabase
        .from('tasks')
        .delete()
        .in('id', taskIds)
        .eq('user_id', userId)
        .eq('is_calendar_event', true)
        .is('plan_id', null)

      if (deleteTasksError) {
        logger.error('Failed to delete tasks for deleted events', {
          error: deleteTasksError instanceof Error ? deleteTasksError.message : String(deleteTasksError),
          errorStack: deleteTasksError instanceof Error ? deleteTasksError.stack : undefined,
        })
      } else {
        logger.info('Deleted tasks for deleted calendar events', {
          connectionId,
          userId,
          taskCount: tasks.length,
        })
      }
    }

    // Delete calendar events
    const { error: deleteEventsError } = await supabase
      .from('calendar_events')
      .delete()
      .in('id', calendarEventIds)
      .eq('calendar_connection_id', connectionId)

    if (deleteEventsError) {
      logger.error('Failed to delete calendar events', {
        error: deleteEventsError instanceof Error ? deleteEventsError.message : String(deleteEventsError),
        errorStack: deleteEventsError instanceof Error ? deleteEventsError.stack : undefined,
      })
    } else {
      logger.info('Deleted calendar events', {
        connectionId,
        userId,
        eventCount: calendarEventIds.length,
      })
    }

    logger.info('Handled deleted calendar events', {
      connectionId,
      userId,
      deletedCount: deletedEventIds.length,
      tasksDeleted: tasks?.length || 0,
      eventsDeleted: calendarEventIds.length,
    })
  } catch (error) {
    logger.error('Error handling deleted calendar events', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      connectionId,
      userId,
    })
  }
}

