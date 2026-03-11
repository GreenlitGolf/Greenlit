import { notFound } from 'next/navigation'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import OrganizerBanner from '../OrganizerBanner'
import BrochureCover from './BrochureCover'
import BrochureCourseSection, { type BrochureCourse } from './BrochureCourseSection'

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

  // Parallel fetches
  const [
    { count: memberCount },
    { data: rawItems },
    { data: custom },
    { data: tripCoursesRaw },
    { data: organizerRaw },
  ] = await Promise.all([
    supabase.from('trip_members').select('*', { count: 'exact', head: true }).eq('trip_id', trip.id),
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
  ])

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

  // Stats
  const totalRounds = items.filter((i) => i.type === 'tee_time').length
  const estFees     = orderedCourses.reduce((sum, c) => sum + (c.price_min ?? 0), 0)

  const stats = [
    { icon: '📅', label: 'Dates',        value: fmtRange(trip.start_date, trip.end_date) },
    { icon: '⛳', label: 'Courses',       value: `${orderedCourses.length} course${orderedCourses.length !== 1 ? 's' : ''}` },
    { icon: '👥', label: 'Golfers',       value: `${memberCount ?? 1} golfer${(memberCount ?? 1) !== 1 ? 's' : ''}` },
    { icon: '📍', label: 'Destination',   value: trip.destination || 'TBD' },
    { icon: '🏌️', label: 'Total Rounds', value: `${totalRounds} round${totalRounds !== 1 ? 's' : ''}` },
    { icon: '💰', label: 'Est. Green Fees', value: estFees > 0 ? `From $${estFees.toLocaleString()} per golfer` : 'Contact courses' },
  ]

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
        emoji={firstCourse?.emoji ?? '⛳'}
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
              const dayNote  = dayNotes[String(dayNum)] || null
              return (
                <div key={dayNum}>
                  <div style={{ padding: '14px 0', borderTop: '1px solid var(--cream-dark)' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--green-deep)', marginBottom: '6px', fontFamily: 'var(--font-sans)' }}>
                      Day {dayNum} — {fmtCompact(date)}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-dark)', lineHeight: 1.9, fontWeight: 300 }}>
                      {dayItems.length > 0 ? dayItems.map((item, idx) => (
                        <span key={item.id}>
                          {idx > 0 && <span style={{ color: 'var(--cream-dark)', margin: '0 8px' }}>·</span>}
                          {item.start_time && <span style={{ color: 'var(--text-light)', marginRight: '4px', fontSize: '12px' }}>{item.start_time}</span>}
                          {item.type === 'tee_time'
                            ? <strong style={{ fontWeight: 600, color: 'var(--green-deep)' }}>{item.title}</strong>
                            : <span>{item.title}</span>}
                        </span>
                      )) : <span style={{ color: 'var(--text-light)', fontStyle: 'italic' }}>No items planned yet.</span>}
                    </div>
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
      {orderedCourses.map((course, i) => (
        <BrochureCourseSection
          key={course.id}
          course={course}
          index={i}
          isLast={i === orderedCourses.length - 1}
        />
      ))}

      {/* ── Section 4: Organizer Notes ── */}
      {hasNotes && (
        <section style={{ background: 'var(--cream)', padding: '72px 0' }}>
          <div style={{ maxWidth: '760px', margin: '0 auto', padding: '0 48px' }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', color: 'var(--green-deep)', fontWeight: 700, marginBottom: '36px' }}>
              A Note from {organizerName}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {tripDays.map(({ dayNum }) => {
                const note = dayNotes[String(dayNum)]
                if (!note?.trim()) return null
                return (
                  <div key={dayNum} style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                    <div style={{ flexShrink: 0, paddingTop: '4px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-light)', fontFamily: 'var(--font-sans)' }}>Day {dayNum}</div>
                    </div>
                    <div style={{ borderLeft: '3px solid var(--gold)', paddingLeft: '20px', flex: 1 }}>
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

      {/* ── Section 5: Footer ── */}
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
          .cover-section { height: 100vh !important; page-break-after: always; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body { margin: 0; }
          @page { margin: 0; }
          img { max-width: 100%; }
        }
      `}</style>
      <script dangerouslySetInnerHTML={{ __html: `
        document.getElementById('print-btn')?.addEventListener('click', function() { window.print() });
      `}} />
    </>
  )
}
