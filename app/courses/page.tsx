'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link                                          from 'next/link'
import { supabase }                                  from '@/lib/supabase'
import { useAuth }                                   from '@/context/AuthContext'
import AddToTripModal                                from '@/components/course/AddToTripModal'

// ── Constants ───────────────────────────────────────────────────────────────────

const COUNTRIES = ['USA', 'Scotland', 'Ireland', 'England', 'Australia', 'Canada']

const TAG_FILTERS = [
  'Links', 'Parkland', 'Desert', 'Mountain', 'Ocean Views',
  'Bucket List', 'Value Play', 'Hidden Gem',
]

const PRICE_RANGES = [
  { label: 'Under $100',  key: '$',    min: 0,   max: 100  },
  { label: '$100–$200',   key: '$$',   min: 100, max: 200  },
  { label: '$200–$500',   key: '$$$',  min: 200, max: 500  },
  { label: '$500+',       key: '$$$$', min: 500, max: 99999 },
]

// ── Types ───────────────────────────────────────────────────────────────────────

type Course = {
  id:               string
  slug:             string
  name:             string
  location:         string
  state:            string | null
  country:          string
  emoji:            string
  tags:             string[]
  rating:           number | null
  price_min:        number | null
  price_max:        number | null
  tagline:          string | null
  description:      string | null
  walking_friendly: boolean
  google_place_id:  string | null
  is_featured:      boolean
  gd_ranking:       number | null
}

// ── CourseCard ───────────────────────────────────────────────────────────────────

function CourseCard({
  course,
  onAddToTrip,
}: {
  course:      Course
  onAddToTrip: (c: Course) => void
}) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [hovered,  setHovered]  = useState(false)

  // Lazy-load first photo
  useEffect(() => {
    if (!course.google_place_id) return
    fetch(`/api/course-photos/${course.google_place_id}`)
      .then(r => r.json())
      .then(data => { if (data.photos?.[0]) setPhotoUrl(data.photos[0]) })
      .catch(() => {})
  }, [course.google_place_id])

  const priceStr =
    course.price_min && course.price_max
      ? course.price_min === course.price_max
        ? `$${course.price_min}`
        : `$${course.price_min}–$${course.price_max}`
      : course.price_min
        ? `From $${course.price_min}`
        : null

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link
        href={`/course/${course.slug}`}
        style={{ textDecoration: 'none', display: 'block' }}
      >
        <div
          style={{
            background:   'var(--white)',
            border:       '1px solid var(--cream-dark)',
            borderRadius: 'var(--radius-lg)',
            overflow:     'hidden',
            transition:   'box-shadow 0.2s, transform 0.2s',
            cursor:       'pointer',
            boxShadow:    hovered ? 'var(--shadow-card)' : 'none',
            transform:    hovered ? 'translateY(-2px)' : 'translateY(0)',
          }}
        >
          {/* Photo */}
          <div style={{
            height:     '180px',
            background: photoUrl
              ? `url(${photoUrl}) center/cover no-repeat`
              : 'linear-gradient(135deg, var(--green-deep) 0%, var(--green-mid) 100%)',
            position:   'relative',
          }}>
            {!photoUrl && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px' }}>
                {course.emoji || '⛳'}
              </div>
            )}
          </div>

          {/* Body */}
          <div style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <div style={{
                fontFamily: 'var(--font-serif)',
                fontSize:   '15px',
                color:      'var(--green-deep)',
                fontWeight: 600,
                lineHeight: 1.3,
                flex:       1,
                minWidth:   0,
              }}>
                {course.name}
              </div>
              {course.is_featured && course.gd_ranking && (
                <span style={{
                  flexShrink:    0,
                  padding:       '2px 8px',
                  borderRadius:  '99px',
                  background:    'var(--green-deep)',
                  color:         'var(--gold)',
                  fontSize:      '9px',
                  fontWeight:    700,
                  letterSpacing: '0.04em',
                  whiteSpace:    'nowrap',
                }}>
                  GD #{course.gd_ranking}
                </span>
              )}
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-light)', fontWeight: 300, marginBottom: '8px' }}>
              📍 {course.location}{course.country ? `, ${course.country}` : ''}
            </div>

            {/* Description preview for featured courses */}
            {course.is_featured && course.description && (
              <div style={{
                fontSize:      '12px',
                color:         'var(--text-mid)',
                fontWeight:    300,
                lineHeight:    1.5,
                marginBottom:  '8px',
                display:       '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow:      'hidden',
              }}>
                {course.description.replace(/<\/?cite[^>]*>/gi, '').split('\n\n')[0]?.slice(0, 150)}
              </div>
            )}

            {/* Price + walking */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              {priceStr && (
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: '13px', color: 'var(--gold)', fontWeight: 600 }}>
                  {priceStr}
                </span>
              )}
              {course.walking_friendly && (
                <span style={{ fontSize: '11px', color: 'var(--green-mid)', fontWeight: 500 }}>
                  🚶 Walking Friendly
                </span>
              )}
            </div>

            {/* Tags */}
            {course.tags?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {course.tags.slice(0, 3).map(tag => (
                  <span
                    key={tag}
                    style={{
                      padding:      '2px 8px',
                      borderRadius: '99px',
                      background:   'var(--cream)',
                      border:       '1px solid var(--cream-dark)',
                      fontSize:     '10px',
                      fontWeight:   500,
                      color:        'var(--green-mid)',
                      letterSpacing:'0.02em',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* + Add to Trip overlay button */}
      {hovered && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAddToTrip(course) }}
          style={{
            position:      'absolute',
            top:           '12px',
            right:         '12px',
            padding:       '6px 12px',
            borderRadius:  'var(--radius-sm)',
            background:    'var(--gold)',
            color:         'var(--green-deep)',
            border:        'none',
            fontSize:      '11px',
            fontWeight:    700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            cursor:        'pointer',
            fontFamily:    'var(--font-sans)',
            boxShadow:     '0 2px 8px rgba(0,0,0,0.2)',
            transition:    'opacity 0.15s',
            zIndex:        5,
          }}
        >
          + Add to Trip
        </button>
      )}
    </div>
  )
}

