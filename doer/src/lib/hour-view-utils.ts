/**
 * Position calculation utilities for hour view
 */

import { parseTimeToMinutes, minutesToTimeString, snapToInterval } from './task-time-utils'

export type IntervalType = '1hr' | '30min' | '15min'

/**
 * Get row height for a given interval type
 */
export function getRowHeight(intervalType: IntervalType): number {
  switch (intervalType) {
    case '1hr':
      return 50
    case '30min':
      return 35
    case '15min':
      return 25
    default:
      return 50
  }
}

/**
 * Get minutes per row for a given interval type
 */
export function getMinutesPerRow(intervalType: IntervalType): number {
  switch (intervalType) {
    case '1hr':
      return 60
    case '30min':
      return 30
    case '15min':
      return 15
    default:
      return 60
  }
}

/**
 * Calculate grid position in pixels based on time and zoom level
 * @param startMinutes - Minutes since midnight
 * @param intervalType - Current interval view type
 * @returns Pixel position from top of grid
 */
export function calculateGridPosition(
  startMinutes: number,
  intervalType: IntervalType
): number {
  const rowHeight = getRowHeight(intervalType)
  const minutesPerRow = getMinutesPerRow(intervalType)
  
  return (startMinutes / minutesPerRow) * rowHeight
}

/**
 * Calculate task height in pixels based on duration
 * @param durationMinutes - Task duration in minutes
 * @param intervalType - Current interval view type
 * @returns Height in pixels
 */
export function calculateTaskHeight(
  durationMinutes: number,
  intervalType: IntervalType
): number {
  const rowHeight = getRowHeight(intervalType)
  const minutesPerRow = getMinutesPerRow(intervalType)
  
  // Minimum height of one row
  const calculatedHeight = (durationMinutes / minutesPerRow) * rowHeight
  return Math.max(calculatedHeight, rowHeight)
}

/**
 * Convert pixel position back to time string
 * @param positionPixels - Pixel position from top of grid
 * @param intervalType - Current interval view type
 * @returns Time string in HH:MM format
 */
export function calculateTimeFromPosition(
  positionPixels: number,
  intervalType: IntervalType
): string {
  const rowHeight = getRowHeight(intervalType)
  const minutesPerRow = getMinutesPerRow(intervalType)
  
  const totalMinutes = Math.round((positionPixels / rowHeight) * minutesPerRow)
  
  // Clamp to 0-1439 (24 hours in minutes)
  const clampedMinutes = Math.max(0, Math.min(1439, totalMinutes))
  
  return minutesToTimeString(clampedMinutes)
}

/**
 * Snap time to grid based on current interval
 * @param time - Time string (HH:MM)
 * @param intervalType - Current interval view type
 * @returns Snapped time string
 */
export function snapToGrid(time: string, intervalType: IntervalType): string {
  const intervalMinutes = getMinutesPerRow(intervalType)
  return snapToInterval(time, intervalMinutes)
}

/**
 * Calculate end time based on start time and duration
 * @param startTime - Start time (HH:MM)
 * @param durationMinutes - Duration in minutes
 * @returns End time (HH:MM)
 */
export function calculateEndTime(startTime: string, durationMinutes: number): string {
  const startMinutes = parseTimeToMinutes(startTime)
  const endMinutes = startMinutes + durationMinutes
  
  // Clamp to end of day
  const clampedEndMinutes = Math.min(endMinutes, 1439) // 23:59
  
  return minutesToTimeString(clampedEndMinutes)
}

/**
 * Calculate the total height of the grid in pixels
 * @param intervalType - Current interval view type
 * @returns Total grid height in pixels (24 hours worth)
 */
export function calculateTotalGridHeight(intervalType: IntervalType): number {
  const minutesPerRow = getMinutesPerRow(intervalType)
  const rowHeight = getRowHeight(intervalType)
  const totalRows = (24 * 60) / minutesPerRow
  
  return totalRows * rowHeight
}

/**
 * Get the day column index for positioning
 * @param dayIndex - Day of week (0 = Sunday)
 * @returns Column index in grid (1-7, accounting for time label column)
 */
export function getDayColumnIndex(dayIndex: number): number {
  return dayIndex + 1 // +1 to account for the time label column
}












