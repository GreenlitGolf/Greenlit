import { NextRequest } from 'next/server'
import { anthropic }   from '@/lib/anthropic'

// ── Fetch readable text from a URL ───────────────────────────────────────────

async function fetchUrlContent(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GreenlitBot/1.0)' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Failed to fetch URL: ${res.status}`)

  const html = await res.text()

  // Strip HTML tags, scripts, styles — extract readable text
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Limit to ~4000 chars to stay within token budget
  return text.slice(0, 4000)
}

// ── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { content, url } = await req.json()

  // Determine the text to analyze — fetch from URL if no content provided
  let textToAnalyze = content?.trim() || ''

  if (!textToAnalyze && url?.trim()) {
    try {
      textToAnalyze = await fetchUrlContent(url.trim())
    } catch (err) {
      console.error('URL fetch error:', err)
      return Response.json({ error: 'Failed to fetch URL content' }, { status: 400 })
    }
  }

  if (!textToAnalyze) {
    return Response.json({ error: 'Provide content or a URL' }, { status: 400 })
  }

  try {
    const response = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role:    'user',
        content: `Extract structured data from this golf content. Be specific with course and destination names. Also write a concise summary of the key takeaways (bullet points) that would be useful for a golf trip concierge.

"${textToAnalyze}"

Respond in JSON only:
{
  "category": "trip_recommendation|course_review|hidden_gem|dining|activities|travel_tip|itinerary|destination_guide|influencer_content|general",
  "destinations": ["destination/resort names mentioned"],
  "courses_mentioned": ["specific course names mentioned"],
  "tags": ["relevant tags like: buddies trip, bachelor party, budget, bucket list, links golf, resort, walkable, caddie tips, dining, logistics"],
  "summary_title": "short title for this entry (under 60 chars)",
  "summary_content": "concise bullet-point summary of key takeaways for a golf concierge"
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
