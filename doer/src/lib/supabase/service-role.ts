import { createClient, SupabaseClient } from '@supabase/supabase-js'

let singleton: SupabaseClient | null = null

function getEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function getServiceRoleClient(): SupabaseClient {
  if (singleton) return singleton

  const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')

  singleton = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return singleton
}









