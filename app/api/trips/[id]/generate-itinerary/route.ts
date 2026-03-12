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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime12(time: string): string {
  const [hStr, mStr] = time.split(':')
  let h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  if (h > 12) h -= 12
  if (h === 0) h = 12
  return `${h}:${m.toString().padStart(2, '0')} ${ampm}`
}

function formatDateHuman(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

function dateToDayNumber(date: string, tripStart: string): number {
  const d = new Date(date + 'T12:00:00')
  const s = new Date(tripStart + 'T12:00:00')
  return Math.round((d.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

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
- Keep descriptions concise but evocative — one sentence each
- CRITICAL: If confirmed bookings are provided below, you MUST include them in the itinerary at their exact times and dates. Do not move, rename, or omit confirmed bookings. Build the rest of the itinerary around them.`

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

  // Fetch courses, members, concierge, tee times, and accommodations in parallel
  const [
    { data: tripCourses },
    { count: memberCount },
    { data: conciergeMessages },
    { data: teeTimesRaw },
    { data: accommodationsRaw },
  ] = await Promise.all([
    supabase.from('trip_courses').select('course_id, course_name').eq('trip_id', tripId),
    supabase.from('trip_members').select('*', { count: 'exact', head: true }).eq('trip_id', tripId),
    supabase.from('concierge_messages').select('role, content').eq('trip_id', tripId).order('created_at', { ascending: false }).limit(10),
    supabase.from('tee_times').select('*').eq('trip_id', tripId).order('tee_date').order('tee_time'),
    supabase.from('accommodations').select('*').eq('trip_id', tripId).order('check_in_date'),
  ])

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

  // ── Build confirmed bookings block ──────────────────────────────────────
  const teeTimes = teeTimesRaw || []
  const accommodations = accommodationsRaw || []

  let confirmedBlock = ''

  if (teeTimes.length > 0 || accommodations.length > 0) {
    const lines: string[] = [
      '',
      'The following are CONFIRMED bookings that must appear in the itinerary exactly as specified. Do not change their times, names, or dates.',
    ]

    if (teeTimes.length > 0) {
      lines.push('', 'CONFIRMED TEE TIMES:')
      for (const tt of teeTimes) {
        const dayNum = trip.start_date ? dateToDayNumber(tt.tee_date, trip.start_date) : null
        const dateStr = formatDateHuman(tt.tee_date)
        const timeStr = formatTime12(tt.tee_time)
        const parts = [`- ${dateStr} (Day ${dayNum}), ${timeStr}: ${tt.course_name}`]
        const details: string[] = []
        if (tt.num_players) details.push(`${tt.num_players} players`)
        if (tt.green_fee_per_player) details.push(`$${tt.green_fee_per_player}/person`)
        if (tt.confirmation_number) details.push(`confirmation #${tt.confirmation_number}`)
        if (details.length > 0) parts[0] += ` (${details.join(', ')})`
        lines.push(parts[0])
      }
    }

    if (accommodations.length > 0) {
      lines.push('', 'CONFIRMED ACCOMMODATIONS:')
      for (const acc of accommodations) {
        const checkInTime = acc.check_in_time ? formatTime12(acc.check_in_time) : '3:00 PM'
        const checkOutTime = acc.check_out_time ? formatTime12(acc.check_out_time) : '11:00 AM'
        lines.push(`- Check-in: ${formatDateHuman(acc.check_in_date)} at ${checkInTime} — ${acc.name}`)
        lines.push(`- Check-out: ${formatDateHuman(acc.check_out_date)} at ${checkOutTime} — ${acc.name}`)
      }
    }

    lines.push('', 'Generate the rest of the itinerary around these confirmed items — meals, travel, activities, evening plans. Do not invent or move the confirmed items.')
    confirmedBlock = lines.join('\n')
  }

  const userMessage = [
    `Trip: ${trip.name}`,
    `Destination: ${trip.destination || 'TBD'}`,
    `Dates: ${trip.start_date || 'TBD'} to ${trip.end_date || 'TBD'} (${dayCount} day${dayCount !== 1 ? 's' : ''})`,
    `Group size: ${memberCount ?? 1} golfer${(memberCount ?? 1) !== 1 ? 's' : ''}`,
    `Courses added to trip: ${courseList}`,
    confirmedBlock,
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
