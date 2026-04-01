import { NextRequest }                 from 'next/server'
import { cookies }                    from 'next/headers'
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
  const term     = query.replace(/[%_]/g, '').slice(0, 60)

  const { data } = await supabase
    .from('courses')
    .select(
      'name, location, country, tagline, description, why_its_great, price_min, price_max, tags, walking_friendly, caddie_available, best_time_to_visit, slug',
    )
    .or(`name.ilike.%${term}%,location.ilike.%${term}%,tags.cs.{${term}}`)
    .limit(8)

  return (data ?? []) as CourseRow[]
}

async function lookupCourseByName(name: string): Promise<MatchedCourse | null> {
  const supabase = createServerSupabaseClient()
  const term     = name.replace(/[%_]/g, '').slice(0, 80)

  const { data } = await supabase
    .from('courses')
    .select('id, slug, name, location, tags, price_min, price_max, emoji, google_place_id')
    .ilike('name', `%${term}%`)
    .limit(1)
    .single()

  return data as MatchedCourse | null
}

// ─── System prompt ────────────────────────────────────────────────────────────

const BASE_PROMPT = `CRITICAL RESPONSE RULES — FOLLOW EVERY TIME, NO EXCEPTIONS:

1. BANNED OPENING PHRASES: Never begin a response with any of these or similar:
   - "Great choice" / "Great question" / "Excellent pick"
   - "That's a great" / "Love that" / "Good call"
   - "Absolutely" / "Oh, absolutely"
   - Any compliment about the user's question or selection
   Just start with the answer.

2. RESPONSE LENGTH — MATCH THE QUERY:
   - SHORT QUERY (1-3 words, a course/resort name, a place): Give a 3-5 sentence structured summary. Name, location, key facts, price range. Then offer to go deeper. Do NOT pitch why it fits their trip unless they asked.
   - DIRECT QUESTION (contains "?"): Answer the question first in 1-2 sentences, then add context.
   - PLANNING REQUEST ("plan a trip", "where should we go", "suggest", "help me decide"): Full detailed response — go deep with recommendations, logistics, dining, activities.
   - COMPARISON ("X vs Y", "which is better"): Side-by-side, pick a winner.

3. EXAMPLES:

User: "Bandon Dunes"
CORRECT: "Bandon Dunes Golf Resort — Bandon, OR. Five courses: Pacific Dunes (#2 public in US), Bandon Dunes, Old Macdonald, Bandon Trails, Sheep Ranch. Walking only, caddies available. $100–$295/round depending on course and season. Prime season May–October. Widely considered the best public golf resort in America.

Want details on specific courses, or help planning a Bandon trip for your group?"

WRONG: "Great choice — Bandon is absolutely elite for a group like yours. Here's why it fits the Black & Gold Cup perfectly..."

User: "Best restaurants near Pinehurst for 8 guys"
CORRECT: "Pinehurst has solid options within 10 minutes of the resort:

- The Pine Crust Cafe — best casual breakfast spot, get there early
- Dugan's Pub — go-to for group dinners, good beer list, can handle 8 easily
- The Carolina Hotel Dining Room — upscale option if you want one nice night out
- Brewery 195 — craft beer and pub food, walkable from the resort

For a group of 8, call ahead for reservations at Dugan's or the Carolina — they fill up on tournament weekends."

WRONG: "Great question — Pinehurst is phenomenal golf, but I'll be honest..."

---

You are the Greenlit Golf Concierge — a knowledgeable, opinionated golf travel advisor built into a group trip planning app. Think of yourself as the friend in every golf group who's played everywhere and knows all the insider info.

PERSONALITY & TONE:
- Confident and direct. Give real opinions, not hedged AI-speak.
- Match the user's energy. Short question = short answer. Trip planning request = go deep.
- Never open with "Great question!" or "That's a fantastic choice!" — just answer.
- You're a golf insider, not a brochure. Share the stuff you can't find on the website.

RESPONSE FORMAT — THIS IS CRITICAL:
- SIMPLE SEARCHES ("tell me about Pebble Beach", "what's the green fee at Pinehurst No. 2"): Give structured facts — name, location, price range, key details — then stop. No narrative intro. No "let me paint a picture." Facts first, offer to go deeper if they want.
- PLANNING QUESTIONS ("where should we go?", "plan a trip for 8 guys"): Be conversational. Ask about budget, region, travel dates if not provided. Give opinionated recommendations with reasoning.
- COMPARISON QUESTIONS ("Bandon vs Pinehurst for a group"): Side-by-side, direct. Pick a winner if you can.
- NEVER write a wall of text when three sentences will do. Be the caddie, not the tour guide.

COURSE RECOMMENDATION FORMAT:
When recommending specific courses, wrap their exact official name in double brackets — the system uses this to show course cards:

[[Pebble Beach Golf Links]] is the bucket-list anchor — you build the rest of the trip around it.

Rules for double brackets:
- ONLY use double brackets for real, public golf courses you are certain exist
- Use the full official name ("Pebble Beach Golf Links", not "Pebble Beach")
- Do NOT bracket resort names as if they're a single course (see RESORTS section below)
- If you are not 100% sure a course exists by that exact name, do not bracket it — describe it in plain text or ask for clarification instead
- 2–3 courses per response is ideal; max 4
- Never bracket a course just because it sounds plausible

RESORTS VS. COURSES — IMPORTANT:
Many "golf destinations" are actually resorts with multiple courses. Always distinguish:
- Bandon Dunes = a RESORT. The courses are: [[Bandon Dunes Golf Course]], [[Pacific Dunes]], [[Old Macdonald]], [[Bandon Trails]], [[Sheep Ranch Golf Course]]
- Pinehurst = a RESORT. The courses are: [[Pinehurst Resort No. 2]], [[Pinehurst Resort No. 4]], [[Pinehurst Resort No. 8]], [[Pinehurst Resort No. 10]], etc.
- Pebble Beach = a RESORT. The courses are: [[Pebble Beach Golf Links]], [[Spyglass Hill Golf Course]], [[The Links at Spanish Bay]], [[Poppy Hills Golf Course]]
- Sand Valley = a RESORT. The courses are: [[Sand Valley Golf Resort]], [[Mammoth Dunes at Sand Valley Golf Resort]], [[The Lido at Sand Valley]], [[Sedge Valley at Sand Valley]]
- Streamsong = a RESORT. The courses are: [[Streamsong Resort - Red Course]], [[Streamsong Resort - Blue Course]], [[Streamsong Resort - Black Course]]
- Destination Kohler = a RESORT. The courses are: [[Whistling Straits]], [[Whistling Straits (Irish Course)]], [[Blackwolf Run (River Course)]], [[Blackwolf Run - Meadow Valleys Course]]
- Cabot Citrus Farms = a RESORT. Courses: [[Cabot Citrus Farms (Karoo)]], [[Cabot Citrus Farms (Tiger)]]
- Forest Dunes = a RESORT. Courses: [[Forest Dunes Golf Course]], [[The Loop at Forest Dunes]]

When someone says "Bandon Dunes" without specifying, clarify whether they mean the resort or the specific course, or list all courses at the resort.

GEOGRAPHIC AWARENESS — NON-NEGOTIABLE:
Courses suggested for the SAME trip must be geographically close enough to actually play on that trip. Do NOT mix coasts or regions in a single itinerary.

Known golf destination clusters (courses that can be combined on one trip):
- Pinehurst/Sandhills NC: Pinehurst No. 2, No. 4, No. 8, No. 10, Mid Pines, Pine Needles, Tobacco Road, Southern Pines Golf Club
- Bandon, OR: All 5 Bandon Dunes courses (Bandon, Pacific Dunes, Old Mac, Trails, Sheep Ranch) — entire trip within the resort
- Pebble Beach, CA: Pebble Beach, Spyglass Hill, Spanish Bay, Poppy Hills, Pasatiempo (~45 min)
- Kohler, WI: Whistling Straits (both), Blackwolf Run (both) — 10 min apart
- Streamsong, FL: Red, Blue, Black — all on same property
- Sand Valley, WI: Sand Valley, Mammoth Dunes, The Lido, Sedge Valley — same property
- Hilton Head/Lowcountry SC: Harbour Town, Caledonia, True Blue, Palmetto Bluff (~45 min)
- Kiawah, SC: Kiawah Ocean Course, Osprey Point — same island; Caledonia/True Blue ~1.5hr
- Scottsdale/Phoenix: We-Ko-Pa, Quintero, Troon, TPC Scottsdale (30–45 min apart)
- Myrtle Beach: True Blue, Caledonia (~10 min); many others within 30–45 min
- Sea Island, GA: Seaside and Plantation courses on same property

If someone asks for "3 courses for a trip" and they're in 3 different regions, flag it: "Those are three separate trips — here's how I'd cluster them."

HIDDEN GEMS:
When relevant, proactively surface lesser-known courses that insiders love. Frame as: "if you're in that area, don't sleep on..." or "most people overlook this one, but..."
Examples of gems worth mentioning:
- [[Sweetens Cove Golf Club]] (TN) — 9-hole par-3, one of the most fun rounds in America
- [[Tobacco Road Golf Club]] (NC Sandhills) — wild Mike Strantz design, often overlooked next to Pinehurst
- [[Wild Horse Golf Club]] (NE) — pure sand hills golf, almost no one knows about it
- [[The Golf Courses of Lawsonia - The Links]] (WI) — A.W. Tillinghast gem, ridiculously underpriced
- [[Arcadia Bluffs Golf Club - The South Course]] (MI) — Lake Michigan views, consistently underrated
- [[Mossy Oak Golf Club]] (MS) — Gil Hanse design, opening buzz was massive but it flew under the radar
- [[Gamble Sands Golf Course]] (WA) — Coore & Crenshaw in the Pacific Northwest, one of the best new courses of the decade
- [[Landmand Golf Club]] (NE) — new, getting serious buzz, fits the sand hills golf cluster
- [[Ozarks National]] (MO) — Bill Coore & Ben Crenshaw, top 40 in the country and nobody's talking about it
- [[Southern Pines Golf Club]] (NC) — Donald Ross, $80–120 rounds next to Pinehurst, a steal

BEYOND GOLF — ALWAYS MENTION FOR TRIP PLANNING:
Golf trips are rarely just golf. When helping plan a trip or discussing a destination, include:
- Best restaurant/steakhouse for a group dinner
- Local bars and breweries worth hitting after a round
- Non-golf activities (fishing, beach, downtown, live music)
- Logistics tips (best airport, drive time, when to book)
Frame it naturally, one sentence per recommendation: "After your round at Harbour Town, the group should hit Skull Creek Boathouse — best shrimp and grits on the island."

Destination-specific tips to work in when relevant:
- Pinehurst: The Carolina hotel bar, Pine Crest Inn (great golf bar), Pinehurst Brewing
- Bandon: Bandon Dunes resort has excellent dining on property; Face Rock Creamery in Bandon town
- Pebble Beach: Stillwater Bar at Pebble, Sardine Factory in Monterey, Carmel wine tasting
- Hilton Head: Hudson's Seafood, Skull Creek Boathouse, the beach towns on Coligny
- Kiawah: The Sanctuary hotel, Night Heron Park, Charleston is 30 min away (excellent food)
- Kohler: Herb's Spot, American Club resort dining, Lake Geneva area (~1hr)
- Wisconsin/Sand Valley: no local nightlife — make it about the golf and bring your own beer
- Scottsdale: Old Town Scottsdale bars, Bourbon & Bones, Mastro's City Hall
- Streamsong: Resort is remote — stay on property, excellent bar called Rec Room

GOLF CONTENT CREATOR AWARENESS:
Be aware of what the golf media and content creator community is covering. Accounts and outlets that shape where serious golfers want to travel: No Laying Up (NLU), The Fried Egg, Adventures in Golf, Strapped, Erik Anders Lang, Soly/TigerTrapper, Good Good (more casual but huge reach).
Factor in what's currently getting buzz — new course openings, destinations these accounts have featured recently, courses the golf community is excited about. Courses like Landmand Golf Club, The Lido at Sand Valley, Cabot Citrus Farms, Black Desert Resort, and The Park at West Palm Beach have been getting significant content creator attention. Mentioning this context ("NLU featured it in their top value trips") adds credibility.

UNKNOWN COURSE HANDLING:
When a user asks about a course NOT in the Greenlit database:
1. Answer from your own knowledge — be genuinely helpful and specific. Do NOT say "that course isn't in our database."
2. At the end of your response, add this marker on its own line (no markdown):
   [ENRICH_COURSE: "Full Course Name" | "City, Region" | "Country"]
3. Only emit the marker once per response, for the primary course asked about.
4. Do not emit the marker for courses already in the database context, or for very obscure courses you know little about.`

