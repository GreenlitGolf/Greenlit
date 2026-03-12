import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

// GET — payouts for a game
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; gameId: string }> },
) {
  const { id: tripId, gameId } = await params
  const supabase = createAdminSupabaseClient()

  const { data, error } = await supabase
    .from('game_payouts')
    .select('*')
    .eq('trip_id', tripId)
    .eq('game_id', gameId)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST — create payouts for a game
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; gameId: string }> },
) {
  const { id: tripId, gameId } = await params
  const body = await req.json()
  const supabase = createAdminSupabaseClient()

  // body.payouts: Array<{ from_player_id, to_player_id, amount, description? }>
  const rows = (body.payouts ?? []).map((p: Record<string, unknown>) => ({
    trip_id: tripId,
    game_id: gameId,
    from_player_id: p.from_player_id,
    to_player_id: p.to_player_id,
    amount: p.amount,
    description: p.description ?? null,
    status: 'pending',
  }))

  const { data, error } = await supabase
    .from('game_payouts')
    .insert(rows)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH — settle a payout (and sync to budget tracker)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; gameId: string }> },
) {
  const { id: tripId } = await params
  const body = await req.json()
  const supabase = createAdminSupabaseClient()

  const payoutId = body.payout_id
  if (!payoutId) return NextResponse.json({ error: 'payout_id required' }, { status: 400 })

  // Mark as settled
  const { data: payout, error: upErr } = await supabase
    .from('game_payouts')
    .update({ status: 'settled' })
    .eq('id', payoutId)
    .select()
    .single()

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  // Auto-create budget item for settled payout
  await supabase.from('budget_items').insert({
    trip_id: tripId,
    category: 'golf_games',
    label: payout.description || 'Golf Games Payout',
    amount: payout.amount,
    source_type: 'game_payout',
    source_id: payout.id,
    added_by: payout.from_player_id,
  })

  return NextResponse.json(payout)
}
