import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'
import Anthropic                     from '@anthropic-ai/sdk'

// Increase timeout for Vercel Pro — web search + AI can take 20-40 s
export const maxDuration = 60

// ── Supabase admin client (bypasses RLS) ─────────────────────

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

// ── Anthropic ─────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Agent system prompt ───────────────────────────────────────

const AGENT_SYSTEM_PROMPT = `You are a golf travel research agent for Greenlit, a premium golf trip planning app.

STEP 1 — PRIVATE CLUB CHECK (do this first):
Search for publicly available green fees, resort rates, or daily fee pricing for this course.

If you cannot find any publicly available pricing — the course appears to be members-only with no published guest rates — respond with ONLY this JSON:
{"private": true, "reason": "Brief explanation of why it appears private"}

STEP 2 — If public pricing IS found, research the course thoroughly and return ONLY a valid JSON object with these exact fields:

{
  "name": "Full official course name",
  "location": "City, Region",
  "country": "Country name",
  "state_region": "State or region",
  "tagline": "One punchy sentence that sells the course — make a golfer's pulse quicken",
  "description": "3-4 paragraphs. Write like a golf travel journalist, not Wikipedia. Focus on what it feels like to play here, the setting, the challenge, and why a group of golfers would have the time of their lives.",
  "why_its_great": ["Array of 4-5 specific reasons this course is great for a GROUP golf trip — not generic, be specific to this course"],
  "courses_on_property": [{"name": "Course name", "holes": 18, "par": 72, "description": "One sentence"}],
  "lodging_on_property": true or false,
  "lodging_description": "Description of on-site lodging if it exists, otherwise null",
  "nearby_lodging": [{"name": "Hotel or resort name", "type": "Type of accommodation", "price_tier": "$, $$, $$$, or $$$$"}],
  "best_time_to_visit": "Specific guidance on best months and why, and what to avoid",
  "walking_friendly": true or false,
  "caddie_available": true or false,
  "price_per_round_low": integer (lowest published green fee in USD),
  "price_per_round_high": integer (highest published green fee in USD),
  "tags": ["Choose relevant tags from: Links, Parkland, Desert, Mountain, Ocean Views, Bucket List, Walking Only, Cart Required, Caddies Available, Resort, Championship, Ryder Cup, Major Venue, Waterfront, Historic, Hidden Gem, Off the Beaten Path, Value Play, Family Friendly"],
  "google_place_id": "Search Google Places for this course and return the place_id if found, otherwise null",
  "youtube_search_query": "[Course Name] golf course flyover"
}

Return ONLY valid JSON. No markdown, no preamble, no explanation. Just the JSON object.`

// ── Slug generator ────────────────────────────────────────────

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, '')           // strip apostrophes
    .replace(/[^a-z0-9\s-]/g, ' ') // non-alphanumeric → space
    .trim()
    .replace(/\s+/g, '-')           // spaces → hyphens
    .replace(/-+/g, '-')            // collapse multiple hyphens
}

// ── Emoji picker from tags ────────────────────────────────────

function pickEmoji(tags: string[]): string {
  const t = tags.map((x) => x.toLowerCase())
  if (t.some((x) => x.includes('ocean') || x.includes('waterfront'))) return '🌊'
  if (t.some((x) => x.includes('desert')))                             return '🏜️'
  if (t.some((x) => x.includes('mountain')))                           return '⛰️'
  if (t.some((x) => x.includes('links')))                              return '🌬️'
  if (t.some((x) => x.includes('historic')))                           return '🏛️'
  if (t.some((x) => x.includes('resort')))                             return '🌴'
  return '⛳'
}

// ── JSON extractor ────────────────────────────────────────────
// Handles cases where the model adds preamble text or markdown fences around the JSON

function extractJSON(raw: string): unknown {
  // Strip markdown code fences first
  let text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

  // Find the outermost { ... } block
  const start = text.indexOf('{')
  const end   = text.lastIndexOf('}')

  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`No JSON object found in response. Raw text: ${text.slice(0, 200)}`)
  }

  return JSON.parse(text.slice(start, end + 1))
}