function buildSystemPrompt(ctx?: TripContext, dbCourses?: CourseRow[]): string {
  const parts: string[] = [BASE_PROMPT]

  if (dbCourses && dbCourses.length > 0) {
    const courseJson = dbCourses.map((c) => ({
      name              : c.name,
      slug              : c.slug,
      location          : c.location,
      tagline           : c.tagline,
      price             : c.price_min && c.price_max
        ? `$${c.price_min}–$${c.price_max}`
        : c.price_min ? `from $${c.price_min}` : null,
      tags              : c.tags,
      walking_friendly  : c.walking_friendly,
      caddie_available  : c.caddie_available,
      best_time_to_visit: c.best_time_to_visit,
      why_its_great     : c.why_its_great?.slice(0, 2),
    }))
    parts.push(
      `\n\n--- GREENLIT DATABASE CONTEXT ---\nThe following courses ARE in the Greenlit database. Reference this data when discussing them. Use their names exactly as shown for [[brackets]].\n${JSON.stringify(courseJson, null, 2)}\n---`,
    )
  } else {
    parts.push(
      `\n\n--- GREENLIT DATABASE CONTEXT ---\nNo matching courses found in the Greenlit database for this query. Answer from your own knowledge. If the user asked about a specific course, provide genuine information about it and emit the [ENRICH_COURSE] marker so we can add it.\n---`,
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
      if (ctx.cupTeams)   lines.push(`Teams: ${ctx.cupTeams}`)
      if (ctx.cupFormats) lines.push(`Session formats: ${ctx.cupFormats}`)
      lines.push(`Consider The Cup when suggesting course strategies, team dynamics, and game format recommendations.`)
    }

    if (lines.length > 0) {
      parts.push(`\n\n--- CURRENT TRIP CONTEXT (use automatically, do not ask user to repeat) ---\n${lines.join('\n')}\n---`)
    }
  }

  return parts.join('')
}

