import React from 'react'

type Variant = 'primary' | 'gold' | 'outline'
type Size    = 'sm' | 'md'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?:    Size
  fullWidth?: boolean
  children: React.ReactNode
}

const base: React.CSSProperties = {
  display:        'inline-flex',
  alignItems:     'center',
  justifyContent: 'center',
  gap:            '8px',
  borderRadius:   'var(--radius-sm)',
  fontFamily:     'var(--font-sans)',
  fontWeight:     600,
  letterSpacing:  '0.08em',
  textTransform:  'uppercase',
  cursor:         'pointer',
  border:         'none',
  transition:     'all 0.2s',
  whiteSpace:     'nowrap',
}

const sizes: Record<Size, React.CSSProperties> = {
  sm: { padding: '7px 14px', fontSize: '11px' },
  md: { padding: '10px 20px', fontSize: '12px' },
}

const variants: Record<Variant, React.CSSProperties> = {
  primary: { background: 'var(--green-deep)', color: 'var(--gold-light)' },
  gold:    { background: 'var(--gold)',       color: 'var(--green-deep)' },
  outline: { background: 'transparent',      color: 'var(--green-deep)', border: '1px solid var(--cream-dark)' },
}

export default function Button({
  variant   = 'primary',
  size      = 'md',
  fullWidth = false,
  style,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      style={{
        ...base,
        ...sizes[size],
        ...variants[variant],
        ...(fullWidth ? { width: '100%' } : {}),
        ...style,
      }}
    >
      {children}
    </button>
  )
}
