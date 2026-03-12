import { NextRequest, NextResponse } from 'next/server'

interface PlayerInfo {
  playerId: string
  name:     string
  handicap: number
}

interface Team {
  team_number: number
  team_name:   string
  player_ids:  string[]
  players:     PlayerInfo[]
  totalHcp:    number
}

// Snake-draft players by handicap into N teams for balance
function snakeDraft(players: PlayerInfo[], teamCount: number): Team[] {
  const sorted = [...players].sort((a, b) => a.handicap - b.handicap)
  const teams: Team[] = Array.from({ length: teamCount }, (_, i) => ({
    team_number: i + 1,
    team_name: `Team ${i + 1}`,
    player_ids: [],
    players: [],
    totalHcp: 0,
  }))

  let forward = true
  let idx = 0
  for (const p of sorted) {
    teams[idx].player_ids.push(p.playerId)
    teams[idx].players.push(p)
    teams[idx].totalHcp += p.handicap

    if (forward) {
      idx++
      if (idx >= teamCount) { idx = teamCount - 1; forward = false }
    } else {
      idx--
      if (idx < 0) { idx = 0; forward = true }
    }
  }

  return teams
}

// Pair lowest-vs-lowest and highest-vs-highest (competitive)
function pairCompetitive(players: PlayerInfo[]): { match: number; players: PlayerInfo[] }[] {
  const sorted = [...players].sort((a, b) => a.handicap - b.handicap)
  const matches: { match: number; players: PlayerInfo[] }[] = []
  for (let i = 0; i < sorted.length - 1; i += 2) {
    matches.push({ match: matches.length + 1, players: [sorted[i], sorted[i + 1]] })
  }
  if (sorted.length % 2 !== 0) {
    matches[matches.length - 1].players.push(sorted[sorted.length - 1])
  }
  return matches
}

// Pair lowest-vs-highest (maximum spread)
function pairMaxSpread(players: PlayerInfo[]): { match: number; players: PlayerInfo[] }[] {
  const sorted = [...players].sort((a, b) => a.handicap - b.handicap)
  const matches: { match: number; players: PlayerInfo[] }[] = []
  let lo = 0, hi = sorted.length - 1
  let matchNum = 1
  while (lo < hi) {
    matches.push({ match: matchNum++, players: [sorted[lo], sorted[hi]] })
    lo++
    hi--
  }
  if (lo === hi) {
    matches[matches.length - 1].players.push(sorted[lo])
  }
  return matches
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await params
  const body = await req.json()
  const { gameType, playerHandicaps } = body as {
    gameType: string
    playerHandicaps: PlayerInfo[]
  }

  if (!playerHandicaps || playerHandicaps.length < 2) {
    return NextResponse.json({ error: 'At least 2 players required' }, { status: 400 })
  }

  // Default missing handicaps to 18
  const players = playerHandicaps.map((p) => ({
    ...p,
    handicap: p.handicap ?? 18,
  }))

  // Team games: snake draft into 2 teams
  const teamGames = ['vegas', 'sixSixSix', 'scramble', 'chapman', 'alternateShot', 'ryderCup', 'presidents_cup']
  if (teamGames.includes(gameType)) {
    const teamCount = gameType === 'scramble' && players.length > 4 ? Math.ceil(players.length / 4) : 2
    const teams = snakeDraft(players, teamCount)
    return NextResponse.json({ type: 'teams', teams })
  }

  // Nassau / match play: offer both pairing styles
  if (['nassau', 'matchPlay'].includes(gameType)) {
    return NextResponse.json({
      type: 'matchups',
      competitive: pairCompetitive(players),
      maxSpread: pairMaxSpread(players),
    })
  }

  // Individual games: just return confirmed player list sorted by handicap
  return NextResponse.json({
    type: 'individual',
    players: [...players].sort((a, b) => a.handicap - b.handicap),
  })
}