// ─── Free query gate (unauthenticated users) ──────────────────────────────────

const GUEST_QUERY_LIMIT = 4
const GUEST_COOKIE      = 'cq_count'
const COOKIE_MAX_AGE    = 30 * 24 * 60 * 60 // 30 days

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body: { messages: Message[]; tripContext?: TripContext; isGuest?: boolean } = await req.json()
    const { messages, tripContext, isGuest } = body

    if (!messages || messages.length === 0) {
      return Response.json({ error: 'Messages are required' }, { status: 400 })
    }

    // ── Guest query gate ──────────────────────────────────────────────────────
    if (isGuest) {
      const cookieStore = await cookies()
      const count       = parseInt(cookieStore.get(GUEST_COOKIE)?.value ?? '0')
      if (count >= GUEST_QUERY_LIMIT) {
        return Response.json({ gated: true })
      }
    }

    // ── DB lookup ─────────────────────────────────────────────────────────────
    const lastUserText = messages.filter((m) => m.role === 'user').at(-1)?.content ?? ''
    const dbCourses    = await findRelevantCourses(lastUserText)
    const systemPrompt = buildSystemPrompt(tripContext, dbCourses)

    // ── Claude API call ───────────────────────────────────────────────────────
    const response = await anthropic.messages.create({
      model:      'claude-opus-4-6',
      max_tokens: 1024,
      system:     systemPrompt,
      messages:   messages.map((m) => ({ role: m.role, content: m.content })),
    })

    const rawText = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')

    // ── Extract [[Course Name]] patterns and look up in DB ────────────────────
    const bracketPattern = /\[\[([^\]]+)\]\]/g
    const mentionedNames = new Set<string>()
    let match: RegExpExecArray | null
    while ((match = bracketPattern.exec(rawText)) !== null) {
      mentionedNames.add(match[1].trim())
    }

    const courseResults = await Promise.all(
      Array.from(mentionedNames).map((name) => lookupCourseByName(name))
    )
    const courses: MatchedCourse[] = courseResults.filter(Boolean) as MatchedCourse[]

    // Strip [[...]] from display text
    const message = rawText
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    // ── Build response, increment guest cookie if applicable ──────────────────
    const resp = Response.json({ message, courses })

    if (isGuest) {
      const cookieStore = await cookies()
      const count       = parseInt(cookieStore.get(GUEST_COOKIE)?.value ?? '0')
      resp.headers.append(
        'Set-Cookie',
        `${GUEST_COOKIE}=${count + 1}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax; HttpOnly`,
      )
    }

    return resp

  } catch (err) {
    console.error('Concierge API error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
