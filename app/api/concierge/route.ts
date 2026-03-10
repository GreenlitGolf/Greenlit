import { NextRequest } from 'next/server'
import { anthropic } from '@/lib/anthropic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Message {
  role:    'user' | 'assistant'
  content: string
}

export interface TripContext {
  tripName?:     string
  memberCount?:  number
  startDate?:    string
  endDate?:      string
  addedCourses?: string[]   // course names already added to the trip
}

// ─── System prompt ────────────────────────────────────────────────────────────

const BASE_PROMPT = `You are the Greenlit golf concierge — a knowledgeable, warm, and witty golf travel expert embedded inside a trip-planning app. You serve two purposes simultaneously:

1. GUIDED PLANNING: Help groups build a trip from scratch. Ask about travel dates, group size, budget, skill levels, preferred regions, and trip vibe (bucket list vs. value, walking vs. cart, links vs. parkland). Build toward concrete course recommendations.

2. INSTANT DISCOVERY: When a user asks a direct browse query — "show me links courses in the Southeast under $400", "what are the best courses in Scottsdale?", "find me something bucket-list in Ireland" — respond with GREENLIT_PICKS immediately. Do not ask follow-up questions for browse queries. Return the cards first, then offer to refine.

Key rules:
- Return GREENLIT_PICKS any time you have enough signal to recommend courses (2–3 is ideal, max 3).
- Keep prose responses short and conversational — this is a chat, not an essay.
- Use light golf humor where it fits naturally.
- Always move the conversation toward locking in a plan.
- If a trip context is provided below, factor it into every recommendation automatically. Do not ask the user to repeat information already in the context.

COURSE CARD FORMAT — use EXACTLY this structure, on its own lines, after your conversational text:

GREENLIT_PICKS:
[{"name":"Course Name","location":"City, State","price":"$X–$Y/person est.","emoji":"⛳","rating":4.5,"tags":["Tag1","Tag2","Tag3"],"courseId":"slug-here","whyItFits":"One sentence connecting this course to the group's specific situation."}]
END_PICKS

- rating: number from 1.0 to 5.0 (your honest assessment — vary this, don't always give 5.0)
- tags: 2–3 short descriptors (e.g. "Links", "Championship", "Walking-friendly", "Under $300", "Resort")
- emoji: use a relevant golf or landscape emoji
- courseId: the URL slug for that course if it's one of the Greenlit flagship courses listed below; omit or set to "" for all others
- whyItFits: one short, specific sentence explaining why this course suits THIS group — reference their actual budget, group size, dates, or vibe. Never generic ("great course"); always personal ("Fits your $300 budget with room for a post-round beer").
- Do not use markdown inside the picks block.

GREENLIT FLAGSHIP COURSE SLUGS (use these exact courseId values when recommending these courses):
- Pebble Beach Golf Links → "pebble-beach"
- Sand Valley Golf Resort → "sand-valley"
- Bandon Dunes Golf Resort → "bandon-dunes"
- Pinehurst Resort → "pinehurst"
- TPC Sawgrass → "tpc-sawgrass"
- Whistling Straits → "whistling-straits"
- Harbour Town Golf Links → "harbour-town"
- Sea Island Golf Club → "sea-island"
- Streamsong Resort → "streamsong"
- Kiawah Island Ocean Course → "kiawah-island-ocean-course"`

function buildSystemPrompt(ctx?: TripContext): string {
  if (!ctx) return BASE_PROMPT

  const lines: string[] = []

  if (ctx.tripName)    lines.push(`Trip name: ${ctx.tripName}`)
  if (ctx.memberCount) lines.push(`Group size: ${ctx.memberCount} golfer${ctx.memberCount !== 1 ? 's' : ''}`)
  if (ctx.startDate && ctx.endDate)
    lines.push(`Travel dates: ${ctx.startDate} to ${ctx.endDate}`)
  else if (ctx.startDate)
    lines.push(`Travel from: ${ctx.startDate}`)
  else if (ctx.endDate)
    lines.push(`Travel until: ${ctx.endDate}`)

  if (ctx.addedCourses && ctx.addedCourses.length > 0)
    lines.push(`Courses already on the itinerary: ${ctx.addedCourses.join(', ')} — avoid recommending these again unless asked.`)

  if (lines.length === 0) return BASE_PROMPT

  return `${BASE_PROMPT}\n\n--- CURRENT TRIP CONTEXT (use automatically, do not ask user to repeat) ---\n${lines.join('\n')}\n---`
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body: { messages: Message[]; tripContext?: TripContext } = await req.json()
    const { messages, tripContext } = body

    if (!messages || messages.length === 0) {
      return new Response('Messages are required', { status: 400 })
    }

    const systemPrompt = buildSystemPrompt(tripContext)
    const encoder      = new TextEncoder()

    const readable = new ReadableStream({
      async start(controller) {
        try {
          const stream = anthropic.messages.stream({
            model:      'claude-opus-4-6',
            max_tokens: 1024,
            system:     systemPrompt,
            messages:   messages.map((m) => ({
              role:    m.role,
              content: m.content,
            })),
          })

          await new Promise<void>((resolve, reject) => {
            stream.on('text', (textDelta) => {
              controller.enqueue(encoder.encode(textDelta))
            })
            stream.on('end', () => {
              controller.close()
              resolve()
            })
            stream.on('error', (err) => {
              controller.error(err)
              reject(err)
            })
          })
        } catch (err) {
          controller.error(err)
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type':      'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control':     'no-cache',
      },
    })
  } catch (err) {
    console.error('Concierge API error:', err)
    return new Response('Internal server error', { status: 500 })
  }
}
