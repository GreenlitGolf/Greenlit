'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'

// ─── Types ────────────────────────────────────────────────────────────────────

type TripCourseInfo = {
  name: string
  google_place_id: string | null
}

type Trip = {
  id:            string
  name:          string
  destination:   string | null
  start_date:    string | null
  end_date:      string | null
  share_token:   string | null
  memberCount:   number
  courseCount:    number
  courses:       TripCourseInfo[]
}

type FeaturedCourse = {
  id:               string
  slug:             string
  name:             string
  location:         string
  emoji:            string
  tagline:          string | null
  google_place_id:  string | null
  tags:             string[]
  price_min:        number | null
  price_max:        number | null
  rating:           number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function formatPrice(min: number | null, max: number | null) {
  if (min != null && max != null) return `$${min}–$${max}`
  if (min != null) return `From $${min}`
  if (max != null) return `Up to $${max}`
  return null
}

/** Luxury fallback background — gold crosshatch texture over deep green gradient */
const FALLBACK_GRADIENT = [
  'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23c4a84f\' fill-opacity=\'0.04\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
  'radial-gradient(ellipse at 70% 30%, rgba(45, 90, 60, 0.4) 0%, transparent 60%)',
  'radial-gradient(ellipse at 30% 70%, rgba(196, 168, 79, 0.08) 0%, transparent 50%)',
  'linear-gradient(160deg, rgb(15, 35, 15) 0%, rgb(8, 22, 8) 100%)',
].join(', ')

/** Fetch a single photo URL from the course-photos API */
async function fetchPhoto(placeId: string): Promise<string | null> {
  try {
    console.log('[Dashboard] Fetching photo for placeId:', placeId)
    const res = await fetch(`/api/course-photos/${encodeURIComponent(placeId)}`)
    const data = await res.json()
    const url = data.photos?.[0] ?? null
    if (url) {
      console.log('[Dashboard] Photo URL resolved:', url.slice(0, 80) + '...')
    } else {
      console.warn('[Dashboard] No photos returned for placeId:', placeId, 'Response:', JSON.stringify(data))
    }
    return url
  } catch (err) {
    console.error('[Dashboard] Photo fetch error for placeId:', placeId, err)
    return null
  }
}

// ─── Trip Progress ────────────────────────────────────────────────────────────

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
      <div style={{ height: '3px', background: 'rgba(237,229,212,0.5)', borderRadius: '99px', overflow: 'hidden', marginBottom: '8px' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--gold)' : 'linear-gradient(90deg, var(--green-mid), var(--green-light))', borderRadius: '99px', transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {steps.map((step) => (
          <div key={step.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: step.done ? 'var(--green-light)' : 'var(--cream-dark)' }} />
            <span style={{ fontSize: '8px', letterSpacing: '0.05em', textTransform: 'uppercase', color: step.done ? 'var(--green-light)' : 'var(--text-light)', fontWeight: step.done ? 600 : 400 }}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Lazy Photo Hook ──────────────────────────────────────────────────────────

function useLazyPhoto(placeId: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!placeId) return
    let cancelled = false
    fetchPhoto(placeId).then((u) => { if (!cancelled) setUrl(u) })
    return () => { cancelled = true }
  }, [placeId])
  return url
}

// ─── Scroll Strip ─────────────────────────────────────────────────────────────

