import { notFound } from 'next/navigation'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import OrganizerBanner from '../OrganizerBanner'
import BrochureCover from './BrochureCover'
import BrochureCourseSection, { type BrochureCourse } from './BrochureCourseSection'

// ─── Types ───────────────────────────────────────────────────────────────────

type TeeTime = {
  id: string
  trip_id: string
  course_id: string | null
  course_name: string
  tee_date: string
  tee_time: string
  num_players: number | null
  confirmation_number: string | null
  green_fee_per_player: number | null
  cart_fee_per_player: number | null
  notes: string | null
}

type Accommodation = {
  id: string
  trip_id: string
  name: string
  address: string | null
  check_in_date: string
  check_out_date: string
  check_in_time: string | null
  check_out_time: string | null
  confirmation_number: string | null
  num_rooms: number | null
  cost_per_night: number | null
  total_cost: number | null
  notes: string | null
}

type BudgetItem = {
  id: string
  trip_id: string
  category: string
  label: string
  amount: number
  per_person: boolean
  source_type: string | null
  source_id: string | null
  notes: string | null
}

type TripMember = {
  id: string
  trip_id: string
  user_id: string | null
  display_name: string | null
  role: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseTimeToMinutes(time: string): number {
  const m = time.match(/^(\d+):(\d+)\s*(AM|PM)$/i)
  if (!m) return Infinity
  let h = parseInt(m[1], 10)
  const p = m[3].toUpperCase()
  if (p === 'PM' && h !== 12) h += 12
  if (p === 'AM' && h === 12) h = 0
  return h * 60 + parseInt(m[2], 10)
}

function getTripDays(start: string | null, end: string | null) {
  const base = start ? new Date(start + 'T12:00:00') : new Date()
  const last = end   ? new Date(end   + 'T12:00:00') : base
  const days: Array<{ date: Date; dayNum: number }> = []
  const cur = new Date(base); let n = 1
  while (cur <= last) {
    days.push({ date: new Date(cur), dayNum: n }); cur.setDate(cur.getDate() + 1); n++
  }
  return days.length ? days : [{ date: base, dayNum: 1 }]
}

function fmtCompact(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function fmtRange(start: string | null, end: string | null): string {
  if (!start) return 'Dates TBD'
  const s = new Date(start + 'T12:00:00')
  const e = end ? new Date(end + 'T12:00:00') : null
  const mo = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (!e) return s.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  if (s.getFullYear() === e.getFullYear()) return `${mo(s)} – ${mo(e)}, ${s.getFullYear()}`
  return `${mo(s)}, ${s.getFullYear()} – ${mo(e)}, ${e.getFullYear()}`
}

function fmtTime12(time: string): string {
  // Convert "HH:MM:SS" or "HH:MM" to "8:00 AM"
  const [hStr, mStr] = time.split(':')
  let h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  if (h > 12) h -= 12
  if (h === 0) h = 12
  return `${h}:${m.toString().padStart(2, '0')} ${ampm}`
}

function fmtDateFull(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function fmtDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtTimePretty(time: string | null): string {
  if (!time) return ''
  const [hStr, mStr] = time.split(':')
  let h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  if (h > 12) h -= 12
  if (h === 0) h = 12
  return `${h}:${m.toString().padStart(2, '0')} ${ampm}`
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(checkIn + 'T12:00:00')
  const b = new Date(checkOut + 'T12:00:00')
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

// ─── Tee time grouping helpers ────────────────────────────────────────────────

type TeeTimeGroup = {
  courseName:      string
  earliestTime:    string   // "HH:MM:SS"
  latestTime:      string   // "HH:MM:SS"
  totalPlayers:    number
  groupCount:      number
  feePerPlayer:    number | null
  teeTimeIds:      string[]
}

/** Convert "HH:MM:SS" to minutes since midnight */
function hhmmToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/**
 * Group tee times on the same date + course that are within 30 min of each other.
 * Input must be sorted by tee_time ascending (which the DB query already does).
 */
function groupTeeTimesList(tts: TeeTime[]): TeeTimeGroup[] {
  const groups: TeeTimeGroup[] = []
  let i = 0
  while (i < tts.length) {
    const anchor = tts[i]
    const batch = [anchor]
    let j = i + 1
    while (
      j < tts.length &&
      tts[j].course_name === anchor.course_name &&
      hhmmToMinutes(tts[j].tee_time) - hhmmToMinutes(anchor.tee_time) <= 30
    ) {
      batch.push(tts[j])
      j++
    }
    groups.push({
      courseName:   anchor.course_name,
      earliestTime: anchor.tee_time,
      latestTime:   batch[batch.length - 1].tee_time,
      totalPlayers: batch.reduce((s, t) => s + (t.num_players ?? 0), 0),
      groupCount:   batch.length,
      feePerPlayer: anchor.green_fee_per_player ? Number(anchor.green_fee_per_player) : null,
      teeTimeIds:   batch.map((t) => t.id),
    })
    i = j
  }
  return groups
}

/** Format a time range: "8:47 – 9:10 AM" or "8:47 AM" if single */
function fmtTimeRange(earliest: string, latest: string): string {
  const e = fmtTime12(earliest)
  if (earliest === latest) return e
  const l = fmtTime12(latest)
  // If same AM/PM suffix, drop it from the first time
  const eSuffix = e.slice(-2)
  const lSuffix = l.slice(-2)
  if (eSuffix === lSuffix) {
    return `${e.slice(0, -3)} – ${l}`
  }
  return `${e} – ${l}`
}

// Display-item types for day-by-day rendering (Fix 2)
type DisplayItem =
  | { kind: 'regular'; id: string; start_time: string | null; title: string; type: string }
  | { kind: 'grouped_tee'; key: string; earliestTime: string; courseName: string; groupCount: number; playersPerGroup: number }

/**
 * Process sorted dayItems into display items, collapsing adjacent tee_time items
 * for the same course within 30 min into a single grouped row.
 */
function buildDisplayItems(
  dayItems: Array<{ id: string; start_time: string | null; title: string; type: string; course_id: string | null }>,
): DisplayItem[] {
  const result: DisplayItem[] = []
  let i = 0
  while (i < dayItems.length) {
    const item = dayItems[i]
    if (item.type !== 'tee_time' || !item.start_time) {
      result.push({ kind: 'regular', ...item })
      i++
      continue
    }
    // Collect consecutive tee_time items for same course within 30 min
    const batch = [item]
    let j = i + 1
    while (j < dayItems.length) {
      const next = dayItems[j]
      if (
        next.type === 'tee_time' &&
        next.course_id === item.course_id &&
        next.start_time &&
        parseTimeToMinutes(next.start_time) - parseTimeToMinutes(item.start_time) <= 30
      ) {
        batch.push(next)
        j++
      } else break
    }
    if (batch.length === 1) {
      result.push({ kind: 'regular', ...item })
    } else {
      result.push({
        kind: 'grouped_tee',
        key: `grp-${item.id}`,
        earliestTime: item.start_time,
        courseName: item.title,
        groupCount: batch.length,
        playersPerGroup: 4, // standard foursome
      })
    }
    i = j
  }
  return result
}

// Category config for budget display
const CATEGORY_CONFIG: Record<string, { emoji: string; label: string; order: number }> = {
  green_fees:    { emoji: '\u26F3', label: 'Green Fees',    order: 1 },
  lodging:       { emoji: '\uD83C\uDFE8', label: 'Lodging',       order: 2 },
  transport:     { emoji: '\uD83D\uDE97', label: 'Transport',     order: 3 },
  food_drink:    { emoji: '\uD83C\uDF7A', label: 'Food & Drink',  order: 4 },
  entertainment: { emoji: '\uD83C\uDFAD', label: 'Entertainment', order: 5 },
  equipment:     { emoji: '\uD83C\uDFCC\uFE0F', label: 'Equipment',    order: 6 },
  other:         { emoji: '\uD83D\uDCCB', label: 'Other',         order: 7 },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function BrochurePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase  = createAdminSupabaseClient()

  // Fetch trip
  const { data: trip } = await supabase
    .from('trips')
    .select('id, name, destination, start_date, end_date, created_by, share_token')
    .eq('share_token', token)
    .single()

  if (!trip) return notFound()

  // Parallel fetches — now includes tee_times, accommodations, budget_items, members
  const [
    { data: membersRaw },
    { data: rawItems },
    { data: custom },
    { data: tripCoursesRaw },
    { data: organizerRaw },
    { data: teeTimesRaw },
    { data: accommodationsRaw },
    { data: budgetItemsRaw },
    { data: cupRaw },
  ] = await Promise.all([
    supabase.from('trip_members').select('id, trip_id, user_id, display_name, role').eq('trip_id', trip.id),
    supabase.from('itinerary_items').select('id, day_number, start_time, title, type, course_id').eq('trip_id', trip.id),
    supabase.from('trip_report_customizations').select('tagline, day_notes, cover_photo_url').eq('trip_id', trip.id).single(),
    supabase.from('trip_courses').select(`
      course_id,
      courses:course_id (
        id, slug, name, location, state, tags, rating, price_min, price_max,
        description, why_its_great, courses_on_property, lodging_on_property,
        lodging_description, best_time_to_visit, walking_friendly, caddie_available,
        google_place_id, tagline, emoji
      )
    `).eq('trip_id', trip.id),
    supabase.from('users').select('full_name, email').eq('id', trip.created_by).single(),
    supabase.from('tee_times').select('*').eq('trip_id', trip.id).order('tee_date').order('tee_time'),
    supabase.from('accommodations').select('*').eq('trip_id', trip.id).order('check_in_date'),
    supabase.from('budget_items').select('*').eq('trip_id', trip.id),
    supabase.from('trip_cups').select('name, team_a_name, team_b_name, team_a_color, team_b_color, status').eq('trip_id', trip.id).maybeSingle(),
  ])

  const members = (membersRaw || []) as unknown as TripMember[]
  const memberCount = members.length || 1
  const teeTimes: TeeTime[] = (teeTimesRaw || []) as TeeTime[]
  const accommodations: Accommodation[] = (accommodationsRaw || []) as Accommodation[]
  const budgetItems: BudgetItem[] = (budgetItemsRaw || []) as BudgetItem[]

  // Cup data
  const cup = cupRaw as { name: string; team_a_name: string; team_b_name: string; team_a_color: string; team_b_color: string; status: string } | null
  let cupScoreA = 0
  let cupScoreB = 0
  if (cup && cup.status !== 'setup') {
    const { data: cupFull } = await supabase
      .from('trip_cups').select('id').eq('trip_id', trip.id).single()
    if (cupFull) {
      const { data: sessIds } = await supabase
        .from('cup_sessions').select('id').eq('cup_id', cupFull.id)
      if (sessIds && sessIds.length > 0) {
        const { data: matches } = await supabase
          .from('cup_matches')
          .select('team_a_points, team_b_points')
          .in('session_id', sessIds.map((s: { id: string }) => s.id))
        if (matches) {
          for (const m of matches) {
            cupScoreA += Number(m.team_a_points ?? 0)
            cupScoreB += Number(m.team_b_points ?? 0)
          }
        }
      }
    }
  }

  // Sort items
  const items = (rawItems || []).sort((a, b) => {
    if (a.day_number !== b.day_number) return a.day_number - b.day_number
    if (!a.start_time && !b.start_time) return 0
    if (!a.start_time) return 1
    if (!b.start_time) return -1
    return parseTimeToMinutes(a.start_time) - parseTimeToMinutes(b.start_time)
  })

  // Order courses by first appearance in itinerary
  const courseMap: Record<string, BrochureCourse> = {}
  for (const tc of tripCoursesRaw || []) {
    if (tc.course_id && tc.courses) {
      courseMap[tc.course_id] = tc.courses as unknown as BrochureCourse
    }
  }
  const seen = new Set<string>()
  const orderedCourses: BrochureCourse[] = []
  for (const item of items) {
    if (item.course_id && courseMap[item.course_id] && !seen.has(item.course_id)) {
      orderedCourses.push(courseMap[item.course_id])
      seen.add(item.course_id)
    }
  }
  // Append any trip courses not in the itinerary
  for (const tc of tripCoursesRaw || []) {
    if (tc.course_id && courseMap[tc.course_id] && !seen.has(tc.course_id)) {
      orderedCourses.push(courseMap[tc.course_id])
      seen.add(tc.course_id)
    }
  }

  const tripDays   = getTripDays(trip.start_date, trip.end_date)
  const dayNotes   = (custom?.day_notes as Record<string, string>) || {}
  const tagline    = custom?.tagline ?? null
  const coverUrl   = custom?.cover_photo_url ?? null
  const hasNotes   = Object.values(dayNotes).some((n) => n?.trim())

  const organizerName = organizerRaw?.full_name?.split(' ')[0] ?? 'Your Organizer'

  const firstCourse  = orderedCourses[0] ?? null
  const year         = trip.start_date ? new Date(trip.start_date + 'T12:00:00').getFullYear() : new Date().getFullYear()

  // ── Dynamic stats ────────────────────────────────────────────────────────
  const daysOfGolf = teeTimes.length > 0
    ? new Set(teeTimes.map((t) => t.tee_date)).size
    : orderedCourses.length

  // Green fees: sum budget_items where category=green_fees & source_type=tee_time, ÷ member count
  let estFeesValue = ''
  const greenFeeItems = budgetItems.filter(
    (b) => b.category === 'green_fees' && b.source_type === 'tee_time'
  )
  const greenFeeTotal = greenFeeItems.reduce((sum, b) => {
    return sum + (b.per_person ? Number(b.amount) * memberCount : Number(b.amount))
  }, 0)
  if (greenFeeTotal > 0) {
    const perGolfer = Math.round(greenFeeTotal / memberCount)
    estFeesValue = `$${perGolfer.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per golfer`
  } else {
    // Fallback: price range from courses
    const courseFeesEst = orderedCourses.reduce((sum, c) => sum + (c.price_min ?? 0), 0)
    estFeesValue = courseFeesEst > 0 ? `From $${courseFeesEst.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per golfer` : 'Contact courses'
  }

  const stats = [
    { icon: '\uD83D\uDCC5', label: 'Dates',        value: fmtRange(trip.start_date, trip.end_date) },
    { icon: '\u26F3',        label: 'Courses',       value: `${orderedCourses.length} course${orderedCourses.length !== 1 ? 's' : ''}` },
    { icon: '\uD83D\uDC65',  label: 'Golfers',       value: `${memberCount} golfer${memberCount !== 1 ? 's' : ''}` },
    { icon: '\uD83D\uDCCD',  label: 'Destination',   value: trip.destination || 'TBD' },
    { icon: '\uD83C\uDFCC\uFE0F', label: 'Days of Golf', value: `${daysOfGolf} day${daysOfGolf !== 1 ? 's' : ''}` },
    { icon: '\uD83D\uDCB0',  label: 'Est. Green Fees', value: estFeesValue },
  ]

  // ── Tee Sheet data: group by date ────────────────────────────────────────
  const teeTimesByDate: Record<string, TeeTime[]> = {}
  for (const tt of teeTimes) {
    if (!teeTimesByDate[tt.tee_date]) teeTimesByDate[tt.tee_date] = []
    teeTimesByDate[tt.tee_date].push(tt)
  }
  const teeSheetDates = Object.keys(teeTimesByDate).sort()

  // ── Budget data: aggregate by category ───────────────────────────────────
  const budgetByCategory: Record<string, number> = {}
  for (const item of budgetItems) {
    const cat = item.category || 'other'
    const amt = item.per_person ? Number(item.amount) * memberCount : Number(item.amount)
    budgetByCategory[cat] = (budgetByCategory[cat] || 0) + amt
  }
  const budgetCategories = Object.entries(budgetByCategory)
    .map(([cat, total]) => ({
      category: cat,
      total,
      perPerson: Math.round(total / memberCount),
      config: CATEGORY_CONFIG[cat] || { emoji: '\uD83D\uDCCB', label: cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), order: 99 },
    }))
    .sort((a, b) => a.config.order - b.config.order)
  const budgetTotal = budgetCategories.reduce((sum, c) => sum + c.total, 0)
  const budgetTotalPerPerson = Math.round(budgetTotal / memberCount)

  return (
    <>
      <OrganizerBanner
        tripId={trip.id}
        tripName={trip.name}
        createdBy={trip.created_by}
        shareToken={token}
        startDate={trip.start_date}
        endDate={trip.end_date}
        initialTagline={tagline}
        initialDayNotes={dayNotes}
        initialCoverUrl={coverUrl}
        dayCount={tripDays.length}
        currentView="brochure"
      />

      {/* ── View toggle + print — screen only ── */}
      <div className="no-print" style={{
        display: 'flex', justifyContent: 'flex-end', gap: '8px',
        padding: '12px 40px', background: 'var(--white)',
        borderBottom: '1px solid var(--cream-dark)',
      }}>
        <div style={{ display: 'flex', border: '1px solid var(--cream-dark)', borderRadius: '8px', overflow: 'hidden' }}>
          <a href={`/share/${token}`} style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 400, color: 'var(--text-mid)', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
            Quick View
          </a>
          <span style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 600, background: 'var(--green-deep)', color: 'var(--gold-light)' }}>
            Brochure
          </span>
        </div>
        <button onClick={undefined} id="print-btn" style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 500, border: '1px solid var(--cream-dark)', borderRadius: '8px', background: 'transparent', color: 'var(--text-mid)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
          ⎙ Print
        </button>
      </div>

      {/* ── Section 1: Cover ── */}
      <BrochureCover
        tripName={trip.name}
        destination={trip.destination}
        startDate={trip.start_date}
        endDate={trip.end_date}
        tagline={tagline}
        coverUrl={coverUrl}
        placeId={firstCourse?.google_place_id ?? null}
        emoji={firstCourse?.emoji ?? '\u26F3'}
        year={year}
      />

      {/* ── Section 2: Trip at a Glance ── */}
      <section style={{ background: '#fff', padding: '72px 0' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '0 48px' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', color: 'var(--green-deep)', fontWeight: 700, marginBottom: '36px' }}>
            The Trip at a Glance
          </h2>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--cream-dark)', border: '1px solid var(--cream-dark)', borderRadius: '12px', overflow: 'hidden', marginBottom: '48px' }}>
            {stats.map(({ icon, label, value }) => (
              <div key={label} style={{ background: 'var(--cream)', padding: '20px 18px' }}>
                <div style={{ fontSize: '20px', marginBottom: '6px' }}>{icon}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-light)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px', fontFamily: 'var(--font-sans)' }}>{label}</div>
                <div style={{ fontSize: '14px', color: 'var(--green-deep)', fontWeight: 500 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Compact itinerary */}
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: 'var(--green-deep)', fontWeight: 600, marginBottom: '20px' }}>
            Day-by-Day Schedule
          </h3>
          <div>
            {tripDays.map(({ date, dayNum }) => {
              const dayItems = items.filter((i) => i.day_number === dayNum)
              const displayItems = buildDisplayItems(dayItems)
              const dayNote  = dayNotes[String(dayNum)] || null
              return (
                <div key={dayNum}>
                  <div style={{ padding: '14px 0', borderTop: '1px solid var(--cream-dark)' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--green-deep)', marginBottom: '10px', fontFamily: 'var(--font-sans)' }}>
                      Day {dayNum} — {fmtCompact(date)}
                    </div>

                    {/* Stacked item rows */}
                    {displayItems.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {displayItems.map((di) => di.kind === 'grouped_tee' ? (
                          <div key={di.key} style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                            <div style={{
                              width: '80px', flexShrink: 0, fontSize: '13px',
                              fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--gold)',
                            }}>
                              {di.earliestTime}
                            </div>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                              <strong style={{ fontSize: '13px', fontWeight: 600, color: 'var(--green-deep)' }}>
                                {di.courseName}
                              </strong>
                              <span style={{ fontSize: '12px', color: 'var(--text-mid)' }}>⛳</span>
                              <span style={{
                                fontSize: '11px', color: 'var(--text-light)', fontWeight: 400,
                                padding: '1px 8px', background: 'var(--cream)', borderRadius: '10px',
                              }}>
                                {di.groupCount} groups of {di.playersPerGroup}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div key={di.id} style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                            {di.start_time ? (
                              <div style={{
                                width: '80px', flexShrink: 0, fontSize: '13px',
                                fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--gold)',
                              }}>
                                {di.start_time}
                              </div>
                            ) : (
                              <div style={{ width: '80px', flexShrink: 0 }} />
                            )}
                            <div style={{ flex: 1 }}>
                              {di.type === 'tee_time' ? (
                                <span style={{ fontSize: '13px', display: 'inline-flex', alignItems: 'baseline', gap: '6px' }}>
                                  <strong style={{ fontWeight: 600, color: 'var(--green-deep)' }}>{di.title}</strong>
                                  <span style={{ fontSize: '12px', color: 'var(--text-mid)' }}>⛳</span>
                                </span>
                              ) : (
                                <span style={{ fontSize: '13px', fontWeight: 300, color: 'var(--text-dark)' }}>{di.title}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '13px', color: 'var(--text-light)', fontStyle: 'italic' }}>
                        No items planned yet.
                      </div>
                    )}

                    {dayNote && (
                      <div style={{ marginTop: '7px', paddingLeft: '12px', borderLeft: '2px solid var(--gold)', fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--gold)', fontSize: '13px' }}>
                        {dayNote}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            <div style={{ borderTop: '1px solid var(--cream-dark)' }} />
          </div>
        </div>
      </section>

      {/* ── Section 3: Per-course ── */}
      {orderedCourses.length === 0 ? (
        <section style={{ background: 'var(--cream)', padding: '80px 0' }}>
          <div style={{ maxWidth: '760px', margin: '0 auto', padding: '0 48px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⛳</div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: 'var(--green-deep)', fontWeight: 700, marginBottom: '12px' }}>
              No courses added yet
            </h2>
            <p style={{ fontSize: '15px', color: 'var(--text-light)', fontWeight: 300, lineHeight: 1.7, maxWidth: '420px', margin: '0 auto 28px' }}>
              Use the Golf Concierge to find courses and add them to your trip — they&apos;ll appear here in your brochure.
            </p>
          </div>
        </section>
      ) : (
        orderedCourses.map((course, i) => (
          <BrochureCourseSection
            key={course.id}
            course={course}
            index={i}
            isLast={i === orderedCourses.length - 1}
          />
        ))
      )}

      {/* ── Section: The Tee Sheet ── */}
      {teeTimes.length > 0 && (
        <section className="tee-sheet-section" style={{ background: '#fff', padding: '72px 0' }}>
          <div style={{ maxWidth: '760px', margin: '0 auto', padding: '0 48px' }}>
            <h2 style={{
              fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700,
              letterSpacing: '0.2em', textTransform: 'uppercase',
              color: 'var(--text-light)', marginBottom: '36px',
            }}>
              The Tee Sheet
            </h2>

            {teeSheetDates.map((date, di) => {
              const groups = groupTeeTimesList(teeTimesByDate[date])
              return (
                <div key={date} style={{ marginBottom: di < teeSheetDates.length - 1 ? '32px' : 0 }}>
                  {/* Day header */}
                  <div style={{
                    fontSize: '18px', fontFamily: 'var(--font-serif)', fontWeight: 600,
                    color: 'var(--green-deep)', marginBottom: '16px',
                    paddingBottom: '10px', borderBottom: '1px solid var(--cream-dark)',
                  }}>
                    {fmtDateFull(date)}
                  </div>

                  {/* Grouped tee time rows */}
                  {groups.map((g, gi) => (
                    <div key={gi} style={{ display: 'flex', alignItems: 'baseline', gap: '16px', padding: '8px 0' }}>
                      <div style={{
                        fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 600,
                        color: 'var(--gold)', minWidth: '130px', flexShrink: 0,
                      }}>
                        {fmtTimeRange(g.earliestTime, g.latestTime)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--green-deep)' }}>
                          {g.courseName}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-light)', fontWeight: 300, marginTop: '2px' }}>
                          {[
                            g.totalPlayers > 0 ? `${g.totalPlayers} player${g.totalPlayers !== 1 ? 's' : ''}` : null,
                            g.groupCount > 1 ? `${g.groupCount} groups` : null,
                            g.feePerPlayer ? `$${g.feePerPlayer.toFixed(2)}/person` : null,
                          ].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Section: Where We're Staying ── */}
      {accommodations.length > 0 && (
        <section className="accommodations-section" style={{ background: 'var(--cream)', padding: '72px 0' }}>
          <div style={{ maxWidth: '760px', margin: '0 auto', padding: '0 48px' }}>
            <h2 style={{
              fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700,
              letterSpacing: '0.2em', textTransform: 'uppercase',
              color: 'var(--text-light)', marginBottom: '36px',
            }}>
              Where We&apos;re Staying
            </h2>

            {accommodations.map((acc, ai) => {
              const nights = nightsBetween(acc.check_in_date, acc.check_out_date)
              return (
                <div key={acc.id}>
                  {ai > 0 && (
                    <div style={{ borderTop: '1px solid var(--cream-dark)', margin: '32px 0' }} />
                  )}
                  <div>
                    {/* Property name */}
                    <h3 style={{
                      fontFamily: 'var(--font-serif)', fontSize: '26px', fontWeight: 700,
                      color: 'var(--green-deep)', marginBottom: '6px', lineHeight: 1.2,
                    }}>
                      {acc.name}
                    </h3>

                    {/* Address in small caps */}
                    {acc.address && (
                      <div style={{
                        fontSize: '12px', fontWeight: 500, letterSpacing: '0.08em',
                        textTransform: 'uppercase', color: 'var(--text-light)', marginBottom: '20px',
                      }}>
                        {acc.address}
                      </div>
                    )}

                    {/* Check-in / Check-out / Nights */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '16px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-light)', marginBottom: '4px', fontFamily: 'var(--font-sans)' }}>
                          Check-in
                        </div>
                        <div style={{ fontSize: '15px', color: 'var(--green-deep)', fontWeight: 500 }}>
                          {fmtDateShort(acc.check_in_date)}
                          {acc.check_in_time ? ` · ${fmtTimePretty(acc.check_in_time)}` : ''}
                        </div>
                      </div>
                      <div style={{
                        padding: '6px 16px', textAlign: 'center',
                        fontSize: '14px', fontWeight: 600, color: 'var(--green-deep)',
                      }}>
                        {nights} night{nights !== 1 ? 's' : ''}
                      </div>
                      <div style={{ flex: 1, textAlign: 'right' }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-light)', marginBottom: '4px', fontFamily: 'var(--font-sans)' }}>
                          Check-out
                        </div>
                        <div style={{ fontSize: '15px', color: 'var(--green-deep)', fontWeight: 500 }}>
                          {fmtDateShort(acc.check_out_date)}
                          {acc.check_out_time ? ` · ${fmtTimePretty(acc.check_out_time)}` : ''}
                        </div>
                      </div>
                    </div>

                    {/* Notes */}
                    {acc.notes && (
                      <div style={{
                        fontFamily: 'var(--font-serif)', fontStyle: 'italic',
                        fontSize: '14px', color: 'var(--text-mid)', lineHeight: 1.6,
                      }}>
                        {acc.notes}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Section 4: Organizer Notes ── */}
      {hasNotes && (
        <section style={{ background: teeTimes.length > 0 || accommodations.length > 0 ? '#fff' : 'var(--cream)', padding: '72px 0' }}>
          <div style={{ maxWidth: '760px', margin: '0 auto', padding: '0 48px' }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', color: 'var(--green-deep)', fontWeight: 700, marginBottom: '36px' }}>
              A Note from {organizerName}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {tripDays.map(({ date, dayNum }) => {
                const note = dayNotes[String(dayNum)]
                if (!note?.trim()) return null
                const dayLabel = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()
                return (
                  <div key={dayNum}>
                    <div style={{
                      fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em',
                      textTransform: 'uppercase', color: 'var(--green-deep)',
                      fontFamily: 'var(--font-sans)', marginBottom: '10px',
                    }}>
                      Day {dayNum} — {dayLabel}
                    </div>
                    <div style={{ borderLeft: '3px solid var(--gold)', paddingLeft: '20px' }}>
                      <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '18px', color: 'var(--green-deep)', lineHeight: 1.7, margin: 0, fontWeight: 400 }}>
                        {note}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Section: What It'll Cost ── */}
      {budgetItems.length > 0 && (
        <section className="budget-section" style={{ background: 'var(--cream)', padding: '72px 0' }}>
          <div style={{ maxWidth: '760px', margin: '0 auto', padding: '0 48px' }}>
            <h2 style={{
              fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700,
              letterSpacing: '0.2em', textTransform: 'uppercase',
              color: 'var(--text-light)', marginBottom: '36px',
            }}>
              What It&apos;ll Cost
            </h2>

            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '24px', marginBottom: '12px', paddingRight: '4px' }}>
              <div style={{ width: '100px', textAlign: 'right', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-light)', fontFamily: 'var(--font-sans)' }}>
                Total
              </div>
              <div style={{ width: '100px', textAlign: 'right', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-light)', fontFamily: 'var(--font-sans)' }}>
                Per Person
              </div>
            </div>

            {/* Category rows */}
            {budgetCategories.map(({ category, total, perPerson, config }) => (
              <div key={category} style={{
                display: 'flex', alignItems: 'center', padding: '10px 0',
                borderBottom: '1px solid rgba(0,0,0,0.06)',
              }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '16px' }}>{config.emoji}</span>
                  <span style={{ fontSize: '15px', color: 'var(--green-deep)', fontWeight: 500 }}>
                    {config.label}
                  </span>
                </div>
                <div style={{ width: '100px', textAlign: 'right', fontSize: '15px', color: 'var(--text-dark)', fontWeight: 400 }}>
                  ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ width: '100px', textAlign: 'right', fontSize: '15px', color: 'var(--text-mid)', fontWeight: 400, marginLeft: '24px' }}>
                  ${perPerson.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            ))}

            {/* Total row */}
            <div style={{
              display: 'flex', alignItems: 'center', padding: '14px 0',
              borderTop: '2px solid var(--green-deep)', marginTop: '8px',
            }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '15px', color: 'var(--green-deep)', fontWeight: 700, letterSpacing: '0.04em' }}>
                  ESTIMATED TOTAL
                </span>
              </div>
              <div style={{ width: '100px', textAlign: 'right', fontSize: '16px', color: 'var(--green-deep)', fontWeight: 700 }}>
                ${budgetTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ width: '100px', textAlign: 'right', fontSize: '16px', color: 'var(--green-deep)', fontWeight: 700, marginLeft: '24px' }}>
                ${budgetTotalPerPerson.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {/* Disclaimer */}
            <p style={{
              fontSize: '12px', color: 'var(--text-light)', fontStyle: 'italic',
              marginTop: '20px', fontWeight: 300,
            }}>
              Costs are estimates and subject to change.
            </p>
          </div>
        </section>
      )}

      {/* ── Section: The Cup ── */}
      {cup && cup.status !== 'setup' && (
        <section style={{ padding: '56px 48px', background: 'var(--cream)' }}>
          <div style={{ maxWidth: '720px', margin: '0 auto', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: 'var(--gold)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>
              🏆 The Cup
            </div>
            <h2 style={{
              fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '32px',
              fontWeight: 700, color: 'var(--green-deep)', margin: '0 0 24px',
            }}>
              {cup.name}
            </h2>

            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px',
              padding: '24px 32px', borderRadius: '12px',
              background: '#fff', border: '1px solid #e5e7eb',
            }}>
              <div style={{ textAlign: 'right', flex: 1 }}>
                <div style={{ fontSize: '15px', fontWeight: 600, color: cup.team_a_color }}>{cup.team_a_name}</div>
                <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: cup.team_a_color, marginLeft: 'auto', marginTop: '6px' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px' }}>
                <span style={{ fontSize: '48px', fontWeight: 700, fontFamily: 'var(--font-serif)', color: cup.team_a_color }}>
                  {cupScoreA % 1 === 0 ? cupScoreA : cupScoreA.toFixed(1)}
                </span>
                <span style={{ fontSize: '24px', color: '#d1d5db', fontWeight: 300 }}>—</span>
                <span style={{ fontSize: '48px', fontWeight: 700, fontFamily: 'var(--font-serif)', color: cup.team_b_color }}>
                  {cupScoreB % 1 === 0 ? cupScoreB : cupScoreB.toFixed(1)}
                </span>
              </div>
              <div style={{ textAlign: 'left', flex: 1 }}>
                <div style={{ fontSize: '15px', fontWeight: 600, color: cup.team_b_color }}>{cup.team_b_name}</div>
                <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: cup.team_b_color, marginTop: '6px' }} />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Section: Footer ── */}
      <footer style={{ background: 'var(--green-deep)', padding: '56px 48px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: 'var(--gold-light)', fontWeight: 600, marginBottom: '8px' }}>
          Planned with Greenlit
        </div>
        <div style={{ marginBottom: '16px' }}>
          <a href="https://greenlit.golf" style={{ fontSize: '14px', color: 'var(--gold)', textDecoration: 'none', letterSpacing: '0.05em' }}>
            greenlit.golf
          </a>
        </div>
        <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'rgba(245,240,232,0.5)', fontSize: '14px' }}>
          Get the golf trip out of the group chat.
        </div>
      </footer>

      {/* ── Print / client scripts ── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
          .cover-section { height: 100vh !important; overflow: hidden; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body { margin: 0; }
          @page { margin: 0; }
          img { max-width: 100%; }
          .tee-sheet-section { page-break-before: always; }
          .budget-section { page-break-before: always; }
          .photo-strip { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
      <script dangerouslySetInnerHTML={{ __html: `
        document.getElementById('print-btn')?.addEventListener('click', function() { window.print() });
      `}} />
    </>
  )
}
