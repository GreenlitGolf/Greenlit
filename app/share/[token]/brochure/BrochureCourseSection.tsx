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
  course:  BrochureCourse
  index:   number
  isLast:  boolean
}

const GOLD = 'var(--gold)'

// Tag color map for placeholders
const TAG_COLORS: Record<string, string> = {
  'links':         '#2d6a4f',
  'resort':        '#1b4332',
  'public':        '#40916c',
  'private':       '#2d3436',
  'top 100':       '#c4a84f',
  'bucket list':   '#b08d3a',
  'parkland':      '#52796f',
  'heathland':     '#5f7464',
  'championship':  '#1a3c34',
  'coastal':       '#3a86a8',
  'desert':        '#c68b59',
  'mountain':      '#4a6741',
}

function getTagColor(tags: string[]): string {
  for (const tag of tags) {
    const color = TAG_COLORS[tag.toLowerCase()]
    if (color) return color
  }
  return '#2d4a2d' // default green
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// First paragraph, truncated to maxWords
function firstParaTruncated(text: string | null, maxWords = 150): { short: string; full: string; truncated: boolean } {
  if (!text) return { short: '', full: '', truncated: false }
  const firstPara = text.split('\n\n')[0].trim()
  const words = firstPara.split(/\s+/)
  if (words.length <= maxWords) return { short: firstPara, full: text, truncated: false }
  return { short: words.slice(0, maxWords).join(' ') + '\u2026', full: text, truncated: true }
}

// Best Season: first 120 chars max
function truncateSeason(text: string | null): string {
  if (!text) return 'Year-round'
  if (text.length <= 120) return text
  return text.slice(0, 120).trimEnd() + '\u2026'
}

// Also on Property phrase: max 60 chars
function truncatePhrase(desc: string | undefined): string {
  if (!desc) return ''
  if (desc.length <= 60) return desc
  return desc.slice(0, 60).trimEnd() + '\u2026'
}

// Lodging: first 2 sentences
function twoSentences(text: string | null): string {
  if (!text) return ''
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text]
  return sentences.slice(0, 2).join('').trim()
}

