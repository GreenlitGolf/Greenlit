import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import CourseHero    from '@/components/course/CourseHero'
import CourseContent from '@/components/course/CourseContent'
import CourseSidebar from '@/components/course/CourseSidebar'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CourseOnProperty {
  name:        string
  par:         number
  holes:       number
  description: string
}

interface NearbyLodging {
  name:        string
  type:        string
  price_range: string
  url:         string
}

interface Course {
  id:                   string
  slug:                 string
  name:                 string
  location:             string
  state:                string | null
  country:              string
  emoji:                string
  tags:                 string[]
  rating:               number | null
  price_min:            number | null
  price_max:            number | null
  tagline:              string | null
  description:          string | null
  why_its_great:        string[]
  courses_on_property:  CourseOnProperty[]
  lodging_on_property:  string | null
  lodging_description:  string | null
  nearby_lodging:       NearbyLodging[]
  best_time_to_visit:   string | null
  walking_friendly:     boolean
  caddie_available:     boolean
  google_place_id:      string | null
  youtube_search_query: string | null
}

// ─── Data Fetching ─────────────────────────────────────────────────────────────

async function getCourse(slug: string): Promise<Course | null> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !data) return null
  return data as Course
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const course = await getCourse(slug)
  if (!course) return { title: 'Course Not Found | Greenlit' }
  return {
    title:       `${course.name} | Greenlit`,
    description: course.tagline ?? `Plan your group golf trip to ${course.name}.`,
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CourseDetailPage({
  params,
  searchParams,
}: {
  params:       Promise<{ slug: string }>
  searchParams: Promise<{ tripId?: string }>
}) {
  const { slug }   = await params
  const { tripId } = await searchParams
  const course     = await getCourse(slug)
  if (!course) notFound()

  const backHref  = tripId ? `/trip/${tripId}` : '/dashboard'
  const backLabel = tripId ? '← Back to Trip' : '← Dashboard'

  return (
    <div
      style={{
        minHeight:  '100vh',
        background: 'var(--cream)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* ── Top Nav ───────────────────────────────────────────── */}
      <header
        style={{
          position:       'sticky',
          top:            0,
          zIndex:         50,
          background:     'var(--green-deep)',
          padding:        '0 48px',
          height:         '64px',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          flexShrink:     0,
        }}
      >
        <Link
          href="/dashboard"
          style={{
            fontFamily:     'var(--font-serif)',
            fontSize:       '20px',
            color:          'var(--gold-light)',
            letterSpacing:  '0.02em',
            textDecoration: 'none',
          }}
        >
          Greenlit
        </Link>

        <nav style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <Link
            href={backHref}
            style={{
              fontSize:       '12px',
              color:          tripId ? 'var(--gold-light)' : 'rgba(245,240,232,0.5)',
              textDecoration: 'none',
              fontWeight:     tripId ? 500 : 400,
              letterSpacing:  '0.04em',
              opacity:        tripId ? 1 : 0.7,
            }}
          >
            {backLabel}
          </Link>
          <Link
            href="/trips/new"
            style={{
              padding:        '8px 18px',
              background:     'var(--gold)',
              color:          'var(--green-deep)',
              borderRadius:   'var(--radius-sm)',
              fontSize:       '11px',
              fontWeight:     700,
              letterSpacing:  '0.08em',
              textTransform:  'uppercase',
              textDecoration: 'none',
              fontFamily:     'var(--font-sans)',
            }}
          >
            + New Trip
          </Link>
        </nav>
      </header>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <CourseHero
        name={course.name}
        location={course.location}
        tagline={course.tagline ?? ''}
        emoji={course.emoji}
        googlePlaceId={course.google_place_id}
      />

      {/* ── Body ──────────────────────────────────────────────── */}
      <div
        style={{
          maxWidth:            '1200px',
          margin:              '0 auto',
          padding:             '48px 24px 80px',
          display:             'grid',
          gridTemplateColumns: '1fr 340px',
          gap:                 '40px',
          alignItems:          'start',
        }}
      >
        {/* Left column — content */}
        <CourseContent
          description={course.description ?? ''}
          whyItsGreat={course.why_its_great ?? []}
          coursesOnProperty={course.courses_on_property ?? []}
          youtubeSearchQuery={course.youtube_search_query}
        />

        {/* Right column — sidebar (sticky) */}
        <div style={{ position: 'sticky', top: '80px' }}>
          <CourseSidebar
            courseId={course.id}
            courseName={course.name}
            courseLocation={course.location}
            courseSlug={course.slug}
            priceMin={course.price_min}
            priceMax={course.price_max}
            tags={course.tags ?? []}
            rating={course.rating}
            bestTimeToVisit={course.best_time_to_visit}
            walkingFriendly={course.walking_friendly}
            caddieAvailable={course.caddie_available}
            lodgingOnProperty={course.lodging_on_property}
            lodgingDescription={course.lodging_description}
            nearbyLodging={course.nearby_lodging ?? []}
          />
        </div>
      </div>
    </div>
  )
}
