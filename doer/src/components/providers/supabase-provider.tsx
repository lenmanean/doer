'use client'

import { createContext, useContext, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

const SupabaseContext = createContext<any>(null)

export function SupabaseProvider({ children, initialSession }: { children: React.ReactNode, initialSession?: Session }) {
  const [session, setSession] = useState<Session | null>(initialSession || null)

  return (
    <SupabaseContext.Provider value={{ supabase, session, setSession }}>
      {children}
    </SupabaseContext.Provider>
  )
}

export const useSupabase = () => useContext(SupabaseContext)
