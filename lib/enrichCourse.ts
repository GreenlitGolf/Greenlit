/**
 * Shared course enrichment utility — used by both:
 *   /api/cron/enrich-courses  (scheduled batch processing)
 *   /api/courses/enrich-on-demand  (inline enrichment triggered by concierge)
 *
 * Supports two modes:
 *   'standard' — single Anthropic call with web search (fast, ~15-25s)
 *   'deep'     — two-phase: source discovery → fetch URLs → deep synthesis (~40-60s)
 */

import Anthropic          from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'

// ── Result types ──────────────────────────────────────────────

export type EnrichResult =
  | { success: true;  slug: string; name: string; location: string }
  | { success: false; isPrivate: true;    reason: string }
  | { success: false; isRateLimit: true;  error: string }
  | { success: false; isCreditExhausted: true; error: string }
  | { success: false; error: string }

export type EnrichMode = 'standard' | 'deep'

// ── Anthropic client ──────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Standard agent system prompt (original) ───────────────────

const STANDARD_SYSTEM_PROMPT = `You are a golf travel research agent for Greenlit, a premium golf trip planning app.

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
  "youtube_search_query": "[Course Name] golf course flyover",
  "website_url": "Official course website URL (e.g., https://www.pebblebeach.com). Null if not found."
}

IMPORTANT: Do NOT include any HTML tags, citation tags, or markup in your response. Output clean prose only.
Return ONLY valid JSON. No markdown, no preamble, no explanation. Just the JSON object.`

// ── Deep research system prompt ───────────────────────────────

const DEEP_SYNTHESIS_PROMPT = `You are a senior golf travel advisor and researcher for Greenlit, a premium golf trip planning app. Your job is to produce the most comprehensive, accurate, and genuinely useful course profile possible — better than anything a golfer could piece together from Google in an hour.

You have access to fetched source material from the course's official website, reviews, and trip reports. Read them carefully. Supplement with your own web searches for anything the sources don't cover.

STEP 1 — PRIVATE CLUB CHECK:
Before anything else: does this course have publicly available green fees or resort guest rates?

If it is strictly members-only with no published guest access — respond ONLY with:
{"private": true, "reason": "Brief explanation"}

STEP 2 — DEEP RESEARCH SYNTHESIS:
If the course is publicly accessible, produce a complete course profile. Think like a 20-year golf travel advisor who has personally visited this course and knows what groups actually care about — not what the marketing brochure says.

Return ONLY a valid JSON object with these exact fields:

{
  "name": "Full official course name",
  "location": "City, Region",
  "country": "Country name",
  "state_region": "State or region",

  "tagline": "One punchy sentence that makes a golfer's pulse quicken. Specific to this course — not generic hype.",

  "description": "4 paragraphs. Write like a golf travel journalist, not Wikipedia or a press release. Paragraph 1: the setting and first impression — what does it feel like to arrive here? Paragraph 2: the course itself — architecture, character, signature holes, how it plays. Paragraph 3: the group experience — pace of play, the 19th hole, what happens after the round. Paragraph 4: honest context — who this course is for, who might be disappointed, what makes it worth the trip.",

  "why_its_great": [
    "4-5 specific reasons this course is exceptional for a GROUP golf trip — not generic ('great views') but concrete ('The Halfway House at the 9th stocks local craft beer and the starter always holds groups there for 20 minutes, turning it into a party'). Reference actual features, holes, traditions, or logistics that matter to groups."
  ],

  "courses_on_property": [{"name": "Course name", "holes": 18, "par": 72, "description": "One honest sentence — what is this course actually like?"}],

  "lodging_on_property": true or false,
  "lodging_description": "Honest description of on-site lodging if it exists. Include price tier, quality level, capacity, and whether it's actually worth it for groups vs. staying nearby. Null if none.",

  "nearby_lodging": [
    {"name": "Hotel or resort name", "type": "Type", "price_tier": "$/$$/$$$/$$$$", "insider_note": "One sentence an advisor would tell you that's not on their website"}
  ],

  "best_time_to_visit": "Specific month-by-month guidance. Don't just say 'spring and fall' — tell me which months to book, which to avoid and why (weather, crowds, pricing, course conditions), and any specific windows that insiders know about.",

  "advance_booking_required": "How far in advance do groups need to book? Is there a lottery or ballot system? Any insider tips on securing tee times?",

  "walking_friendly": true or false,
  "caddie_available": true or false,
  "caddie_notes": "If caddies are available: cost range, how to book, whether they're recommended for first-timers, any booking lead time requirements. Null if no caddies.",

  "pace_of_play": "Honest assessment — is this course known for fast or slow play? Any times of day or days of week that are better for groups wanting to move? Any minimum handicap or pace requirements?",

  "price_per_round_low": integer (lowest published green fee USD),
  "price_per_round_high": integer (highest published green fee USD),
  "pricing_notes": "Any nuance on pricing — twilight rates, replay discounts, stay-and-play packages, cart vs. walking rate differences, seasonal variation.",

  "tags": ["Choose all relevant tags from: Links, Parkland, Desert, Mountain, Ocean Views, Bucket List, Walking Only, Cart Required, Caddies Available, Resort, Championship, Ryder Cup, Major Venue, Waterfront, Historic, Hidden Gem, Off the Beaten Path, Value Play, Family Friendly, Walking Recommended"],

  "insider_tips": [
    "2-3 things a well-connected golf travel advisor would tell you that aren't on the website. Examples: specific holes to watch out for, local knowledge about conditions, a restaurant nearby that's actually worth it, a quirk of the booking system, the best time of day to play for light/conditions."
  ],

  "common_questions": [
    {"question": "Is this course walkable?", "answer": "..."},
    {"question": "How far in advance should we book?", "answer": "..."},
    {"question": "What are the best months to visit?", "answer": "..."}
  ],

  "trip_combinations": "If this course is commonly paired with 1-2 other courses for a multi-day itinerary, name them and describe the logical trip. E.g., 'Pairs naturally with Turnberry and Trump Turnberry for a 4-day Ayrshire coast trip.' Null if no obvious combination.",

  "youtube_search_query": "[Course Name] golf course flyover",
  "website_url": "Official course website URL (e.g., https://www.pebblebeach.com). Null if not found.",
  "architect": "Course architect(s) name. Null if not found.",
  "year_opened": "Year the course opened. Null if not found."
}

QUALITY BAR: Before finalizing your response, ask yourself: would a serious golfer planning a group trip learn something genuinely useful from this profile that they couldn't get from 5 minutes on Google? If not, go deeper.

IMPORTANT: Do NOT include any HTML tags, citation tags, or markup in your response. Output clean prose only.
Return ONLY valid JSON. No markdown, no preamble, no explanation.`

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

