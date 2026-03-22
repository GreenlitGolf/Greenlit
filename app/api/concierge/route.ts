import { NextRequest }                 from 'next/server'
import { anthropic }                  from '@/lib/anthropic'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Message {
  role:    'user' | 'assistant'
  content: string
}

export interface TripContext {
  tripName?:      string
  memberCount?:   number
  handicapRange?: string   // e.g. "4–18" or "scratch to 22"
  startDate?:     string
  endDate?:       string
  addedCourses?:  string[]
  cupName?:       string
  cupTeams?:      string   // e.g. "Team Birdie (4 players) vs Team Eagle (4 players)"
  cupFormats?:    string   // e.g. "Round 1: Four-Ball, Round 2: Singles"
}

export interface MatchedCourse {
  id:              string
  slug:            string
  name:            string
  location:        string
  tags:            string[]
  price_min:       number | null
  price_max:       number | null
  emoji:           string
  google_place_id: string | null
}

type CourseRow = {
  name               : string
  location           : string
  country            : string | null
  tagline            : string | null
  description        : string | null
  why_its_great      : string[]
  price_min          : number | null
  price_max          : number | null
  tags               : string[]
  walking_friendly   : boolean
  caddie_available   : boolean
  best_time_to_visit : string | null
  slug               : string
}

// ─── DB course lookup ─────────────────────────────────────────────────────────

async function findRelevantCourses(query: string): Promise<CourseRow[]> {
  if (!query.trim()) return []

  const supabase = createServerSupabaseClient()

  // Simple keyword search across name + location — good enough for the concierge
  const term = query.replace(/[%_]/g, '').slice(0, 60) // sanitise before ILIKE

  const { data } = await supabase
    .from('courses')
    .select(
      'name, location, country, tagline, description, why_its_great, price_min, price_max, tags, walking_friendly, caddie_available, best_time_to_visit, slug',
    )
    .or(`name.ilike.%${term}%,location.ilike.%${term}%,tags.cs.{${term}}`)
    .limit(5)

  return (data ?? []) as CourseRow[]
}

async function lookupCourseByName(name: string): Promise<MatchedCourse | null> {
  const supabase = createServerSupabaseClient()
  const term = name.replace(/[%_]/g, '').slice(0, 80)

  const { data } = await supabase
    .from('courses')
    .select('id, slug, name, location, tags, price_min, price_max, emoji, google_place_id')
    .ilike('name', `%${term}%`)
    .limit(1)
    .single()

  return data as MatchedCourse | null
}

// ─── System prompt ────────────────────────────────────────────────────────────

const BASE_PROMPT = `You are the Greenlit golf concierge — a knowledgeable, warm, and witty golf travel expert embedded inside a trip-planning app. You serve two purposes simultaneously:

1. GUIDED PLANNING: Help groups build a trip from scratch. Ask about travel dates, group size, budget, skill levels, preferred regions, and trip vibe (bucket list vs. value, walking vs. cart, links vs. parkland). Build toward concrete course recommendations.

2. INSTANT DISCOVERY: When a user asks a direct browse query — "show me links courses in the Southeast under $400", "what are the best courses in Scottsdale?", "find me something bucket-list in Ireland" — recommend courses immediately with their names in double brackets. Do not ask follow-up questions for browse queries. Recommend first, then offer to refine.

Key rules:
- Keep prose responses short and conversational — this is a chat, not an essay.
- Use light golf humor where it fits naturally.
- Always move the conversation toward locking in a plan.
- If a trip context is provided below, factor it into every recommendation automatically. Do not ask the user to repeat information already in the context.
- When recommending 2–3 courses, put each on its own line so the UI can display course cards.

COURSE RECOMMENDATION FORMAT:
When recommending specific courses, always wrap their exact name in double brackets so the system can look them up and show the user a course card:

[[Forest Dunes Golf Club]] is a must for your group — perfect for the walk-and-carry vibe you're after.

You can mention multiple courses:
[[Pebble Beach Golf Links]] and [[Bandon Dunes Golf Resort]] are both iconic bucket-list experiences.

Rules for double brackets:
- Only use double brackets for real, public golf courses you are confident about
- Use the most common/official name of the course (e.g. "Pebble Beach Golf Links" not just "Pebble Beach")
- Do not use double brackets for vague references ("a links course") or private clubs
- 2–3 recommended courses per response is ideal; max 4
- After your conversational text, you can follow up with a line per recommended course giving a one-sentence "why it fits this group" note

GREENLIT FLAGSHIP COURSES (always use double brackets when mentioning these):
- [[Pebble Beach Golf Links]] — pebble-beach
- [[Sand Valley Golf Resort]] — sand-valley
- [[Bandon Dunes Golf Resort]] — bandon-dunes
- [[Pinehurst Resort]] — pinehurst
- [[TPC Sawgrass]] — tpc-sawgrass
- [[Whistling Straits]] — whistling-straits
- [[Harbour Town Golf Links]] — harbour-town
- [[Sea Island Golf Club]] — sea-island
- [[Streamsong Resort]] — streamsong
- [[Kiawah Island Ocean Course]] — kiawah-island-ocean-course
- [[Forest Dunes Golf Club]] — forest-dunes

UNKNOWN COURSE HANDLING:
When a user asks about a specific golf course that is NOT in the GREENLIT DATABASE CONTEXT below:
1. Answer from your own knowledge — be genuinely helpful and specific.
2. Be honest that you're drawing on general knowledge, not the Greenlit database.
3. End your response with this exact marker on its own line (no markdown around it):
   [ENRICH_COURSE: "Full Course Name" | "City, Region" | "Country"]
4. Only emit this marker once per response, for the primary course the user asked about.
5. Do not emit the marker for courses already in the database context, or for very obscure courses you know little about.`

