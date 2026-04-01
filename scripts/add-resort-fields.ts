/**
 * Migration: Add resort_name + resort_slug to courses table,
 * then populate all multi-course resort properties.
 *
 * Run with:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/add-resort-fields.ts
 */

import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// Each entry: which courses (ILIKE patterns) belong to which resort
const RESORT_MAPPINGS: { resort_name: string; resort_slug: string; patterns: string[] }[] = [
  {
    resort_name: 'Bandon Dunes Golf Resort',
    resort_slug: 'bandon-dunes-golf-resort',
    patterns: [
      'Bandon Dunes',
      'Pacific Dunes',
      'Old Macdonald',
      'Bandon Trails',
      'Sheep Ranch',
    ],
  },
  {
    resort_name: 'Pinehurst Resort',
    resort_slug: 'pinehurst-resort',
    patterns: [
      'Pinehurst Resort No.',
      'Pinehurst Resort #',
    ],
  },
  {
    resort_name: 'Pebble Beach Resorts',
    resort_slug: 'pebble-beach-resorts',
    patterns: [
      'Pebble Beach Golf Links',
      'Spyglass Hill',
      'The Links at Spanish Bay',
      'Poppy Hills',
    ],
  },
  {
    resort_name: 'Sand Valley Resort',
    resort_slug: 'sand-valley-resort',
    patterns: [
      'Sand Valley Golf Resort',
      'Mammoth Dunes',
      'The Lido at Sand Valley',
      'Sedge Valley at Sand Valley',
    ],
  },
  {
    resort_name: 'Streamsong Resort',
    resort_slug: 'streamsong-resort',
    patterns: [
      'Streamsong Resort',
    ],
  },
  {
    resort_name: 'Destination Kohler',
    resort_slug: 'destination-kohler',
    patterns: [
      'Whistling Straits',
      'Blackwolf Run',
    ],
  },
  {
    resort_name: 'Cabot Citrus Farms',
    resort_slug: 'cabot-citrus-farms',
    patterns: [
      'Cabot Citrus Farms',
    ],
  },
  {
    resort_name: 'Forest Dunes Resort',
    resort_slug: 'forest-dunes-resort',
    patterns: [
      'Forest Dunes',
      'The Loop at Forest Dunes',
      'Bootlegger',
    ],
  },
  {
    resort_name: 'Kiawah Island Golf Resort',
    resort_slug: 'kiawah-island-golf-resort',
    patterns: [
      'Kiawah Island',
    ],
  },
  {
    resort_name: 'Sea Island Resort',
    resort_slug: 'sea-island-resort',
    patterns: [
      'Sea Island Golf Club',
    ],
  },
  {
    resort_name: 'The Prairie Club',
    resort_slug: 'the-prairie-club',
    patterns: [
      'The Prairie Club',
    ],
  },
  {
    resort_name: 'PGA Frisco',
    resort_slug: 'pga-frisco',
    patterns: [
      'PGA Frisco Fields Ranch',
    ],
  },
  {
    resort_name: 'Blackwolf Run',  // keep separate from Whistling Straits if needed — but both are Kohler
    resort_slug: 'destination-kohler',
    patterns: [], // already covered above
  },
  {
    resort_name: 'We-Ko-Pa Golf Club',
    resort_slug: 'we-ko-pa-golf-club',
    patterns: [
      'We-Ko-Pa',
    ],
  },
  {
    resort_name: 'Caledonia Golf & Fish Club / True Blue',
    resort_slug: 'caledonia-true-blue',
    patterns: [
      'Caledonia Golf',
      'True Blue Golf Club',
    ],
  },
]

async function main() {
  // ── Step 1: Add columns if they don't exist ───────────────────────────────
  // We can't run DDL directly via the JS client — use raw SQL via RPC if available,
  // otherwise we'll use the REST API workaround.
  // The safest approach: attempt an update and catch the column-missing error.
  // If it errors, log a reminder to run the migration SQL manually.

  console.log('Checking if resort_name / resort_slug columns exist...')

  const { error: colCheck } = await db
    .from('courses')
    .select('resort_name, resort_slug')
    .limit(1)

  if (colCheck) {
    console.log('\n⚠️  Columns resort_name and resort_slug do not exist yet.')
    console.log('Run this SQL in the Supabase SQL editor first:\n')
    console.log('  ALTER TABLE courses ADD COLUMN IF NOT EXISTS resort_name TEXT;')
    console.log('  ALTER TABLE courses ADD COLUMN IF NOT EXISTS resort_slug TEXT;\n')
    console.log('Then re-run this script.')
    process.exit(1)
  }

  console.log('Columns exist — proceeding with population.\n')

  // ── Step 2: Populate resort fields ───────────────────────────────────────
  let totalUpdated = 0

  for (const mapping of RESORT_MAPPINGS) {
    if (mapping.patterns.length === 0) continue

    for (const pattern of mapping.patterns) {
      const { data, error } = await db
        .from('courses')
        .update({
          resort_name: mapping.resort_name,
          resort_slug: mapping.resort_slug,
        })
        .ilike('name', `%${pattern}%`)
        .select('name')

      if (error) {
        console.error(`  FAILED pattern "${pattern}": ${error.message}`)
      } else if (data && data.length > 0) {
        data.forEach((c: { name: string }) =>
          console.log(`  [${mapping.resort_name}] ← ${c.name}`)
        )
        totalUpdated += data.length
      }
    }
  }

  console.log(`\nTotal courses updated with resort info: ${totalUpdated}`)

  // ── Step 3: Verify ────────────────────────────────────────────────────────
  console.log('\n=== Resort groupings ===')

  const { data: grouped } = await db
    .from('courses')
    .select('resort_name, name')
    .not('resort_name', 'is', null)
    .order('resort_name')
    .order('name')

  const byResort: Record<string, string[]> = {}
  for (const row of grouped ?? []) {
    if (!byResort[row.resort_name]) byResort[row.resort_name] = []
    byResort[row.resort_name].push(row.name)
  }

  for (const [resort, names] of Object.entries(byResort)) {
    console.log(`\n${resort} (${names.length} courses):`)
    names.forEach((n) => console.log(`  - ${n}`))
  }

  const { count } = await db
    .from('courses')
    .select('*', { count: 'exact', head: true })
    .not('resort_name', 'is', null)

  console.log(`\nTotal courses with resort association: ${count}`)
}

main().catch(console.error)
