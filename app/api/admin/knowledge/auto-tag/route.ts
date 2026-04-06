import { NextRequest } from 'next/server'
import { anthropic }   from '@/lib/anthropic'

const TAG_PROMPT_SUFFIX = `Respond in JSON only:
{
  "category": "trip_recommendation|course_review|hidden_gem|dining|activities|travel_tip|itinerary|destination_guide|influencer_content|general",
  "destinations": ["destination/resort names mentioned"],
  "courses_mentioned": ["specific course names mentioned"],
  "tags": ["relevant tags like: buddies trip, bachelor party, budget, bucket list, links golf, resort, walkable, caddie tips, dining, logistics"],
  "summary_title": "short title for this entry (under 60 chars)",
  "summary_content": "concise bullet-point summary of key takeaways for a golf concierge",
  "author": "account name if visible, or null"
}`

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { content, image, imageType } = await req.json()

  // ── Image-based auto-tag (vision) ──────────────────────────────────────────
  if (image) {
    try {
      const response = await anthropic.messages.create({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type:       'base64',
                media_type: imageType || 'image/jpeg',
                data:       image,
              },
            },
            {
              type: 'text',
              text: `This is a screenshot of a social media post about golf. Extract the following:

1. A concise summary of the golf-related content (trips, courses, tips, recommendations)
2. Any golf courses or destinations mentioned
3. Any restaurants, bars, or non-golf activities mentioned
4. Practical tips or insider knowledge that would help someone planning a golf trip
5. The author/account name if visible

${TAG_PROMPT_SUFFIX}`,
            },
          ],
        }],
      })

      const text = response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join('')

      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return Response.json({ error: 'Failed to parse AI response' }, { status: 500 })

      const parsed = JSON.parse(jsonMatch[0])
      return Response.json({ data: parsed })
    } catch (err) {
      console.error('Vision auto-tag error:', err)
      return Response.json({ error: 'Image auto-tag failed' }, { status: 500 })
    }
  }

  // ── Text-based auto-tag ────────────────────────────────────────────────────
  if (!content?.trim()) {
    return Response.json({ error: 'Provide content or an image' }, { status: 400 })
  }

  try {
    const response = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role:    'user',
        content: `Extract structured data from this golf content. Be specific with course and destination names. Also write a concise summary of the key takeaways (bullet points) that would be useful for a golf trip concierge.

"${content}"

${TAG_PROMPT_SUFFIX}`,
      }],
    })

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return Response.json({ error: 'Failed to parse AI response' }, { status: 500 })

    const parsed = JSON.parse(jsonMatch[0])
    return Response.json({ data: parsed })
  } catch (err) {
    console.error('Auto-tag error:', err)
    return Response.json({ error: 'Auto-tag failed' }, { status: 500 })
  }
}
