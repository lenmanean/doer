import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { level, message, data, userAgent, url, timestamp } = body

    // Get client IP and other request info
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const requestUserAgent = req.headers.get('user-agent') || userAgent || 'unknown'

    // Format log message with context
    const logMessage = `[CLIENT-LOG] [${level.toUpperCase()}] ${message}`
    const logData = {
      timestamp: timestamp || new Date().toISOString(),
      ip,
      userAgent: requestUserAgent,
      url: url || 'unknown',
      ...data,
    }

    // Log to server console (will appear in Vercel logs)
    switch (level) {
      case 'error':
        console.error(logMessage, logData)
        break
      case 'warn':
        console.warn(logMessage, logData)
        break
      case 'info':
        console.log(logMessage, logData)
        break
      default:
        console.log(logMessage, logData)
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    // Even if logging fails, don't break the app
    console.error('[LOG-API] Error processing log request:', error)
    return NextResponse.json({ success: false, error: 'Failed to process log' }, { status: 500 })
  }
}

