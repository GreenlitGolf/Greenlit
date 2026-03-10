import React from 'react'

interface TagProps {
  children: React.ReactNode
  variant?: 'default' | 'gold'
}

const styles: Record<'default' | 'gold', React.CSSProperties> = {
  default: {
    background: 'var(--cream-dark)',
    color:      'var(--green-mid)',
  },
  gold: {
    background: 'rgba(196,168,79,0.15)',
    color:      'var(--gold)',
  },
}

export default function Tag({ children, variant = 'default' }: TagProps) {
  return (
    <span
      style={{
        fontSize:      '10px',
        padding:       '3px 9px',
        borderRadius:  '20px',
        fontWeight:    500,
        letterSpacing: '0.05em',
        fontFamily:    'var(--font-sans)',
        ...styles[variant],
      }}
    >
      {children}
    </span>
  )
}
