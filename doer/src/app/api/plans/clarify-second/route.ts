// src/app/api/plans/clarify-second/route.ts
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

/**
 * POST /api/plans/clarify-second
 *
 * Given a user's goal_text, first clarification question, and first clarification answer,
 * generate a second clarification question that builds on the first answer.
 */
export async function POST(req: NextRequest) {
  try {
    const { goal_text, first_question, first_answer } = await req.json()

    if (!goal_text || !first_question || !first_answer) {
      return NextResponse.json({ 
        error: 'Missing required fields: goal_text, first_question, first_answer' 
      }, { status: 400 })
    }

    const prompt = `
You are a goal clarification assistant. Your job is to ask a SECOND intelligent question that will help create a better, more personalized action plan.

User's Goal: "${goal_text}"

First Question Asked: "${first_question}"
User's Answer: "${first_answer}"

CRITICAL INSTRUCTIONS:
1. Analyze their first answer to understand what they've told you
2. Ask ONE simple follow-up question based on their answer
3. Keep it EXTREMELY short - aim for 5-8 words max
4. Ask it like you're talking to a friend - natural and casual
5. DO NOT explicitly connect it to their goal in the question itself
6. DO NOT ask about timeframes, deadlines, or schedules
7. DO NOT repeat the same type of question as Q1

⚠️ BREVITY IS KEY: Your question should be short enough to read in 2 seconds

⚠️ RESPONSE TO CONFUSION:
- If their answer shows confusion ("I don't know", "you tell me"), ask something even SIMPLER
- Focus on concrete, easy questions


BAD EXAMPLES (Too long/complex):
- "What's the biggest challenge you expect with this goal?" (too wordy)
- "Do you have any specific tools or resources already available?" (too long)
- "What would achieving this goal change for you?" (too abstract)
- "How much time can you realistically dedicate to this each day?" (too wordy)

Return only valid JSON in this exact format:
{ "question": "Your question here" }
`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that outputs only JSON. CRITICAL: Keep questions EXTREMELY short (5-8 words max). Ask like talking to a friend.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      response_format: { type: 'json_object' },
    })

    const output = completion.choices[0].message.content
    if (!output) throw new Error('Empty response from model')

    const parsed = JSON.parse(output)
    const question = parsed.question

    if (!question || typeof question !== 'string') {
      throw new Error('Invalid response format')
    }

    return NextResponse.json({
      success: true,
      question,
      token_count: completion.usage?.total_tokens || 0,
    })
  } catch (err: any) {
    console.error('❌ Clarify Second Error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to generate second clarification question' },
      { status: 500 }
    )
  }
}
