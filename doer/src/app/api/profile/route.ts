import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sanitizePreferences } from '@/lib/validation/preferences'
import { updateStripeCustomerProfile } from '@/lib/stripe/customer-profile'
import { sendResendEmail } from '@/lib/email/resend'
import { EmailWelcome } from '@/emails/welcome/EmailWelcome'
import { logger } from '@/lib/logger'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * GET /api/profile
 * Fetches the current user's profile
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error) {
      // If profile doesn't exist, create it with defaults
      if (error.code === 'PGRST116') {
        // Get browser timezone and locale for defaults
        const defaultTimezone = 'UTC' // Will be set by user later
        const defaultLocale = 'en-US' // Will be set by user later
        
        // Extract username from auth metadata
        const username = user.user_metadata?.username || null
        
        const { data: newProfile, error: createError } = await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            username: username,
            timezone: defaultTimezone,
            locale: defaultLocale
          })
          .select()
          .single()

        if (createError) {
          console.error('Error creating profile:', createError)
          return NextResponse.json({ error: createError.message }, { status: 500 })
        }

        return NextResponse.json({ profile: newProfile })
      }

      console.error('Error fetching profile:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Unexpected error in GET /api/profile:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/profile
 * Updates the current user's profile
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { avatar_url, first_name, last_name, date_of_birth, phone_number, referral_source, timezone, locale, settings } = body

    // Validate input
    if (avatar_url !== undefined && typeof avatar_url !== 'string') {
      return NextResponse.json(
        { error: 'Invalid avatar_url' },
        { status: 400 }
      )
    }

    if (first_name !== undefined && first_name !== null && typeof first_name !== 'string') {
      return NextResponse.json(
        { error: 'Invalid first_name' },
        { status: 400 }
      )
    }

    if (last_name !== undefined && last_name !== null && typeof last_name !== 'string') {
      return NextResponse.json(
        { error: 'Invalid last_name' },
        { status: 400 }
      )
    }

    if (date_of_birth !== undefined && date_of_birth !== null) {
      // Validate date format (YYYY-MM-DD)
      if (typeof date_of_birth !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date_of_birth)) {
        return NextResponse.json(
          { error: 'Invalid date_of_birth format. Use YYYY-MM-DD' },
          { status: 400 }
        )
      }
      // Validate date is not in the future
      const dob = new Date(date_of_birth)
      if (dob > new Date()) {
        return NextResponse.json(
          { error: 'Date of birth cannot be in the future' },
          { status: 400 }
        )
      }
      // Validate reasonable age (e.g., at least 13 years old, not more than 150)
      const age = new Date().getFullYear() - dob.getFullYear()
      if (age < 13 || age > 150) {
        return NextResponse.json(
          { error: 'Invalid date of birth' },
          { status: 400 }
        )
      }
    }

    if (phone_number !== undefined && phone_number !== null) {
      if (typeof phone_number !== 'string') {
        return NextResponse.json(
          { error: 'Invalid phone_number' },
          { status: 400 }
        )
      }
      // Basic phone number validation (allows various formats, but must contain digits)
      const cleanedPhone = phone_number.replace(/\D/g, '')
      if (cleanedPhone.length < 10 || cleanedPhone.length > 15) {
        return NextResponse.json(
          { error: 'Invalid phone number format. Must contain 10-15 digits' },
          { status: 400 }
        )
      }
    }

    if (referral_source !== undefined && referral_source !== null && typeof referral_source !== 'string') {
      return NextResponse.json(
        { error: 'Invalid referral_source' },
        { status: 400 }
      )
    }

    if (timezone !== undefined && timezone !== null) {
      if (typeof timezone !== 'string') {
        return NextResponse.json(
          { error: 'Invalid timezone' },
          { status: 400 }
        )
      }
      // Validate timezone is in the list of supported timezones
      try {
        if (!Intl.supportedValuesOf('timeZone').includes(timezone)) {
          return NextResponse.json(
            { error: 'Invalid timezone' },
            { status: 400 }
          )
        }
      } catch (e) {
        // If Intl.supportedValuesOf is not available, just validate it's a string
        // This is a fallback for older browsers
      }
    }

    if (locale !== undefined && locale !== null) {
      if (typeof locale !== 'string') {
        return NextResponse.json(
          { error: 'Invalid locale' },
          { status: 400 }
        )
      }
      // Basic locale format validation (e.g., en-US, fr-FR)
      if (!/^[a-z]{2}-[A-Z]{2}$/.test(locale) && !/^[a-z]{2}$/.test(locale)) {
        return NextResponse.json(
          { error: 'Invalid locale format. Use format like en-US or en' },
          { status: 400 }
        )
      }
    }

    if (settings !== undefined && typeof settings !== 'object') {
      return NextResponse.json(
        { error: 'Invalid settings' },
        { status: 400 }
      )
    }

    // Merge preferences: keep existing JSONB and update only intended keys
    // Fetch current profile to check if this is first-time completion
    const { data: existingProfile } = await supabase
      .from('user_settings')
      .select('preferences, first_name')
      .eq('user_id', user.id)
      .single()

    const currentPrefs = existingProfile?.preferences || {}
    const hadFirstName = !!existingProfile?.first_name
    const isFirstTimeCompletion = !hadFirstName && first_name !== undefined && first_name !== null && first_name.trim().length > 0

    // Build preferences object from incoming settings
    const incomingPrefs: any = { ...currentPrefs }
    
    // Map incoming settings to preference keys
    if (settings?.preferences) {
      // Sanitize and validate preferences
      const sanitized = sanitizePreferences({
        theme: settings.preferences.theme,
        accent_color: settings.preferences.accent_color,
        time_format: settings.preferences.time_format,
        week_start_day: settings.preferences.start_of_week === 'monday' ? 1 : 
                        settings.preferences.start_of_week === 'sunday' ? 0 : 
                        settings.preferences.start_of_week,
        improve_model_enabled: settings.preferences.improve_model_enabled,
        privacy: settings.preferences.privacy
      })
      
      if (sanitized === null) {
        return NextResponse.json(
          { error: 'Invalid preferences data' },
          { status: 400 }
        )
      }
      
      // Merge sanitized preferences
      if (sanitized.theme) incomingPrefs.theme = sanitized.theme
      if (sanitized.accent_color) incomingPrefs.accent_color = sanitized.accent_color
      if (sanitized.time_format) incomingPrefs.time_format = sanitized.time_format
      if (sanitized.week_start_day !== undefined) incomingPrefs.week_start_day = sanitized.week_start_day
      if (sanitized.privacy) {
        incomingPrefs.privacy = {
          ...(currentPrefs.privacy || {}),
          ...sanitized.privacy
        }
      }
      if (sanitized.workday) {
        incomingPrefs.workday = {
          ...(currentPrefs.workday || {}),
          ...sanitized.workday
        }
      }
    }
    
    if (settings?.workday) {
      // Validate workday hours
      const workdayPrefs: any = {}
      if (settings.workday.workday_start_hour !== undefined) {
        if (typeof settings.workday.workday_start_hour !== 'number' || 
            settings.workday.workday_start_hour < 0 || 
            settings.workday.workday_start_hour > 23) {
          return NextResponse.json(
            { error: 'Invalid workday_start_hour' },
            { status: 400 }
          )
        }
        workdayPrefs.workday_start_hour = settings.workday.workday_start_hour
      }
      if (settings.workday.workday_end_hour !== undefined) {
        if (typeof settings.workday.workday_end_hour !== 'number' || 
            settings.workday.workday_end_hour < 0 || 
            settings.workday.workday_end_hour > 23) {
          return NextResponse.json(
            { error: 'Invalid workday_end_hour' },
            { status: 400 }
          )
        }
        workdayPrefs.workday_end_hour = settings.workday.workday_end_hour
      }
      if (settings.workday.lunch_start_hour !== undefined) {
        if (typeof settings.workday.lunch_start_hour !== 'number' || 
            settings.workday.lunch_start_hour < 0 || 
            settings.workday.lunch_start_hour > 23) {
          return NextResponse.json(
            { error: 'Invalid lunch_start_hour' },
            { status: 400 }
          )
        }
        workdayPrefs.lunch_start_hour = settings.workday.lunch_start_hour
      }
      if (settings.workday.lunch_end_hour !== undefined) {
        if (typeof settings.workday.lunch_end_hour !== 'number' || 
            settings.workday.lunch_end_hour < 0 || 
            settings.workday.lunch_end_hour > 23) {
          return NextResponse.json(
            { error: 'Invalid lunch_end_hour' },
            { status: 400 }
          )
        }
        workdayPrefs.lunch_end_hour = settings.workday.lunch_end_hour
      }
      
      // Preserve existing structure if we already store workday there
      incomingPrefs.workday = {
        ...(incomingPrefs.workday || currentPrefs.workday || {}),
        ...workdayPrefs
      }
    }

    const { data: profile, error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        avatar_url: avatar_url !== undefined ? avatar_url : undefined,
        first_name: first_name !== undefined ? (first_name || null) : undefined,
        last_name: last_name !== undefined ? (last_name || null) : undefined,
        date_of_birth: date_of_birth !== undefined ? (date_of_birth || null) : undefined,
        phone_number: phone_number !== undefined ? (phone_number || null) : undefined,
        referral_source: referral_source !== undefined ? (referral_source || null) : undefined,
        timezone: timezone !== undefined ? (timezone || null) : undefined,
        locale: locale !== undefined ? (locale || null) : undefined,
        // Note: phone_verified should only be set to true after verification
        // For now, it remains false until verification is implemented
        preferences: incomingPrefs,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single()

    if (error) {
      console.error('Error upserting profile:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update Stripe customer profile asynchronously (don't block response)
    updateStripeCustomerProfile(user.id, {
      firstName: first_name ?? undefined,
      lastName: last_name ?? undefined,
      email: user.email || undefined,
    }).catch((stripeError) => {
      console.warn('[profile] Failed to update Stripe customer profile:', stripeError)
    })

    // Send welcome email on first-time profile completion (non-blocking)
    if (isFirstTimeCompletion && user.email) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://usedoer.com'
      const unsubscribeUrl = `${baseUrl}/api/unsubscribe?email=${encodeURIComponent(user.email)}`
      const dashboardUrl = `${baseUrl}/dashboard`
      
      sendResendEmail({
        to: user.email,
        subject: 'Welcome to DOER! 🎉',
        react: EmailWelcome({ unsubscribeUrl, dashboardUrl }),
        tag: 'user-welcome',
        unsubscribeUrl,
      }).catch((emailError) => {
        logger.error('Failed to send welcome email', {
          error: emailError instanceof Error ? emailError.message : String(emailError),
          userId: user.id,
          email: user.email,
        })
        // Don't fail the request - email sending is non-blocking
      })
    }

    return NextResponse.json({ profile, success: true })
  } catch (error) {
    console.error('Unexpected error in POST /api/profile:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

