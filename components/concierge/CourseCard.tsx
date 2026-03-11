'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export interface CoursePickData {
  name:           string
  location:       string
  price:          string
  emoji:          string
  rating?:        number   // 1–5, decimals OK
  tags:           string[]
  courseId?:      string   // slug for /course/[slug] — present for known courses
  whyItFits?:     string   // one-line personalised note from the concierge
  courseUUID?:    string   // DB UUID for trip_courses insert
  googlePlaceId?: string   // for course photo via Google Places
}

interface CourseCardProps {
  course:       CoursePickData
  onAddToTrip?: (course: CoursePickData) => void
  tripId?:      string   // when inside a trip — appended to View Details URL
  added?:       boolean  // override added state (controlled externally)
}

/** Renders a rating like 4.5 as ★★★★½☆ */
function StarRating({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(5, value))
  const full    = Math.floor(clamped)
  const half    = clamped - full >= 0.25 && clamped - full < 0.75
  const empty   = 5 - full - (half ? 1 : 0)

  return (
    <span
      style={{
        fontSize:    '11px',
        letterSpacing: '1px',
        lineHeight:  1,
        userSelect:  'none',
      }}
    >
      <span style={{ color: 'var(--gold)' }}>{'★'.repeat(full)}</span>
      {half && <span style={{ color: 'var(--gold)' }}>½</span>}
      <span style={{ color: 'var(--cream-dark)' }}>{'★'.repeat(empty)}</span>
    </span>
  )
}

export default function CourseCard({ course, onAddToTrip, tripId, added: addedProp }: CourseCardProps) {
  const [added,    setAdded]    = useState(addedProp ?? false)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  // Sync controlled added state
  useEffect(() => {
    if (addedProp !== undefined) setAdded(addedProp)
  }, [addedProp])

  // Fetch course photo from Google Places if placeId is available
  useEffect(() => {
    if (!course.googlePlaceId) return
    let cancelled = false
    fetch(`/api/course-photos/${encodeURIComponent(course.googlePlaceId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.photos?.[0]) setPhotoUrl(data.photos[0])
      })
      .catch(() => {/* silently ignore — green gradient fallback shows */})
    return () => { cancelled = true }
  }, [course.googlePlaceId])

  function handleAdd() {
    setAdded(true)
    onAddToTrip?.(course)
  }

  return (
    <div
      style={{
        background:    'var(--white)',
        border:        '1px solid var(--cream-dark)',
        borderRadius:  'var(--radius-lg)',
        overflow:      'hidden',
        display:       'flex',
        flexDirection: 'column',
        gap:           0,
        boxShadow:     'var(--shadow-subtle)',
      }}
    >
      {/* Course photo strip */}
      {(photoUrl || course.googlePlaceId) && (
        <div
          style={{
            height:     '140px',
            background: photoUrl
              ? `url(${photoUrl}) center/cover no-repeat`
              : 'linear-gradient(135deg, var(--green-deep), var(--green-mid))',
            position:   'relative',
            flexShrink: 0,
          }}
        >
          {/* Emoji badge overlay when no photo yet */}
          {!photoUrl && (
            <div style={{
              position:  'absolute', inset: 0,
              display:   'flex', alignItems: 'center', justifyContent: 'center',
              fontSize:  '40px',
            }}>
              {course.emoji}
            </div>
          )}
        </div>
      )}

      {/* Card body */}
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          {/* Emoji badge — only when no photo strip */}
          {!course.googlePlaceId && (
            <div
              style={{
                width:          '44px',
                height:         '44px',
                borderRadius:   'var(--radius-md)',
                background:     'linear-gradient(135deg, var(--green-mid), var(--green-light))',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                fontSize:       '22px',
                flexShrink:     0,
              }}
            >
              {course.emoji}
            </div>
          )}

          {/* Name + location */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily:   'var(--font-serif)',
                fontSize:     '15px',
                color:        'var(--green-deep)',
                fontWeight:   600,
                lineHeight:   1.3,
                marginBottom: '3px',
              }}
            >
              {course.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-light)', fontWeight: 300 }}>
                📍 {course.location}
              </span>
              {course.rating != null && (
                <>
                  <span style={{ color: 'var(--cream-dark)', fontSize: '10px' }}>·</span>
                  <StarRating value={course.rating} />
                  <span style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: 300 }}>
                    {course.rating.toFixed(1)}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Price */}
          <div
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize:   '13px',
              color:      'var(--gold)',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {course.price}
          </div>
        </div>

        {/* Tags */}
        {course.tags.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {course.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  padding:       '3px 9px',
                  borderRadius:  '99px',
                  background:    'var(--cream-dark)',
                  fontSize:      '10px',
                  fontWeight:    500,
                  color:         'var(--green-mid)',
                  letterSpacing: '0.03em',
                  fontFamily:    'var(--font-sans)',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Why it fits */}
        {course.whyItFits && (
          <div
            style={{
              fontSize:    '12px',
              color:       'var(--text-mid)',
              fontStyle:   'italic',
              lineHeight:  1.5,
              fontWeight:  300,
              borderTop:   '1px solid var(--cream-dark)',
              paddingTop:  '8px',
            }}
          >
            {course.whyItFits}
          </div>
        )}

        {/* Action row */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleAdd}
            disabled={added}
            style={{
              padding:       '7px 16px',
              borderRadius:  'var(--radius-sm)',
              background:    added ? 'var(--green-light)' : 'var(--gold)',
              color:         added ? '#fff' : 'var(--green-deep)',
              fontSize:      '11px',
              fontWeight:    600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              border:        'none',
              cursor:        added ? 'default' : 'pointer',
              fontFamily:    'var(--font-sans)',
              transition:    'all 0.2s',
            }}
          >
            {added ? '✓ Added' : '+ Add to Trip'}
          </button>

          {course.courseId && (
            <Link
              href={`/course/${course.courseId}${tripId ? `?tripId=${tripId}` : ''}`}
              style={{
                padding:        '7px 14px',
                borderRadius:   'var(--radius-sm)',
                border:         '1px solid var(--cream-dark)',
                background:     'transparent',
                color:          'var(--green-mid)',
                fontSize:       '11px',
                fontWeight:     500,
                letterSpacing:  '0.04em',
                textDecoration: 'none',
                fontFamily:     'var(--font-sans)',
                transition:     'border-color 0.15s',
                display:        'inline-block',
              }}
            >
              View Details →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
