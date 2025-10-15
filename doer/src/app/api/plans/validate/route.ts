import { NextRequest, NextResponse } from 'next/server'
import { validateGoalFeasibility } from '@/lib/ai'

export async function POST(req: NextRequest) {
  try {
    const { goal, clarifications } = await req.json()

    if (!goal || typeof goal !== 'string') {
      return NextResponse.json(
        { error: 'Goal is required and must be a string' },
        { status: 400 }
      )
    }

    // Validate goal feasibility using server-side AI
    const feasibilityCheck = await validateGoalFeasibility(goal.trim())

    return NextResponse.json({
      success: true,
      isFeasible: feasibilityCheck.isFeasible,
      reasoning: feasibilityCheck.reasoning
    })

  } catch (error) {
    console.error('Error validating goal feasibility:', error)
    return NextResponse.json(
      { error: 'Failed to validate goal feasibility' },
      { status: 500 }
    )
  }
}
