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
  const days: Array<{ date: Date; dayNum: number }> = []
  const cur = new Date(base); let n = 1
  while (cur <= last) {
    days.push({ date: new Date(cur), dayNum: n })
    cur.setDate(cur.getDate() + 1); n++
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
  if (s.getFullYear() === e.getFullYear())
    return `${mo(s)} – ${mo(e)}, ${s.getFullYear()}`
  return `${mo(s)}, ${s.getFullYear()} – ${mo(e)}, ${e.getFullYear()}`
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

  // Fetch member count, items, customizations in parallel
  const [{ count: memberCount }, { data: rawItems }, { data: custom }] = await Promise.all([
    supabase.from('trip_members').select('*', { count: 'exact', head: true }).eq('trip_id', trip.id),
    supabase.from('itinerary_items').select('id, day_number, start_time, title, type').eq('trip_id', trip.id),
    supabase.from('trip_report_customizations').select('tagline, day_notes, cover_photo_url').eq('trip_id', trip.id).single(),
  ])

  const items: RawItem[] = (rawItems || []).sort((a, b) => {
    if (a.day_number !== b.day_number) return a.day_number - b.day_number
    if (!a.start_time && !b.start_time) return 0
    if (!a.start_time) return 1
    if (!b.start_time) return -1
    return parseTimeToMinutes(a.start_time) - parseTimeToMinutes(b.start_time)
  })

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
            {tripDays.map(({ date, dayNum }) => {
              const dayItems = items.filter((i) => i.day_number === dayNum)
              const dayNote  = dayNotes[String(dayNum)] || null

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