function buildSystemPrompt(ctx?: TripContext, dbCourses?: CourseRow[]): string {
  const parts: string[] = [BASE_PROMPT]

  if (dbCourses && dbCourses.length > 0) {
    const courseJson = dbCourses.map((c) => ({
      name             : c.name,
      slug             : c.slug,
      location         : c.location,
      tagline          : c.tagline,
      price            : c.price_min && c.price_max
        ? `$${c.price_min}–$${c.price_max}`
        : c.price_min ? `from $${c.price_min}` : null,
      tags             : c.tags,
      walking_friendly : c.walking_friendly,
      caddie_available : c.caddie_available,
      best_time_to_visit: c.best_time_to_visit,
      why_its_great    : c.why_its_great?.slice(0, 2), // keep prompt lean
    }))
    parts.push(
      `\n--- GREENLIT DATABASE CONTEXT (use this data when discussing these courses) ---\n${JSON.stringify(courseJson, null, 2)}\n---`,
    )
  }

  if (ctx) {
    const lines: string[] = []
    if (ctx.tripName)    lines.push(`Trip name: ${ctx.tripName}`)
    if (ctx.memberCount) {
      const hcpNote = ctx.handicapRange ? ` (handicaps: ${ctx.handicapRange})` : ''
      lines.push(`Group size: ${ctx.memberCount} golfer${ctx.memberCount !== 1 ? 's' : ''}${hcpNote}`)
    }
    if (ctx.startDate && ctx.endDate)
      lines.push(`Travel dates: ${ctx.startDate} to ${ctx.endDate}`)
    else if (ctx.startDate)
      lines.push(`Travel from: ${ctx.startDate}`)
    else if (ctx.endDate)
      lines.push(`Travel until: ${ctx.endDate}`)
    if (ctx.addedCourses && ctx.addedCourses.length > 0)
      lines.push(`Courses already on the itinerary: ${ctx.addedCourses.join(', ')} — avoid recommending these again unless asked.`)
    if (ctx.cupName) {
      lines.push(`The Cup competition: "${ctx.cupName}" is set up for this trip.`)
      if (ctx.cupTeams) lines.push(`Teams: ${ctx.cupTeams}`)
      if (ctx.cupFormats) lines.push(`Session formats: ${ctx.cupFormats}`)
      lines.push(`Consider The Cup when suggesting course strategies, team dynamics, and game format recommendations.`)
    }

    if (lines.length > 0) {
      parts.push(`\n--- CURRENT TRIP CONTEXT (use automatically, do not ask user to repeat) ---\n${lines.join('\n')}\n---`)
    }
  }

  return parts.join('')
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body: { messages: Message[]; tripContext?: TripContext } = await req.json()
    const { messages, tripContext } = body

    if (!messages || messages.length === 0) {
      return Response.json({ error: 'Messages are required' }, { status: 400 })
    }

    // Look up relevant courses from DB based on last user message
    const lastUserText = messages.filter((m) => m.role === 'user').at(-1)?.content ?? ''
    const dbCourses    = await findRelevantCourses(lastUserText)

    const systemPrompt = buildSystemPrompt(tripContext, dbCourses)

    // Get full response (non-streaming for reliable course extraction)
    const response = await anthropic.messages.create({
      model:      'claude-opus-4-6',
      max_tokens: 1024,
      system:     systemPrompt,
      messages:   messages.map((m) => ({
        role:    m.role,
        content: m.content,
      })),
    })

    const rawText = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')

    // ── Extract [[Course Name]] patterns ─────────────────────────────────────
    const bracketPattern = /\[\[([^\]]+)\]\]/g
    const mentionedNames = new Set<string>()
    let match: RegExpExecArray | null
    while ((match = bracketPattern.exec(rawText)) !== null) {
      mentionedNames.add(match[1].trim())
    }

    // Look up each mentioned course in the DB
    const courseResults = await Promise.all(
      Array.from(mentionedNames).map((name) => lookupCourseByName(name))
    )
    const courses: MatchedCourse[] = courseResults.filter(Boolean) as MatchedCourse[]

    // Strip [[...]] from the display text — keep just the plain name
    const message = rawText
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    return Response.json({ message, courses })
  } catch (err) {
    console.error('Concierge API error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