// ── Filter Pill ─────────────────────────────────────────────────────────────────

function Pill({
  label,
  active,
  onClick,
}: {
  label:   string
  active:  boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding:      '5px 14px',
        borderRadius: '99px',
        border:       active ? '1px solid var(--gold)' : '1px solid var(--cream-dark)',
        background:   active ? 'var(--gold)' : 'var(--white)',
        color:        active ? 'var(--green-deep)' : 'var(--text-light)',
        fontSize:     '12px',
        fontWeight:   active ? 600 : 400,
        cursor:       'pointer',
        fontFamily:   'var(--font-sans)',
        transition:   'all 0.15s',
        whiteSpace:   'nowrap',
      }}
    >
      {label}
    </button>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default function CoursesDirectoryPage() {
  const { session } = useAuth()

  const [allCourses,      setAllCourses]      = useState<Course[]>([])
  const [filtered,        setFiltered]        = useState<Course[]>([])
  const [loading,         setLoading]         = useState(true)
  const [searchTerm,      setSearchTerm]      = useState('')
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const [selectedTags,    setSelectedTags]    = useState<string[]>([])
  const [priceRange,      setPriceRange]      = useState<string | null>(null)
  const [walkingOnly,     setWalkingOnly]     = useState(false)
  const [modalCourse,     setModalCourse]     = useState<Course | null>(null)
  const debounceRef                           = useRef<ReturnType<typeof setTimeout>>(undefined)

  // ── Load courses ──────────────────────────────────────────
  useEffect(() => {
    supabase
      .from('courses')
      .select('id, slug, name, location, state, country, emoji, tags, rating, price_min, price_max, tagline, description, walking_friendly, google_place_id, is_featured, gd_ranking')
      .not('description', 'is', null)
      .order('name', { ascending: true })
      .then(({ data }) => {
        const courses = (data ?? []) as Course[]
        // Sort featured courses first (by ranking), then alphabetically
        courses.sort((a, b) => {
          if (a.is_featured && !b.is_featured) return -1
          if (!a.is_featured && b.is_featured) return 1
          if (a.is_featured && b.is_featured) return (a.gd_ranking ?? 999) - (b.gd_ranking ?? 999)
          return a.name.localeCompare(b.name)
        })
        setAllCourses(courses)
        setFiltered(courses)
        setLoading(false)
      })
  }, [])

  // ── Apply filters ─────────────────────────────────────────
  const applyFilters = useCallback((
    search: string,
    country: string | null,
    tags: string[],
    price: string | null,
    walking: boolean,
    courses: Course[],
  ) => {
    let result = courses

    // Search
    if (search) {
      const term = search.toLowerCase()
      result = result.filter(c =>
        c.name.toLowerCase().includes(term) ||
        c.location.toLowerCase().includes(term) ||
        (c.state ?? '').toLowerCase().includes(term) ||
        (c.country ?? '').toLowerCase().includes(term)
      )
    }

    // Country
    if (country) {
      if (country === 'Other') {
        result = result.filter(c => !COUNTRIES.includes(c.country ?? ''))
      } else {
        result = result.filter(c => c.country === country)
      }
    }

    // Tags (must have ALL selected tags)
    if (tags.length > 0) {
      result = result.filter(c =>
        tags.every(t => (c.tags ?? []).some(ct => ct.toLowerCase().includes(t.toLowerCase())))
      )
    }

    // Price range
    if (price) {
      const range = PRICE_RANGES.find(r => r.key === price)
      if (range) {
        result = result.filter(c => {
          const low = c.price_min ?? 0
          return low >= range.min && low < range.max
        })
      }
    }

    // Walking only
    if (walking) {
      result = result.filter(c => c.walking_friendly)
    }

    setFiltered(result)
  }, [])

  // Re-filter when any filter changes
  useEffect(() => {
    applyFilters(searchTerm, selectedCountry, selectedTags, priceRange, walkingOnly, allCourses)
  }, [searchTerm, selectedCountry, selectedTags, priceRange, walkingOnly, allCourses, applyFilters])

  // Debounced search handler
  function handleSearch(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearchTerm(value)
    }, 300)
  }

  // Tag toggle
  function toggleTag(tag: string) {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const hasActiveFilters = !!selectedCountry || selectedTags.length > 0 || !!priceRange || walkingOnly || !!searchTerm

  function clearAll() {
    setSearchTerm('')
    setSelectedCountry(null)
    setSelectedTags([])
    setPriceRange(null)
    setWalkingOnly(false)
    // Also clear the actual input element
    const input = document.querySelector<HTMLInputElement>('[data-search-input]')
    if (input) input.value = ''
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', fontFamily: 'var(--font-sans)' }}>

      {/* ── Header ──────────────────────────────────────────── */}
      <header style={{
        background:     'var(--green-deep)',
        padding:        '0 48px',
        height:         '64px',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        position:       'sticky',
        top:            0,
        zIndex:         20,
      }}>
        <Link href="/dashboard" style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: 'var(--gold-light)', letterSpacing: '0.02em', textDecoration: 'none' }}>
          Greenlit
        </Link>
        <nav style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <Link href="/dashboard" style={{ fontSize: '12px', color: 'rgba(245,240,232,0.5)', textDecoration: 'none', letterSpacing: '0.04em' }}>
            Dashboard
          </Link>
          <Link href="/courses" style={{ fontSize: '12px', color: 'var(--gold-light)', textDecoration: 'none', letterSpacing: '0.04em', fontWeight: 500 }}>
            Courses
          </Link>
          <Link href="/discover" style={{ fontSize: '12px', color: 'rgba(245,240,232,0.5)', textDecoration: 'none', letterSpacing: '0.04em' }}>
            Concierge
          </Link>
          <Link href="/trips/new" style={{
            padding: '8px 18px', background: 'var(--gold)', color: 'var(--green-deep)',
            borderRadius: 'var(--radius-sm)', fontSize: '11px', fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none', fontFamily: 'var(--font-sans)',
          }}>
            + New Trip
          </Link>
        </nav>
      </header>

      {/* ── Hero ────────────────────────────────────────────── */}
      <div style={{
        background:   'var(--white)',
        borderBottom: '1px solid var(--cream-dark)',
        padding:      '48px 48px 32px',
        textAlign:    'center',
      }}>
        <div style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--green-light)', fontWeight: 600, marginBottom: '8px' }}>
          Course Directory
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '30px', color: 'var(--green-deep)', fontWeight: 600, margin: '0 0 8px' }}>
          Find Your Next Round
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-light)', fontWeight: 300, marginBottom: '24px' }}>
          Browse our curated collection of golf courses, enriched with insider details for group trips.
        </p>

        {/* Search */}
        <div style={{ maxWidth: '480px', margin: '0 auto', position: 'relative' }}>
          <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', color: 'var(--text-light)', pointerEvents: 'none' }}>
            🔍
          </span>
          <input
            data-search-input
            type="text"
            placeholder="Search by course name, location, or country…"
            defaultValue=""
            onChange={e => handleSearch(e.target.value)}
            style={{
              width:        '100%',
              padding:      '12px 16px 12px 40px',
              borderRadius: 'var(--radius-lg)',
              border:       '1px solid var(--cream-dark)',
              background:   'var(--cream)',
              fontSize:     '14px',
              color:        'var(--green-deep)',
              fontFamily:   'var(--font-sans)',
              outline:      'none',
              boxSizing:    'border-box',
            }}
          />
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────── */}
      <div style={{ padding: '20px 48px', borderBottom: '1px solid var(--cream-dark)', background: 'var(--white)' }}>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>

          {/* Country */}
          <div>
            <div style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-light)', fontWeight: 600, marginBottom: '6px' }}>
              Country
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <Pill label="All" active={!selectedCountry} onClick={() => setSelectedCountry(null)} />
              {COUNTRIES.map(c => (
                <Pill key={c} label={c} active={selectedCountry === c} onClick={() => setSelectedCountry(selectedCountry === c ? null : c)} />
              ))}
              <Pill label="Other" active={selectedCountry === 'Other'} onClick={() => setSelectedCountry(selectedCountry === 'Other' ? null : 'Other')} />
            </div>
          </div>

          {/* Tags */}
          <div>
            <div style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-light)', fontWeight: 600, marginBottom: '6px' }}>
              Tags
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {TAG_FILTERS.map(t => (
                <Pill key={t} label={t} active={selectedTags.includes(t)} onClick={() => toggleTag(t)} />
              ))}
            </div>
          </div>

          {/* Price */}
          <div>
            <div style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-light)', fontWeight: 600, marginBottom: '6px' }}>
              Price Range
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <Pill label="Any" active={!priceRange} onClick={() => setPriceRange(null)} />
              {PRICE_RANGES.map(r => (
                <Pill key={r.key} label={r.label} active={priceRange === r.key} onClick={() => setPriceRange(priceRange === r.key ? null : r.key)} />
              ))}
            </div>
          </div>

          {/* Walking + Clear */}
          <div>
            <div style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-light)', fontWeight: 600, marginBottom: '6px' }}>
              Walking
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <Pill label="🚶 Walking Friendly" active={walkingOnly} onClick={() => setWalkingOnly(!walkingOnly)} />
              {hasActiveFilters && (
                <button
                  onClick={clearAll}
                  style={{
                    padding:    '5px 12px',
                    background: 'transparent',
                    border:     'none',
                    color:      '#d97070',
                    fontSize:   '12px',
                    fontWeight: 600,
                    cursor:     'pointer',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  Clear All ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Results ─────────────────────────────────────────── */}
      <div style={{ padding: '24px 48px 60px', maxWidth: '1200px', margin: '0 auto' }}>

        {/* Result count */}
        <div style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '20px', fontWeight: 300 }}>
          Showing {filtered.length} course{filtered.length !== 1 ? 's' : ''}
        </div>

        {/* Loading skeletons */}
        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} style={{
                background: 'var(--white)', borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--cream-dark)', overflow: 'hidden',
              }}>
                <div style={{
                  height: '180px',
                  background: 'linear-gradient(90deg, var(--cream-dark) 25%, var(--cream) 50%, var(--cream-dark) 75%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.5s infinite',
                }} />
                <div style={{ padding: '16px 20px' }}>
                  <div style={{ width: '70%', height: '16px', borderRadius: '4px', background: 'linear-gradient(90deg, var(--cream-dark) 25%, var(--cream) 50%, var(--cream-dark) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', marginBottom: '8px' }} />
                  <div style={{ width: '50%', height: '12px', borderRadius: '4px', background: 'linear-gradient(90deg, var(--cream-dark) 25%, var(--cream) 50%, var(--cream-dark) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', marginBottom: '8px' }} />
                  <div style={{ width: '30%', height: '12px', borderRadius: '4px', background: 'linear-gradient(90deg, var(--cream-dark) 25%, var(--cream) 50%, var(--cream-dark) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                </div>
              </div>
            ))}
            <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div style={{
            textAlign:    'center',
            padding:      '80px 40px',
            background:   'var(--white)',
            borderRadius: 'var(--radius-lg)',
            border:       '1px solid var(--cream-dark)',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: 'var(--green-deep)', marginBottom: '8px' }}>
              No courses match your filters
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-light)', fontWeight: 300, marginBottom: '24px' }}>
              Try adjusting your search or clearing some filters.
            </p>
            <button
              onClick={clearAll}
              style={{
                padding:       '10px 24px',
                borderRadius:  'var(--radius-sm)',
                background:    'var(--gold)',
                color:         'var(--green-deep)',
                border:        'none',
                fontSize:      '12px',
                fontWeight:    600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor:        'pointer',
                fontFamily:    'var(--font-sans)',
              }}
            >
              Clear All Filters
            </button>
          </div>
        )}

        {/* Course grid */}
        {!loading && filtered.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {filtered.map(course => (
              <CourseCard
                key={course.id}
                course={course}
                onAddToTrip={(c) => setModalCourse(c)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Add to Trip Modal ───────────────────────────────── */}
      {modalCourse && session && (
        <AddToTripModal
          courseId={modalCourse.id}
          courseName={modalCourse.name}
          courseLocation={modalCourse.location}
          onClose={() => setModalCourse(null)}
        />
      )}
    </div>
  )
}
