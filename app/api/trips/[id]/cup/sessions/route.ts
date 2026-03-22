import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

// POST — create sessions with matches
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tripId } = await params
  const body = await req.json()
  const db = createAdminSupabaseClient()

  const { data: cup, error: cupErr } = await db
    .from('trip_cups')
    .select('id')
    .eq('trip_id', tripId)
    .single()

  if (cupErr || !cup) {
    return NextResponse.json({ error: 'Cup not found' }, { status: 404 })
  }

  // Delete existing sessions (cascades to matches)
  await db.from('cup_sessions').delete().eq('cup_id', cup.id)

  const sessions: Array<{
    tee_time_id: string | null
    format: string
    session_order: number
    matches: Array<{
      team_a_player1_id: string
      team_a_player2_id?: string | null
      team_b_player1_id: string
      team_b_player2_id?: string | null
      match_order: number
    }>
  }> = body.sessions

  if (!sessions || sessions.length === 0) {
    return NextResponse.json({ ok: true, sessions: [] })
  }

  const createdSessions = []

  for (const s of sessions) {
    const { data: session, error: sessErr } = await db
      .from('cup_sessions')
      .insert({
        cup_id: cup.id,
        tee_time_id: s.tee_time_id,
        format: s.format,
        session_order: s.session_order,
        status: 'upcoming',
      })
      .select()
      .single()

    if (sessErr) return NextResponse.json({ error: sessErr.message }, { status: 500 })

    // Insert matches for this session
    if (s.matches && s.matches.length > 0) {
      const matchRows = s.matches.map(m => ({
        session_id: session.id,
        team_a_player1_id: m.team_a_player1_id,
        team_a_player2_id: m.team_a_player2_id ?? null,
        team_b_player1_id: m.team_b_player1_id,
        team_b_player2_id: m.team_b_player2_id ?? null,
        match_order: m.match_order,
      }))

      const { data: matches, error: matchErr } = await db
        .from('cup_matches')
        .insert(matchRows)
        .select()

      if (matchErr) return NextResponse.json({ error: matchErr.message }, { status: 500 })
      createdSessions.push({ ...session, matches })
    } else {
      createdSessions.push({ ...session, matches: [] })
    }
  }

  return NextResponse.json(createdSessions, { status: 201 })
}

// PATCH — update a single session (format, status)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await params
  const body = await req.json()
  const db = createAdminSupabaseClient()

  const { session_id, ...updates } = body
  if (!session_id) return NextResponse.json({ error: 'session_id required' }, { status: 400 })

  const allowed = ['format', 'status']
  const patch: Record<string, unknown> = {}
  for (const key of allowed) {
    if (updates[key] !== undefined) patch[key] = updates[key]
  }

  const { data: session, error } = await db
    .from('cup_sessions')
    .update(patch)
    .eq('id', session_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(session)
}
