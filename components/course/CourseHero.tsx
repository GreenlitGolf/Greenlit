'use client'

import { useEffect, useState } from 'react'

interface CourseHeroProps {
  name:          string
  location:      string
  tagline:       string
  emoji:         string
  googlePlaceId: string | null
  isFeatured?:   boolean
  gdRanking?:    number | null
}

export default function CourseHero({ name, location, tagline, emoji, googlePlaceId, isFeatured, gdRanking }: CourseHeroProps) {
  const [photos,       setPhotos]       = useState<string[]>([])
  const [activePhoto,  setActivePhoto]  = useState(0)
  const [photosLoaded, setPhotosLoaded] = useState(false)

  useEffect(() => {
    if (!googlePlaceId) { setPhotosLoaded(true); return }

    fetch(`/api/course-photos/${googlePlaceId}`)
      .then((r) => r.json())
      .then((d) => {
        setPhotos(d.photos ?? [])
        setPhotosLoaded(true)
      })
      .catch(() => setPhotosLoaded(true))
  }, [googlePlaceId])

  const hasPhotos = photos.length > 0

  return (
    <div
      style={{
        position:     'relative',
        width:        '100%',
        height:       '480px',
        overflow:     'hidden',
        borderRadius: '0',
        flexShrink:   0,
      }}
    >
      {/* Background — photo or gradient fallback */}
      {hasPhotos ? (
        <>
          {photos.map((src, i) => (
            <img
              key={src}
              src={src}
              alt={`${name} photo ${i + 1}`}
              style={{
                position:   'absolute',
                inset:      0,
                width:      '100%',
                height:     '100%',
                objectFit:  'cover',
                opacity:    i === activePhoto ? 1 : 0,
                transition: 'opacity 0.6s ease',
              }}
            />
          ))}
        </>
      ) : (
        <div
          style={{
            position:   'absolute',
            inset:      0,
            background: 'linear-gradient(135deg, var(--green-deep) 0%, var(--green-mid) 60%, var(--green-light) 100%)',
          }}
        />
      )}

      {/* Dark gradient overlay for text legibility */}
      <div
        style={{
          position:   'absolute',
          inset:      0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.1) 100%)',
        }}
      />

      {/* Emoji badge (shown when no photos) */}
      {!hasPhotos && photosLoaded && (
        <div
          style={{
            position:       'absolute',
            top:            '50%',
            left:           '50%',
            transform:      'translate(-50%, -60%)',
            fontSize:       '80px',
            lineHeight:     1,
            filter:         'drop-shadow(0 4px 16px rgba(0,0,0,0.3))',
            userSelect:     'none',
          }}
        >
          {emoji}
        </div>
      )}

      {/* Course info overlay */}
      <div
        style={{
          position:   'absolute',
          bottom:     0,
          left:       0,
          right:      0,
          padding:    '32px 48px',
        }}
      >
        <div
          style={{
            fontSize:      '11px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color:         'rgba(245,240,232,0.65)',
            fontWeight:    500,
            marginBottom:  '8px',
          }}
        >
          {location}
        </div>
        <h1
          style={{
            fontFamily:   'var(--font-serif)',
            fontSize:     'clamp(28px, 4vw, 44px)',
            fontWeight:   600,
            color:        '#fff',
            lineHeight:   1.15,
            marginBottom: '12px',
            textShadow:   '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          {name}
        </h1>
        {isFeatured && gdRanking && (
          <div
            style={{
              display:       'inline-flex',
              alignItems:    'center',
              gap:           '6px',
              padding:       '5px 14px',
              borderRadius:  '99px',
              background:    'rgba(26,46,26,0.7)',
              border:        '1px solid rgba(196,168,79,0.4)',
              backdropFilter:'blur(8px)',
              marginBottom:  '12px',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.06em' }}>
              Golf Digest Top 100 Public
            </span>
            <span style={{ fontSize: '11px', color: 'rgba(196,168,79,0.5)' }}>·</span>
            <span style={{ fontSize: '12px', color: 'var(--gold)', fontWeight: 700, fontFamily: 'var(--font-serif)' }}>
              #{gdRanking}
            </span>
          </div>
        )}
        <p
          style={{
            fontSize:   '15px',
            color:      'rgba(245,240,232,0.85)',
            fontWeight: 300,
            lineHeight: 1.5,
            maxWidth:   '600px',
            fontStyle:  'italic',
          }}
        >
          {tagline}
        </p>
      </div>

      {/* Photo dot navigation */}
      {photos.length > 1 && (
        <div
          style={{
            position:       'absolute',
            bottom:         '16px',
            right:          '24px',
            display:        'flex',
            gap:            '6px',
            alignItems:     'center',
          }}
        >
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={() => setActivePhoto(i)}
              style={{
                width:        i === activePhoto ? '20px' : '6px',
                height:       '6px',
                borderRadius: '99px',
                background:   i === activePhoto ? '#fff' : 'rgba(255,255,255,0.4)',
                border:       'none',
                cursor:       'pointer',
                padding:      0,
                transition:   'all 0.3s',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
