import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      email,
      phone,
      solutionType,
      companyName,
      teamSize,
      industry,
      useCase,
      schoolName,
      numberOfStudents,
      gradeLevel,
      subjectArea,
      businessName,
      numberOfClients,
      coachingType,
      specialization,
      message,
    } = body

    // Validate required fields
    if (!name || !email || !solutionType) {
      return NextResponse.json(
        { error: 'Name, email, and solution type are required' },
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

    // Validate solution type
    const validSolutionTypes = ['teams', 'educators', 'coaches']
    if (!validSolutionTypes.includes(solutionType)) {
      return NextResponse.json(
        { error: 'Invalid solution type' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Store the submission in the database
    const { data, error } = await supabase
      .from('contact_sales_submissions')
      .insert({
        name,
        email,
        phone: phone || null,
        solution_type: solutionType,
        company_name: companyName || null,
        team_size: teamSize || null,
        industry: industry || null,
        use_case: useCase || null,
        school_name: schoolName || null,
        number_of_students: numberOfStudents || null,
        grade_level: gradeLevel || null,
        subject_area: subjectArea || null,
        business_name: businessName || null,
        number_of_clients: numberOfClients || null,
        coaching_type: coachingType || null,
        specialization: specialization || null,
        message: message || null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Error storing contact sales submission:', error)
      return NextResponse.json(
        { error: 'Failed to submit contact form' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Contact form submitted successfully',
      id: data.id,
    })
  } catch (error) {
    console.error('Error in contact sales API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

