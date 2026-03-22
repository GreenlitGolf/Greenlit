import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

// POST — bulk assign members to teams (replaces all existing assignments)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tripId } = await params
  const body = await req.json()
  const db = createAdminSupabaseClient()

  // Get the cup for this trip
  const { data: cup, error: cupErr } = await db
    .from('trip_cups')
    .select('id')
    .eq('trip_id', tripId)
    .single()

  if (cupErr || !cup) {
    return NextResponse.json({ error: 'Cup not found' }, { status: 404 })
  }

  // Delete existing assignments
  await db.from('cup_teams').delete().eq('cup_id', cup.id)

  // Insert new assignments
  const assignments: Array<{ member_id: string; team: 'a' | 'b'; is_captain?: boolean }> = body.assignments
  if (!assignments || assignments.length === 0) {
    return NextResponse.json({ ok: true, teams: [] })
  }

  const rows = assignments.map(a => ({
    cup_id: cup.id,
    member_id: a.member_id,
    team: a.team,
    is_captain: a.is_captain ?? false,
  }))

  const { data: teams, error } = await db
    .from('cup_teams')
    .insert(rows)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(teams)
}
