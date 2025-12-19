import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/supabase/service-role'
import { logger } from '@/lib/logger'
import { sendResendEmail } from '@/lib/email/resend'
import { EmailWeekOut } from '@/emails/waitlist/EmailWeekOut'
import { EmailLaunch } from '@/emails/waitlist/EmailLaunch'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * Get base URL for unsubscribe links
 */
function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://usedoer.com'
}

/**
 * Cron job endpoint for waitlist email automation
 * Runs every 30 minutes via Vercel Cron
 * 
 * Security: Verifies cron secret from Vercel
 * Uses service role client to bypass RLS for cron operations
 * 
 * Email Schedule:
 * - Week-out Email: December 25 UTC (if not already sent)
 * - Launch Email: January 1 UTC (if not already sent)
 */
export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    logger.warn('Unauthorized cron request to waitlist-drip', { hasAuthHeader: !!authHeader })
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    // Use service role client for cron job - bypasses RLS
    const supabase = getServiceRoleClient()
    const baseUrl = getBaseUrl()
    const now = new Date().toISOString()
    
    const results = {
      weekOut: { sent: 0, failed: 0 },
      launch: { sent: 0, failed: 0 },
      errors: [] as string[],
    }

    // Get current UTC date for date guards
    const today = new Date()
    const utcMonth = today.getUTCMonth()
    const utcDate = today.getUTCDate()

    // Process Week-Out Email: December 25 UTC (if not already sent)
    const isWeekOutDay = utcMonth === 11 && utcDate === 25 // Month is 0-indexed, December is 11

    if (isWeekOutDay) {
      const { data: weekOutCandidates, error: weekOutError } = await supabase
        .from('waitlist')
        .select('id, email')
        .not('welcome_sent_at', 'is', null)
        .is('week_out_sent_at', null)
        .is('unsubscribed_at', null)
        .limit(100)

      if (weekOutError) {
        logger.error('Failed to fetch week-out email candidates', {
          error: weekOutError.message,
        })
        results.errors.push(`Week-out email fetch error: ${weekOutError.message}`)
      } else if (weekOutCandidates && weekOutCandidates.length > 0) {
        for (const entry of weekOutCandidates) {
          try {
            const unsubscribeUrl = `${baseUrl}/api/unsubscribe?email=${encodeURIComponent(entry.email)}`
            const emailResult = await sendResendEmail({
              to: entry.email,
              subject: 'Launch is One Week Away!',
              react: EmailWeekOut({ unsubscribeUrl }),
              tag: 'waitlist-week-out',
            })

            if (emailResult.success) {
              const { error: updateError } = await supabase
                .from('waitlist')
                .update({
                  week_out_sent_at: now,
                  last_email_sent_at: now,
                })
                .eq('id', entry.id)

              if (updateError) {
                logger.error('Failed to update week_out_sent_at', {
                  error: updateError.message,
                  email: entry.email,
                })
                results.weekOut.failed++
              } else {
                results.weekOut.sent++
              }
            } else {
              logger.error('Failed to send week-out email', {
                error: emailResult.error,
                email: entry.email,
              })
              results.weekOut.failed++
            }
          } catch (error) {
            logger.error('Exception sending week-out email', {
              error: error instanceof Error ? error.message : String(error),
              email: entry.email,
            })
            results.weekOut.failed++
          }
        }
      }
    }

    // Process Launch Email: January 1 UTC (if not already sent)
    const isLaunchDay = utcMonth === 0 && utcDate === 1 // Month is 0-indexed, January is 0

    if (isLaunchDay) {
      const { data: launchCandidates, error: launchError } = await supabase
        .from('waitlist')
        .select('id, email')
        .is('launch_sent_at', null)
        .is('unsubscribed_at', null)
        .limit(100)

      if (launchError) {
        logger.error('Failed to fetch launch email candidates', {
          error: launchError.message,
        })
        results.errors.push(`Launch email fetch error: ${launchError.message}`)
      } else if (launchCandidates && launchCandidates.length > 0) {
        for (const entry of launchCandidates) {
          try {
            const unsubscribeUrl = `${baseUrl}/api/unsubscribe?email=${encodeURIComponent(entry.email)}`
            const signupUrl = `${baseUrl}/auth/signup`
            const emailResult = await sendResendEmail({
              to: entry.email,
              subject: 'DOER is Live! 🎉',
              react: EmailLaunch({ unsubscribeUrl, signupUrl }),
              tag: 'waitlist-launch',
            })

            if (emailResult.success) {
              const { error: updateError } = await supabase
                .from('waitlist')
                .update({
                  launch_sent_at: now,
                  last_email_sent_at: now,
                })
                .eq('id', entry.id)

              if (updateError) {
                logger.error('Failed to update launch_sent_at', {
                  error: updateError.message,
                  email: entry.email,
                })
                results.launch.failed++
              } else {
                results.launch.sent++
              }
            } else {
              logger.error('Failed to send launch email', {
                error: emailResult.error,
                email: entry.email,
              })
              results.launch.failed++
            }
          } catch (error) {
            logger.error('Exception sending launch email', {
              error: error instanceof Error ? error.message : String(error),
              email: entry.email,
            })
            results.launch.failed++
          }
        }
      }
    }

    const totalSent = results.weekOut.sent + results.launch.sent
    const totalFailed = results.weekOut.failed + results.launch.failed

    logger.info('Waitlist email cron completed', {
      weekOut: results.weekOut,
      launch: results.launch,
      totalSent,
      totalFailed,
    })

    return NextResponse.json({
      success: true,
      results,
      totalSent,
      totalFailed,
    })
  } catch (error) {
    logger.error('Unexpected error in waitlist drip cron', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


