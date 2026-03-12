import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// GET — all scores for a game
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; gameId: string }> },
) {
  const { gameId } = await params
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from('game_scores')
    .select('*')
    .eq('game_id', gameId)
    .order('hole_number')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST — upsert scores (batch)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; gameId: string }> },
) {
  const { gameId } = await params
  const body = await req.json()
  const supabase = createServerSupabaseClient()

  const { data: session } = await supabase.auth.getUser()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // body.scores: Array<{ player_id, hole_number?, gross_score, net_score?, points?, notes? }>
  const scores = (body.scores ?? []).map((s: Record<string, unknown>) => ({
    game_id: gameId,
    player_id: s.player_id,
    hole_number: s.hole_number ?? null,
    gross_score: s.gross_score ?? null,
    net_score: s.net_score ?? null,
    points: s.points ?? null,
    notes: s.notes ?? null,
  }))

  // Delete existing scores for these players on this game, then insert fresh
  const playerIds = [...new Set(scores.map((s: { player_id: string }) => s.player_id))]
  await supabase
    .from('game_scores')
    .delete()
    .eq('game_id', gameId)
    .in('player_id', playerIds)

  const { data, error } = await supabase
    .from('game_scores')
    .insert(scores)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
