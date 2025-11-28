/**
 * Integration Plan Service
 * Manages integration plans for calendar connections and other integrations
 */

import { createClient } from '@/lib/supabase/server'
import { formatDateForDB } from '@/lib/date-utils'
import { logger } from '@/lib/logger'

export interface IntegrationPlanMetadata {
  connection_id: string
  provider: 'google' | 'outlook' | 'apple'
  calendar_ids: string[]
  calendar_names: string[]
}

/**
 * Create an integration plan for a calendar connection
 */
export async function createIntegrationPlan(
  userId: string,
  connectionId: string,
  provider: 'google' | 'outlook' | 'apple',
  calendarIds: string[],
  calendarNames: string[]
): Promise<string> {
  const supabase = await createClient()

  try {
    // Generate plan name from provider and calendar names
    const providerName = provider === 'google' ? 'Google Calendar' 
      : provider === 'outlook' ? 'Microsoft Outlook'
      : 'Apple Calendar'
    
    const calendarName = calendarNames.length > 0 
      ? calendarNames[0] 
      : 'Primary'
    
    const goalText = `${providerName} - ${calendarName}${calendarNames.length > 1 ? ` (+${calendarNames.length - 1} more)` : ''}`

    // Create integration plan
    const { data: plan, error } = await supabase
      .from('plans')
      .insert({
        user_id: userId,
        goal_text: goalText,
        plan_type: 'integration',
        start_date: formatDateForDB(new Date()),
        end_date: null, // Integration plans are ongoing
        status: 'active',
        integration_metadata: {
          connection_id: connectionId,
          provider,
          calendar_ids: calendarIds,
          calendar_names: calendarNames,
        } as IntegrationPlanMetadata,
        summary_data: {
          provider,
          calendar_count: calendarIds.length,
        },
      })
      .select('id')
      .single()

    if (error) {
      logger.error('Failed to create integration plan', error as Error, {
        userId,
        connectionId,
        provider,
      })
      throw error
    }

    logger.info('Created integration plan', {
      planId: plan.id,
      userId,
      connectionId,
      provider,
    })

    return plan.id
  } catch (error) {
    logger.error('Error creating integration plan', error as Error, {
      userId,
      connectionId,
      provider,
    })
    throw error
  }
}

/**
 * Get integration plan for a calendar connection
 * Security: Verifies connection belongs to user via RLS, but also explicitly checks user_id for defense in depth
 */
export async function getIntegrationPlanForConnection(
  connectionId: string,
  userId: string
): Promise<string | null> {
  const supabase = await createClient()

  try {
    // First verify connection belongs to user
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
      return null
    }

    const { data: plan, error } = await supabase
      .from('plans')
      .select('id, user_id')
      .eq('plan_type', 'integration')
      .eq('integration_metadata->>connection_id', connectionId)
      .eq('status', 'active')
      .eq('user_id', userId) // Explicit user_id check for security
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No plan found
        return null
      }
      logger.error('Failed to get integration plan', error as Error, {
        connectionId,
        userId,
      })
      throw error
    }

    return plan?.id || null
  } catch (error) {
    logger.error('Error getting integration plan', error as Error, {
      connectionId,
      userId,
    })
    throw error
  }
}

/**
 * Get or create integration plan for a calendar connection
 */
export async function getOrCreateIntegrationPlan(
  userId: string,
  connectionId: string,
  provider: 'google' | 'outlook' | 'apple',
  calendarIds: string[],
  calendarNames: string[]
): Promise<string> {
  // Try to get existing plan (with user_id validation)
  const existingPlanId = await getIntegrationPlanForConnection(connectionId, userId)
  if (existingPlanId) {
    return existingPlanId
  }

  // Create new plan
  return await createIntegrationPlan(
    userId,
    connectionId,
    provider,
    calendarIds,
    calendarNames
  )
}

/**
 * Archive integration plan when connection is disconnected
 * Security: Verifies plan belongs to user before archiving
 */
