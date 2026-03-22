import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

// GET — fetch cup + teams + sessions + matches for a trip
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tripId } = await params
  const db = createAdminSupabaseClient()

  const { data: cup, error: cupErr } = await db
    .from('trip_cups')
    .select('*')
    .eq('trip_id', tripId)
    .maybeSingle()

  if (cupErr) return NextResponse.json({ error: cupErr.message }, { status: 500 })
  if (!cup) return NextResponse.json(null)

  // Parallel fetch teams, sessions (with matches)
  const [teamsRes, sessionsRes] = await Promise.all([
    db.from('cup_teams').select('*').eq('cup_id', cup.id),
    db.from('cup_sessions').select('*, cup_matches(*)').eq('cup_id', cup.id).order('session_order'),
  ])

  if (teamsRes.error) return NextResponse.json({ error: teamsRes.error.message }, { status: 500 })
  if (sessionsRes.error) return NextResponse.json({ error: sessionsRes.error.message }, { status: 500 })

  return NextResponse.json({
    ...cup,
    teams: teamsRes.data,
    sessions: (sessionsRes.data ?? []).map(s => ({
      ...s,
      matches: (s.cup_matches ?? []).sort(
        (a: { match_order: number }, b: { match_order: number }) => a.match_order - b.match_order,
      ),
    })),
  })
}

// POST — create a new cup
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tripId } = await params
  const body = await req.json()
  const db = createAdminSupabaseClient()

  // Only one cup per trip
  const { data: existing } = await db
    .from('trip_cups')
    .select('id')
    .eq('trip_id', tripId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'A cup already exists for this trip' }, { status: 409 })
  }

  const { data: cup, error } = await db
    .from('trip_cups')
    .insert({
      trip_id: tripId,
      name: body.name,
      team_a_name: body.team_a_name ?? 'Team A',
      team_b_name: body.team_b_name ?? 'Team B',
      team_a_color: body.team_a_color ?? '#1a2e1a',
      team_b_color: body.team_b_color ?? '#c4a84f',
      status: 'setup',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(cup, { status: 201 })
}

// PATCH — update cup details or status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tripId } = await params
  const body = await req.json()
  const db = createAdminSupabaseClient()

  const allowed = ['name', 'team_a_name', 'team_b_name', 'team_a_color', 'team_b_color', 'status']
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key]
  }

  const { data: cup, error } = await db
    .from('trip_cups')
    .update(updates)
    .eq('trip_id', tripId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(cup)
}

// DELETE — remove the cup (organizer only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tripId } = await params
  const db = createAdminSupabaseClient()

  const { error } = await db.from('trip_cups').delete().eq('trip_id', tripId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
