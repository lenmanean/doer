import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createClient()

    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('[auth/signout] Supabase sign out failed:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[auth/signout] Unexpected error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}





