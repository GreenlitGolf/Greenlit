'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'

// ─── Types ────────────────────────────────────────────────────────────────────

type Trip = {
  id:           string
  name:         string
  destination:  string | null
  start_date:   string | null
  end_date:     string | null
  memberCount:  number   // confirmed members
  courseCount:  number   // courses added
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateRange(start: string | null, end: string | null) {
  if (!start && !end) return 'Dates TBD'
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  if (start && end) return `${fmt(start)} – ${fmt(end)}`
  if (start) return `From ${fmt(start)}`
  return `Until ${fmt(end!)}`
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

// ─── Trip Progress Indicator ─────────────────────────────────────────────────

function TripProgress({ trip }: { trip: Trip }) {
  const steps = [
    { label: 'Created',  done: true },
    { label: 'Members',  done: trip.memberCount > 1 },
    { label: 'Courses',  done: trip.courseCount > 0 },
    { label: 'Dates',    done: trip.start_date != null },
  ]
  const completedCount = steps.filter((s) => s.done).length
  const pct = (completedCount / steps.length) * 100

  return (
    <div style={{ marginTop: '14px' }}>
      {/* Bar */}
      <div
        style={{
          height:       '3px',
          background:   'var(--cream-dark)',
          borderRadius: '99px',
          overflow:     'hidden',
          marginBottom: '8px',
        }}
      >
        <div
          style={{
            height:       '100%',
            width:        `${pct}%`,
            background:   pct === 100
              ? 'var(--gold)'
              : 'linear-gradient(90deg, var(--green-mid), var(--green-light))',
            borderRadius: '99px',
            transition:   'width 0.4s ease',
          }}
        />
      </div>
      {/* Steps */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {steps.map((step) => (
          <div key={step.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <div
              style={{
                width:        '6px',
                height:       '6px',
                borderRadius: '50%',
                background:   step.done ? 'var(--green-light)' : 'var(--cream-dark)',
              }}
            />
            <span
              style={{
                fontSize:      '8px',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color:         step.done ? 'var(--green-light)' : 'var(--text-light)',
                fontWeight:    step.done ? 600 : 400,
              }}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Trip Card ───────────────────────────────────────────────────────────────

function TripCard({ trip }: { trip: Trip }) {
  return (
    <Link href={`/trip/${trip.id}`} style={{ textDecoration: 'none' }}>
      <div
        style={{
          background:   'var(--white)',
          borderRadius: 'var(--radius-lg)',
          border:       '1px solid var(--cream-dark)',
          overflow:     'hidden',
          transition:   'box-shadow 0.2s, transform 0.2s',
          cursor:       'pointer',
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement
          el.style.boxShadow = 'var(--shadow-card)'
          el.style.transform = 'translateY(-2px)'
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement
          el.style.boxShadow = 'none'
          el.style.transform = 'translateY(0)'
        }}
      >
        <div style={{ height: '5px', background: 'linear-gradient(90deg, var(--green-deep), var(--green-light))' }} />

        <div style={{ padding: '20px' }}>
          <div style={{ fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--green-muted)', marginBottom: '5px', fontWeight: 600 }}>
            Golf Trip
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--green-deep)', fontWeight: 600, lineHeight: 1.25, marginBottom: '4px' }}>
            {trip.name}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-light)', fontWeight: 300, marginBottom: '8px' }}>
            📍 {trip.destination ?? 'Destination TBD'}
          </div>
          <div style={{ fontSize: '11px', color: trip.start_date ? 'var(--sand)' : 'var(--text-light)', fontWeight: trip.start_date ? 400 : 300, marginBottom: '12px' }}>
            🗓 {formatDateRange(trip.start_date, trip.end_date)}
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: '16px', paddingTop: '12px', borderTop: '1px solid var(--cream-dark)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '12px' }}>👥</span>
              <span style={{ fontSize: '13px', fontWeight: trip.memberCount > 1 ? 600 : 400, color: trip.memberCount > 1 ? 'var(--green-deep)' : 'var(--text-light)' }}>
                {trip.memberCount}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: 300 }}>
                {trip.memberCount === 1 ? 'golfer' : 'golfers'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '12px' }}>⛳</span>
              <span style={{ fontSize: '13px', fontWeight: trip.courseCount > 0 ? 600 : 400, color: trip.courseCount > 0 ? 'var(--green-deep)' : 'var(--text-light)' }}>
                {trip.courseCount}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: 300 }}>
                {trip.courseCount === 1 ? 'course' : 'courses'}
              </span>
            </div>
          </div>

          {/* Progress */}
          <TripProgress trip={trip} />
        </div>
      </div>
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { session } = useAuth()
  const router      = useRouter()
  const [trips,   setTrips]   = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)

  const userDisplayName =
    session?.user.user_metadata?.full_name ?? session?.user.email ?? ''
  const initials = userDisplayName ? getInitials(userDisplayName) : '?'

  useEffect(() => {
    async function fetchTrips() {
      if (!session) return

      // 1. All trip IDs the user belongs to
      const { data: memberRows } = await supabase
        .from('trip_members')
        .select('trip_id')
        .eq('user_id', session.user.id)

      if (!memberRows || memberRows.length === 0) {
        setLoading(false)
        return
      }

      const tripIds = memberRows.map((r) => r.trip_id)

      // 2. Trips data + member counts + course counts in parallel
      const [tripsRes, membersRes, coursesRes] = await Promise.all([
        supabase
          .from('trips')
          .select('id, name, destination, start_date, end_date')
          .in('id', tripIds),
        supabase
          .from('trip_members')
          .select('trip_id')
          .in('trip_id', tripIds),
        supabase
          .from('trip_courses')
          .select('trip_id')
          .in('trip_id', tripIds),
      ])

      const tripData   = tripsRes.data   ?? []
      const memberData = membersRes.data ?? []
      const courseData = coursesRes.data ?? []

      // 3. Count maps
      const memberCountMap = memberData.reduce<Record<string, number>>((acc, r) => {
        acc[r.trip_id] = (acc[r.trip_id] ?? 0) + 1
        return acc
      }, {})
      const courseCountMap = courseData.reduce<Record<string, number>>((acc, r) => {
        acc[r.trip_id] = (acc[r.trip_id] ?? 0) + 1
        return acc
      }, {})

      // 4. Combine
      const enriched: Trip[] = tripData.map((t) => ({
        ...t,
        memberCount: memberCountMap[t.id] ?? 0,
        courseCount: courseCountMap[t.id] ?? 0,
      }))

      setTrips(enriched)
      setLoading(false)
    }
    fetchTrips()
  }, [session])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <ProtectedRoute>
      <div style={{ minHeight: '100vh', background: 'var(--cream)', fontFamily: 'var(--font-sans)' }}>

        {/* Top bar */}
        <header style={{ background: 'var(--green-deep)', padding: '0 48px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 20 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: 'var(--gold-light)', letterSpacing: '0.02em' }}>
            Greenlit
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(196,168,79,0.2)', border: '1px solid var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--gold-light)' }}>
              {initials}
            </div>
            <button onClick={handleLogout} style={{ background: 'transparent', border: 'none', fontSize: '12px', color: 'rgba(245,240,232,0.5)', cursor: 'pointer', letterSpacing: '0.05em', fontFamily: 'var(--font-sans)' }}>
              Log out
            </button>
          </div>
        </header>

        {/* Page header */}
        <div style={{ padding: '40px 48px 28px', borderBottom: '1px solid var(--cream-dark)', background: 'var(--white)', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--green-light)', fontWeight: 600, marginBottom: '6px' }}>
              Your Trips
            </div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '30px', color: 'var(--green-deep)', fontWeight: 600 }}>
              Dashboard
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '4px', fontWeight: 300 }}>
              {session?.user.email}
            </p>
          </div>
          <Link href="/trips/new" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 20px', borderRadius: 'var(--radius-sm)', background: 'var(--green-deep)', color: 'var(--gold-light)', fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none' }}>
            + New Trip
          </Link>
        </div>

        {/* Content */}
        <div style={{ padding: '36px 48px', maxWidth: '960px' }}>

          {loading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{
                  background: 'var(--white)', borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--cream-dark)', overflow: 'hidden',
                }}>
                  <div style={{ height: '5px', background: 'var(--cream-dark)' }} />
                  <div style={{ padding: '20px' }}>
                    {/* Label skeleton */}
                    <div style={{
                      width: '60px', height: '8px', borderRadius: '4px',
                      background: 'linear-gradient(90deg, var(--cream-dark) 25%, var(--cream) 50%, var(--cream-dark) 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.5s infinite',
                      marginBottom: '10px',
                    }} />
                    {/* Title skeleton */}
                    <div style={{
                      width: '70%', height: '18px', borderRadius: '4px',
                      background: 'linear-gradient(90deg, var(--cream-dark) 25%, var(--cream) 50%, var(--cream-dark) 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.5s infinite',
                      marginBottom: '10px',
                    }} />
                    {/* Destination skeleton */}
                    <div style={{
                      width: '50%', height: '12px', borderRadius: '4px',
                      background: 'linear-gradient(90deg, var(--cream-dark) 25%, var(--cream) 50%, var(--cream-dark) 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.5s infinite',
                      marginBottom: '8px',
                    }} />
                    {/* Date skeleton */}
                    <div style={{
                      width: '40%', height: '11px', borderRadius: '4px',
                      background: 'linear-gradient(90deg, var(--cream-dark) 25%, var(--cream) 50%, var(--cream-dark) 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.5s infinite',
                      marginBottom: '16px',
                    }} />
                    {/* Stats row skeleton */}
                    <div style={{ display: 'flex', gap: '16px', paddingTop: '12px', borderTop: '1px solid var(--cream-dark)' }}>
                      <div style={{
                        width: '80px', height: '12px', borderRadius: '4px',
                        background: 'linear-gradient(90deg, var(--cream-dark) 25%, var(--cream) 50%, var(--cream-dark) 75%)',
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 1.5s infinite',
                      }} />
                      <div style={{
                        width: '80px', height: '12px', borderRadius: '4px',
                        background: 'linear-gradient(90deg, var(--cream-dark) 25%, var(--cream) 50%, var(--cream-dark) 75%)',
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 1.5s infinite',
                      }} />
                    </div>
                    {/* Progress bar skeleton */}
                    <div style={{
                      marginTop: '14px', height: '3px', borderRadius: '99px',
                      background: 'linear-gradient(90deg, var(--cream-dark) 25%, var(--cream) 50%, var(--cream-dark) 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.5s infinite',
                    }} />
                  </div>
                </div>
              ))}
              <style>{`
                @keyframes shimmer {
                  0% { background-position: 200% 0; }
                  100% { background-position: -200% 0; }
                }
              `}</style>
            </div>
          )}

          {!loading && trips.length === 0 && (
            <div style={{ textAlign: 'center', padding: '80px 40px', background: 'var(--white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--cream-dark)' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>⛳</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'var(--green-deep)', marginBottom: '8px' }}>No trips yet</div>
              <p style={{ fontSize: '13px', color: 'var(--text-light)', fontWeight: 300, marginBottom: '24px' }}>
                Create your first golf trip and invite the crew.
              </p>
              <Link href="/trips/new" style={{ display: 'inline-flex', padding: '10px 24px', borderRadius: 'var(--radius-sm)', background: 'var(--gold)', color: 'var(--green-deep)', fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none' }}>
                Plan a Trip
              </Link>
            </div>
          )}

          {trips.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {trips.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </div>
          )}

        </div>
      </div>
    </ProtectedRoute>
  )
}
