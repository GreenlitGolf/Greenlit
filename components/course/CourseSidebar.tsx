'use client'

import { useState } from 'react'
import AddToTripModal from './AddToTripModal'

interface NearbyLodging {
  name:        string
  type:        string
  price_range: string
  url:         string
}

interface CourseSidebarProps {
  courseId:          string
  courseName:        string
  courseLocation:    string
  courseSlug:        string
  priceMin:          number | null
  priceMax:          number | null
  tags:              string[]
  rating:            number | null
  bestTimeToVisit:   string | null
  walkingFriendly:   boolean
  caddieAvailable:   boolean
  lodgingOnProperty: string | null
  lodgingDescription: string | null
  nearbyLodging:     NearbyLodging[]
}

export default function CourseSidebar({
  courseId,
  courseName,
  courseLocation,
  courseSlug,
  priceMin,
  priceMax,
  tags,
  rating,
  bestTimeToVisit,
  walkingFriendly,
  caddieAvailable,
  lodgingOnProperty,
  lodgingDescription,
  nearbyLodging,
}: CourseSidebarProps) {
  const [modalOpen, setModalOpen] = useState(false)

  const priceStr =
    priceMin && priceMax
      ? priceMin === priceMax
        ? `$${priceMin}`
        : `$${priceMin}–$${priceMax}`
      : priceMin
        ? `From $${priceMin}`
        : null

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Add to Trip CTA */}
        <div
          style={{
            background:   'var(--green-deep)',
            borderRadius: 'var(--radius-lg)',
            padding:      '24px',
            textAlign:    'center',
          }}
        >
          <div
            style={{
              fontSize:      '22px',
              marginBottom:  '8px',
            }}
          >
            ✦
          </div>
          <div
            style={{
              fontFamily:   'var(--font-serif)',
              fontSize:     '16px',
              color:        'var(--gold-light)',
              fontWeight:   600,
              marginBottom: '6px',
            }}
          >
            Ready to play here?
          </div>
          <div
            style={{
              fontSize:     '13px',
              color:        'rgba(245,240,232,0.6)',
              fontWeight:   300,
              marginBottom: '20px',
              lineHeight:   1.5,
            }}
          >
            Add this course to one of your trips.
          </div>
          <button
            onClick={() => setModalOpen(true)}
            style={{
              width:         '100%',
              padding:       '12px 20px',
              background:    'var(--gold)',
              color:         'var(--green-deep)',
              border:        'none',
              borderRadius:  'var(--radius-sm)',
              fontSize:      '12px',
              fontWeight:    700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor:        'pointer',
              fontFamily:    'var(--font-sans)',
              transition:    'opacity 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            + Add to Trip
          </button>
        </div>

        {/* Key Details */}
        <div
          style={{
            background:   'var(--white)',
            border:       '1px solid var(--cream-dark)',
            borderRadius: 'var(--radius-lg)',
            padding:      '20px',
          }}
        >
          <SidebarSectionLabel>Key Details</SidebarSectionLabel>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {priceStr && (
              <DetailRow icon="💰" label="Green Fees">
                <span style={{ fontWeight: 500, color: 'var(--gold)' }}>{priceStr}/person est.</span>
              </DetailRow>
            )}
            {rating != null && (
              <DetailRow icon="⭐" label="Greenlit Rating">
                <span style={{ fontWeight: 500, color: 'var(--green-deep)' }}>{rating.toFixed(1)} / 5.0</span>
              </DetailRow>
            )}
            <DetailRow icon="🚶" label="Walking Friendly">
              <span style={{ fontWeight: 500, color: walkingFriendly ? 'var(--green-mid)' : 'var(--text-light)' }}>
                {walkingFriendly ? 'Yes' : 'Cart recommended'}
              </span>
            </DetailRow>
            <DetailRow icon="🎒" label="Caddies Available">
              <span style={{ fontWeight: 500, color: caddieAvailable ? 'var(--green-mid)' : 'var(--text-light)' }}>
                {caddieAvailable ? 'Yes' : 'No'}
              </span>
            </DetailRow>
            {bestTimeToVisit && (
              <DetailRow icon="📅" label="Best Time to Visit">
                <span style={{ fontWeight: 400, color: 'var(--text-body)', lineHeight: 1.45 }}>
                  {bestTimeToVisit}
                </span>
              </DetailRow>
            )}
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--cream-dark)' }}>
              {tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    padding:       '3px 10px',
                    borderRadius:  '99px',
                    background:    'var(--cream)',
                    fontSize:      '10px',
                    fontWeight:    500,
                    color:         'var(--green-mid)',
                    letterSpacing: '0.03em',
                    fontFamily:    'var(--font-sans)',
                    border:        '1px solid var(--cream-dark)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Lodging on Property */}
        {lodgingOnProperty && (
          <div
            style={{
              background:   'var(--white)',
              border:       '1px solid var(--cream-dark)',
              borderRadius: 'var(--radius-lg)',
              padding:      '20px',
            }}
          >
            <SidebarSectionLabel>Stay on Property</SidebarSectionLabel>
            <div
              style={{
                fontFamily:   'var(--font-serif)',
                fontSize:     '14px',
                fontWeight:   600,
                color:        'var(--green-deep)',
                marginBottom: '8px',
              }}
            >
              {lodgingOnProperty}
            </div>
            {lodgingDescription && (
              <p
                style={{
                  fontSize:   '13px',
                  color:      'var(--text-light)',
                  fontWeight: 300,
                  lineHeight: 1.55,
                  margin:     0,
                }}
              >
                {lodgingDescription}
              </p>
            )}
          </div>
        )}

        {/* Nearby Lodging */}
        {nearbyLodging.length > 0 && (
          <div
            style={{
              background:   'var(--white)',
              border:       '1px solid var(--cream-dark)',
              borderRadius: 'var(--radius-lg)',
              padding:      '20px',
            }}
          >
            <SidebarSectionLabel>Nearby Lodging</SidebarSectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {nearbyLodging.map((lodge, i) => (
                <a
                  key={i}
                  href={lodge.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display:        'flex',
                    justifyContent: 'space-between',
                    alignItems:     'flex-start',
                    padding:        '10px 12px',
                    background:     'var(--cream)',
                    borderRadius:   'var(--radius-sm)',
                    border:         '1px solid var(--cream-dark)',
                    textDecoration: 'none',
                    gap:            '10px',
                    transition:     'border-color 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--gold)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--cream-dark)')}
                >
                  <div>
                    <div
                      style={{
                        fontSize:   '13px',
                        fontWeight: 500,
                        color:      'var(--green-deep)',
                        lineHeight: 1.35,
                        marginBottom: '2px',
                      }}
                    >
                      {lodge.name}
                    </div>
                    <div
                      style={{
                        fontSize:   '11px',
                        color:      'var(--text-light)',
                        fontWeight: 300,
                      }}
                    >
                      {lodge.type}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize:   '12px',
                      fontWeight: 600,
                      color:      'var(--gold)',
                      flexShrink: 0,
                    }}
                  >
                    {lodge.price_range}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add to Trip Modal */}
      {modalOpen && (
        <AddToTripModal
          courseId={courseId}
          courseName={courseName}
          courseLocation={courseLocation}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}

function SidebarSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize:      '10px',
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        color:         'var(--green-light)',
        fontWeight:    600,
        marginBottom:  '14px',
        fontFamily:    'var(--font-sans)',
      }}
    >
      {children}
    </div>
  )
}

function DetailRow({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
      <span style={{ fontSize: '14px', lineHeight: 1.5, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-light)', fontWeight: 500, marginBottom: '2px' }}>
          {label}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-body)', lineHeight: 1.45 }}>
          {children}
        </div>
      </div>
    </div>
  )
}
