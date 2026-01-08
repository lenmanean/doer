import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return NextResponse.json(
        { 
          healthy: false, 
          authenticated: false,
          error: 'Not authenticated' 
        },
        { status: 401 }
      )
    }
    
    return NextResponse.json({ 
      healthy: true, 
      authenticated: true,
      userId: user.id,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json(
      { 
        healthy: false, 
        authenticated: false,
        error: 'Health check failed' 
      },
      { status: 500 }
    )
  }
}
