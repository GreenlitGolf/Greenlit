'use client'

import React from 'react'
import Link from 'next/link'

export interface NavItem {
  id:      string
  icon:    string
  label:   string
  href:    string
  badge?:  number   // optional count badge shown on the right
  section?: string  // if set, render a section label before this item
}

interface MemberAvatar {
  initials: string
  color:    string
}

interface SidebarProps {
  navItems:     NavItem[]
  activeId:     string
  tripName?:    string
  tripMeta?:    string
  groupName?:   string
  members?:     MemberAvatar[]
  onItemClick?: (id: string) => void  // if set, renders buttons instead of Links
}

const NOISE_BG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E")`

export default function Sidebar({
  navItems,
  activeId,
  tripName    = 'My Trip',
  tripMeta    = '',
  groupName   = 'Your Group',
  members     = [],
  onItemClick,
}: SidebarProps) {
  const divider: React.CSSProperties = {
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  }

  return (
    <aside
      style={{
        width:         '260px',
        minWidth:      '260px',
        background:    'var(--green-deep)',
        display:       'flex',
        flexDirection: 'column',
        height:        '100vh',
        position:      'sticky',
        top:           0,
        overflow:      'hidden',
      }}
    >
      {/* Grain texture overlay */}
      <div
        aria-hidden
        style={{
          position:        'absolute',
          inset:           0,
          backgroundImage: NOISE_BG,
          opacity:         0.4,
          pointerEvents:   'none',
          zIndex:          0,
        }}
      />

      {/* Logo */}
      <div style={{ padding: '32px 28px 24px', ...divider, position: 'relative', zIndex: 1 }}>
        <Link href="/dashboard" style={{ textDecoration: 'none' }}>
          <div
            style={{
              fontFamily:    'var(--font-serif)',
              fontSize:      '22px',
              color:         'var(--gold-light)',
              letterSpacing: '0.02em',
              lineHeight:    1.2,
            }}
          >
            Greenlit
          </div>
          <div
            style={{
              fontSize:      '10px',
              color:         'var(--green-muted)',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              marginTop:     '4px',
              fontWeight:    500,
              fontFamily:    'var(--font-sans)',
            }}
          >
            Golf Trip Planner
          </div>
        </Link>
      </div>

      {/* Current trip */}
      {tripName && (
        <div style={{ padding: '20px 28px', ...divider, position: 'relative' }}>
          <div
            style={{
              fontSize:      '9px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color:         'var(--green-muted)',
              marginBottom:  '6px',
              fontWeight:    600,
              fontFamily:    'var(--font-sans)',
            }}
          >
            Current Trip
          </div>
          <div
            style={{
              fontFamily:  'var(--font-serif)',
              fontSize:    '16px',
              color:       'var(--cream)',
              fontStyle:   'italic',
            }}
          >
            {tripName}
          </div>
          {tripMeta && (
            <div
              style={{
                fontSize:   '11px',
                color:      'var(--sand)',
                marginTop:  '4px',
                fontWeight: 300,
                fontFamily: 'var(--font-sans)',
              }}
            >
              {tripMeta}
            </div>
          )}
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, padding: '16px 0', position: 'relative' }}>
        {navItems.map((item, idx) => {
          const sectionLabel = item.section ?? (idx === 0 ? 'Plan' : undefined)
          const isActive = item.id === activeId
          const sharedStyle: React.CSSProperties = {
            display:       'flex',
            alignItems:    'center',
            gap:           '12px',
            padding:       '11px 28px',
            cursor:        'pointer',
            fontSize:      '13px',
            fontWeight:    400,
            color:         isActive ? 'var(--gold-light)' : 'rgba(245,240,232,0.65)',
            background:    isActive ? 'rgba(196,168,79,0.1)' : 'transparent',
            letterSpacing: '0.02em',
            position:      'relative',
            transition:    'all 0.2s',
            fontFamily:    'var(--font-sans)',
            width:         '100%',
            textAlign:     'left',
          }
          const indicator = isActive ? (
            <span
              style={{
                position:     'absolute',
                left:         0,
                top:          0,
                bottom:       0,
                width:        '3px',
                background:   'var(--gold)',
                borderRadius: '0 2px 2px 0',
              }}
            />
          ) : null
          const inner = (
            <>
              {indicator}
              <span style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>
                {item.icon}
              </span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span style={{
                  fontSize: '10px', fontWeight: 700, lineHeight: 1,
                  padding: '2px 7px', borderRadius: '20px',
                  background: isActive ? 'rgba(196,168,79,0.3)' : 'rgba(255,255,255,0.12)',
                  color: isActive ? 'var(--gold-light)' : 'rgba(245,240,232,0.6)',
                  fontFamily: 'var(--font-sans)',
                }}>
                  {item.badge}
                </span>
              )}
            </>
          )

          const sectionHeader = sectionLabel ? (
            <div
              key={`section-${item.id}`}
              style={{
                padding:       '12px 28px 6px',
                fontSize:      '9px',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color:         'var(--green-muted)',
                fontWeight:    600,
                fontFamily:    'var(--font-sans)',
                ...(idx > 0 ? { marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' } : {}),
              }}
            >
              {sectionLabel}
            </div>
          ) : null

          if (onItemClick) {
            return (
              <React.Fragment key={item.id}>
                {sectionHeader}
                <button
                  onClick={() => onItemClick(item.id)}
                  style={{ ...sharedStyle, border: 'none' }}
                >
                  {inner}
                </button>
              </React.Fragment>
            )
          }

          return (
            <React.Fragment key={item.id}>
              {sectionHeader}
              <Link
                href={item.href}
                style={{ ...sharedStyle, textDecoration: 'none' }}
              >
                {inner}
              </Link>
            </React.Fragment>
          )
        })}
      </nav>

      {/* Footer avatars */}
      <div
        style={{
          padding:     '20px 28px',
          borderTop:   '1px solid rgba(255,255,255,0.08)',
          position:    'relative',
        }}
      >
        {members.length > 0 && (
          <div style={{ display: 'flex', marginBottom: '8px' }}>
            {members.slice(0, 5).map((m, i) => (
              <div
                key={i}
                style={{
                  width:          '28px',
                  height:         '28px',
                  borderRadius:   '50%',
                  border:         '2px solid var(--green-deep)',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  fontSize:       '10px',
                  fontWeight:     600,
                  marginRight:    '-6px',
                  background:     m.color + '33',
                  color:          'var(--cream)',
                  zIndex:         5 - i,
                  fontFamily:     'var(--font-sans)',
                }}
              >
                {m.initials}
              </div>
            ))}
          </div>
        )}
        <div
          style={{
            fontSize:   '10px',
            color:      'var(--green-muted)',
            fontWeight: 400,
            fontFamily: 'var(--font-sans)',
          }}
        >
          {groupName}
          {members.length > 0 && ` · ${members.length} members`}
        </div>
      </div>
    </aside>
  )
}
