// src/app/api/plans/clarify/route.ts
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

/**
 * POST /api/plans/clarify
 *
 * Given a user's goal_text, ask GPT-4 to generate two short clarification questions
 * to help better understand the goal before roadmap generation.
 */
export async function POST(req: NextRequest) {
  try {
    const { goal_text } = await req.json()

    if (!goal_text || typeof goal_text !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid goal_text' }, { status: 400 })
    }

    const prompt = `
You are a goal clarification assistant. Your job is to ask ONE intelligent question that will help create a better, more personalized action plan.

User's Goal: "${goal_text}"

CRITICAL INSTRUCTIONS:
1. Ask ONE simple question that helps you understand their situation better
2. Keep it EXTREMELY short - aim for 5-8 words max
3. Ask it like you're talking to a friend - natural and casual
4. DO NOT explicitly connect it to their goal in the question itself
5. DO NOT ask about timeframes, deadlines, or schedules
6. DO NOT use long, complex sentence structures

⚠️ BREVITY IS KEY: Your question should be short enough to read in 2 seconds

GOOD EXAMPLES (Short and natural):
- For "Make money online": "What's your favorite thing to do?"
- For "Get fit": "What exercise do you enjoy most?"
- For "Learn Spanish": "Do you know any Spanish already?"


BAD EXAMPLES (Too long/complex):
- "What interests you or hobbies do you enjoy that could potentially be turned into an online opportunity?" (WAY too long)
- "What type of exercise do you enjoy or find most realistic to stick with?" (too wordy)
- "Is this a deep declutter project or mainly organizing what you have?" (too complex)
- "What's your motivation?" (too generic)

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
    console.error('❌ Clarify Error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to generate clarification questions' },
      { status: 500 }
    )
  }
}
