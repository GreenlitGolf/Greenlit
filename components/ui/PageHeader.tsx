import React from 'react'

interface PageHeaderProps {
  eyebrow:   string
  title:     string
  subtitle?: string
  action?:   React.ReactNode
}

export default function PageHeader({ eyebrow, title, subtitle, action }: PageHeaderProps) {
  return (
    <div
      style={{
        padding:    '40px 48px 28px',
        borderBottom: '1px solid var(--cream-dark)',
        background: 'var(--white)',
        position:   'sticky',
        top:        0,
        zIndex:     10,
        display:    'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
      }}
    >
      <div>
        <div
          style={{
            fontSize:      '10px',
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            color:         'var(--green-light)',
            fontWeight:    600,
            marginBottom:  '6px',
            fontFamily:    'var(--font-sans)',
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize:   '30px',
            color:      'var(--green-deep)',
            fontWeight: 600,
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize:   '13px',
              color:      'var(--text-light)',
              marginTop:  '4px',
              fontWeight: 300,
              fontFamily: 'var(--font-sans)',
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