// ── HTML stripping (regex-based, no deps) ─────────────────────

function stripHtml(html: string): string {
  let text = html
  // Remove script, style, nav, footer, header blocks entirely
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  text = text.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
  text = text.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
  text = text.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
  // Remove all remaining tags
  text = text.replace(/<[^>]+>/g, ' ')
  // Decode common entities
  text = text.replace(/&nbsp;/g, ' ')
  text = text.replace(/&amp;/g, '&')
  text = text.replace(/&lt;/g, '<')
  text = text.replace(/&gt;/g, '>')
  text = text.replace(/&quot;/g, '"')
  text = text.replace(/&#39;/g, "'")
  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim()
  return text
}

// ── URL fetching with timeout ─────────────────────────────────

async function fetchPageContent(url: string, timeoutMs = 8000): Promise<{ url: string; content: string } | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Greenlit/1.0; +https://greenlit.golf)',
        Accept: 'text/html,application/xhtml+xml,*/*',
      },
    })
    clearTimeout(timer)

    if (!res.ok) {
      console.log(`[deep-research] Fetch failed for ${url}: ${res.status}`)
      return null
    }

    const html = await res.text()
    const stripped = stripHtml(html)
    const truncated = stripped.slice(0, 3000)
    console.log(`[deep-research] Fetched ${url} → ${truncated.length} chars`)
    return { url, content: truncated }
  } catch (err) {
    console.log(`[deep-research] Fetch error for ${url}: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}

// ── Extract URL array from Phase 1 response ──────────────────

function extractURLArray(raw: string): string[] {
  try {
    const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    // Find the JSON array
    const start = text.indexOf('[')
    const end = text.lastIndexOf(']')
    if (start === -1 || end === -1 || end <= start) return []
    const arr = JSON.parse(text.slice(start, end + 1))
    if (!Array.isArray(arr)) return []
    return arr.filter((u: unknown) => typeof u === 'string' && u.startsWith('http')).slice(0, 4)
  } catch {
    return []
  }
}

// ── Standard research (original single-pass) ─────────────────

async function standardResearch(
  name: string,
  location: string,
  country: string,
): Promise<{ textContent: string }> {
  const response = await anthropic.messages.create({
    model      : 'claude-haiku-4-5',
    max_tokens : 2000,
    tools      : [{ type: 'web_search_20250305' as const, name: 'web_search' }] as Parameters<typeof anthropic.messages.create>[0]['tools'],
    system     : STANDARD_SYSTEM_PROMPT,
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
  return { textContent }
}

// ── Deep research (two-phase) ─────────────────────────────────

async function deepResearch(
  name: string,
  location: string,
  country: string,
): Promise<{ textContent: string }> {
  // ── Phase 1: Source discovery ──────────────────────────────
  let urls: string[] = []

  try {
    console.log(`[deep-research] Phase 1: discovering sources for "${name}"`)
    const discoveryResponse = await anthropic.messages.create({
      model      : 'claude-sonnet-4-5',
      max_tokens : 500,
      tools      : [{ type: 'web_search_20250305' as const, name: 'web_search' }] as Parameters<typeof anthropic.messages.create>[0]['tools'],
      messages   : [{
        role   : 'user',
        content: `Find the 4 best online sources for researching this golf course for a group trip planner: ${name}, ${location}${country ? `, ${country}` : ''}.

Search for: the course's official website, Golf Digest or Golf Pass reviews, No Laying Up coverage, GolfAdvisor or TripAdvisor reviews, and any detailed trip reports or course guides.

Return ONLY a JSON array of up to 4 URLs — the most information-rich sources you found. No markdown, no explanation. Just the array: ["https://...", "https://...", "https://...", "https://..."]`,
      }],
    })

    const discoveryText = discoveryResponse.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim()

    urls = extractURLArray(discoveryText)
    console.log(`[deep-research] Phase 1 found ${urls.length} URLs: ${urls.join(', ')}`)
  } catch (err) {
    console.warn(`[deep-research] Phase 1 failed, proceeding with web search only:`, err instanceof Error ? err.message : String(err))
    // Graceful fallback — Phase 2 will still use web search
  }

  // ── Fetch URLs in parallel ─────────────────────────────────
  let fetchedSources: Array<{ url: string; content: string }> = []

  if (urls.length > 0) {
    const results = await Promise.all(urls.map((u) => fetchPageContent(u)))
    fetchedSources = results.filter((r): r is { url: string; content: string } => r !== null)
    console.log(`[deep-research] Fetched ${fetchedSources.length}/${urls.length} URLs successfully`)
  }

  // ── Phase 2: Deep synthesis ────────────────────────────────
  console.log(`[deep-research] Phase 2: deep synthesis for "${name}"`)

  let sourceContext = ''
  if (fetchedSources.length > 0) {
    sourceContext = '\n\n--- FETCHED SOURCE MATERIAL ---\n' +
      fetchedSources.map((s, i) =>
        `\n[Source ${i + 1}: ${s.url}]\n${s.content}`
      ).join('\n') +
      '\n--- END SOURCE MATERIAL ---\n'
  }

  const synthesisResponse = await anthropic.messages.create({
    model      : 'claude-sonnet-4-5',
    max_tokens : 3000,
    tools      : [{ type: 'web_search_20250305' as const, name: 'web_search' }] as Parameters<typeof anthropic.messages.create>[0]['tools'],
    system     : DEEP_SYNTHESIS_PROMPT,
    messages   : [{
      role   : 'user',
      content: `Research this golf course: ${name}, located in ${location}${country ? `, ${country}` : ''}.${sourceContext}`,
    }],
  })

  const textContent = synthesisResponse.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('')
    .trim()

  if (!textContent) throw new Error('No text content in Phase 2 Anthropic response')
  return { textContent }
}

// ── Main enrichment function ──────────────────────────────────

export async function enrichCourse(
  name     : string,
  location : string,
  country  : string,
  queueId  : string,
  db       : SupabaseClient,
  mode     : EnrichMode = 'standard',
): Promise<EnrichResult> {
  try {
    console.log(`[enrichCourse] Starting ${mode} enrichment for "${name}" (${location})`)

    // ── Research + Google Places lookup in parallel ──────
    const [researchResult, googlePlaceId] = await Promise.all([
      mode === 'deep'
        ? deepResearch(name, location, country)
        : standardResearch(name, location, country),
      fetchGooglePlaceId(name, location),
    ])

    const { textContent } = researchResult

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const courseData = extractJSON(textContent) as any

    // ── Private club ──────────────────────────────────────
    if (courseData.private === true) {
      await db.from('course_queue').update({
        status      : 'private',
        notes       : courseData.reason ?? 'Private club — no public pricing found',
        processed_at: new Date().toISOString(),
      }).eq('id', queueId)
      return { success: false, isPrivate: true, reason: courseData.reason ?? 'Private club' }
    }

    // ── Build courses row ─────────────────────────────────
    const slug         = generateSlug(courseData.name ?? name)
    const resolvedName = courseData.name     ?? name
    const resolvedLoc  = courseData.location ?? location
    // googlePlaceId already resolved from parallel call above

    const courseRow: Record<string, unknown> = {
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
      description         : (courseData.description ?? '').replace(/<\/?cite[^>]*>/gi, '') || null,
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
      website_url         : courseData.website_url         ?? null,
      updated_at          : new Date().toISOString(),
    }

    // Architect + year_opened — only write if present
    if (courseData.architect !== undefined) {
      courseRow.architect = courseData.architect ?? null
    }
    if (courseData.year_opened !== undefined) {
      courseRow.year_opened = courseData.year_opened ?? null
    }

    // Deep research fields — only write if present (avoids nulling out on standard mode)
    if (courseData.advance_booking_required !== undefined) {
      courseRow.advance_booking_required = courseData.advance_booking_required ?? null
    }
    if (courseData.caddie_notes !== undefined) {
      courseRow.caddie_notes = courseData.caddie_notes ?? null
    }
    if (courseData.pace_of_play !== undefined) {
      courseRow.pace_of_play = courseData.pace_of_play ?? null
    }
    if (courseData.pricing_notes !== undefined) {
      courseRow.pricing_notes = courseData.pricing_notes ?? null
    }
    if (courseData.insider_tips !== undefined) {
      courseRow.insider_tips = courseData.insider_tips ?? []
    }
    if (courseData.common_questions !== undefined) {
      courseRow.common_questions = courseData.common_questions ?? []
    }
    if (courseData.trip_combinations !== undefined) {
      courseRow.trip_combinations = courseData.trip_combinations ?? null
    }

    const { error: upsertErr } = await db
      .from('courses')
      .upsert(courseRow, { onConflict: 'name,location', ignoreDuplicates: false })

    if (upsertErr) throw new Error(`Supabase upsert error: ${upsertErr.message}`)

    await db.from('course_queue').update({
      status      : 'complete',
      notes       : mode === 'deep' ? 'Deep research' : null,
      processed_at: new Date().toISOString(),
    }).eq('id', queueId)

    console.log(`[enrichCourse] ✓ ${mode} enrichment complete for "${resolvedName}"`)
    return { success: true, slug, name: courseRow.name as string, location: courseRow.location as string }

  } catch (err) {
    const message     = err instanceof Error ? err.message : String(err)
    const isRateLimit = message.includes('rate_limit_error') || message.includes('429')

    if (isRateLimit) {
      await db.from('course_queue')
        .update({ status: 'pending', notes: null })
        .eq('id', queueId)
      return { success: false, isRateLimit: true, error: 'Rate limit hit — course reset to pending' }
    }

    const isCreditExhausted = message.includes('credit balance') ||
                              message.includes('Your credit') ||
                              (message.includes('invalid_request_error') && message.includes('cred'))
    if (isCreditExhausted) {
      await db.from('course_queue')
        .update({ status: 'pending', notes: 'Credit balance exhausted — will retry' })
        .eq('id', queueId)
      return { success: false, isCreditExhausted: true, error: 'Anthropic credit balance too low' }
    }

    await db.from('course_queue').update({
      status      : 'failed',
      notes       : message.slice(0, 500),
      processed_at: new Date().toISOString(),
    }).eq('id', queueId)

    return { success: false, error: message }
  }
}
