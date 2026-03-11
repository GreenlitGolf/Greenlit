'use client'

import React, { useEffect, useState } from 'react'

interface CourseOnProperty {
  name:        string
  holes?:      number
  par?:        number
  description?: string
}

export interface BrochureCourse {
  id:                  string
  slug:                string
  name:                string
  location:            string
  state:               string | null
  tags:                string[]
  rating:              number | null
  price_min:           number | null
  price_max:           number | null
  description:         string | null
  why_its_great:       string[]
  courses_on_property: CourseOnProperty[]
  lodging_on_property: string | null
  lodging_description: string | null
  best_time_to_visit:  string | null
  walking_friendly:    boolean
  caddie_available:    boolean
  google_place_id:     string | null
  tagline:             string | null
  emoji:               string
}

interface Props {
  course:    BrochureCourse
  index:     number   // 0-based, for alternating bg
  isLast:    boolean
}

const GOLD = 'var(--gold)'

export default function BrochureCourseSection({ course, index, isLast }: Props) {
  const [photo, setPhoto] = useState<string | null>(null)
  const bg = index % 2 === 0 ? '#fff' : 'var(--cream)'

  useEffect(() => {
    if (!course.google_place_id) return
    fetch(`/api/course-photos/${course.google_place_id}`)
      .then((r) => r.json())
      .then((d) => { if (d.photos?.[0]) setPhoto(d.photos[0]) })
      .catch(() => {})
  }, [course.google_place_id])

  const priceLabel = course.price_min
    ? course.price_max && course.price_max !== course.price_min
      ? `$${course.price_min}–$${course.price_max}`
      : `From $${course.price_min}`
    : null

  return (
    <section
      className={index > 0 ? 'page-break' : ''}
      style={{ background: bg, paddingBottom: isLast ? 0 : '72px' }}
    >
      {/* Full-width photo strip */}
      <div style={{
        width: '100%', height: '360px', overflow: 'hidden', position: 'relative',
        background: photo ? undefined : 'linear-gradient(135deg, var(--green-mid), var(--green-deep))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {photo ? (
          <img src={photo} alt={course.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
        ) : (
          <span style={{ fontSize: '80px', opacity: 0.4 }}>{course.emoji}</span>
        )}
        {/* Bottom gradient for legibility */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '120px', background: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent)' }} />
      </div>

      {/* Content */}
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 48px 0' }}>

        {/* Course name */}
        <h2 style={{
          fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 4vw, 40px)',
          color: 'var(--green-deep)', fontWeight: 700, lineHeight: 1.15,
          marginBottom: '10px',
        }}>
          {course.name}
        </h2>

        {/* Location + tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '20px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-light)', fontWeight: 300 }}>
            📍 {course.location}{course.state ? `, ${course.state}` : ''}
          </span>
          {course.tags.slice(0, 5).map((tag) => (
            <span key={tag} style={{
              fontSize: '10px', padding: '3px 10px', borderRadius: '20px',
              border: '1px solid var(--cream-dark)', color: 'var(--text-mid)',
              fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
              fontFamily: 'var(--font-sans)',
            }}>
              {tag}
            </span>
          ))}
        </div>

        {/* Key stats row */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '0', background: 'var(--cream)', borderRadius: '10px',
          border: '1px solid var(--cream-dark)', marginBottom: '32px', overflow: 'hidden',
        }}>
          {[
            ['Green Fees',     priceLabel || 'Contact'],
            ['Walking',        course.walking_friendly ? '✓ Friendly' : 'Cart required'],
            ['Caddies',        course.caddie_available ? '✓ Available' : 'Not available'],
            ['Best Season',    course.best_time_to_visit || 'Year-round'],
          ].map(([label, value], i, arr) => (
            <div key={label} style={{
              padding: '14px 16px',
              borderRight: i < arr.length - 1 ? '1px solid var(--cream-dark)' : 'none',
            }}>
              <div style={{ fontSize: '9px', color: 'var(--text-light)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
              <div style={{ fontSize: '13px', color: 'var(--green-deep)', fontWeight: 500 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Description */}
        {course.description && (
          <div style={{ marginBottom: '32px' }}>
            {course.description.split('\n\n').map((para, i) => (
              <p key={i} style={{
                fontSize: '15px', color: 'var(--text-dark)', lineHeight: 1.8,
                fontWeight: 300, margin: i > 0 ? '14px 0 0' : 0,
              }}>
                {para}
              </p>
            ))}
          </div>
        )}

        {/* Why it's great */}
        {course.why_its_great?.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{
              fontFamily: 'var(--font-serif)', fontSize: '18px',
              color: 'var(--green-deep)', fontWeight: 600, marginBottom: '14px',
            }}>
              Why It&apos;s Great for Groups
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {course.why_its_great.map((point, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ color: GOLD, fontSize: '14px', flexShrink: 0, marginTop: '2px' }}>◆</span>
                  <span style={{ fontSize: '14px', color: 'var(--text-dark)', lineHeight: 1.7, fontWeight: 300 }}>{point}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Also on property */}
        {course.courses_on_property?.length > 0 && (
          <div style={{ marginBottom: '28px' }}>
            <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', color: 'var(--green-deep)', fontWeight: 600, marginBottom: '10px' }}>
              Also on Property
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {course.courses_on_property.map((c, i) => (
                <div key={i} style={{ fontSize: '13px', color: 'var(--text-mid)', display: 'flex', gap: '8px' }}>
                  <span style={{ color: GOLD }}>◆</span>
                  <span>
                    <strong style={{ fontWeight: 600, color: 'var(--green-deep)' }}>{c.name}</strong>
                    {c.holes ? ` — ${c.holes} holes` : ''}
                    {c.description ? `. ${c.description}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stay on property */}
        {course.lodging_on_property && course.lodging_description && (
          <div style={{
            background: 'var(--green-deep)', borderRadius: '10px',
            padding: '20px 24px', marginBottom: '8px',
          }}>
            <div style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 700, marginBottom: '6px', fontFamily: 'var(--font-sans)' }}>
              Stay on Property
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', color: 'var(--cream)', fontWeight: 600, marginBottom: '8px' }}>
              {course.lodging_on_property}
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(245,240,232,0.75)', fontWeight: 300, lineHeight: 1.7 }}>
              {course.lodging_description}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
