import { NextRequest } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import Anthropic from '@anthropic-ai/sdk'

// ─── Types ────────────────────────────────────────────────────────────────────

type ValidType = 'tee_time' | 'travel' | 'accommodation' | 'meal' | 'activity' | 'other'

interface GeneratedItem {
  day_number:   number
  start_time:   string | null
  title:        string
  description:  string | null
  type:         string
  course_name?: string | null
}

const VALID_TYPES: ValidType[] = [
  'tee_time', 'travel', 'accommodation', 'meal', 'activity', 'other',
]

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a golf trip planning assistant. Given details about a group golf trip, generate a realistic day-by-day itinerary.

Return ONLY a valid JSON array of itinerary items. No markdown, no preamble.

Each item must have:
{
  "day_number": integer (1-based),
  "start_time": "8:00 AM" or null,
  "title": "string",
  "description": "string or null",
  "type": "tee_time" | "travel" | "accommodation" | "meal" | "activity" | "other",
  "course_name": "string or null — only for tee_time items, must match one of the provided course names exactly"
}

Guidelines:
- Items within each day MUST be ordered chronologically by start_time, earliest first (e.g. 7:30 AM travel → 8:30 AM tee time → 1:00 PM lunch → 7:00 PM dinner)
- Day 1 usually involves travel/arrival and a welcome dinner
- Last day usually involves checkout and travel home
- Golf days: include ALL rounds the user has requested. A day can have multiple tee_time items (e.g. morning round at 8:00 AM AND afternoon round at 1:30 PM). Never drop a round — if the trip has courses added or the user mentioned specific rounds, include every one of them.
- Between two rounds on the same day, include a lunch break item at approximately 12:00-12:30 PM
- Suggest realistic tee times: morning rounds 7:30–9:00 AM, afternoon rounds 1:00–2:00 PM
- Be specific with meal suggestions based on the destination (don't just say "dinner")
- Include 1-2 non-golf activities per trip (local sights, range session, 19th hole, etc.)
- Keep descriptions concise but evocative — one sentence each`

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tripId } = await params
  const supabase = createAdminSupabaseClient()

  // Fetch trip
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('id, name, destination, start_date, end_date')
    .eq('id', tripId)
    .single()

  if (tripError || !trip) {
    return Response.json({ error: 'Trip not found' }, { status: 404 })
  }

  // Fetch courses on this trip
  const { data: tripCourses } = await supabase
    .from('trip_courses')
    .select('course_id, course_name')
    .eq('trip_id', tripId)

  // Fetch member count
  const { count: memberCount } = await supabase
    .from('trip_members')
    .select('*', { count: 'exact', head: true })
    .eq('trip_id', tripId)

  // Fetch last 10 concierge messages for additional context
  const { data: conciergeMessages } = await supabase
    .from('concierge_messages')
    .select('role, content')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false })
    .limit(10)

  // Calculate trip duration
  const startDate = trip.start_date ? new Date(trip.start_date + 'T12:00:00') : new Date()
  const endDate   = trip.end_date   ? new Date(trip.end_date   + 'T12:00:00') : startDate
  const dayCount  = Math.max(
    1,
    Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1,
  )

  const courseList = tripCourses
    ?.map((tc) => tc.course_name)
    .filter(Boolean)
    .join(', ') || 'None yet'

  // Build concierge context summary (reverse so oldest first)
  const recentNotes = conciergeMessages && conciergeMessages.length > 0
    ? conciergeMessages
        .reverse()
        .map((m) => `${m.role === 'user' ? 'User' : 'Concierge'}: ${m.content}`)
        .join('\n')
    : 'None'

  const userMessage = [
    `Trip: ${trip.name}`,
    `Destination: ${trip.destination || 'TBD'}`,
    `Dates: ${trip.start_date || 'TBD'} to ${trip.end_date || 'TBD'} (${dayCount} day${dayCount !== 1 ? 's' : ''})`,
    `Group size: ${memberCount ?? 1} golfer${(memberCount ?? 1) !== 1 ? 's' : ''}`,
    `Courses added to trip: ${courseList}`,
    '',
    'Recent planning notes from concierge:',
    recentNotes,
    '',
    'Build a full itinerary based on the above, including all courses and rounds discussed.',
  ].join('\n')

  // Use ANTHROPIC_SECRET (not ANTHROPIC_API_KEY) to avoid Turbopack shadowing the SDK's
  // own process.env.ANTHROPIC_API_KEY reference with an empty string at bundle time.
  const apiKey = process.env.ANTHROPIC_SECRET
  const anthropic = new Anthropic({ apiKey })
  let rawItems: GeneratedItem[]
  try {
    const response = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: userMessage }],
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = rawText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No JSON array in response')
    rawItems = JSON.parse(jsonMatch[0])
  } catch (err) {
    console.error('AI generation error:', err)
    return Response.json({ error: 'Failed to generate itinerary' }, { status: 500 })
  }

  // Build course-name → course_id lookup
  const courseMap: Record<string, string> = {}
  if (tripCourses) {
    for (const tc of tripCourses) {
      if (tc.course_name && tc.course_id) {
        courseMap[tc.course_name.toLowerCase()] = tc.course_id
      }
    }
  }

  // Delete existing items for this trip
  await supabase.from('itinerary_items').delete().eq('trip_id', tripId)

  // Insert new items
  const toInsert = rawItems
    .filter((item) => item.title && item.day_number >= 1 && item.day_number <= dayCount)
    .map((item) => ({
      trip_id:     tripId,
      day_number:  item.day_number,
      start_time:  item.start_time  || null,
      title:       item.title,
      description: item.description || null,
      type:        VALID_TYPES.includes(item.type as ValidType) ? item.type : 'other',
      course_id:   item.course_name
        ? (courseMap[item.course_name.toLowerCase()] ?? null)
        : null,
    }))

  const { data: inserted, error: insertError } = await supabase
    .from('itinerary_items')
    .insert(toInsert)
    .select()

  if (insertError) {
    return Response.json({ error: insertError.message }, { status: 500 })
  }

  return Response.json(inserted)
}
