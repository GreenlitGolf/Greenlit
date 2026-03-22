import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

// PATCH — record a match result
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await params
  const body = await req.json()
  const db = createAdminSupabaseClient()

  const { match_id, result, score_display } = body
  if (!match_id) return NextResponse.json({ error: 'match_id required' }, { status: 400 })

  // Calculate points
  let team_a_points = 0
  let team_b_points = 0
  if (result === 'team_a') { team_a_points = 1; team_b_points = 0 }
  else if (result === 'team_b') { team_a_points = 0; team_b_points = 1 }
  else if (result === 'halved') { team_a_points = 0.5; team_b_points = 0.5 }

  const { data: match, error } = await db
    .from('cup_matches')
    .update({
      result: result ?? null,
      score_display: score_display ?? null,
      team_a_points,
      team_b_points,
    })
    .eq('id', match_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-update session status: if all matches have results, mark complete
  const { data: sessionMatches } = await db
    .from('cup_matches')
    .select('result')
    .eq('session_id', match.session_id)

  if (sessionMatches) {
    const allDone = sessionMatches.every((m: { result: string | null }) => m.result !== null)
    const anyDone = sessionMatches.some((m: { result: string | null }) => m.result !== null)

    const newStatus = allDone ? 'complete' : anyDone ? 'in_progress' : 'upcoming'
    await db.from('cup_sessions').update({ status: newStatus }).eq('id', match.session_id)
  }

  return NextResponse.json(match)
}
