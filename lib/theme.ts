// Greenlit Design System — single source of truth for all tokens.
// Components reference these via CSS variables (var(--token-name)).
// This file provides TypeScript-typed constants for programmatic use.

export const colors = {
  greenDeep:  '#1a2e1a',
  greenMid:   '#2d4a2d',
  greenLight: '#4a7c4a',
  greenMuted: '#6b9e6b',
  cream:      '#f5f0e8',
  creamDark:  '#ede5d4',
  sand:       '#c8b89a',
  gold:       '#c4a84f',
  goldLight:  '#e2c97e',
  white:      '#faf8f4',
  textDark:   '#1a1a1a',
  textMid:    '#4a4a4a',
  textLight:  '#8a8a8a',
} as const

export const fonts = {
  serif: "'Playfair Display', Georgia, serif",
  sans:  "'Jost', system-ui, sans-serif",
} as const

export const radii = {
  sm:   '6px',
  md:   '8px',
  lg:   '12px',
  full: '9999px',
} as const

export const shadows = {
  card:   '0 4px 24px rgba(26,46,26,0.08)',
  subtle: '0 2px 12px rgba(26,46,26,0.06)',
} as const

// CSS variable names — use these when building inline styles
export const cssVars = {
  greenDeep:  'var(--green-deep)',
  greenMid:   'var(--green-mid)',
  greenLight: 'var(--green-light)',
  greenMuted: 'var(--green-muted)',
  cream:      'var(--cream)',
  creamDark:  'var(--cream-dark)',
  sand:       'var(--sand)',
  gold:       'var(--gold)',
  goldLight:  'var(--gold-light)',
  white:      'var(--white)',
  textDark:   'var(--text-dark)',
  textMid:    'var(--text-mid)',
  textLight:  'var(--text-light)',
} as const
