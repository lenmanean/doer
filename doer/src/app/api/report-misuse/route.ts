import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/mailer'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, description, reportedUrl } = body

    // Validate required fields
    if (!email || !description) {
      return NextResponse.json(
        { error: 'Email and description are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate description length
    const trimmedDescription = description.trim()
    if (trimmedDescription.length < 10) {
      return NextResponse.json(
        { error: 'Description must be at least 10 characters long' },
        { status: 400 }
      )
    }
    if (trimmedDescription.length > 5000) {
      return NextResponse.json(
        { error: 'Description must be no more than 5000 characters long' },
        { status: 400 }
      )
    }

    // Extract IP address and user agent
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null

    const userAgent = request.headers.get('user-agent') || null

    // Get authenticated user if available
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const userId = user?.id || null

    // Store the report in the database
    const { data, error } = await supabase
      .from('misuse_reports')
      .insert({
        email: email.trim().toLowerCase(),
        description: trimmedDescription,
        reported_url: reportedUrl?.trim() || null,
        user_id: userId,
        ip_address: ipAddress,
        user_agent: userAgent,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Error storing misuse report:', error)
      return NextResponse.json(
        { error: 'Failed to submit report' },
        { status: 500 }
      )
    }

    // Send email notification to help@usedoer.com
    try {
      // Escape HTML to prevent XSS
      const escapeHtml = (text: string) => {
        const map: Record<string, string> = {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#039;',
        }
        return text.replace(/[&<>"']/g, (m) => map[m])
      }

      const emailSubject = `Misuse Report - ${data.id.substring(0, 8)}`
      const escapedDescription = escapeHtml(description).replace(/\n/g, '<br>')
      const escapedEmail = escapeHtml(email)
      const escapedUrl = reportedUrl ? escapeHtml(reportedUrl) : ''
      
      const emailHtml = `
        <h2>New Misuse Report</h2>
        <p><strong>Report ID:</strong> ${data.id}</p>
        <p><strong>Reporter Email:</strong> ${escapedEmail}</p>
        ${userId ? `<p><strong>User ID:</strong> ${userId}</p>` : ''}
        ${reportedUrl ? `<p><strong>Reported URL:</strong> <a href="${escapedUrl}">${escapedUrl}</a></p>` : ''}
        <p><strong>Description:</strong></p>
        <p style="white-space: pre-wrap; background: #f5f5f5; padding: 10px; border-radius: 4px;">${escapedDescription}</p>
        <p><strong>Submitted:</strong> ${new Date(data.created_at).toLocaleString()}</p>
        ${ipAddress ? `<p><strong>IP Address:</strong> ${escapeHtml(ipAddress)}</p>` : ''}
        <p><strong>Status:</strong> ${data.status}</p>
      `
      const emailText = `
New Misuse Report

Report ID: ${data.id}
Reporter Email: ${email}
${userId ? `User ID: ${userId}\n` : ''}${reportedUrl ? `Reported URL: ${reportedUrl}\n` : ''}
Description:
${description}

Submitted: ${new Date(data.created_at).toLocaleString()}
${ipAddress ? `IP Address: ${ipAddress}\n` : ''}
Status: ${data.status}
      `

      await sendEmail({
        to: 'help@usedoer.com',
        subject: emailSubject,
        html: emailHtml,
        text: emailText,
      })
    } catch (emailError) {
      // Log email error but don't fail the request
      // The report is already stored in the database
      console.error('Error sending misuse report email:', emailError)
    }

    return NextResponse.json({
      success: true,
      message: 'Report submitted successfully',
      id: data.id,
    })
  } catch (error) {
    console.error('Error in report misuse API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
