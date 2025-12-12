/**
 * Supabase Query Helpers
 * 
 * Provides helper functions that automatically enforce user filtering.
 * This reduces the risk of forgetting user_id filters in queries.
 */

import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Creates a query builder for user data that automatically filters by user_id
 * 
 * @param supabase - Supabase client
 * @param table - Table name
 * @param userId - User ID to filter by
 * @returns Query builder with user_id filter pre-applied
 * 
 * @example
 * ```typescript
 * const query = queryUserData(supabase, 'tasks', user.id)
 * const { data } = await query.select('*').order('created_at', { ascending: false })
 * ```
 */
export function queryUserData<T = any>(
  supabase: SupabaseClient,
  table: string,
  userId: string
) {
  return supabase.from(table).eq('user_id', userId) as any
}

/**
 * Creates a query builder for user data with plan filter
 * 
 * @param supabase - Supabase client
 * @param table - Table name
 * @param userId - User ID to filter by
 * @param planId - Plan ID to filter by (optional)
 * @returns Query builder with user_id and plan_id filters pre-applied
 * 
 * @example
 * ```typescript
 * const query = queryUserPlanData(supabase, 'tasks', user.id, planId)
 * const { data } = await query.select('*')
 * ```
 */
export function queryUserPlanData<T = any>(
  supabase: SupabaseClient,
  table: string,
  userId: string,
  planId: string | null
) {
  let query = supabase.from(table).eq('user_id', userId)
  
  if (planId) {
    query = query.eq('plan_id', planId) as any
  }
  
  return query as any
}

/**
 * Verifies user ownership before querying with array of IDs
 * 
 * @param supabase - Supabase client
 * @param table - Table name
 * @param userId - User ID to filter by
 * @param ids - Array of resource IDs
 * @param selectFields - Fields to select (default: 'id')
 * @returns Array of resources that belong to the user
 * 
 * @example
 * ```typescript
 * const tasks = await verifyUserOwnershipArray(
 *   supabase,
 *   'tasks',
 *   user.id,
 *   taskIds,
 *   'id, name'
 * )
 * if (tasks.length !== taskIds.length) {
 *   // Some tasks don't belong to user
 * }
 * ```
 */
export async function verifyUserOwnershipArray<T = any>(
  supabase: SupabaseClient,
  table: string,
  userId: string,
  ids: string[],
  selectFields: string = 'id'
): Promise<T[]> {
  const { data, error } = await supabase
    .from(table)
    .select(selectFields)
    .eq('user_id', userId) // ✅ Always filter by user_id first
    .in('id', ids)

  if (error || !data) {
    return []
  }

  return data as T[]
}

/**
 * Gets a single resource with user ownership verification
 * 
 * @param supabase - Supabase client
 * @param table - Table name
 * @param userId - User ID to filter by
 * @param resourceId - Resource ID
 * @param selectFields - Fields to select
 * @returns Resource if found and owned, null otherwise
 * 
 * @example
 * ```typescript
 * const plan = await getUserResource(
 *   supabase,
 *   'plans',
 *   user.id,
 *   planId,
 *   'id, name, goal_text'
 * )
 * if (!plan) {
 *   return notFoundResponse('Plan')
 * }
 * ```
 */
export async function getUserResource<T = any>(
  supabase: SupabaseClient,
  table: string,
  userId: string,
  resourceId: string,
  selectFields: string = 'id, user_id'
): Promise<T | null> {
  const { data, error } = await supabase
    .from(table)
    .select(selectFields)
    .eq('id', resourceId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data as T
}

