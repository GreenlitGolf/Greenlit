import React from 'react'

interface StatCardProps {
  label:    string
  value:    string | number
  sub?:     string
  style?:   React.CSSProperties
  valueStyle?: React.CSSProperties
}

export default function StatCard({ label, value, sub, style, valueStyle }: StatCardProps) {
  return (
    <div
      style={{
        background:   'var(--white)',
        border:       '1px solid var(--cream-dark)',
        borderRadius: 'var(--radius-lg)',
        padding:      '18px 20px',
        ...style,
      }}
    >
      <div
        style={{
          fontSize:      '10px',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color:         'var(--text-light)',
          fontWeight:    600,
          marginBottom:  '6px',
          fontFamily:    'var(--font-sans)',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize:   '26px',
          color:      'var(--green-deep)',
          ...valueStyle,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontSize:   '11px',
            color:      'var(--green-muted)',
            marginTop:  '2px',
            fontWeight: 300,
            fontFamily: 'var(--font-sans)',
          }}
        >
          {sub}
        </div>
      )}
    </div>
  )
}
