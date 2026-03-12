import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// GET — list games for a trip (with pairings)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tripId } = await params
  const supabase = createServerSupabaseClient()

  const { data: games, error } = await supabase
    .from('trip_games')
    .select('*, game_pairings(*)')
    .eq('trip_id', tripId)
    .order('round_number')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(games)
}

// POST — create a new game with optional pairings
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tripId } = await params
  const body = await req.json()
  const supabase = createServerSupabaseClient()

  const { data: session } = await supabase.auth.getUser()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { pairings, ...gameData } = body

  // Insert game
  const { data: game, error: gameErr } = await supabase
    .from('trip_games')
    .insert({
      trip_id: tripId,
      round_number: gameData.round_number ?? 1,
      course_id: gameData.course_id ?? null,
      game_type: gameData.game_type,
      game_config: gameData.game_config ?? {},
      stakes_per_unit: gameData.stakes_per_unit ?? 0,
      status: 'setup',
      created_by: session.user.id,
    })
    .select()
    .single()

  if (gameErr) return NextResponse.json({ error: gameErr.message }, { status: 500 })

  // Insert pairings if provided
  if (pairings && Array.isArray(pairings) && pairings.length > 0) {
    const rows = pairings.map((p: { team_number: number; team_name?: string; player_ids: string[] }) => ({
      game_id: game.id,
      team_number: p.team_number,
      team_name: p.team_name ?? null,
      player_ids: p.player_ids,
    }))
    const { error: pairErr } = await supabase.from('game_pairings').insert(rows)
    if (pairErr) return NextResponse.json({ error: pairErr.message }, { status: 500 })
  }

  return NextResponse.json(game, { status: 201 })
}

// DELETE — delete a game by game_id in query param
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await params // consume
  const gameId = req.nextUrl.searchParams.get('game_id')
  if (!gameId) return NextResponse.json({ error: 'game_id required' }, { status: 400 })

  const supabase = createServerSupabaseClient()
  const { error } = await supabase.from('trip_games').delete().eq('id', gameId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