export default function BrochureCourseSection({ course, index, isLast }: Props) {
  const [photos, setPhotos]   = useState<string[]>([])
  const [expanded, setExpanded] = useState(false)
  const bg = index % 2 === 0 ? '#fff' : 'var(--cream)'

  useEffect(() => {
    if (!course.google_place_id) return
    fetch(`/api/course-photos/${course.google_place_id}`)
      .then((r) => r.json())
      .then((d) => { if (d.photos?.length) setPhotos(d.photos) })
      .catch(() => {})
  }, [course.google_place_id])

  const heroPhoto = photos[0] || null
  // Photo strip uses indexes 1, 2, 3 (skip 0 which is the hero)
  const stripPhotos = photos.slice(1, 4) // up to 3 additional photos

  const priceLabel = course.price_min
    ? course.price_max && course.price_max !== course.price_min
      ? `$${course.price_min}\u2013$${course.price_max}`
      : `From $${course.price_min}`
    : null

  const { short: descShort, full: descFull, truncated: descTruncated } = firstParaTruncated(course.description)
  const bestSeason   = truncateSeason(course.best_time_to_visit)
  // Defensive: lodging_on_property should be a short name; if it's long (data error), it's the description
  const lodgingName  = (course.lodging_on_property && course.lodging_on_property.length < 80)
    ? course.lodging_on_property
    : null
  const lodgingDesc  = twoSentences(course.lodging_description || course.lodging_on_property)

  // Filter out the lodge from "Also on Property" to prevent duplication
  const onPropertyCourses = (course.courses_on_property || []).filter(
    (c) => c.name !== course.lodging_on_property
  )

  const tagColor = getTagColor(course.tags)
  const initial = course.name.charAt(0).toUpperCase()

  // Build photo strip items: fill to 3 with placeholders
  const photoStripItems: Array<{ type: 'photo'; url: string } | { type: 'placeholder' }> = []
  for (let i = 0; i < 3; i++) {
    if (i < stripPhotos.length) {
      photoStripItems.push({ type: 'photo', url: stripPhotos[i] })
    } else {
      photoStripItems.push({ type: 'placeholder' })
    }
  }

  return (
    <section
      className="page-break"
      style={{ background: bg, paddingBottom: isLast ? 0 : '72px' }}
    >
      {/* Full-bleed photo — 45vh */}
      <div style={{
        width: '100%', height: '45vh', minHeight: '260px', overflow: 'hidden', position: 'relative',
        background: heroPhoto ? undefined : 'linear-gradient(135deg, var(--green-mid), var(--green-deep))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {heroPhoto ? (
          <img src={heroPhoto} alt={course.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
        ) : (
          <span style={{ fontSize: '80px', opacity: 0.4 }}>{course.emoji}</span>
        )}
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

        {/* Stats grid — 4 cells */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '0', background: 'var(--cream)', borderRadius: '10px',
          border: '1px solid var(--cream-dark)', marginBottom: '28px', overflow: 'hidden',
        }}>
          {[
            ['Green Fees',  priceLabel || 'Contact'],
            ['Walking',     course.walking_friendly ? '✓ Friendly' : 'Cart required'],
            ['Caddies',     course.caddie_available ? '✓ Available' : 'Not available'],
            ['Best Season', bestSeason],
          ].map(([label, value], i, arr) => (
            <div key={label} style={{
              padding: '14px 16px',
              borderRight: i < arr.length - 1 ? '1px solid var(--cream-dark)' : 'none',
            }}>
              <div style={{ fontSize: '9px', color: 'var(--text-light)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
              <div style={{ fontSize: '13px', color: 'var(--green-deep)', fontWeight: 500, lineHeight: 1.4 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Pull quote — italic standfirst, first paragraph ≤ 150 words */}
        {descShort && (
          <div style={{ marginBottom: '32px' }}>
            <p style={{
              fontFamily: 'var(--font-serif)', fontStyle: 'italic',
              fontSize: '16px', color: 'var(--text-dark)', lineHeight: 1.75,
              fontWeight: 400, margin: 0,
              borderLeft: '3px solid var(--gold)', paddingLeft: '20px',
            }}>
              {expanded
                ? descFull.split('\n\n').map((para, i) => (
                    <span key={i}>{i > 0 && <><br /><br /></>}{para}</span>
                  ))
                : descShort}
            </p>
            {descTruncated && (
              <button
                onClick={() => setExpanded(!expanded)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '12px', color: 'var(--green-mid)', fontWeight: 500,
                  marginTop: '8px', paddingLeft: '23px', fontFamily: 'var(--font-sans)',
                }}
              >
                {expanded ? '\u2190 Show less' : 'Read more \u2192'}
              </button>
            )}
          </div>
        )}

        {/* Photo strip — 3 images (or placeholders) below description */}
        <div className="photo-strip" style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px', marginBottom: '28px', borderRadius: '8px', overflow: 'hidden',
        }}>
          {photoStripItems.map((item, i) => (
            <div key={i} style={{
              height: '200px', borderRadius: '6px', overflow: 'hidden',
              position: 'relative',
            }}>
              {item.type === 'photo' ? (
                <img
                  src={item.url}
                  alt={`${course.name} photo ${i + 2}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{
                  width: '100%', height: '100%',
                  background: hexToRgba(tagColor, 0.2),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{
                    fontFamily: 'var(--font-serif)', fontSize: '48px',
                    color: hexToRgba(tagColor, 0.6), fontWeight: 700,
                  }}>
                    {initial}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Also on Property — compact, one line each */}
        {onPropertyCourses.length > 0 && (
          <div style={{ marginBottom: '28px' }}>
            <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', color: 'var(--green-deep)', fontWeight: 600, marginBottom: '10px' }}>
              Also on Property
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {onPropertyCourses.map((c, i) => {
                const phrase = truncatePhrase(c.description) || (c.holes ? `${c.holes} holes` : '')
                return (
                  <div key={i} style={{ fontSize: '13px', color: 'var(--text-mid)', display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                    <span style={{ color: GOLD, flexShrink: 0 }}>◆</span>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <strong style={{ fontWeight: 600, color: 'var(--green-deep)' }}>{c.name}</strong>
                      {c.holes ? ` \u2014 ${c.holes} holes` : ''}
                      {phrase && !phrase.includes('holes') ? ` · ${phrase}` : ''}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Stay on Property — only if lodging_on_property is set */}
        {(lodgingName || lodgingDesc) && (
          <div style={{
            background: 'var(--green-deep)', borderRadius: '10px',
            padding: '20px 24px', marginBottom: '8px',
          }}>
            <div style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 700, marginBottom: '6px', fontFamily: 'var(--font-sans)' }}>
              Stay on Property
            </div>
            {lodgingName && (
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', color: 'var(--cream)', fontWeight: 600, marginBottom: '8px' }}>
                {lodgingName}
              </div>
            )}
            <div style={{ fontSize: '13px', color: 'rgba(245,240,232,0.75)', fontWeight: 300, lineHeight: 1.7 }}>
              {lodgingDesc}
            </div>
          </div>
        )}

      </div>
    </section>
  )
}
