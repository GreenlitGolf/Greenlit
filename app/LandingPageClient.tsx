'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type FeaturedCourse = {
  id: string
  slug: string
  name: string
  location: string
  emoji: string
  tagline: string | null
  google_place_id: string | null
  tags: string[]
  price_min: number | null
  price_max: number | null
  rating: number | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BROCHURE_URL = '/share/5840495f7e33b0565ea08125/brochure'

const FALLBACK_GRADIENT = [
  'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23c4a84f\' fill-opacity=\'0.04\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
  'radial-gradient(ellipse at 70% 30%, rgba(45, 90, 60, 0.4) 0%, transparent 60%)',
  'radial-gradient(ellipse at 30% 70%, rgba(196, 168, 79, 0.08) 0%, transparent 50%)',
  'linear-gradient(160deg, rgb(15, 35, 15) 0%, rgb(8, 22, 8) 100%)',
].join(', ')

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(min: number | null, max: number | null) {
  if (min != null && max != null) return `$${min}–$${max}`
  if (min != null) return `From $${min}`
  if (max != null) return `Up to $${max}`
  return null
}

async function fetchPhoto(placeId: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/course-photos/${encodeURIComponent(placeId)}`)
    const data = await res.json()
    return data.photos?.[0] ?? null
  } catch {
    return null
  }
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

  const scroll = (dir: number) => {
    ref.current?.scrollBy({ left: dir * 320, behavior: 'smooth' })
  }

  const arrowStyle = (show: boolean): React.CSSProperties => ({
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    width: '40px', height: '40px', borderRadius: '50%',
    background: 'rgba(26,46,26,0.85)', border: '1px solid rgba(196,168,79,0.3)',
    color: 'var(--gold-light)', fontSize: '18px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', opacity: show ? 1 : 0, pointerEvents: show ? 'auto' : 'none',
    transition: 'opacity 0.2s', zIndex: 5,
  })

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => scroll(-1)} style={{ ...arrowStyle(canLeft), left: '8px' }} aria-label="Scroll left">&lsaquo;</button>
      <div
        ref={ref}
        style={{
          display: 'flex', gap: '20px', overflowX: 'auto', scrollSnapType: 'x mandatory',
          padding: '0 48px 16px', scrollbarWidth: 'none',
        }}
      >
        {children}
      </div>
      <button onClick={() => scroll(1)} style={{ ...arrowStyle(canRight), right: '8px' }} aria-label="Scroll right">&rsaquo;</button>
    </div>
  )
}

// ─── Course Card ──────────────────────────────────────────────────────────────

function CourseCard({ course }: { course: FeaturedCourse }) {
  const photoUrl = useLazyPhoto(course.google_place_id)
  const price = formatPrice(course.price_min, course.price_max)

  return (
    <Link
      href="/login?redirect=/courses"
      style={{
        flex: '0 0 260px', scrollSnapAlign: 'start',
        borderRadius: '12px', overflow: 'hidden',
        background: 'var(--cream)', textDecoration: 'none',
        boxShadow: '0 4px 24px rgba(26,46,26,0.08)',
        transition: 'transform 0.2s',
      }}
    >
      {/* Photo */}
      <div style={{
        height: '180px', position: 'relative', overflow: 'hidden',
        background: photoUrl ? undefined : 'linear-gradient(135deg, var(--green-mid), var(--green-deep))',
      }}>
        {photoUrl ? (
          <img src={photoUrl} alt={course.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', opacity: 0.4 }}>
            {course.emoji}
          </div>
        )}
        {price && (
          <div style={{
            position: 'absolute', bottom: '8px', right: '8px',
            background: 'rgba(0,0,0,0.6)', color: '#fff',
            fontSize: '11px', fontWeight: 600, padding: '4px 10px',
            borderRadius: '20px', backdropFilter: 'blur(4px)',
          }}>
            {price}
          </div>
        )}
      </div>
      {/* Info */}
      <div style={{ padding: '14px 16px' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', color: 'var(--green-deep)', fontWeight: 600, marginBottom: '4px', lineHeight: 1.3 }}>
          {course.name}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-light)', fontWeight: 300 }}>
          {course.location}
        </div>
        {course.tags.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '8px' }}>
            {course.tags.slice(0, 3).map((tag) => (
              <span key={tag} style={{
                fontSize: '9px', padding: '2px 8px', borderRadius: '20px',
                border: '1px solid var(--cream-dark)', color: 'var(--text-mid)',
                fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LandingPageClient() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [heroPhoto, setHeroPhoto] = useState<string | null>(null)
  const [featuredCourses, setFeaturedCourses] = useState<FeaturedCourse[]>([])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Auth check — redirect logged-in users
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push('/dashboard')
      } else {
        setReady(true)
      }
    })
  }, [router])

  // Fetch featured courses + hero photo
  useEffect(() => {
    if (!ready) return
    fetch('/api/courses/featured')
      .then((r) => r.json())
      .then(async (d) => {
        const courses: FeaturedCourse[] = d.courses ?? []
        setFeaturedCourses(courses)
        // Use first course with a place ID for hero
        const heroCandidate = courses.find((c) => c.google_place_id)
        if (heroCandidate?.google_place_id) {
          const url = await fetchPhoto(heroCandidate.google_place_id)
          setHeroPhoto(url)
        }
      })
      .catch(() => {})
  }, [ready])

  // Loading flash
  if (!ready) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--green-deep)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          border: '2px solid rgba(196,168,79,0.2)', borderTopColor: 'var(--gold)',
          animation: 'landing-spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes landing-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'var(--font-sans)' }}>

      {/* ── Sticky Nav ─────────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(26,46,26,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '0 48px', height: '64px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/" style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: 'var(--gold-light)', letterSpacing: '0.02em', textDecoration: 'none' }}>
          Greenlit
        </Link>

        {/* Desktop links */}
        <div className="landing-desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <Link href="/courses" style={{ fontSize: '12px', color: 'rgba(245,240,232,0.6)', textDecoration: 'none', letterSpacing: '0.04em', fontWeight: 400 }}>
            Courses
          </Link>
          <Link href="/login" style={{ fontSize: '12px', color: 'rgba(245,240,232,0.6)', textDecoration: 'none', letterSpacing: '0.04em', fontWeight: 400 }}>
            Sign In
          </Link>
          <Link href="/signup" style={{
            padding: '8px 18px', borderRadius: 'var(--radius-sm)',
            background: 'var(--gold)', color: 'var(--green-deep)',
            fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', textDecoration: 'none',
          }}>
            Get Started
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="landing-mobile-hamburger"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{
            display: 'none', background: 'none', border: 'none',
            color: 'var(--gold-light)', fontSize: '24px', cursor: 'pointer',
            padding: '4px',
          }}
          aria-label="Menu"
        >
          {mobileMenuOpen ? '\u2715' : '\u2630'}
        </button>
      </nav>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div
          className="landing-mobile-menu"
          style={{
            position: 'fixed', top: '64px', left: 0, right: 0, zIndex: 99,
            background: 'var(--green-deep)', borderBottom: '1px solid rgba(196,168,79,0.15)',
            padding: '16px 48px', display: 'flex', flexDirection: 'column', gap: '16px',
          }}
        >
          <Link href="/courses" onClick={() => setMobileMenuOpen(false)} style={{ fontSize: '14px', color: 'var(--cream)', textDecoration: 'none' }}>Courses</Link>
          <Link href="/login" onClick={() => setMobileMenuOpen(false)} style={{ fontSize: '14px', color: 'var(--cream)', textDecoration: 'none' }}>Sign In</Link>
          <Link href="/signup" onClick={() => setMobileMenuOpen(false)} style={{
            padding: '10px 20px', borderRadius: 'var(--radius-sm)',
            background: 'var(--gold)', color: 'var(--green-deep)',
            fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', textDecoration: 'none', textAlign: 'center',
          }}>Get Started</Link>
        </div>
      )}


      {/* ── Section 1: Hero ────────────────────────────────────────── */}
      <section style={{
        position: 'relative', height: '100vh', overflow: 'hidden',
        background: heroPhoto ? 'var(--green-deep)' : FALLBACK_GRADIENT,
      }}>
        {/* Background image */}
        {heroPhoto && (
          <img
            src={heroPhoto}
            alt=""
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'center',
            }}
          />
        )}

        {/* Overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: heroPhoto
            ? 'rgba(8, 22, 8, 0.55)'
            : 'linear-gradient(to top, rgba(8,22,8,0.6) 0%, rgba(8,22,8,0.2) 50%, rgba(8,22,8,0.4) 100%)',
        }} />

        {/* Content */}
        <div style={{
          position: 'relative', zIndex: 2, height: '100%',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', padding: '64px 24px 80px',
        }}>
          {/* Eyebrow */}
          <div style={{
            fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase',
            color: 'var(--gold)', fontWeight: 600, marginBottom: '24px',
          }}>
            GOLF TRAVEL, ELEVATED
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily: 'var(--font-serif)', fontSize: 'clamp(40px, 6vw, 72px)',
            color: 'var(--cream)', fontWeight: 600, fontStyle: 'italic',
            lineHeight: 1.1, maxWidth: '800px', marginBottom: '24px',
          }}>
            The golf trip your group has been talking about.
          </h1>

          {/* Subhead */}
          <p style={{
            fontSize: '18px', color: 'rgba(245,240,232,0.7)', fontWeight: 300,
            maxWidth: '560px', lineHeight: 1.7, marginBottom: '40px',
          }}>
            Plan courses, coordinate the crew, and share a beautiful trip report — all in one place.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link
              href="/signup"
              style={{
                padding: '14px 32px', borderRadius: 'var(--radius-sm)',
                background: 'var(--gold)', color: 'var(--green-deep)',
                fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', textDecoration: 'none',
                boxShadow: '0 4px 20px rgba(196,168,79,0.3)',
              }}
            >
              Start Planning Free &rarr;
            </Link>
            <a
              href={BROCHURE_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '14px 28px', borderRadius: 'var(--radius-sm)',
                background: 'transparent', border: '1px solid rgba(255,255,255,0.4)',
                color: '#fff', fontSize: '13px', fontWeight: 500,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                textDecoration: 'none',
              }}
            >
              See an Example
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{
          position: 'absolute', bottom: '32px', left: '50%',
          transform: 'translateX(-50%)', zIndex: 2,
          animation: 'landing-bounce 2s ease-in-out infinite',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </div>
        <style>{`@keyframes landing-bounce { 0%, 100% { transform: translateX(-50%) translateY(0); opacity: 0.7; } 50% { transform: translateX(-50%) translateY(8px); opacity: 1; } }`}</style>
      </section>


      {/* ── Section 2: Brochure Preview ────────────────────────────── */}
      <section style={{ background: 'var(--cream)', padding: 'clamp(64px, 10vw, 120px) 48px' }}>
        <div style={{
          maxWidth: '1200px', margin: '0 auto',
          display: 'grid', gridTemplateColumns: '1fr',
          gap: '48px', alignItems: 'center',
        }}
          className="landing-brochure-grid"
        >
          {/* Left: Text */}
          <div>
            <div style={{
              fontSize: '11px', letterSpacing: '0.25em', textTransform: 'uppercase',
              color: 'var(--gold)', fontWeight: 600, marginBottom: '16px',
            }}>
              THE TRIP REPORT
            </div>
            <h2 style={{
              fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 4vw, 42px)',
              color: 'var(--green-deep)', fontWeight: 700, lineHeight: 1.15,
              marginBottom: '20px',
            }}>
              A brochure your group will actually read.
            </h2>
            <p style={{
              fontSize: '16px', color: 'var(--text-mid)', fontWeight: 400,
              lineHeight: 1.7, marginBottom: '28px', maxWidth: '480px',
            }}>
              When it&apos;s time to get everyone on the same page, Greenlit generates a shareable trip report that looks like it came from a high-end travel agency.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                'Day-by-day itinerary with tee times',
                'Full budget breakdown per person',
                'Shareable link — no login required',
                'Print-ready PDF in one click',
              ].map((item) => (
                <li key={item} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '15px', color: 'var(--text-dark)' }}>
                  <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '16px', lineHeight: '1.4' }}>&#10003;</span>
                  {item}
                </li>
              ))}
            </ul>
            <a
              href={BROCHURE_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block', padding: '12px 24px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--gold)', color: 'var(--gold)',
                fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em',
                textTransform: 'uppercase', textDecoration: 'none',
                background: 'transparent',
              }}
            >
              See the Forest Dunes Brochure &rarr;
            </a>
          </div>

          {/* Right: Browser mockup */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{
              width: '100%', maxWidth: '520px',
              borderRadius: '12px', overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(26,46,26,0.15), 0 8px 24px rgba(26,46,26,0.08)',
              background: '#fff',
            }}>
              {/* Browser chrome */}
              <div style={{
                background: '#f0ede7', padding: '10px 16px',
                display: 'flex', alignItems: 'center', gap: '10px',
                borderBottom: '1px solid var(--cream-dark)',
              }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#e8684a' }} />
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#e8b73a' }} />
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#5ec454' }} />
                </div>
                <div style={{
                  flex: 1, background: '#fff', borderRadius: '6px',
                  padding: '5px 12px', fontSize: '11px', color: 'var(--text-light)',
                  fontFamily: 'var(--font-sans)',
                }}>
                  greenlit.golf/share/...
                </div>
              </div>
              {/* Iframe */}
              <div style={{
                width: '100%', height: '420px', overflow: 'hidden',
                position: 'relative',
              }}>
                <iframe
                  src={BROCHURE_URL}
                  title="Brochure preview"
                  style={{
                    width: '166.67%', height: '166.67%',
                    transform: 'scale(0.6)', transformOrigin: 'top left',
                    border: 'none', pointerEvents: 'none',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* ── Section 3: How It Works ────────────────────────────────── */}
      <section style={{
        background: 'var(--green-deep)', padding: 'clamp(64px, 10vw, 100px) 48px',
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{
            fontSize: '11px', letterSpacing: '0.25em', textTransform: 'uppercase',
            color: 'var(--gold)', fontWeight: 600, marginBottom: '48px',
            textAlign: 'center',
          }}>
            HOW IT WORKS
          </div>

          <div className="landing-steps-grid" style={{
            display: 'grid', gridTemplateColumns: '1fr',
            gap: '40px',
          }}>
            {[
              {
                num: '01',
                title: 'Plan your courses',
                body: 'Browse 300+ courses with the AI concierge. Add them to your trip in seconds.',
              },
              {
                num: '02',
                title: 'Wrangle the crew',
                body: 'Invite your group, set dates, track RSVPs, assign games, split the budget.',
              },
              {
                num: '03',
                title: 'Share the trip',
                body: 'Generate a beautiful brochure and share a link. No app download required.',
              },
            ].map((step, i) => (
              <div key={step.num} style={{
                textAlign: 'center', padding: '0 24px',
                position: 'relative',
              }}>
                {/* Gold divider (desktop only, between items) */}
                {i > 0 && (
                  <div className="landing-step-divider" style={{
                    display: 'none',
                    position: 'absolute', left: 0, top: '10%',
                    width: '1px', height: '80%',
                    background: 'rgba(196,168,79,0.2)',
                  }} />
                )}
                <div style={{
                  fontFamily: 'var(--font-serif)', fontSize: '48px',
                  color: 'var(--gold)', fontWeight: 300, marginBottom: '16px',
                  lineHeight: 1,
                }}>
                  {step.num}
                </div>
                <div style={{
                  fontFamily: 'var(--font-serif)', fontSize: '22px',
                  color: 'var(--cream)', fontWeight: 600, marginBottom: '12px',
                }}>
                  {step.title}
                </div>
                <p style={{
                  fontSize: '15px', color: 'rgba(245,240,232,0.55)',
                  fontWeight: 300, lineHeight: 1.6, maxWidth: '280px',
                  margin: '0 auto',
                }}>
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ── Section 4: Course Directory Teaser ─────────────────────── */}
      <section style={{ background: 'var(--white)', padding: 'clamp(64px, 10vw, 100px) 0' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 48px', marginBottom: '40px' }}>
          <div style={{
            fontSize: '11px', letterSpacing: '0.25em', textTransform: 'uppercase',
            color: 'var(--gold)', fontWeight: 600, marginBottom: '16px',
          }}>
            THE COURSE DIRECTORY
          </div>
          <h2 style={{
            fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 4vw, 36px)',
            color: 'var(--green-deep)', fontWeight: 700, lineHeight: 1.15,
            marginBottom: '16px',
          }}>
            300+ courses, hand-picked for groups.
          </h2>
          <p style={{
            fontSize: '16px', color: 'var(--text-mid)', fontWeight: 400,
            lineHeight: 1.7, maxWidth: '600px',
          }}>
            From Bandon Dunes to St Andrews — every course in our directory is enriched with insider tips, group logistics, and real photos. Your AI concierge knows them all.
          </p>
        </div>

        {featuredCourses.length > 0 && (
          <ScrollStrip>
            {featuredCourses.slice(0, 6).map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </ScrollStrip>
        )}

        <div style={{ padding: '24px 48px 0' }}>
          <Link
            href="/courses"
            style={{
              fontSize: '13px', color: 'var(--green-light)', textDecoration: 'none',
              fontWeight: 500, letterSpacing: '0.04em',
            }}
          >
            Browse all courses &rarr;
          </Link>
        </div>
      </section>


      {/* ── Section 5: Pull Quote ──────────────────────────────────── */}
      <section style={{
        background: 'var(--cream)', padding: 'clamp(64px, 10vw, 100px) 48px',
      }}>
        <div style={{
          maxWidth: '700px', margin: '0 auto', textAlign: 'center',
        }}>
          <div style={{
            fontFamily: 'var(--font-serif)', fontSize: '120px',
            color: 'var(--gold)', lineHeight: 0.6, marginBottom: '24px',
          }}>
            &ldquo;
          </div>
          <blockquote style={{
            fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px, 3vw, 28px)',
            color: 'var(--green-deep)', fontStyle: 'italic', fontWeight: 400,
            lineHeight: 1.5, marginBottom: '24px', padding: 0, border: 'none',
          }}>
            Finally, a golf trip planner that doesn&apos;t look like a spreadsheet.
          </blockquote>
          <div style={{
            fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase',
            color: 'var(--green-light)', fontWeight: 600,
          }}>
            — The Group Chat, Every Trip
          </div>
        </div>
      </section>


      {/* ── Section 6: Final CTA ───────────────────────────────────── */}
      <section style={{
        background: 'var(--green-deep)',
        padding: 'clamp(80px, 12vw, 140px) 48px',
        textAlign: 'center',
      }}>
        <h2 style={{
          fontFamily: 'var(--font-serif)', fontSize: 'clamp(32px, 5vw, 48px)',
          color: 'var(--cream)', fontWeight: 600, lineHeight: 1.15,
          marginBottom: '20px', maxWidth: '640px', margin: '0 auto 20px',
        }}>
          Ready to get the trip out of the group chat?
        </h2>
        <p style={{
          fontSize: '16px', color: 'rgba(245,240,232,0.55)', fontWeight: 300,
          marginBottom: '40px',
        }}>
          Free to start. No credit card required.
        </p>
        <Link
          href="/signup"
          style={{
            display: 'inline-block', padding: '16px 48px',
            borderRadius: 'var(--radius-sm)', background: 'var(--gold)',
            color: 'var(--green-deep)', fontSize: '14px', fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            textDecoration: 'none', maxWidth: '320px', width: '100%',
            boxShadow: '0 4px 20px rgba(196,168,79,0.3)',
            textAlign: 'center',
          }}
        >
          Start Planning Free &rarr;
        </Link>
        <div style={{
          marginTop: '24px', fontSize: '12px',
          color: 'rgba(245,240,232,0.35)', letterSpacing: '0.04em',
        }}>
          Planned with Greenlit &middot; greenlit.golf
        </div>
      </section>


      {/* ── Responsive styles ──────────────────────────────────────── */}
      <style>{`
        /* Desktop: brochure 55/45 grid */
        @media (min-width: 768px) {
          .landing-brochure-grid {
            grid-template-columns: 55fr 45fr !important;
          }
          .landing-steps-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
          .landing-step-divider {
            display: block !important;
          }
        }
        /* Mobile nav toggle */
        @media (max-width: 640px) {
          .landing-desktop-nav {
            display: none !important;
          }
          .landing-mobile-hamburger {
            display: block !important;
          }
        }
      `}</style>
    </div>
  )
}
