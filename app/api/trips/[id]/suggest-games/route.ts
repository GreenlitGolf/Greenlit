import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { anthropic } from '@/lib/anthropic'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tripId } = await params
  const supabase = createAdminSupabaseClient()

  // Gather trip context
  const [tripRes, membersRes, coursesRes, gamesRes, teesRes] = await Promise.all([
    supabase.from('trips').select('*').eq('id', tripId).single(),
    supabase.from('trip_members').select('id, user_id, display_name, email, handicap').eq('trip_id', tripId),
    supabase.from('trip_courses').select('course_name, course_id').eq('trip_id', tripId),
    supabase.from('trip_games').select('game_type, round_number').eq('trip_id', tripId),
    supabase.from('tee_times').select('course_name, tee_date').eq('trip_id', tripId).order('tee_date'),
  ])

  const trip = tripRes.data
  const members = membersRes.data ?? []
  const courses = coursesRes.data ?? []
  const existingGames = gamesRes.error ? [] : gamesRes.data ?? []
  const teeTimes = teesRes.data ?? []

  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

  const playerCount = members.length
  const handicaps = members
    .map((m: Record<string, unknown>) => ({
      name: (m.display_name as string) ?? (m.email as string) ?? 'Player',
      handicap: (m.handicap as number) ?? null,
    }))

  // Calculate rounds from tee times or trip duration
  const roundCount = teeTimes.length || (trip.start_date && trip.end_date
    ? Math.ceil((new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / 86400000) + 1
    : 1)

  const courseList = teeTimes.length > 0
    ? teeTimes.map((t, i) => `Round ${i + 1}: ${t.course_name} (${t.tee_date})`)
    : courses.map((c) => c.course_name)

  const prompt = `You are a golf trip games advisor. Given this group's details, suggest the best combination of games for their trip.

Group: ${playerCount} players, handicaps: ${JSON.stringify(handicaps)}
Trip: ${roundCount} rounds over ${trip.start_date && trip.end_date ? Math.ceil((new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / 86400000) + 1 : '?'} days
Courses: ${courseList.join(', ') || 'TBD'}
Existing games already set up: ${existingGames.map(g => `${g.game_type} (Round ${g.round_number})`).join(', ') || 'None'}

Return a JSON array of suggestions:
[{
  "round": "Round 1 / Whole Trip / etc",
  "game": "game_type_key from: skins, nassau, stableford, matchPlay, wolf, bingoBangoBongo, vegas, sixSixSix, banker, scramble, chapman, alternateShot, ryderCup, presidents_cup, strokeplayTournament, stablefordTournament, junk",
  "reason": "One sentence why this works for this specific group",
  "suggestedStakes": "$X per skin / $Y Nassau / etc",
  "config": { ...default config values }
}]

Rules:
- Suggest a trip-wide format if 3+ rounds (Ryder Cup for even teams, Stableford Points Race for mixed ability)
- Suggest Skins + Nassau combo for the first round as a warm-up
- If wide handicap spread (10+ shots between best and worst), prefer net games and Stableford
- If tight handicap spread, suggest gross games
- Always suggest Junk/Dots as an add-on side bet
- For Wolf: only suggest if exactly 4 players
- For Vegas: only suggest if exactly 4 players
- Never suggest Alternate Shot unless the group explicitly has pairs who play regularly together
- Don't suggest games that are already set up
- Return ONLY the JSON array, no other text`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  try {
    // Extract JSON from response (handle possible markdown wrapping)
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    const suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : []
    return NextResponse.json(suggestions)
  } catch {
    return NextResponse.json({ error: 'Failed to parse suggestions', raw: text }, { status: 500 })
  }
}
