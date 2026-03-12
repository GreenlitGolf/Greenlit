export type GameCategory = 'individual' | 'individual_or_team' | 'team' | 'trip_format' | 'side_bet'
export type GameDifficulty = 'easy' | 'medium' | 'hard'

export interface GameDef {
  name:         string
  category:     GameCategory
  minPlayers:   number
  maxPlayers:   number
  description:  string
  configFields: string[]
  idealFor:     string
  difficulty:   GameDifficulty
  sessions?:    string[]
}

export const GAMES_LIBRARY: Record<string, GameDef> = {
  // ── Individual Games ────────────────────────────────────────────────────────

  skins: {
    name: 'Skins',
    category: 'individual',
    minPlayers: 2,
    maxPlayers: 999,
    description:
      'Each hole is worth a skin. Lowest score wins the hole. Ties carry the skin over to the next hole — creating mounting pressure and bigger payoffs.',
    configFields: ['carryovers', 'grossOrNet'],
    idealFor: 'Any size group. Best with 4+ for maximum drama on carryovers.',
    difficulty: 'easy',
  },

  nassau: {
    name: 'Nassau',
    category: 'individual_or_team',
    minPlayers: 2,
    maxPlayers: 4,
    description:
      'Three bets in one: front nine, back nine, and overall 18. Classic match play format with optional press bets when you\'re down 2.',
    configFields: ['stakes', 'presses', 'grossOrNet'],
    idealFor: 'Foursomes. The gold standard of golf betting.',
    difficulty: 'easy',
  },

  stableford: {
    name: 'Stableford',
    category: 'individual',
    minPlayers: 2,
    maxPlayers: 999,
    description:
      'Points for each hole: Eagle=4, Birdie=3, Par=2, Bogey=1, Double or worse=0. Highest points wins. Great for mixed abilities since one blow-up hole doesn\'t ruin your round.',
    configFields: ['grossOrNet'],
    idealFor: 'Groups with mixed handicaps. Keeps everyone in it all day.',
    difficulty: 'easy',
  },

  matchPlay: {
    name: 'Match Play',
    category: 'individual_or_team',
    minPlayers: 2,
    maxPlayers: 4,
    description:
      'Win holes, not strokes. Each hole is its own contest — whoever wins the most holes wins. Can be 1v1 or 2v2 better ball.',
    configFields: ['format', 'grossOrNet'],
    idealFor: 'Pairs or head-to-head. Great for evenly matched players.',
    difficulty: 'easy',
  },

  wolf: {
    name: 'Wolf',
    category: 'individual',
    minPlayers: 4,
    maxPlayers: 4,
    description:
      'Rotating \'Wolf\' picks a partner (or goes alone) after each drive. Go alone and win triple — or lose triple. Requires exactly 4 players.',
    configFields: ['stakesPerHole', 'blindWolfAllowed', 'grossOrNet'],
    idealFor: 'Exactly 4 players of similar ability. Creates massive drama on every hole.',
    difficulty: 'medium',
  },

  bingoBangoBongo: {
    name: 'Bingo Bango Bongo',
    category: 'individual',
    minPlayers: 3,
    maxPlayers: 6,
    description:
      '3 points per hole: Bingo (first on green), Bango (closest to pin once all on green), Bongo (first to hole out). Score doesn\'t matter — strategy and timing do.',
    configFields: ['pointValue', 'grossOrNet'],
    idealFor: 'Mixed handicap groups. Slower players can still win points.',
    difficulty: 'easy',
  },

  vegas: {
    name: 'Vegas',
    category: 'team',
    minPlayers: 4,
    maxPlayers: 4,
    description:
      'Teams of 2. Combine scores as a two-digit number (low score first) — a 4 and 5 becomes 45. Difference between team numbers is the points wagered per hole. Brutal swings possible.',
    configFields: ['stakesPerPoint', 'grossOrNet'],
    idealFor: 'Exactly 4 players split into 2 teams. High variance — set stakes carefully.',
    difficulty: 'medium',
  },

  sixSixSix: {
    name: 'Six Six Six',
    category: 'team',
    minPlayers: 4,
    maxPlayers: 4,
    description:
      'Three 6-hole matches with rotating partners. Holes 1-6, 7-12, 13-18 each have different team pairings. Everyone partners with everyone.',
    configFields: ['stakesPerMatch', 'pairingMethod', 'grossOrNet'],
    idealFor: '4 players who want variety. Guarantees no one is stuck with a bad partner all day.',
    difficulty: 'easy',
  },

  banker: {
    name: 'Banker (Buckets)',
    category: 'individual',
    minPlayers: 3,
    maxPlayers: 6,
    description:
      'Last hole\'s winner becomes the Banker. Sets the bet for the next hole (within agreed min/max). Each player bets the Banker — confidence-based wagering.',
    configFields: ['minBet', 'maxBet', 'grossOrNet'],
    idealFor: 'Confident players who like to set their own stakes. Can get spicy fast.',
    difficulty: 'medium',
  },

  scramble: {
    name: 'Scramble',
    category: 'team',
    minPlayers: 4,
    maxPlayers: 8,
    description:
      'Everyone hits, team picks the best shot, all play from there. Repeat until holed. Pure team format — great for mixing abilities.',
    configFields: ['teamCount', 'strokesAllowedPerPlayer'],
    idealFor: 'Mixed ability groups or when you want a relaxed, team-bonding round.',
    difficulty: 'easy',
  },

  chapman: {
    name: 'Chapman (Pinehurst)',
    category: 'team',
    minPlayers: 4,
    maxPlayers: 4,
    description:
      'Both partners tee off, then hit each other\'s ball, then select the best ball and finish as alternate shot. Unique blend of scramble and foursomes.',
    configFields: ['grossOrNet', 'stakes'],
    idealFor: '4 players in 2 teams. More strategic than scramble, less brutal than alternate shot.',
    difficulty: 'medium',
  },

  alternateShot: {
    name: 'Alternate Shot (Foursomes)',
    category: 'team',
    minPlayers: 4,
    maxPlayers: 4,
    description:
      'Team of 2 alternates every shot. One player tees off on odd holes, partner on even holes. The Ryder Cup format — brutal on partnerships.',
    configFields: ['stakes', 'grossOrNet'],
    idealFor: '4 players in 2 well-matched teams. Tests partnerships under pressure.',
    difficulty: 'hard',
  },

  // ── Trip-Wide Formats ───────────────────────────────────────────────────────

  ryderCup: {
    name: 'Ryder Cup',
    category: 'trip_format',
    minPlayers: 4,
    maxPlayers: 24,
    description:
      'Divide the group into 2 teams for the full trip. Each round earns points: Foursomes (alternate shot), Four-Ball (better ball), and Singles matches. Team with most points wins.',
    configFields: ['teamNames', 'sessionFormat', 'pointsPerSession'],
    idealFor: 'Groups of 6-12. The ultimate multi-day competition format — creates storylines that last for years.',
    difficulty: 'medium',
    sessions: ['foursomes', 'fourball', 'singles'],
  },

  presidents_cup: {
    name: 'Presidents Cup',
    category: 'trip_format',
    minPlayers: 6,
    maxPlayers: 20,
    description:
      'Similar to Ryder Cup but with more flexibility. Mixed foursomes, four-ball, and singles across multiple rounds. Works well for trips with uneven team sizes.',
    configFields: ['teamNames', 'pointsStructure'],
    idealFor: 'Larger groups (8+). More flexible than Ryder Cup for odd-numbered groups.',
    difficulty: 'medium',
  },

  strokeplayTournament: {
    name: 'Stroke Play Tournament',
    category: 'trip_format',
    minPlayers: 4,
    maxPlayers: 999,
    description:
      'Individual stroke play across all rounds. Running leaderboard throughout the trip. Crowns the low-scorer champion at the end.',
    configFields: ['grossOrNet', 'prizePool', 'cutAfterRound'],
    idealFor: 'Competitive groups who want a clear individual champion.',
    difficulty: 'easy',
  },

  stablefordTournament: {
    name: 'Stableford Points Race',
    category: 'trip_format',
    minPlayers: 4,
    maxPlayers: 999,
    description:
      'Accumulate Stableford points across every round of the trip. Running leaderboard. Best for mixed handicap groups — one bad round doesn\'t end your tournament.',
    configFields: ['grossOrNet', 'prizePool'],
    idealFor: 'Mixed ability groups across 3+ rounds. Most inclusive trip format.',
    difficulty: 'easy',
  },

  // ── Side Bets ───────────────────────────────────────────────────────────────

  junk: {
    name: 'Junk / Dots',
    category: 'side_bet',
    minPlayers: 2,
    maxPlayers: 999,
    description:
      'Side bet layer: earn dots for birdies, sandie (par from sand), greenie (closest on par 3 and make par), polly (two-putt par 3 after hitting green in 1), snake (3-putt). Pay out at end of round.',
    configFields: ['dotValue', 'activeDots'],
    idealFor: 'Add on top of any other game. Keeps the chatter going all round.',
    difficulty: 'easy',
  },
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export const GAME_CATEGORIES: { key: GameCategory; label: string }[] = [
  { key: 'individual',          label: 'Individual Games' },
  { key: 'individual_or_team',  label: 'Individual / Team' },
  { key: 'team',                label: 'Team Formats' },
  { key: 'trip_format',         label: 'Trip-Wide Competition' },
  { key: 'side_bet',            label: 'Side Bets' },
]

export function gamesByCategory(cat: GameCategory): [string, GameDef][] {
  return Object.entries(GAMES_LIBRARY).filter(([, g]) => g.category === cat)
}

export function difficultyColor(d: GameDifficulty): string {
  return d === 'easy' ? '#4ade80' : d === 'medium' ? '#facc15' : '#f87171'
}
