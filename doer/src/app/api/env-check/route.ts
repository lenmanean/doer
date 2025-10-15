// src/app/api/env-check/route.ts
import { NextResponse } from 'next/server'

/**
 * GET /api/env-check
 * 
 * Verifies that required environment variables are being loaded properly.
 * (Only exposes whether keys exist — never the actual secrets.)
 */
export async function GET() {
  return NextResponse.json({
    app_env: process.env.NEXT_PUBLIC_APP_ENV || '❌ Missing',
    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Loaded' : '❌ Missing',
      anon_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Loaded' : '❌ Missing',
      service_role: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Loaded' : '❌ Missing',
    },
    openai: process.env.OPENAI_API_KEY ? '✅ Loaded' : '❌ Missing',
  })
}
