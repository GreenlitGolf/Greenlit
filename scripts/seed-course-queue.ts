/**
 * Seed script — populates course_queue from /data/greenlit_course_seed.csv
 *
 * Run with:
 *   npx tsx scripts/seed-course-queue.ts
 *
 * Skips rows that already exist in course_queue (by name + location) or
 * are already fully enriched in the courses table (by name).
 */

import * as fs   from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

// Load .env.local manually (tsx doesn't auto-load it)
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
}

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ── CSV parser (handles quoted fields) ───────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current  = ''
  let inQuotes = false

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  const csvPath = path.resolve(process.cwd(), 'data', 'greenlit_course_seed.csv')
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV not found at ${csvPath}`)
    process.exit(1)
  }

  const lines  = fs.readFileSync(csvPath, 'utf8').split('\n').filter(Boolean)
  const header = parseCSVLine(lines[0])
  const rows   = lines.slice(1)

  console.log(`Found ${rows.length} rows in CSV (columns: ${header.join(', ')})`)

  // Pre-load existing queue entries and enriched courses for fast dedup
  const [{ data: queueRows }, { data: courseRows }] = await Promise.all([
    supabase.from('course_queue').select('name, location'),
    supabase.from('courses').select('name'),
  ])

  const queueSet  = new Set((queueRows  ?? []).map((r) => `${r.name}|||${r.location}`))
  const courseSet = new Set((courseRows ?? []).map((r) => r.name.toLowerCase()))

  let inserted = 0
  let skipped  = 0
  let errors   = 0

  for (const line of rows) {
    const cols       = parseCSVLine(line)
    const name        = cols[0]
    const location    = cols[1]
    const country     = cols[2] ?? ''
    const stateRegion = cols[3] ?? ''

    if (!name || !location) {
      skipped++
      continue
    }

    // Skip if already in the queue
    if (queueSet.has(`${name}|||${location}`)) {
      skipped++
      continue
    }

    // Skip if already enriched in the courses table
    if (courseSet.has(name.toLowerCase())) {
      console.log(`  ↳ skip (already in courses): ${name}`)
      skipped++
      continue
    }

    const { error } = await supabase.from('course_queue').insert({
      name,
      location,
      country      : country      || null,
      state_region : stateRegion  || null,
      status       : 'pending',
    })

    if (error) {
      if (error.code === '23505') {
        // unique_violation — race condition, safe to skip
        skipped++
      } else {
        console.error(`  ✗ error inserting "${name}": ${error.message}`)
        errors++
      }
    } else {
      inserted++
      if (inserted <= 5 || inserted % 50 === 0) {
        console.log(`  ✓ inserted [${inserted}]: ${name} — ${location}`)
      }
    }
  }

  console.log(`\nDone. ${inserted} inserted, ${skipped} skipped, ${errors} errors.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