export async function archiveIntegrationPlan(planId: string, userId: string): Promise<void> {
  const supabase = await createClient()

  try {
    // Verify plan belongs to user
    const { data: plan, error: verifyError } = await supabase
      .from('plans')
      .select('id, user_id, plan_type')
      .eq('id', planId)
      .eq('user_id', userId)
      .eq('plan_type', 'integration')
      .single()

    if (verifyError || !plan) {
      logger.warn('Plan not found or access denied', { planId, userId })
      throw new Error('Plan not found or access denied')
    }

    const { error } = await supabase
      .from('plans')
      .update({
        status: 'archived',
        archived_at: new Date().toISOString(),
      })
      .eq('id', planId)
      .eq('user_id', userId) // Explicit user_id check for security
      .eq('plan_type', 'integration')

    if (error) {
      logger.error('Failed to archive integration plan', error as Error, {
        planId,
        userId,
      })
      throw error
    }

    logger.info('Archived integration plan', { planId, userId })
  } catch (error) {
    logger.error('Error archiving integration plan', error as Error, {
      planId,
      userId,
    })
    throw error
  }
}

/**
 * Handle disconnection - archive the integration plan
 */
export async function handleDisconnection(connectionId: string, userId: string): Promise<void> {
  const planId = await getIntegrationPlanForConnection(connectionId, userId)
  if (planId) {
    await archiveIntegrationPlan(planId, userId)
  }
}

/**
 * Update integration plan metadata (e.g., when calendars are added/removed)
 * Security: Verifies plan belongs to user before updating
 */
export async function updateIntegrationPlanMetadata(
  planId: string,
  userId: string,
  metadata: Partial<IntegrationPlanMetadata>
): Promise<void> {
  const supabase = await createClient()

  try {
    // Get current metadata and verify ownership
    const { data: plan, error: fetchError } = await supabase
      .from('plans')
      .select('integration_metadata, user_id, plan_type')
      .eq('id', planId)
      .eq('user_id', userId) // Explicit user_id check for security
      .eq('plan_type', 'integration')
      .single()

    if (fetchError || !plan) {
      logger.warn('Integration plan not found or access denied', { planId, userId })
      throw new Error('Integration plan not found or access denied')
    }

    // Merge with new metadata
    const currentMetadata = (plan.integration_metadata || {}) as IntegrationPlanMetadata
    const updatedMetadata = {
      ...currentMetadata,
      ...metadata,
    }

    // Update plan name if calendar names changed
    if (metadata.calendar_names) {
      const providerName = updatedMetadata.provider === 'google' ? 'Google Calendar'
        : updatedMetadata.provider === 'outlook' ? 'Microsoft Outlook'
        : 'Apple Calendar'
      
      const calendarName = updatedMetadata.calendar_names.length > 0
        ? updatedMetadata.calendar_names[0]
        : 'Primary'
      
      const goalText = `${providerName} - ${calendarName}${updatedMetadata.calendar_names.length > 1 ? ` (+${updatedMetadata.calendar_names.length - 1} more)` : ''}`

      const { error: updateError } = await supabase
        .from('plans')
        .update({
          integration_metadata: updatedMetadata,
          goal_text: goalText,
          summary_data: {
            provider: updatedMetadata.provider,
            calendar_count: updatedMetadata.calendar_ids.length,
          },
        })
        .eq('id', planId)
        .eq('user_id', userId) // Explicit user_id check for security

      if (updateError) {
        throw updateError
      }
    } else {
      const { error: updateError } = await supabase
        .from('plans')
        .update({
          integration_metadata: updatedMetadata,
        })
        .eq('id', planId)
        .eq('user_id', userId) // Explicit user_id check for security

      if (updateError) {
        throw updateError
      }
    }

    logger.info('Updated integration plan metadata', { planId, userId })
  } catch (error) {
    logger.error('Error updating integration plan metadata', error as Error, {
      planId,
      userId,
    })
    throw error
  }
}

