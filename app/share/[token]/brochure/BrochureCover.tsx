'use client'

import React, { useEffect, useState } from 'react'

interface Props {
  tripName:    string
  destination: string | null
  startDate:   string | null
  endDate:     string | null
  tagline:     string | null
  coverUrl:    string | null   // organizer group photo
  placeId:     string | null   // first course Google Place ID
  emoji:       string
  year:        number
}

function fmtRange(start: string | null, end: string | null): string {
  if (!start) return ''
  const s = new Date(start + 'T12:00:00')
  const e = end ? new Date(end + 'T12:00:00') : null
  const mo = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  if (!e) return s.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  if (s.getFullYear() === e.getFullYear()) return `${mo(s)} – ${mo(e)}, ${s.getFullYear()}`
  return `${mo(s)}, ${s.getFullYear()} – ${mo(e)}, ${e.getFullYear()}`
}

export default function BrochureCover({ tripName, destination, startDate, endDate, tagline, coverUrl, placeId, emoji, year }: Props) {
  const [photo, setPhoto] = useState<string | null>(null)

  useEffect(() => {
    if (!placeId) return
    fetch(`/api/course-photos/${placeId}`)
      .then((r) => r.json())
      .then((d) => { if (d.photos?.[0]) setPhoto(d.photos[0]) })
      .catch(() => {})
  }, [placeId])

  const hasPhoto = !!photo
  const dateRange = fmtRange(startDate, endDate)

  return (
    <section
      className="cover-section"
      style={{
        position:    'relative',
        minHeight:   '100vh',
        display:     'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        overflow:    'hidden',
        background:  hasPhoto ? 'var(--green-deep)' : 'linear-gradient(160deg, #1a2e1a 0%, #2d4a2d 40%, #1a2e1a 100%)',
      }}
    >
      {/* Hero photo */}
      {photo && (
        <img
          src={photo}
          alt=""
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center',
          }}
        />
      )}

      {/* Emoji fallback */}
      {!photo && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: '120px', opacity: 0.12,
        }}>
          {emoji}
        </div>
      )}

      {/* Dark gradient overlay */}
      <div style={{
        position:   'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.05) 100%)',
      }} />

      {/* Group photo inset (circular, bottom right) */}
      {coverUrl && (
        <div style={{
          position: 'absolute', bottom: '48px', right: '48px',
          width: '120px', height: '120px', borderRadius: '50%',
          border: '3px solid rgba(196,168,79,0.7)',
          overflow: 'hidden', zIndex: 2,
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        }}>
          <img src={coverUrl} alt="Group" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}

      {/* Text overlay — bottom left */}
      <div style={{ position: 'relative', zIndex: 2, padding: '64px 64px 64px' }}>
        <div style={{
          fontSize: '11px', letterSpacing: '0.28em', textTransform: 'uppercase',
          color: 'var(--gold)', fontWeight: 600, marginBottom: '16px',
          fontFamily: 'var(--font-sans)',
        }}>
          Golf Trip · {year}
        </div>

        <h1 style={{
          fontFamily: 'var(--font-serif)', fontSize: 'clamp(48px, 7vw, 84px)',
          color: '#fff', fontWeight: 700, lineHeight: 1.1,
          marginBottom: '16px', maxWidth: '700px',
          textShadow: '0 2px 12px rgba(0,0,0,0.4)',
        }}>
          {tripName}
        </h1>

        {(destination || dateRange) && (
          <div style={{
            fontSize: '16px', color: 'rgba(255,255,255,0.82)', fontWeight: 300,
            marginBottom: tagline ? '12px' : 0, fontFamily: 'var(--font-sans)',
          }}>
            {[destination, dateRange].filter(Boolean).join('  ·  ')}
          </div>
        )}

        {tagline && (
          <div style={{
            fontFamily: 'var(--font-serif)', fontStyle: 'italic',
            color: 'var(--gold-light)', fontSize: '20px',
          }}>
            {tagline}
          </div>
        )}
      </div>
    </section>
  )
}
