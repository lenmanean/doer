/**
 * React hook for secure Supabase queries
 * Provides authentication verification and retry logic
 */

import { useCallback } from 'react'
import { secureQuery, QueryOptions, QueryResult } from '@/lib/supabase/secure-query'
import { useSupabase } from '@/components/providers/supabase-provider'
import { SupabaseClient } from '@supabase/supabase-js'

export function useSecureQuery() {
  const { user, supabase } = useSupabase()

  const query = useCallback(
    async <T>(
      queryFn: (client: SupabaseClient) => Promise<{ data: T | null; error: any }>,
      options: QueryOptions = {}
    ): Promise<QueryResult<T>> => {
      // Override requireAuth based on user availability
      const finalOptions: QueryOptions = {
        ...options,
        requireAuth: options.requireAuth !== false && !!user,
      }

      return secureQuery(queryFn, finalOptions)
    },
    [user, supabase]
  )

  return { query, user, supabase }
}

