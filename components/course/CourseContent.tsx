'use client'

import { useEffect, useState } from 'react'

interface CourseOnProperty {
  name:        string
  par:         number
  holes:       number
  description: string
}

interface CourseContentProps {
  description:        string
  whyItsGreat:        string[]
  coursesOnProperty:  CourseOnProperty[]
  youtubeSearchQuery: string | null
}

export default function CourseContent({
  description,
  whyItsGreat,
  coursesOnProperty,
  youtubeSearchQuery,
}: CourseContentProps) {
  const [embedUrl,   setEmbedUrl]   = useState<string | null>(null)
  const [videoState, setVideoState] = useState<'loading' | 'found' | 'none'>('loading')

  useEffect(() => {
    if (!youtubeSearchQuery) { setVideoState('none'); return }
    fetch(`/api/course-video?q=${encodeURIComponent(youtubeSearchQuery)}`)
      .then((r) => r.json())
      .then((d) => {
        setEmbedUrl(d.embedUrl ?? null)
        setVideoState(d.has_video ? 'found' : 'none')
      })
      .catch(() => setVideoState('none'))
  }, [youtubeSearchQuery])

  const paragraphs = description
    .split('\n\n')
    .map((p) => p.trim())
    .filter(Boolean)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>

      {/* Description */}
      <section>
        <SectionLabel>About the Course</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {paragraphs.map((p, i) => (
            <p
              key={i}
              style={{
                fontSize:   '15px',
                color:      'var(--text-body)',
                lineHeight: 1.75,
                fontWeight: 300,
                margin:     0,
              }}
            >
              {p}
            </p>
          ))}
        </div>
      </section>

      {/* Why it's great for groups */}
      {whyItsGreat.length > 0 && (
        <section>
          <SectionLabel>Why It&apos;s Great for Groups</SectionLabel>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {whyItsGreat.map((bullet, i) => (
              <li
                key={i}
                style={{
                  display:    'flex',
                  gap:        '14px',
                  alignItems: 'flex-start',
                }}
              >
                <span
                  style={{
                    color:      'var(--gold)',
                    fontSize:   '14px',
                    lineHeight: '1.75',
                    flexShrink: 0,
                    marginTop:  '1px',
                  }}
                >
                  ✦
                </span>
                <span
                  style={{
                    fontSize:   '14px',
                    color:      'var(--text-body)',
                    lineHeight: 1.65,
                    fontWeight: 300,
                  }}
                >
                  {bullet}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Courses on property */}
      {coursesOnProperty.length > 0 && (
        <section>
          <SectionLabel>Courses on Property</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {coursesOnProperty.map((c, i) => (
              <div
                key={i}
                style={{
                  background:   'var(--white)',
                  border:       '1px solid var(--cream-dark)',
                  borderRadius: 'var(--radius-md)',
                  padding:      '16px 20px',
                  display:      'flex',
                  gap:          '16px',
                  alignItems:   'flex-start',
                }}
              >
                <div
                  style={{
                    width:          '36px',
                    height:         '36px',
                    borderRadius:   'var(--radius-sm)',
                    background:     'var(--cream)',
                    border:         '1px solid var(--cream-dark)',
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    fontSize:       '16px',
                    flexShrink:     0,
                  }}
                >
                  ⛳
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-serif)',
                        fontSize:   '14px',
                        fontWeight: 600,
                        color:      'var(--green-deep)',
                      }}
                    >
                      {c.name}
                    </span>
                    {c.holes > 0 && (
                      <span
                        style={{
                          fontSize:      '11px',
                          color:         'var(--text-light)',
                          fontWeight:    400,
                          letterSpacing: '0.04em',
                        }}
                      >
                        {c.holes} holes · Par {c.par}
                      </span>
                    )}
                  </div>
                  <p
                    style={{
                      fontSize:   '13px',
                      color:      'var(--text-light)',
                      fontWeight: 300,
                      lineHeight: 1.5,
                      margin:     0,
                    }}
                  >
                    {c.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* YouTube embed — only shown when the API confirmed a relevant video */}
      {videoState === 'found' && embedUrl && (
        <section>
          <SectionLabel>Watch the Course</SectionLabel>
          <div
            style={{
              position:     'relative',
              paddingTop:   '56.25%', // 16:9
              borderRadius: 'var(--radius-lg)',
              overflow:     'hidden',
              background:   'var(--green-deep)',
            }}
          >
            <iframe
              src={embedUrl}
              title="Course video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{
                position: 'absolute',
                top:      0,
                left:     0,
                width:    '100%',
                height:   '100%',
                border:   'none',
              }}
            />
          </div>
        </section>
      )}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display:       'flex',
        alignItems:    'center',
        gap:           '12px',
        marginBottom:  '20px',
      }}
    >
      <span
        style={{
          fontFamily:    'var(--font-serif)',
          fontSize:      '18px',
          fontWeight:    600,
          color:         'var(--green-deep)',
          letterSpacing: '0.01em',
        }}
      >
        {children}
      </span>
      <span
        style={{
          flex:       1,
          height:     '1px',
          background: 'var(--cream-dark)',
        }}
      />
    </div>
  )
}
