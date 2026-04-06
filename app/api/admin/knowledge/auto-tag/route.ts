import { NextRequest } from 'next/server'
import { anthropic }   from '@/lib/anthropic'

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { content } = await req.json()
  if (!content?.trim()) {
    return Response.json({ error: 'content is required' }, { status: 400 })
  }

  try {
    const response = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{
        role:    'user',
        content: `Extract structured data from this golf content. Be specific with course and destination names.

"${content}"

Respond in JSON only:
{
  "category": "trip_recommendation|course_review|hidden_gem|dining|activities|travel_tip|itinerary|destination_guide|influencer_content|general",
  "destinations": ["destination/resort names mentioned"],
  "courses_mentioned": ["specific course names mentioned"],
  "tags": ["relevant tags like: buddies trip, bachelor party, budget, bucket list, links golf, resort, walkable, caddie tips, dining, logistics"],
  "summary_title": "short title for this entry (under 60 chars)"
}`,
      }],
    })

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')

    // Parse the JSON from Claude's response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return Response.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    const parsed = JSON.parse(jsonMatch[0])
    return Response.json({ data: parsed })
  } catch (err) {
    console.error('Auto-tag error:', err)
    return Response.json({ error: 'Auto-tag failed' }, { status: 500 })
  }
}
