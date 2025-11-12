'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

interface SupabaseContextType {
  supabase: typeof supabase
  user: User | null
  loading: boolean
}

const SupabaseContext = createContext<SupabaseContextType | null>(null)

interface SupabaseProviderProps {
  children: React.ReactNode
  initialUser?: User | null
}

const isSessionMissingError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'name' in error &&
  (error as { name?: string }).name === 'AuthSessionMissingError'

export function SupabaseProvider({ children, initialUser }: SupabaseProviderProps) {
  const [user, setUser] = useState<User | null>(initialUser ?? null)
  const [loading, setLoading] = useState(initialUser === undefined)

  useEffect(() => {
    let isMounted = true

    const resolveUser = async () => {
      try {
        const { data, error } = await supabase.auth.getUser()
        if (!isMounted) return

        if (error) {
          if (!isSessionMissingError(error)) {
            console.error('[SupabaseProvider] Error fetching user:', error)
          }
          setUser(null)
        } else {
          setUser(data.user ?? null)
        }
      } catch (error) {
        if (!isMounted) return
        if (!isSessionMissingError(error)) {
          console.error('[SupabaseProvider] Unexpected auth error:', error)
        }
        setUser(null)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    if (initialUser === undefined) {
      resolveUser()
    } else {
      setLoading(false)
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (!isMounted) return

      if (event === 'SIGNED_OUT' || (event as string) === 'USER_DELETED') {
        setUser(null)
        setLoading(false)
        return
      }

      try {
        const { data, error } = await supabase.auth.getUser()
        if (!isMounted) return

        if (error) {
          if (!isSessionMissingError(error)) {
            console.error('[SupabaseProvider] Error verifying user after auth change:', error)
          }
          setUser(null)
        } else {
          setUser(data.user ?? null)
        }
      } catch (error) {
        if (!isMounted) return
        if (!isSessionMissingError(error)) {
          console.error('[SupabaseProvider] Unexpected auth change error:', error)
        }
        setUser(null)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [initialUser])

  const contextValue: SupabaseContextType = {
    supabase,
    user,
    loading
  }

  return (
    <SupabaseContext.Provider value={contextValue}>
      {children}
    </SupabaseContext.Provider>
  )
}

export const useSupabase = () => {
  const context = useContext(SupabaseContext)
  if (!context) {
    throw new Error('useSupabase must be used within a SupabaseProvider')
  }
  return context
}
