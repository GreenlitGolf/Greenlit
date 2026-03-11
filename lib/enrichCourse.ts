/**
 * Shared course enrichment utility — used by both:
 *   /api/cron/enrich-courses  (scheduled batch processing)
 *   /api/courses/enrich-on-demand  (inline enrichment triggered by concierge)
 */

import Anthropic          from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'

// ── Result types ──────────────────────────────────────────────

export type EnrichResult =
  | { success: true;  slug: string; name: string; location: string }
  | { success: false; isPrivate: true;    reason: string }
  | { success: false; isRateLimit: true;  error: string }
  | { success: false; error: string }

// ── Anthropic client ──────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Agent system prompt ───────────────────────────────────────

export const AGENT_SYSTEM_PROMPT = `You are a golf travel research agent for Greenlit, a premium golf trip planning app.

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
  "youtube_search_query": "[Course Name] golf course flyover"
}

Return ONLY valid JSON. No markdown, no preamble, no explanation. Just the JSON object.`

// ── Google Places Text Search ─────────────────────────────────

async function fetchGooglePlaceId(courseName: string, location: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey || apiKey === 'your_google_places_api_key_here') return null

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method : 'POST',
      headers: {
        'Content-Type'    : 'application/json',
        'X-Goog-Api-Key'  : apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName',
      },
      body: JSON.stringify({
        textQuery         : `${courseName} golf course ${location}`,
        includedType      : 'golf_course',
        languageCode      : 'en',
      }),
    })

    if (!res.ok) {
      console.warn(`Places Text Search failed (${res.status}) for "${courseName}"`)
      return null
    }

    const data = await res.json()
    const place = data.places?.[0]
    if (!place?.id) return null

    console.log(`Places lookup: "${courseName}" → ${place.id} (${place.displayName?.text})`)
    return place.id
  } catch (err) {
    console.warn('fetchGooglePlaceId error:', err)
    return null
  }
}

// ── Helpers ───────────────────────────────────────────────────

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

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

function extractJSON(raw: string): unknown {
  const text  = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const start = text.indexOf('{')
  const end   = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`No JSON object found in response. Preview: ${text.slice(0, 200)}`)
  }
  return JSON.parse(text.slice(start, end + 1))
}

// ── Main enrichment function ──────────────────────────────────

export async function enrichCourse(
  name     : string,
  location : string,
  country  : string,
  queueId  : string,
  db       : SupabaseClient,
): Promise<EnrichResult> {
  try {
    // ── Call Anthropic with web search ──────────────────────
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

    const textContent = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim()

    if (!textContent) throw new Error('No text content in Anthropic response')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const courseData = extractJSON(textContent) as any

    // ── Private club ────────────────────────────────────────
    if (courseData.private === true) {
      await db.from('course_queue').update({
        status      : 'private',
        notes       : courseData.reason ?? 'Private club — no public pricing found',
        processed_at: new Date().toISOString(),
      }).eq('id', queueId)
      return { success: false, isPrivate: true, reason: courseData.reason ?? 'Private club' }
    }

    // ── Build courses row ───────────────────────────────────
    const slug         = generateSlug(courseData.name ?? name)
    const resolvedName = courseData.name     ?? name
    const resolvedLoc  = courseData.location ?? location

    // Look up a real Google Place ID via the Places API Text Search
    const googlePlaceId = await fetchGooglePlaceId(resolvedName, resolvedLoc)

    const courseRow = {
      slug,
      name                : resolvedName,
      location            : resolvedLoc,
      country             : courseData.country             ?? country ?? 'USA',
      state_region        : courseData.state_region        ?? null,
      emoji               : pickEmoji(courseData.tags      ?? []),
      tags                : courseData.tags                ?? [],
      price_min           : courseData.price_per_round_low  ?? null,
      price_max           : courseData.price_per_round_high ?? null,
      tagline             : courseData.tagline             ?? null,
      description         : courseData.description         ?? null,
      why_its_great       : courseData.why_its_great       ?? [],
      courses_on_property : courseData.courses_on_property ?? [],
      lodging_on_property : courseData.lodging_on_property
        ? (courseData.lodging_description ?? 'Yes')
        : null,
      lodging_description : courseData.lodging_description ?? null,
      nearby_lodging      : courseData.nearby_lodging      ?? [],
      best_time_to_visit  : courseData.best_time_to_visit  ?? null,
      walking_friendly    : courseData.walking_friendly    ?? false,
      caddie_available    : courseData.caddie_available    ?? false,
      google_place_id     : googlePlaceId,
      youtube_search_query: courseData.youtube_search_query ?? `${name} golf course flyover`,
      updated_at          : new Date().toISOString(),
    }

    const { error: upsertErr } = await db
      .from('courses')
      .upsert(courseRow, { onConflict: 'name,location', ignoreDuplicates: false })

    if (upsertErr) throw new Error(`Supabase upsert error: ${upsertErr.message}`)

    await db.from('course_queue').update({
      status      : 'complete',
      notes       : null,
      processed_at: new Date().toISOString(),
    }).eq('id', queueId)

    return { success: true, slug, name: courseRow.name, location: courseRow.location }

  } catch (err) {
    const message     = err instanceof Error ? err.message : String(err)
    const isRateLimit = message.includes('rate_limit_error') || message.includes('429')

    if (isRateLimit) {
      await db.from('course_queue')
        .update({ status: 'pending', notes: null })
        .eq('id', queueId)
      return { success: false, isRateLimit: true, error: 'Rate limit hit — course reset to pending' }
    }

    await db.from('course_queue').update({
      status      : 'failed',
      notes       : message.slice(0, 500),
      processed_at: new Date().toISOString(),
    }).eq('id', queueId)

    return { success: false, error: message }
  }
}
