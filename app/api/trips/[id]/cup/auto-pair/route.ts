import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

type MemberRow = {
  id: string
  display_name: string | null
  handicap: number | null
  trip_handicap: number | null
}

function getHandicap(m: MemberRow): number {
  return m.trip_handicap ?? m.handicap ?? 18
}

// POST — auto-split teams or auto-pair a session
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tripId } = await params
  const body = await req.json()
  const db = createAdminSupabaseClient()
  const action: 'split' | 'pair' = body.action

  // Get cup
  const { data: cup, error: cupErr } = await db
    .from('trip_cups')
    .select('id')
    .eq('trip_id', tripId)
    .single()

  if (cupErr || !cup) {
    return NextResponse.json({ error: 'Cup not found' }, { status: 404 })
  }

  // Get all trip members with handicaps
  const { data: members } = await db
    .from('trip_members')
    .select('id, display_name, handicap, trip_handicap')
    .eq('trip_id', tripId)

  if (!members || members.length < 2) {
    return NextResponse.json({ error: 'Need at least 2 members' }, { status: 400 })
  }

  if (action === 'split') {
    // Sort by handicap, then alternate assignment for balanced teams
    const sorted = [...members].sort((a, b) => getHandicap(a) - getHandicap(b))
    const assignments: Array<{ member_id: string; team: 'a' | 'b'; is_captain: boolean }> = []

    // Snake draft: 0→A, 1→B, 2→B, 3→A, 4→A, 5→B...
    sorted.forEach((m, i) => {
      const round = Math.floor(i / 2)
      const pos = i % 2
      const team: 'a' | 'b' = (round % 2 === 0) ? (pos === 0 ? 'a' : 'b') : (pos === 0 ? 'b' : 'a')
      assignments.push({ member_id: m.id, team, is_captain: false })
    })

    // Mark first member in each team as captain
    const aFirst = assignments.find(a => a.team === 'a')
    const bFirst = assignments.find(a => a.team === 'b')
    if (aFirst) aFirst.is_captain = true
    if (bFirst) bFirst.is_captain = true

    return NextResponse.json({ assignments })
  }

  if (action === 'pair') {
    // Get team assignments
    const { data: teamRows } = await db
      .from('cup_teams')
      .select('member_id, team')
      .eq('cup_id', cup.id)

    if (!teamRows || teamRows.length === 0) {
      return NextResponse.json({ error: 'No team assignments found' }, { status: 400 })
    }

    const teamA = teamRows.filter(t => t.team === 'a').map(t => t.member_id)
    const teamB = teamRows.filter(t => t.team === 'b').map(t => t.member_id)

    // Sort each team by handicap
    const memberMap = new Map(members.map(m => [m.id, m]))
    const sortedA = [...teamA].sort((a, b) => getHandicap(memberMap.get(a)!) - getHandicap(memberMap.get(b)!))
    const sortedB = [...teamB].sort((a, b) => getHandicap(memberMap.get(a)!) - getHandicap(memberMap.get(b)!))

    const format: string = body.format ?? 'singles'
    const pairings: Array<{
      team_a_player1_id: string
      team_a_player2_id: string | null
      team_b_player1_id: string
      team_b_player2_id: string | null
      match_order: number
    }> = []

    if (format === 'singles') {
      // Pair by rank: best vs best
      const count = Math.min(sortedA.length, sortedB.length)
      for (let i = 0; i < count; i++) {
        pairings.push({
          team_a_player1_id: sortedA[i],
          team_a_player2_id: null,
          team_b_player1_id: sortedB[i],
          team_b_player2_id: null,
          match_order: i + 1,
        })
      }
    } else {
      // Doubles: pair adjacent players within each team, then match pairs by combined handicap
      const pairsA: string[][] = []
      const pairsB: string[][] = []
      for (let i = 0; i < sortedA.length - 1; i += 2) {
        pairsA.push([sortedA[i], sortedA[i + 1]])
      }
      for (let i = 0; i < sortedB.length - 1; i += 2) {
        pairsB.push([sortedB[i], sortedB[i + 1]])
      }
      const count = Math.min(pairsA.length, pairsB.length)
      for (let i = 0; i < count; i++) {
        pairings.push({
          team_a_player1_id: pairsA[i][0],
          team_a_player2_id: pairsA[i][1],
          team_b_player1_id: pairsB[i][0],
          team_b_player2_id: pairsB[i][1],
          match_order: i + 1,
        })
      }
    }

    return NextResponse.json({ pairings })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