// ── Route handler ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization') ?? ''
  const expected   = `Bearer ${process.env.CRON_SECRET}`
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = adminSupabase()

  // ── Claim the next pending course ─────────────────────────
  const { data: item, error: qErr } = await db
    .from('course_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (qErr || !item) {
    return NextResponse.json({ message: 'Queue empty' })
  }

  // Mark as processing immediately to prevent double-processing
  await db
    .from('course_queue')
    .update({ status: 'processing' })
    .eq('id', item.id)

  const { name, location, country } = item as {
    id: string; name: string; location: string; country: string | null
  }

  try {
    // ── Call Anthropic with web search ─────────────────────
    const response = await anthropic.messages.create({
      model      : 'claude-sonnet-4-5',
      max_tokens : 4000,
      tools      : [{ type: 'web_search_20250305' as const, name: 'web_search' }] as Parameters<typeof anthropic.messages.create>[0]['tools'],
      system     : AGENT_SYSTEM_PROMPT,
      messages   : [{
        role   : 'user',
        content: `Research this golf course: ${name}, located in ${location}${country ? `, ${country}` : ''}.`,
      }],
    })

    // Extract all text blocks (model may interleave tool results and text)
    const textContent = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as { type: 'text'; text: string }).text)
      .join('')
      .trim()

    if (!textContent) {
      throw new Error('No text content in Anthropic response')
    }

    // Extract JSON — handle preamble text, markdown fences, or trailing commentary
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const courseData = extractJSON(textContent) as any

    // ── Private club ──────────────────────────────────────
    if (courseData.private === true) {
      await db
        .from('course_queue')
        .update({
          status      : 'private',
          notes       : courseData.reason ?? 'Private club — no public pricing found',
          processed_at: new Date().toISOString(),
        })
        .eq('id', item.id)

      return NextResponse.json({
        status  : 'private',
        course  : name,
        reason  : courseData.reason,
      })
    }

    // ── Build courses row ─────────────────────────────────
    const slug = generateSlug(courseData.name ?? name)

    const courseRow = {
      slug,
      name             : courseData.name              ?? name,
      location         : courseData.location           ?? location,
      country          : courseData.country            ?? country ?? 'USA',
      state_region     : courseData.state_region       ?? item.state_region ?? null,
      emoji            : pickEmoji(courseData.tags     ?? []),
      tags             : courseData.tags               ?? [],
      price_min        : courseData.price_per_round_low  ?? null,
      price_max        : courseData.price_per_round_high ?? null,
      tagline          : courseData.tagline            ?? null,
      description      : courseData.description        ?? null,
      why_its_great    : courseData.why_its_great      ?? [],
      courses_on_property : courseData.courses_on_property ?? [],
      lodging_on_property : courseData.lodging_on_property
        ? (courseData.lodging_description ?? 'Yes')
        : null,
      lodging_description : courseData.lodging_description ?? null,
      nearby_lodging      : courseData.nearby_lodging      ?? [],
      best_time_to_visit  : courseData.best_time_to_visit  ?? null,
      walking_friendly    : courseData.walking_friendly    ?? false,
      caddie_available    : courseData.caddie_available    ?? false,
      google_place_id     : courseData.google_place_id     ?? null,
      youtube_search_query: courseData.youtube_search_query ?? `${name} golf course flyover`,
      updated_at          : new Date().toISOString(),
    }

    const { error: upsertErr } = await db
      .from('courses')
      .upsert(courseRow, { onConflict: 'name,location', ignoreDuplicates: false })

    if (upsertErr) throw new Error(`Supabase upsert error: ${upsertErr.message}`)

    // Mark queue record complete
    await db
      .from('course_queue')
      .update({
        status      : 'complete',
        notes       : null,
        processed_at: new Date().toISOString(),
      })
      .eq('id', item.id)

    return NextResponse.json({
      status  : 'complete',
      course  : courseRow.name,
      location: courseRow.location,
      slug    : courseRow.slug,
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`Enrichment error for "${name}":`, message)

    // Rate limit — reset to pending so it retries rather than permanently failing
    const isRateLimit = message.includes('rate_limit_error') || message.includes('429')
    if (isRateLimit) {
      await db
        .from('course_queue')
        .update({ status: 'pending', notes: null })
        .eq('id', item.id)

      return NextResponse.json(
        { status: 'rate_limited', course: name, error: 'Rate limit hit — course reset to pending' },
        { status: 429 },
      )
    }

    await db
      .from('course_queue')
      .update({
        status      : 'failed',
        notes       : message.slice(0, 500),
        processed_at: new Date().toISOString(),
      })
      .eq('id', item.id)

    return NextResponse.json(
      { status: 'failed', course: name, error: message },
      { status: 500 },
    )
  }
}

// Vercel Cron calls GET, so support both
export const GET = POST
