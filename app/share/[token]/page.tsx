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

type ReportSettings = {
  organizer_note?:       string
  accommodation_name?:   string
  accommodation_url?:    string
  accommodation_address?: string
  show_itinerary?:   boolean
  show_tee_sheet?:   boolean
  show_budget?:      boolean
  show_cup?:         boolean
  show_accommodation?: boolean
  show_courses?:     boolean
  show_organizer_note?: boolean
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

function formatLabel(f: string): string {
  const map: Record<string, string> = {
    four_ball: 'Four-Ball', foursomes: 'Foursomes', singles: 'Singles', scramble: 'Scramble',
  }
  return map[f] ?? f
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

  // Parallel fetches
  const [
    { count: memberCount },
    { data: rawItems },
    { data: custom },
    { data: teeTimesRaw },
    { data: accommodationsRaw },
    { data: budgetItemsRaw },
    { data: cupRaw },
    { data: organizerRaw },
  ] = await Promise.all([
    supabase.from('trip_members').select('*', { count: 'exact', head: true }).eq('trip_id', trip.id),
    supabase.from('itinerary_items').select('id, day_number, start_time, title, type').eq('trip_id', trip.id),
    supabase.from('trip_report_customizations').select('tagline, day_notes, cover_photo_url, custom_sections').eq('trip_id', trip.id).single(),
    supabase.from('tee_times').select('id, course_name, tee_date, tee_time, num_players, confirmation_number, green_fee_per_player').eq('trip_id', trip.id).order('tee_date').order('tee_time'),
    supabase.from('accommodations').select('id, name, check_in_date, check_out_date, confirmation_number').eq('trip_id', trip.id).order('check_in_date'),
    supabase.from('budget_items').select('amount, per_person').eq('trip_id', trip.id),
    supabase.from('trip_cups').select('id, name, team_a_name, team_b_name, team_a_color, team_b_color, status').eq('trip_id', trip.id).maybeSingle(),
    supabase.from('users').select('full_name').eq('id', trip.created_by).single(),
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
  const members = memberCount ?? 1
  const budgetItems = (budgetItemsRaw || []) as Array<{ amount: number; per_person: boolean }>
  let totalCost = 0
  for (const bi of budgetItems) {
    totalCost += bi.per_person ? bi.amount * members : bi.amount
  }
  const perPersonCost = members > 0 ? Math.round(totalCost / members) : 0

  // Parse settings from custom_sections
  const settings: ReportSettings = (custom?.custom_sections as ReportSettings) || {}
  const organizerName = organizerRaw?.full_name?.split(' ')[0] ?? 'Your Organizer'

  // Cup data — fetch sessions & teams for session summary
  const cup = cupRaw as { id: string; name: string; team_a_name: string; team_b_name: string; team_a_color: string; team_b_color: string; status: string } | null

  type CupSession = { id: string; format: string; session_order: number; tee_time_id: string | null }
  type CupTeamMember = { member_id: string; team: 'a' | 'b' }
  type TripMemberRow = { id: number | string; display_name: string | null; email: string | null }

  let cupSessions: CupSession[] = []
  let cupTeamA: string[] = []
  let cupTeamB: string[] = []
  let cupMemberMap: Record<string, string> = {}
  let cupScoreA = 0
  let cupScoreB = 0

  if (cup && cup.status !== 'setup') {
    const [sessRes, teamsRes, membersRes] = await Promise.all([
      supabase.from('cup_sessions').select('id, format, session_order, tee_time_id').eq('cup_id', cup.id).order('session_order'),
      supabase.from('cup_teams').select('member_id, team').eq('cup_id', cup.id),
      supabase.from('trip_members').select('id, display_name, email').eq('trip_id', trip.id),
    ])

    cupSessions = (sessRes.data || []) as CupSession[]
    const teams = (teamsRes.data || []) as CupTeamMember[]
    const mems = (membersRes.data || []) as TripMemberRow[]

    // Build member name map
    mems.forEach(m => {
      const name = m.display_name || (m.email ? m.email.split('@')[0] : 'Member')
      const parts = name.split(' ')
      cupMemberMap[String(m.id)] = parts.length > 1 ? parts[parts.length - 1] : name
    })

    teams.forEach(t => {
      const name = cupMemberMap[String(t.member_id)] || 'TBD'
      if (t.team === 'a') cupTeamA.push(name)
      else cupTeamB.push(name)
    })

    // Fetch scores if cup is complete
    if (cup.status === 'complete' && cupSessions.length > 0) {
      const { data: matches } = await supabase
        .from('cup_matches')
        .select('team_a_points, team_b_points')
        .in('session_id', cupSessions.map(s => s.id))
      if (matches) {
        for (const m of matches) {
          cupScoreA += Number(m.team_a_points ?? 0)
          cupScoreB += Number(m.team_b_points ?? 0)
        }
      }
    }
  }

  // Group tee times by date for display
  const teeTimesByDate: Record<string, TeeTime[]> = {}
  for (const tt of teeTimes) {
    if (!teeTimesByDate[tt.tee_date]) teeTimesByDate[tt.tee_date] = []
    teeTimesByDate[tt.tee_date].push(tt)
  }

  // Build tee time lookup for cup sessions
  const ttMap = new Map(teeTimes.map(t => [t.id, t]))

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
        initialSettings={settings}
        dayCount={tripDays.length}
        currentView="quickview"
        organizerName={organizerName}
      />

      <div style={{ minHeight: '100vh', background: '#fff', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '56px 40px 80px' }}>

          {/* ── Header ── */}
          <div style={{ marginBottom: '44px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
              <div style={{
                fontFamily: 'var(--font-serif)', fontSize: '12px', color: 'var(--green-muted)',
                letterSpacing: '0.15em', textTransform: 'uppercase',
              }}>
                Greenlit
              </div>
              <div className="no-print" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ display: 'flex', border: '1px solid var(--cream-dark)', borderRadius: '8px', overflow: 'hidden' }}>
                  <span style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 600, background: 'var(--green-deep)', color: 'var(--gold-light)' }}>
                    Quick View
                  </span>
                  <a href={`/share/${token}/brochure`} style={{
                    padding: '6px 14px', fontSize: '12px', fontWeight: 400, color: 'var(--text-mid)', textDecoration: 'none', display: 'flex', alignItems: 'center',
                  }}>
                    Brochure
                  </a>
                </div>
                <PrintButton />
              </div>
            </div>

            <h1 style={{
              fontFamily: 'var(--font-serif)', fontSize: '42px', fontWeight: 700,
              color: 'var(--green-deep)', lineHeight: 1.15, marginBottom: '10px',
            }}>
              {trip.name}
            </h1>

            <p style={{ fontSize: '14px', color: 'var(--text-light)', fontWeight: 300, marginBottom: tagline ? '8px' : 0 }}>
              {metaParts}
            </p>

            {tagline && (
              <p style={{
                fontFamily: 'var(--font-serif)', fontStyle: 'italic',
                color: 'var(--gold)', fontSize: '17px', margin: 0,
              }}>
                {tagline}
              </p>
            )}
          </div>

          {/* ── From the Organizer ── */}
          {settings.show_organizer_note !== false && settings.organizer_note && (
            <div style={{
              marginBottom: '36px', padding: '20px 24px', borderLeft: '3px solid var(--gold)',
              background: 'var(--cream)', borderRadius: '0 10px 10px 0',
            }}>
              <p style={{
                fontFamily: 'var(--font-serif)', fontStyle: 'italic',
                fontSize: '15px', color: 'var(--green-deep)', lineHeight: 1.7, margin: 0,
              }}>
                &ldquo;{settings.organizer_note}&rdquo;
              </p>
              <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '8px', fontWeight: 500 }}>
                — {organizerName}
              </div>
            </div>
          )}

          {/* ── Day-by-day ── */}
          {settings.show_itinerary !== false && (
            <div>
              {tripDays.map(({ date, dayNum, dateStr }) => {
                const dayItems = items.filter((i) => i.day_number === dayNum)
                const dayNote  = dayNotes[String(dayNum)] || null
                const dayTeeTimes = teeTimesByDate[dateStr] || []

                return (
                  <div key={dayNum}>
                    <div style={{ padding: '16px 0', borderTop: '1px solid var(--cream-dark)' }}>
                      <div style={{
                        fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em',
                        textTransform: 'uppercase', color: 'var(--green-deep)',
                        marginBottom: '7px', fontFamily: 'var(--font-sans)',
                      }}>
                        Day {dayNum} — {fmtCompact(date)}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {dayItems.length > 0 ? dayItems.map((item) => (
                          <div key={item.id} style={{
                            fontSize: '13px', color: 'var(--text-dark)', lineHeight: 1.6, fontWeight: 300,
                            display: 'flex', alignItems: 'center', gap: '6px',
                            ...(item.type === 'tee_time' ? {
                              padding: '6px 10px', background: 'var(--cream)',
                              borderRadius: '6px', fontWeight: 500, color: 'var(--green-deep)',
                            } : {}),
                          }}>
                            {item.type === 'tee_time' && <span>⛳</span>}
                            {item.start_time && (
                              <span style={{
                                color: item.type === 'tee_time' ? 'var(--green-deep)' : 'var(--text-light)',
                                fontSize: '12px', minWidth: '62px',
                              }}>
                                {item.start_time}
                              </span>
                            )}
                            {!item.start_time && item.type !== 'tee_time' && <span style={{ minWidth: '62px' }} />}
                            <span>{item.title}</span>
                          </div>
                        )) : (
                          <span style={{ fontSize: '13px', color: 'var(--text-light)', fontStyle: 'italic', fontWeight: 300 }}>No items planned yet.</span>
                        )}
                      </div>

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
          )}

          {/* ── Accommodations ── */}
          {settings.show_accommodation !== false && accommodations.length > 0 && (
            <div style={{ marginTop: '28px' }}>
              {accommodations.map((acc) => (
                <div key={acc.id} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  fontSize: '13px', color: 'var(--green-deep)', fontWeight: 500, padding: '8px 0',
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
          {settings.show_budget !== false && budgetItems.length > 0 && perPersonCost > 0 && (
            <div style={{
              marginTop: '28px', padding: '12px 0',
              fontSize: '14px', color: 'var(--green-deep)', fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <span style={{ fontSize: '15px' }}>💰</span>
              <span>Estimated cost</span>
              <span style={{ color: 'var(--text-light)', fontWeight: 300 }}>·</span>
              <span style={{ fontWeight: 600 }}>${perPersonCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per person</span>
            </div>
          )}

          {/* ── The Cup ── */}
          {settings.show_cup !== false && cup && cup.status !== 'setup' && (
            <div style={{ marginTop: '36px' }}>
              <div style={{
                fontSize: '14px', fontWeight: 700, fontFamily: 'var(--font-serif)',
                fontStyle: 'italic', color: 'var(--green-deep)', marginBottom: '12px',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <span>🏆</span>
                <span>{cup.name}</span>
              </div>

              {/* Team rosters */}
              <div style={{
                padding: '16px 20px', borderRadius: '10px',
                background: '#fff', border: '1px solid #e5e7eb', marginBottom: '12px',
              }}>
                <div style={{ display: 'flex', gap: '24px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: cup.team_a_color, marginBottom: '6px' }}>
                      {cup.team_a_name}
                      <span style={{ display: 'inline-block', width: '20px', height: '3px', borderRadius: '2px', background: cup.team_a_color, marginLeft: '8px', verticalAlign: 'middle' }} />
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-mid)', fontWeight: 300, lineHeight: 1.8 }}>
                      {cupTeamA.join(', ') || 'TBD'}
                    </div>
                  </div>
                  <div style={{ width: '1px', background: '#e5e7eb' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: cup.team_b_color, marginBottom: '6px' }}>
                      {cup.team_b_name}
                      <span style={{ display: 'inline-block', width: '20px', height: '3px', borderRadius: '2px', background: cup.team_b_color, marginLeft: '8px', verticalAlign: 'middle' }} />
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-mid)', fontWeight: 300, lineHeight: 1.8 }}>
                      {cupTeamB.join(', ') || 'TBD'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Session schedule */}
              {cupSessions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {cupSessions.map((s) => {
                    const tt = s.tee_time_id ? ttMap.get(s.tee_time_id) : null
                    return (
                      <div key={s.id} style={{
                        fontSize: '13px', color: 'var(--text-mid)', fontWeight: 300,
                        padding: '6px 10px', background: 'var(--cream)', borderRadius: '6px',
                        display: 'flex', alignItems: 'center', gap: '8px',
                      }}>
                        <span style={{ fontWeight: 500, color: 'var(--green-deep)' }}>
                          Round {s.session_order}
                        </span>
                        {tt && (
                          <>
                            <span style={{ color: 'var(--text-light)' }}>·</span>
                            <span>{tt.course_name}</span>
                            <span style={{ color: 'var(--text-light)' }}>·</span>
                            <span>{fmtDateShort(tt.tee_date)}</span>
                          </>
                        )}
                        <span style={{ color: 'var(--text-light)' }}>·</span>
                        <span style={{ color: 'var(--gold)', fontWeight: 500 }}>{formatLabel(s.format)}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Show final score only if cup is complete */}
              {cup.status === 'complete' && (
                <div style={{
                  marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                  padding: '12px', borderRadius: '8px', background: 'var(--cream)',
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-light)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Final Score</span>
                  <span style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-serif)', color: cup.team_a_color }}>
                    {cupScoreA % 1 === 0 ? cupScoreA : cupScoreA.toFixed(1)}
                  </span>
                  <span style={{ fontSize: '14px', color: '#d1d5db' }}>—</span>
                  <span style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-serif)', color: cup.team_b_color }}>
                    {cupScoreB % 1 === 0 ? cupScoreB : cupScoreB.toFixed(1)}
                  </span>
                </div>
              )}
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
