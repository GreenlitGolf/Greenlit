import { notFound } from 'next/navigation'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import OrganizerBanner from './OrganizerBanner'
import PrintButton from './PrintButton'

// ─── Types ────────────────────────────────────────────────────────────────────

type RawItem = {
  id:         string
  day_number: number
  start_time: string | null
  title:      string
  type:       string
}

type TeeTime = {
  id: string
  course_name: string
  tee_date: string
  tee_time: string
  num_players: number | null
  confirmation_number: string | null
  green_fee_per_player: number | null
}

type Accommodation = {
  id: string
  name: string
  check_in_date: string
  check_out_date: string
  confirmation_number: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseTimeToMinutes(time: string): number {
  const m = time.match(/^(\d+):(\d+)\s*(AM|PM)$/i)
  if (!m) return Infinity
  let h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  const p = m[3].toUpperCase()
  if (p === 'PM' && h !== 12) h += 12
  if (p === 'AM' && h === 12) h = 0
  return h * 60 + min
}

function getTripDays(start: string | null, end: string | null) {
  const base = start ? new Date(start + 'T12:00:00') : new Date()
  const last = end   ? new Date(end   + 'T12:00:00') : base
  const days: Array<{ date: Date; dayNum: number; dateStr: string }> = []
  const cur = new Date(base); let n = 1
  while (cur <= last) {
    const yyyy = cur.getFullYear()
    const mm = String(cur.getMonth() + 1).padStart(2, '0')
    const dd = String(cur.getDate()).padStart(2, '0')
    days.push({ date: new Date(cur), dayNum: n, dateStr: `${yyyy}-${mm}-${dd}` })
    cur.setDate(cur.getDate() + 1); n++
  }
  return days.length ? days : [{ date: base, dayNum: 1, dateStr: '' }]
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
  if (s.getFullYear() === e.getFullYear())
    return `${mo(s)} – ${mo(e)}, ${s.getFullYear()}`
  return `${mo(s)}, ${s.getFullYear()} – ${mo(e)}, ${e.getFullYear()}`
}

function fmtTime12(time: string): string {
  const [hStr, mStr] = time.split(':')
  let h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  if (h > 12) h -= 12
  if (h === 0) h = 12
  return `${h}:${m.toString().padStart(2, '0')} ${ampm}`
}

function fmtDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ShareQuickView({
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

  // Fetch member count, items, customizations, tee times, accommodations, budget in parallel
  const [
    { count: memberCount },
    { data: rawItems },
    { data: custom },
    { data: teeTimesRaw },
    { data: accommodationsRaw },
    { data: budgetItemsRaw },
  ] = await Promise.all([
    supabase.from('trip_members').select('*', { count: 'exact', head: true }).eq('trip_id', trip.id),
    supabase.from('itinerary_items').select('id, day_number, start_time, title, type').eq('trip_id', trip.id),
    supabase.from('trip_report_customizations').select('tagline, day_notes, cover_photo_url').eq('trip_id', trip.id).single(),
    supabase.from('tee_times').select('id, course_name, tee_date, tee_time, num_players, confirmation_number, green_fee_per_player').eq('trip_id', trip.id).order('tee_date').order('tee_time'),
    supabase.from('accommodations').select('id, name, check_in_date, check_out_date, confirmation_number').eq('trip_id', trip.id).order('check_in_date'),
    supabase.from('budget_items').select('amount, per_person').eq('trip_id', trip.id),
  ])

  const items: RawItem[] = (rawItems || []).sort((a, b) => {
    if (a.day_number !== b.day_number) return a.day_number - b.day_number
    if (!a.start_time && !b.start_time) return 0
    if (!a.start_time) return 1
    if (!b.start_time) return -1
    return parseTimeToMinutes(a.start_time) - parseTimeToMinutes(b.start_time)
  })

  const teeTimes: TeeTime[] = (teeTimesRaw || []) as TeeTime[]
  const accommodations: Accommodation[] = (accommodationsRaw || []) as Accommodation[]

  // Calculate per-person cost from budget items
  const members = memberCount ?? 1
  const budgetItems = (budgetItemsRaw || []) as Array<{ amount: number; per_person: boolean }>
  let totalCost = 0
  for (const bi of budgetItems) {
    totalCost += bi.per_person ? bi.amount * members : bi.amount
  }
  const perPersonCost = members > 0 ? Math.round(totalCost / members) : 0

  // Group tee times by date for quick lookup
  const teeTimesByDate: Record<string, TeeTime[]> = {}
  for (const tt of teeTimes) {
    if (!teeTimesByDate[tt.tee_date]) teeTimesByDate[tt.tee_date] = []
    teeTimesByDate[tt.tee_date].push(tt)
  }

  const tripDays  = getTripDays(trip.start_date, trip.end_date)
  const dayNotes  = (custom?.day_notes as Record<string, string>) || {}
  const tagline   = custom?.tagline ?? null
  const coverUrl  = custom?.cover_photo_url ?? null

  const metaParts = [
    trip.destination || null,
    fmtRange(trip.start_date, trip.end_date),
    memberCount ? `${memberCount} golfer${memberCount !== 1 ? 's' : ''}` : null,
  ].filter(Boolean).join('  ·  ')

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
        currentView="quickview"
      />

      <div style={{ minHeight: '100vh', background: '#fff', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '56px 40px 80px' }}>

          {/* ── Header ── */}
          <div style={{ marginBottom: '44px' }}>
            {/* Logo + controls row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
              <div style={{
                fontFamily: 'var(--font-serif)', fontSize: '12px', color: 'var(--green-muted)',
                letterSpacing: '0.15em', textTransform: 'uppercase',
              }}>
                Greenlit
              </div>

              {/* View toggle + print — hidden in print */}
              <div className="no-print" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ display: 'flex', border: '1px solid var(--cream-dark)', borderRadius: '8px', overflow: 'hidden' }}>
                  <span style={{
                    padding: '6px 14px', fontSize: '12px', fontWeight: 600,
                    background: 'var(--green-deep)', color: 'var(--gold-light)',
                  }}>
                    Quick View
                  </span>
                  <a href={`/share/${token}/brochure`} style={{
                    padding: '6px 14px', fontSize: '12px', fontWeight: 400,
                    color: 'var(--text-mid)', textDecoration: 'none',
                    display: 'flex', alignItems: 'center',
                  }}>
                    Brochure
                  </a>
                </div>
                <PrintButton />
              </div>
            </div>

            {/* Trip name */}
            <h1 style={{
              fontFamily: 'var(--font-serif)', fontSize: '42px', fontWeight: 700,
              color: 'var(--green-deep)', lineHeight: 1.15, marginBottom: '10px',
            }}>
              {trip.name}
            </h1>

            {/* Meta line */}
            <p style={{ fontSize: '14px', color: 'var(--text-light)', fontWeight: 300, marginBottom: tagline ? '8px' : 0 }}>
              {metaParts}
            </p>

            {/* Tagline */}
            {tagline && (
              <p style={{
                fontFamily: 'var(--font-serif)', fontStyle: 'italic',
                color: 'var(--gold)', fontSize: '17px', margin: 0,
              }}>
                {tagline}
              </p>
            )}
          </div>

          {/* ── Day-by-day ── */}
          <div>
            {tripDays.map(({ date, dayNum, dateStr }) => {
              const dayItems = items.filter((i) => i.day_number === dayNum)
              const dayNote  = dayNotes[String(dayNum)] || null
              const dayTeeTimes = teeTimesByDate[dateStr] || []

              return (
                <div key={dayNum}>
                  <div style={{ padding: '16px 0', borderTop: '1px solid var(--cream-dark)' }}>

                    {/* Day label */}
                    <div style={{
                      fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em',
                      textTransform: 'uppercase', color: 'var(--green-deep)',
                      marginBottom: '7px', fontFamily: 'var(--font-sans)',
                    }}>
                      Day {dayNum} — {fmtCompact(date)}
                    </div>

                    {/* Items inline */}
                    <div style={{ fontSize: '13px', color: 'var(--text-dark)', lineHeight: 1.9, fontWeight: 300 }}>
                      {dayItems.length > 0 ? dayItems.map((item, idx) => (
                        <span key={item.id}>
                          {idx > 0 && (
                            <span style={{ color: 'var(--cream-dark)', margin: '0 8px', userSelect: 'none' }}>·</span>
                          )}
                          {item.start_time && (
                            <span style={{ color: 'var(--text-light)', marginRight: '4px', fontSize: '12px' }}>
                              {item.start_time}
                            </span>
                          )}
                          {item.type === 'tee_time' ? (
                            <strong style={{ fontWeight: 600, color: 'var(--green-deep)' }}>{item.title}</strong>
                          ) : (
                            <span>{item.title}</span>
                          )}
                        </span>
                      )) : (
                        <span style={{ color: 'var(--text-light)', fontStyle: 'italic' }}>No items planned yet.</span>
                      )}
                    </div>

                    {/* Tee times for this day — highlighted rows */}
                    {dayTeeTimes.length > 0 && dayTeeTimes.map((tt) => (
                      <div key={tt.id} style={{
                        marginTop: '8px', padding: '8px 12px',
                        background: 'var(--cream)', borderRadius: '6px',
                        fontSize: '13px', color: 'var(--green-deep)', fontWeight: 500,
                        display: 'flex', alignItems: 'center', gap: '6px',
                      }}>
                        <span>⛳</span>
                        <span>{fmtTime12(tt.tee_time)}</span>
                        <span style={{ color: 'var(--text-light)', fontWeight: 300 }}>·</span>
                        <span>{tt.course_name}</span>
                        {tt.confirmation_number && (
                          <>
                            <span style={{ color: 'var(--text-light)', fontWeight: 300 }}>·</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-mid)', fontWeight: 400 }}>
                              Confirmation: #{tt.confirmation_number}
                            </span>
                          </>
                        )}
                      </div>
                    ))}

                    {/* Day note */}
                    {dayNote && (
                      <div style={{
                        marginTop: '8px', paddingLeft: '12px',
                        borderLeft: '2px solid var(--gold)',
                        fontFamily: 'var(--font-serif)', fontStyle: 'italic',
                        color: 'var(--gold)', fontSize: '13px',
                      }}>
                        {dayNote}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            <div style={{ borderTop: '1px solid var(--cream-dark)' }} />
          </div>

          {/* ── Accommodations ── */}
          {accommodations.length > 0 && (
            <div style={{ marginTop: '28px' }}>
              {accommodations.map((acc) => (
                <div key={acc.id} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  fontSize: '13px', color: 'var(--green-deep)', fontWeight: 500,
                  padding: '8px 0',
                }}>
                  <span style={{ fontSize: '15px' }}>🏨</span>
                  <span>{acc.name}</span>
                  <span style={{ color: 'var(--text-light)', fontWeight: 300 }}>,</span>
                  <span style={{ color: 'var(--text-mid)', fontWeight: 400 }}>
                    {fmtDateShort(acc.check_in_date)}–{fmtDateShort(acc.check_out_date)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ── Per-person cost ── */}
          {budgetItems.length > 0 && perPersonCost > 0 && (
            <div style={{
              marginTop: '28px', padding: '12px 0',
              fontSize: '14px', color: 'var(--green-deep)', fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <span style={{ fontSize: '15px' }}>💰</span>
              <span>Estimated cost</span>
              <span style={{ color: 'var(--text-light)', fontWeight: 300 }}>·</span>
              <span style={{ fontWeight: 600 }}>${perPersonCost.toLocaleString()} per person</span>
            </div>
          )}

          {/* ── Footer ── */}
          <div style={{ marginTop: '56px', textAlign: 'center', fontSize: '11px', color: 'var(--text-light)', fontWeight: 300, letterSpacing: '0.06em' }}>
            Planned with Greenlit&nbsp;·&nbsp;
            <a href="https://greenlit.golf" style={{ color: 'var(--text-light)', textDecoration: 'none' }}>greenlit.golf</a>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: white; }
          @page { margin: 0.75in; size: letter; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </>
  )
}