function ScrollStrip({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const checkScroll = useCallback(() => {
    const el = ref.current
    if (!el) return
    setCanLeft(el.scrollLeft > 10)
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    checkScroll()
    el.addEventListener('scroll', checkScroll, { passive: true })
    window.addEventListener('resize', checkScroll)
    return () => { el.removeEventListener('scroll', checkScroll); window.removeEventListener('resize', checkScroll) }
  }, [checkScroll])

  // Re-check after children render (images load, etc.)
  useEffect(() => { const t = setTimeout(checkScroll, 200); return () => clearTimeout(t) }, [children, checkScroll])

  const scroll = (dir: 'left' | 'right') => {
    ref.current?.scrollBy({ left: dir === 'left' ? -400 : 400, behavior: 'smooth' })
  }

  const arrowStyle = (side: 'left' | 'right'): React.CSSProperties => ({
    position: 'absolute',
    top: '50%',
    [side]: '8px',
    transform: 'translateY(-50%)',
    zIndex: 5,
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'var(--white)',
    border: '1px solid var(--cream-dark)',
    boxShadow: 'var(--shadow-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '16px',
    color: 'var(--green-deep)',
    transition: 'opacity 0.2s',
  })

  return (
    <div style={{ position: 'relative' }}>
      {canLeft && (
        <button onClick={() => scroll('left')} style={arrowStyle('left')} aria-label="Scroll left">
          ‹
        </button>
      )}
      <div
        ref={ref}
        style={{
          display: 'flex',
          gap: '20px',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollPaddingLeft: '48px',
          padding: '4px 48px 16px',
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
        }}
      >
        {children}
      </div>
      {canRight && (
        <button onClick={() => scroll('right')} style={arrowStyle('right')} aria-label="Scroll right">
          ›
        </button>
      )}
      <style>{`
        div::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}

// ─── Fade-In Section ──────────────────────────────────────────────────────────

function FadeInSection({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // If already in viewport (e.g. page loaded scrolled, or short hero), show immediately
    const rect = el.getBoundingClientRect()
    if (rect.top < window.innerHeight) {
      setVisible(true)
      return
    }

    // Delay observer setup so layout has settled after data fetch
    const timeout = setTimeout(() => {
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) { setVisible(true); obs.disconnect() }
        },
        { threshold: 0.05 },
      )
      obs.observe(el)
      // Store cleanup in a ref-like closure
      cleanupRef = () => obs.disconnect()
    }, 100)

    let cleanupRef: (() => void) | null = null
    return () => {
      clearTimeout(timeout)
      cleanupRef?.()
    }
  }, [])

  return (
    <div
      ref={ref}
      style={{
        ...style,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(30px)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
      }}
    >
      {children}
    </div>
  )
}

// ─── Trip Card (Rich) ─────────────────────────────────────────────────────────

function RichTripCard({ trip }: { trip: Trip }) {
  const firstPlaceId = trip.courses.find((c) => c.google_place_id)?.google_place_id
  const photoUrl = useLazyPhoto(firstPlaceId)

  return (
    <Link href={`/trip/${trip.id}`} style={{ textDecoration: 'none', flexShrink: 0, scrollSnapAlign: 'start' }}>
      <div
        style={{
          width: '380px',
          background: 'var(--white)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--cream-dark)',
          overflow: 'hidden',
          transition: 'box-shadow 0.2s, transform 0.2s',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => { const el = e.currentTarget; el.style.boxShadow = 'var(--shadow-card)'; el.style.transform = 'translateY(-3px)' }}
        onMouseLeave={(e) => { const el = e.currentTarget; el.style.boxShadow = 'none'; el.style.transform = 'translateY(0)' }}
      >
        {/* Photo */}
        <div style={{
          height: '180px',
          position: 'relative',
          background: photoUrl
            ? `url(${photoUrl}) center/cover no-repeat`
            : FALLBACK_GRADIENT,
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%)' }} />
          <div style={{
            position: 'absolute', bottom: '16px', left: '16px', right: '16px',
            fontFamily: 'var(--font-serif)', fontSize: '20px', color: '#fff', fontWeight: 600, lineHeight: 1.2,
            textShadow: '0 1px 4px rgba(0,0,0,0.3)',
          }}>
            {trip.name}
          </div>
        </div>

        {/* Details */}
        <div style={{ padding: '20px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-light)', fontWeight: 300, marginBottom: '4px' }}>
            📍 {trip.destination ?? 'Destination TBD'}
          </div>
          <div style={{ fontSize: '11px', color: trip.start_date ? 'var(--sand)' : 'var(--text-light)', fontWeight: trip.start_date ? 400 : 300, marginBottom: '12px' }}>
            🗓 {formatDateRange(trip.start_date, trip.end_date)}
          </div>
          <div style={{ display: 'flex', gap: '16px', paddingTop: '12px', borderTop: '1px solid var(--cream-dark)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '12px' }}>👥</span>
              <span style={{ fontSize: '13px', fontWeight: trip.memberCount > 1 ? 600 : 400, color: trip.memberCount > 1 ? 'var(--green-deep)' : 'var(--text-light)' }}>{trip.memberCount}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: 300 }}>{trip.memberCount === 1 ? 'golfer' : 'golfers'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '12px' }}>⛳</span>
              <span style={{ fontSize: '13px', fontWeight: trip.courseCount > 0 ? 600 : 400, color: trip.courseCount > 0 ? 'var(--green-deep)' : 'var(--text-light)' }}>{trip.courseCount}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: 300 }}>{trip.courseCount === 1 ? 'course' : 'courses'}</span>
            </div>
          </div>
          <TripProgress trip={trip} />
        </div>
      </div>
    </Link>
  )
}

// ─── Featured Course Card ─────────────────────────────────────────────────────

function FeaturedCourseCard({ course }: { course: FeaturedCourse }) {
  const photoUrl = useLazyPhoto(course.google_place_id)
  const price = formatPrice(course.price_min, course.price_max)

  return (
    <Link href={`/course/${course.slug}`} style={{ textDecoration: 'none', flexShrink: 0, scrollSnapAlign: 'start' }}>
      <div
        style={{
          width: '280px',
          background: 'var(--white)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--cream-dark)',
          overflow: 'hidden',
          transition: 'box-shadow 0.2s, transform 0.2s',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => { const el = e.currentTarget; el.style.boxShadow = 'var(--shadow-card)'; el.style.transform = 'translateY(-3px)' }}
        onMouseLeave={(e) => { const el = e.currentTarget; el.style.boxShadow = 'none'; el.style.transform = 'translateY(0)' }}
      >
        <div style={{
          height: '160px',
          background: photoUrl
            ? `url(${photoUrl}) center/cover no-repeat`
            : FALLBACK_GRADIENT,
        }} />
        <div style={{ padding: '16px' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', color: 'var(--green-deep)', fontWeight: 600, lineHeight: 1.25, marginBottom: '4px' }}>
            {course.emoji} {course.name}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: 300, marginBottom: '8px' }}>
            {course.location}
          </div>
          {price && (
            <div style={{ fontSize: '12px', color: 'var(--gold)', fontWeight: 600, marginBottom: '8px' }}>
              {price}
            </div>
          )}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {(course.tags ?? []).slice(0, 3).map((tag) => (
              <span key={tag} style={{
                fontSize: '9px', letterSpacing: '0.06em', textTransform: 'uppercase',
                padding: '3px 8px', borderRadius: '99px', background: 'var(--cream)',
                color: 'var(--green-mid)', fontWeight: 500,
              }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Ken Burns Hero ───────────────────────────────────────────────────────────

function KenBurnsHero({ photos, children }: { photos: string[]; children: React.ReactNode }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (photos.length <= 1) return
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % photos.length)
    }, 6000)
    return () => clearInterval(interval)
  }, [photos.length])

  return (
    <div style={{ position: 'relative', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      {/* Background layers */}
      {photos.length > 0 ? (
        photos.map((url, i) => (
          <div
            key={url}
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url(${url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: i === index ? 1 : 0,
              transition: 'opacity 1.5s ease-in-out',
              animation: i === index ? 'kenBurns 6s ease-in-out forwards' : 'none',
            }}
          />
        ))
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, var(--green-deep), var(--green-mid))' }} />
      )}

      {/* Overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.65) 100%)' }} />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  )
}

// ─── Quick Access Pill ────────────────────────────────────────────────────────

function QuickPill({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      style={{
        padding: '6px 14px',
        borderRadius: '99px',
        background: 'rgba(255,255,255,0.1)',
        backdropFilter: 'blur(4px)',
        color: 'rgba(255,255,255,0.8)',
        fontSize: '11px',
        fontWeight: 500,
        letterSpacing: '0.04em',
        textDecoration: 'none',
        transition: 'background 0.2s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.2)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)' }}
    >
      {label}
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { session }  = useAuth()
  const router        = useRouter()

  const [trips,           setTrips]           = useState<Trip[]>([])
  const [loading,         setLoading]         = useState(true)
  const [heroPhotoUrl,    setHeroPhotoUrl]    = useState<string | null>(null)
  const [featuredCourses, setFeaturedCourses] = useState<FeaturedCourse[]>([])
  const [kenBurnsPhotos,  setKenBurnsPhotos]  = useState<string[]>([])

  const userDisplayName = session?.user.user_metadata?.full_name ?? session?.user.email ?? ''
  const initials = userDisplayName ? getInitials(userDisplayName) : '?'

  // ── Fetch trips (extended with course data + share_token) ──────────────────
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

      // 2. Trips + member counts + course counts + trip_courses in parallel
      const [tripsRes, membersRes, coursesCountRes, tripCoursesRes] = await Promise.all([
        supabase
          .from('trips')
          .select('id, name, destination, start_date, end_date, share_token')
          .in('id', tripIds),
        supabase
          .from('trip_members')
          .select('trip_id')
          .in('trip_id', tripIds),
        supabase
          .from('trip_courses')
          .select('trip_id')
          .in('trip_id', tripIds),
        supabase
          .from('trip_courses')
          .select('trip_id, course_id')
          .in('trip_id', tripIds),
      ])

      const tripData       = tripsRes.data        ?? []
      const memberData     = membersRes.data       ?? []
      const courseCountData = coursesCountRes.data  ?? []
      const tripCoursesData = tripCoursesRes.data  ?? []

      // Count maps
      const memberCountMap = memberData.reduce<Record<string, number>>((acc, r) => { acc[r.trip_id] = (acc[r.trip_id] ?? 0) + 1; return acc }, {})
      const courseCountMap = courseCountData.reduce<Record<string, number>>((acc, r) => { acc[r.trip_id] = (acc[r.trip_id] ?? 0) + 1; return acc }, {})

      // Fetch course details (google_place_id, name) for trip courses
      const allCourseIds = [...new Set(tripCoursesData.map((tc) => tc.course_id).filter(Boolean))] as string[]
      let courseDetailsMap: Record<string, { name: string; google_place_id: string | null }> = {}

      if (allCourseIds.length > 0) {
        const { data: courseDetails } = await supabase
          .from('courses')
          .select('id, name, google_place_id')
          .in('id', allCourseIds)
        ;(courseDetails ?? []).forEach((c) => {
          courseDetailsMap[c.id] = { name: c.name, google_place_id: c.google_place_id }
        })
      }

      // Build trip_courses per trip
      const tripCourseMap: Record<string, TripCourseInfo[]> = {}
      tripCoursesData.forEach((tc) => {
        if (!tripCourseMap[tc.trip_id]) tripCourseMap[tc.trip_id] = []
        if (tc.course_id && courseDetailsMap[tc.course_id]) {
          tripCourseMap[tc.trip_id].push(courseDetailsMap[tc.course_id])
        }
      })

      // Combine
      const enriched: Trip[] = tripData.map((t) => ({
        ...t,
        memberCount: memberCountMap[t.id] ?? 0,
        courseCount:  courseCountMap[t.id]  ?? 0,
        courses:     tripCourseMap[t.id]   ?? [],
      }))

      // Sort: upcoming first (by start_date), then undated
      enriched.sort((a, b) => {
        if (a.start_date && b.start_date) return new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
        if (a.start_date) return -1
        if (b.start_date) return 1
        return 0
      })

      setTrips(enriched)
      setLoading(false)

      // Fetch hero photo — fallback chain:
      // 1. Trip's own courses' google_place_id
      // 2. Any enriched course in the DB with a google_place_id
      const heroTrip = enriched[0]
      console.log('[Dashboard] Hero trip:', heroTrip?.name, '| Courses:', heroTrip?.courses.map(c => ({ name: c.name, placeId: c.google_place_id })))
      const heroPlaceId = heroTrip?.courses.find((c) => c.google_place_id)?.google_place_id

      if (heroPlaceId) {
        console.log('[Dashboard] Hero placeId (from trip courses):', heroPlaceId)
        const url = await fetchPhoto(heroPlaceId)
        if (url) { setHeroPhotoUrl(url); return }
        console.log('[Dashboard] Trip course photo failed, trying fallback…')
      } else {
        console.log('[Dashboard] No trip courses have google_place_id, trying fallback…')
      }

      // Fallback: grab a random enriched course photo from the DB
      const { data: fallbackCourses } = await supabase
        .from('courses')
        .select('google_place_id')
        .not('google_place_id', 'is', null)
        .not('description', 'is', null)
        .limit(5)
      const fallbackIds = (fallbackCourses ?? []).map(c => c.google_place_id).filter(Boolean) as string[]
      if (fallbackIds.length > 0) {
        const randomId = fallbackIds[Math.floor(Math.random() * fallbackIds.length)]
        console.log('[Dashboard] Fallback placeId (random enriched course):', randomId)
        const url = await fetchPhoto(randomId)
        if (url) { setHeroPhotoUrl(url) } else {
          console.warn('[Dashboard] Fallback photo also failed — using gradient')
        }
      } else {
        console.warn('[Dashboard] No enriched courses with google_place_id in DB')
      }
    }
    fetchTrips()
  }, [session])

  // ── Fetch featured courses ────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/courses/featured')
      .then((r) => r.json())
      .then((data) => {
        const courses = data.courses ?? []
        setFeaturedCourses(courses)

        // For new-user Ken Burns: fetch photos for first 5 featured courses
        const placeIds = courses
          .map((c: FeaturedCourse) => c.google_place_id)
          .filter(Boolean)
          .slice(0, 5) as string[]

        if (placeIds.length > 0) {
          Promise.all(placeIds.map(fetchPhoto)).then((urls) => {
            setKenBurnsPhotos(urls.filter(Boolean) as string[])
          })
        }
      })
      .catch(() => {})
  }, [])

  // ── Determine hero trip ────────────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0]
  const upcomingTrip = trips.find((t) => t.start_date && t.start_date >= today) ?? trips[0]

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const hasTrips = !loading && trips.length > 0
  const isNewUser = !loading && trips.length === 0

  return (
    <ProtectedRoute>
      <div style={{ minHeight: '100vh', background: 'var(--cream)', fontFamily: 'var(--font-sans)' }}>

        {/* ── Sticky Header ───────────────────────────────────────── */}
        <header style={{
          background: 'var(--green-deep)', padding: '0 48px', height: '64px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 50,
        }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: 'var(--gold-light)', letterSpacing: '0.02em' }}>
            Greenlit
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Link href="/courses" style={{ fontSize: '12px', color: 'rgba(245,240,232,0.6)', textDecoration: 'none', letterSpacing: '0.04em', fontWeight: 400 }}>Courses</Link>
            <Link href="/discover" style={{ fontSize: '12px', color: 'rgba(245,240,232,0.6)', textDecoration: 'none', letterSpacing: '0.04em', fontWeight: 400 }}>Concierge</Link>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(196,168,79,0.2)', border: '1px solid var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--gold-light)' }}>{initials}</div>
            <button onClick={handleLogout} style={{ background: 'transparent', border: 'none', fontSize: '12px', color: 'rgba(245,240,232,0.5)', cursor: 'pointer', letterSpacing: '0.05em', fontFamily: 'var(--font-sans)' }}>Log out</button>
          </div>
        </header>

        {/* ── Loading Skeleton ─────────────────────────────────────── */}
        {loading && (
          <>
            <div style={{ height: 'calc(100vh - 64px)', background: 'var(--green-deep)', position: 'relative', overflow: 'hidden' }}>
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(90deg, rgba(45,74,45,0) 25%, rgba(45,74,45,0.3) 50%, rgba(45,74,45,0) 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 2s infinite',
              }} />
            </div>
            <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
          </>
        )}

        {/* ── Hero: Returning User ────────────────────────────────── */}
        {hasTrips && upcomingTrip && (
          <div style={{
            position: 'relative',
            height: 'calc(100vh - 64px)',
            overflow: 'hidden',
          }}>
            {/* Background */}
            <div style={{
              position: 'absolute', inset: 0,
              background: heroPhotoUrl
                ? `url(${heroPhotoUrl}) center/cover no-repeat`
                : FALLBACK_GRADIENT,
              transition: 'opacity 0.5s ease',
            }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 0%, rgba(10,28,10,0.75) 100%)' }} />

            {/* Ghost text watermark — only when using gradient fallback */}
            {!heroPhotoUrl && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '20%',
                  left: '-20px',
                  fontFamily: 'var(--font-serif)',
                  fontSize: 'clamp(80px, 12vw, 180px)',
                  color: 'rgba(196, 168, 79, 0.06)',
                  letterSpacing: '-0.02em',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  userSelect: 'none',
                  zIndex: 1,
                  lineHeight: 1,
                  fontWeight: 600,
                }}
              >
                {upcomingTrip.destination ?? upcomingTrip.name}
              </div>
            )}

            {/* Content */}
            <div style={{
              position: 'relative', zIndex: 2, height: '100%',
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
              padding: '64px', maxWidth: '700px',
            }}>
              <div style={{ fontSize: '11px', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 600, marginBottom: '12px' }}>
                YOUR UPCOMING TRIP
              </div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '48px', color: '#fff', fontWeight: 600, lineHeight: 1.1, marginBottom: '12px', textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                {upcomingTrip.name}
              </h1>
              <div style={{ fontSize: '16px', color: 'rgba(255,255,255,0.8)', marginBottom: '8px' }}>
                📍 {upcomingTrip.destination ?? 'Destination TBD'} &nbsp;·&nbsp; 🗓 {formatDateRange(upcomingTrip.start_date, upcomingTrip.end_date)}
              </div>
              <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                <span style={{ fontSize: '14px', color: 'var(--gold-light)' }}>👥 {upcomingTrip.memberCount} {upcomingTrip.memberCount === 1 ? 'golfer' : 'golfers'}</span>
                <span style={{ fontSize: '14px', color: 'var(--gold-light)' }}>⛳ {upcomingTrip.courseCount} {upcomingTrip.courseCount === 1 ? 'course' : 'courses'}</span>
              </div>

              {/* Days away counter */}
              {upcomingTrip.start_date && new Date(upcomingTrip.start_date) > new Date() && (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '28px' }}>
                  <span style={{
                    fontFamily: 'var(--font-serif)', fontSize: '48px', color: 'var(--gold)',
                    fontWeight: 600, fontStyle: 'italic', lineHeight: 1,
                    textShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  }}>
                    {Math.ceil((new Date(upcomingTrip.start_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))}
                  </span>
                  <span style={{
                    fontSize: '12px', color: 'rgba(196,168,79,0.6)',
                    fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase',
                  }}>
                    DAYS AWAY
                  </span>
                </div>
              )}

              {/* CTAs */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                <Link
                  href={`/trip/${upcomingTrip.id}`}
                  style={{
                    padding: '12px 28px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--gold)', color: 'var(--green-deep)',
                    fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em',
                    textTransform: 'uppercase', textDecoration: 'none',
                  }}
                >
                  View Trip
                </Link>
                {upcomingTrip.share_token && (
                  <Link
                    href={`/share/${upcomingTrip.share_token}/brochure`}
                    style={{
                      padding: '12px 28px', borderRadius: 'var(--radius-sm)',
                      background: 'transparent', border: '1px solid rgba(255,255,255,0.4)',
                      color: '#fff', fontSize: '12px', fontWeight: 600,
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      textDecoration: 'none',
                    }}
                  >
                    Share Brochure
                  </Link>
                )}
              </div>

              {/* Quick-access pills */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <QuickPill href={`/trip/${upcomingTrip.id}/tee-times`} label="Tee Times" />
                <QuickPill href={`/trip/${upcomingTrip.id}/budget`} label="Budget" />
                <QuickPill href={`/trip/${upcomingTrip.id}/accommodations`} label="Accommodations" />
                <QuickPill href={`/trip/${upcomingTrip.id}/games`} label="Games" />
                <QuickPill href={`/trip/${upcomingTrip.id}/report`} label="Trip Report" />
              </div>
            </div>
          </div>
        )}

        {/* ── Hero: New User ──────────────────────────────────────── */}
        {isNewUser && (
          <KenBurnsHero photos={kenBurnsPhotos}>
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              textAlign: 'center', padding: '48px 24px',
            }}>
              <div style={{ fontSize: '11px', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 600, marginBottom: '16px' }}>
                WELCOME TO GREENLIT
              </div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '52px', color: '#fff', fontWeight: 600, lineHeight: 1.1, marginBottom: '16px', maxWidth: '600px', textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                Your Group Golf Trip Starts Here
              </h1>
              <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.7)', marginBottom: '32px', maxWidth: '500px', lineHeight: 1.6 }}>
                Plan courses, wrangle the crew, lock in tee times — all in one place.
              </p>
              <Link
                href="/trips/new"
                style={{
                  padding: '14px 36px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--gold)', color: 'var(--green-deep)',
                  fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em',
                  textTransform: 'uppercase', textDecoration: 'none',
                }}
              >
                Plan Your First Trip
              </Link>
            </div>
          </KenBurnsHero>
        )}

        {/* ── Trips Section ───────────────────────────────────────── */}
        {hasTrips && (
          <FadeInSection style={{ padding: '56px 0 48px', background: 'var(--cream)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 48px', marginBottom: '24px' }}>
              <div>
                <div style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--green-light)', fontWeight: 600, marginBottom: '4px' }}>YOUR TRIPS</div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: 'var(--green-deep)', fontWeight: 600 }}>Upcoming &amp; Recent</h2>
              </div>
              <Link
                href="/trips/new"
                style={{
                  padding: '10px 20px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--green-deep)', color: 'var(--gold-light)',
                  fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em',
                  textTransform: 'uppercase', textDecoration: 'none',
                }}
              >
                + New Trip
              </Link>
            </div>
            <ScrollStrip>
              {trips.map((trip) => (
                <RichTripCard key={trip.id} trip={trip} />
              ))}
            </ScrollStrip>
          </FadeInSection>
        )}

        {/* ── Featured Courses Strip ──────────────────────────────── */}
        {featuredCourses.length > 0 && (
          <FadeInSection style={{ padding: '56px 0 48px', background: 'var(--white)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 48px', marginBottom: '24px' }}>
              <div>
                <div style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--green-light)', fontWeight: 600, marginBottom: '4px' }}>EXPLORE COURSES</div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: 'var(--green-deep)', fontWeight: 600 }}>Editor&apos;s Picks</h2>
              </div>
              <Link
                href="/courses"
                style={{
                  fontSize: '13px', color: 'var(--green-light)', textDecoration: 'none',
                  fontWeight: 500, letterSpacing: '0.04em',
                }}
              >
                View All →
              </Link>
            </div>
            <ScrollStrip>
              {featuredCourses.map((course) => (
                <FeaturedCourseCard key={course.id} course={course} />
              ))}
            </ScrollStrip>
          </FadeInSection>
        )}

        {/* ── Footer Strip (new users / few trips) ────────────────── */}
        {(isNewUser || trips.length < 2) && !loading && (
          <FadeInSection style={{
            background: 'var(--green-deep)', padding: '64px 48px',
          }}>
            <div style={{
              maxWidth: '1000px', margin: '0 auto',
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '40px',
              marginBottom: '40px',
            }}>
              {[
                { icon: '🏌️', title: 'Curated Courses', desc: 'Browse world-class courses hand-picked for group trips, with real photos and insider details.' },
                { icon: '👥', title: 'Wrangle the Crew', desc: 'Invite your group, track RSVPs, and keep everyone on the same page with shared itineraries.' },
                { icon: '📋', title: 'One-Stop Planning', desc: 'Tee times, budgets, accommodations, and games — everything lives in one beautiful trip hub.' },
              ].map((item) => (
                <div key={item.title} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>{item.icon}</div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--gold-light)', marginBottom: '8px', fontWeight: 600 }}>{item.title}</div>
                  <p style={{ fontSize: '13px', color: 'rgba(245,240,232,0.6)', lineHeight: 1.6, fontWeight: 300 }}>{item.desc}</p>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center' }}>
              <Link
                href="/trips/new"
                style={{
                  display: 'inline-block', padding: '12px 32px',
                  borderRadius: 'var(--radius-sm)', background: 'var(--gold)',
                  color: 'var(--green-deep)', fontSize: '12px', fontWeight: 700,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  textDecoration: 'none',
                }}
              >
                Get Started
              </Link>
            </div>
          </FadeInSection>
        )}

        {/* ── Keyframes ───────────────────────────────────────────── */}
        <style>{`
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
          @keyframes kenBurns {
            0% { transform: scale(1) translate(0, 0); }
            100% { transform: scale(1.1) translate(-2%, -1%); }
          }
        `}</style>
      </div>
    </ProtectedRoute>
  )
}
