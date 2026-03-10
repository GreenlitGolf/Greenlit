import React from 'react'

// ─── Root ─────────────────────────────────────────────────────────────────
interface CardProps {
  children: React.ReactNode
  style?:   React.CSSProperties
}

export default function Card({ children, style }: CardProps) {
  return (
    <div
      style={{
        background:   'var(--white)',
        borderRadius: 'var(--radius-lg)',
        border:       '1px solid var(--cream-dark)',
        overflow:     'hidden',
        transition:   'box-shadow 0.2s',
        ...style,
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-card)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
      }}
    >
      {children}
    </div>
  )
}

// ─── Image / Emoji Slot ───────────────────────────────────────────────────
interface CardMediaProps {
  emoji?:  string
  height?: number
  style?:  React.CSSProperties
}

export function CardMedia({ emoji, height = 160, style }: CardMediaProps) {
  return (
    <div
      style={{
        width:           '100%',
        height:          `${height}px`,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        fontSize:        '48px',
        background:      'linear-gradient(135deg, var(--green-mid), var(--green-light))',
        ...style,
      }}
    >
      {emoji}
    </div>
  )
}

// ─── Body ─────────────────────────────────────────────────────────────────
export function CardBody({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ padding: '20px', ...style }}>
      {children}
    </div>
  )
}

// ─── Title ────────────────────────────────────────────────────────────────
export function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-serif)',
        fontSize:   '17px',
        color:      'var(--green-deep)',
        marginBottom: '4px',
      }}
    >
      {children}
    </div>
  )
}

// ─── Meta ─────────────────────────────────────────────────────────────────
export function CardMeta({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: '12px', color: 'var(--text-light)', fontWeight: 300 }}>
      {children}
    </div>
  )
}

// ─── Tags row ─────────────────────────────────────────────────────────────
export function CardTags({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '10px 0' }}>
      {children}
    </div>
  )
}

// ─── Price ────────────────────────────────────────────────────────────────
export function CardPrice({ value, unit }: { value: string | number; unit?: string }) {
  return (
    <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--green-deep)', marginTop: '8px' }}>
      {value}
      {unit && (
        <span style={{ fontSize: '12px', fontWeight: 300, color: 'var(--text-light)', marginLeft: '2px' }}>
          {unit}
        </span>
      )}
    </div>
  )
}
